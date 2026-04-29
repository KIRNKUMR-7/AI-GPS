/**
 * alertNotify.ts
 *
 * Unified alert dispatcher for Guardian Angel.
 * - On Android APK (Capacitor): uses @capacitor/local-notifications → real system tray notification
 * - On browser/web: falls back to the Web Notification API
 * - Always attempts navigator.vibrate() and a Web Audio beep regardless of platform
 */

import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

// ── Auto-incrementing notification ID (must be a positive integer for Android) ──
let _notifId = 1;
const nextId = () => _notifId++;

// ── Alert de-dup: key → expiry timestamp ──────────────────────────────────────
const _sent = new Map<string, number>();

/** Returns true if this key was NOT recently sent (and records it if not). */
function shouldFire(key: string, cooldownMs = 60_000): boolean {
  const now = Date.now();
  const last = _sent.get(key);
  if (last && now - last < cooldownMs) return false;
  _sent.set(key, now);
  return true;
}

// ── Web Audio beep ────────────────────────────────────────────────────────────
export function playAlertBeep(freq = 880, duration = 0.25, times = 3) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    for (let i = 0; i < times; i++) {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "square";
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.45;
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
      osc.start(t);
      osc.stop(t + duration + 0.02);
    }
    setTimeout(() => ctx.close(), times * 450 + 500);
  } catch { /** silent – AudioContext blocked */ }
}

// ── Vibration ─────────────────────────────────────────────────────────────────
export function vibrate(pattern: number[]) {
  try { navigator.vibrate?.(pattern); } catch { /** ignore */ }
}

// ── Request permissions (call once on component mount) ────────────────────────
export async function requestNotificationPermission(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    // Android / iOS native
    const granted = await LocalNotifications.requestPermissions();
    return granted.display === "granted";
  } else {
    // Browser
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    const result = await Notification.requestPermission();
    return result === "granted";
  }
}

// ── Main fire function ────────────────────────────────────────────────────────

export interface AlertPayload {
  /** Unique key for de-duplication (e.g. "dev-ABCD-fast_approach") */
  dedupeKey: string;
  /** Notification title */
  title: string;
  /** Notification body */
  body: string;
  /** Cooldown before the same key can fire again (default 60 s) */
  cooldownMs?: number;
  /** Vibration pattern (ms on, ms off, …) */
  vibrationPattern?: number[];
  /** Beep frequency in Hz (0 = no beep) */
  beepFreq?: number;
  /** Number of beep bursts */
  beepTimes?: number;
}

export async function fireAlert(payload: AlertPayload): Promise<void> {
  const {
    dedupeKey,
    title,
    body,
    cooldownMs = 60_000,
    vibrationPattern = [300, 150, 300],
    beepFreq = 880,
    beepTimes = 3,
  } = payload;

  if (!shouldFire(dedupeKey, cooldownMs)) return;

  // ── Notification ────────────────────────────────────────────────────
  if (Capacitor.isNativePlatform()) {
    // ✅ Real Android system notification in status bar
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id:       nextId(),
            title,
            body,
            sound:    "default",
            // Android-specific: make it heads-up (pops over other apps)
            extra:    { priority: "high" },
          },
        ],
      });
    } catch (e) {
      console.warn("LocalNotifications.schedule failed", e);
    }
  } else {
    // Browser fallback
    if ("Notification" in window && Notification.permission === "granted") {
      try { new Notification(title, { body }); } catch { /** ignore */ }
    }
  }

  // ── Vibration ───────────────────────────────────────────────────────
  vibrate(vibrationPattern);

  // ── Beep ────────────────────────────────────────────────────────────
  if (beepFreq > 0) playAlertBeep(beepFreq, 0.25, beepTimes);
}
