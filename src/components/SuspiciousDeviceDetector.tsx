import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle, Radio, Users, RefreshCw, Loader2,
  WifiOff, ShieldCheck, Eye, X, Zap, BellRing,
} from "lucide-react";
import { useLocation } from "@/hooks/use-location";
import { fetchNearbyUsers } from "@/lib/api";
import {
  fireAlert as sendAlert,
  requestNotificationPermission,
} from "@/lib/alertNotify";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Real-world detection radius */
const RADAR_RANGE_M      = 10;
/** Canvas dimensions */
const RADAR_SIZE         = 260;
const RADAR_RADIUS_PX    = 114;
/** px per real metre, so 10 m fills the whole circle */
const PX_PER_METRE       = RADAR_RADIUS_PX / RADAR_RANGE_M;
/** Supabase poll cadence */
const POLL_INTERVAL_MS   = 3_000;
/** Dwell thresholds */
const WATCH_MS           = 2 * 60_000;   // 2 min → "Watching"
const SUSPECT_MS         = 5 * 60_000;   // 5 min → "Suspicious"
/** Closing speed that triggers a fast-approach alert (m/s) */
const FAST_APPROACH_MPS  = 1.5;          // ≈ 5.4 km/h (faster than brisk walk)

// ─── Types ────────────────────────────────────────────────────────────────────

type ThreatLevel = "new" | "watching" | "suspicious";
type AlertKind   = "suspicious" | "fast_approach";

interface TrackedDevice {
  id:               string;
  label:            string;
  distanceM:        number;
  offsetX:          number;
  offsetY:          number;
  threatLevel:      ThreatLevel;
  seenForMs:        number;
  closingSpeedMps:  number;   // positive = approaching you
  updatedAt:        string;
}

interface AlertEntry {
  id:               string;
  kind:             AlertKind;
  label:            string;
  distanceM:        number;
  closingSpeedMps?: number;
  time:             Date;
}

// ─── Colours ─────────────────────────────────────────────────────────────────

const THREAT_COLORS: Record<ThreatLevel, string> = {
  new:        "#22c55e",
  watching:   "#f59e0b",
  suspicious: "#ef4444",
};

// ─── Geo helpers ──────────────────────────────────────────────────────────────

function haversineMeters(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R    = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a    =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function bearingRad(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLng  = toRad(lng2 - lng1);
  const y     = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x     =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return Math.atan2(y, x); // 0 = North
}

function shortLabel(deviceId: string): string {
  return `DEV-${deviceId.replace(/-/g, "").toUpperCase().slice(0, 4)}`;
}

function fmtDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

// (beep + vibration handled by alertNotify.ts)

// ─── Radar canvas hook ────────────────────────────────────────────────────────

function useRadarSweep(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  devices:   TrackedDevice[],
) {
  const angleRef = useRef(0);
  const rafRef   = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cx = RADAR_SIZE / 2;
    const cy = RADAR_SIZE / 2;

    function draw() {
      ctx!.clearRect(0, 0, RADAR_SIZE, RADAR_SIZE);

      // ── Background circle ──
      ctx!.beginPath();
      ctx!.arc(cx, cy, RADAR_RADIUS_PX, 0, Math.PI * 2);
      ctx!.fillStyle = "rgba(15,23,42,0.97)";
      ctx!.fill();

      // ── Concentric rings (danger zone markers) ──
      [0.33, 0.66, 1].forEach((f, idx) => {
        ctx!.beginPath();
        ctx!.arc(cx, cy, RADAR_RADIUS_PX * f, 0, Math.PI * 2);
        ctx!.strokeStyle = f === 1 ? "rgba(239,68,68,0.40)" : "rgba(99,102,241,0.18)";
        ctx!.lineWidth   = f === 1 ? 1.5 : 1;
        ctx!.stroke();
        // metre labels on right side
        const r     = RADAR_RADIUS_PX * f;
        const label = ["~3 m", "~7 m", "10 m"][idx];
        ctx!.fillStyle = "rgba(148,163,184,0.45)";
        ctx!.font      = "7px monospace";
        ctx!.fillText(label, cx + r + 3, cy - 2);
      });

      // ── Cross-hairs ──
      ctx!.strokeStyle = "rgba(99,102,241,0.14)";
      ctx!.lineWidth   = 1;
      [0, Math.PI / 2].forEach((a) => {
        ctx!.beginPath();
        ctx!.moveTo(cx + Math.cos(a) * RADAR_RADIUS_PX, cy + Math.sin(a) * RADAR_RADIUS_PX);
        ctx!.lineTo(cx - Math.cos(a) * RADAR_RADIUS_PX, cy - Math.sin(a) * RADAR_RADIUS_PX);
        ctx!.stroke();
      });

      // ── Sweep wedge ──
      const swp = angleRef.current;
      for (let s = 0; s < 32; s++) {
        const frac   = s / 32;
        const startA = swp - frac * (Math.PI / 2);
        const endA   = startA + Math.PI / 32;
        ctx!.beginPath();
        ctx!.moveTo(cx, cy);
        ctx!.arc(cx, cy, RADAR_RADIUS_PX, startA, endA);
        ctx!.closePath();
        ctx!.fillStyle = `rgba(99,102,241,${0.28 * (1 - frac)})`;
        ctx!.fill();
      }
      // Sweep line
      ctx!.beginPath();
      ctx!.moveTo(cx, cy);
      ctx!.lineTo(cx + Math.cos(swp) * RADAR_RADIUS_PX, cy + Math.sin(swp) * RADAR_RADIUS_PX);
      ctx!.strokeStyle = "rgba(129,140,248,0.9)";
      ctx!.lineWidth   = 2;
      ctx!.stroke();

      // ── Centre (self) dot ──
      ctx!.beginPath();
      ctx!.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx!.fillStyle = "#818cf8";
      ctx!.fill();
      ctx!.beginPath();
      ctx!.arc(cx, cy, 9, 0, Math.PI * 2);
      ctx!.strokeStyle = "rgba(129,140,248,0.40)";
      ctx!.lineWidth   = 2;
      ctx!.stroke();

      // ── Device dots ──
      devices.forEach((d) => {
        const dx  = cx + d.offsetX;
        const dy  = cy + d.offsetY;
        const col = THREAT_COLORS[d.threatLevel];
        const isFast = d.closingSpeedMps >= FAST_APPROACH_MPS;

        // Pulsing outer halo for suspicious / fast approach
        if (d.threatLevel === "suspicious" || isFast) {
          const pulse = 10 + Math.sin(angleRef.current * 5) * 4;
          ctx!.beginPath();
          ctx!.arc(dx, dy, pulse, 0, Math.PI * 2);
          ctx!.strokeStyle = "#ef4444" + "33";
          ctx!.lineWidth   = 2;
          ctx!.stroke();
        }
        // Mid ring
        ctx!.beginPath();
        ctx!.arc(dx, dy, 8, 0, Math.PI * 2);
        ctx!.strokeStyle = col + "55";
        ctx!.lineWidth   = 1.5;
        ctx!.stroke();
        // Fill dot
        ctx!.beginPath();
        ctx!.arc(dx, dy, 5, 0, Math.PI * 2);
        ctx!.fillStyle = col;
        ctx!.fill();
        // Approach arrow (line from dot toward centre if closing fast)
        if (isFast) {
          const ratio = 0.4;
          ctx!.beginPath();
          ctx!.moveTo(dx, dy);
          ctx!.lineTo(dx + (cx - dx) * ratio, dy + (cy - dy) * ratio);
          ctx!.strokeStyle = "#f97316cc";
          ctx!.lineWidth   = 2;
          ctx!.stroke();
        }
      });

      // ── Outer border ──
      ctx!.beginPath();
      ctx!.arc(cx, cy, RADAR_RADIUS_PX, 0, Math.PI * 2);
      ctx!.strokeStyle = "rgba(239,68,68,0.30)";
      ctx!.lineWidth   = 2;
      ctx!.stroke();

      angleRef.current += 0.025;
      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [devices, canvasRef]);
}

// ─── Main Component ───────────────────────────────────────────────────────────

const SuspiciousDeviceDetector = () => {
  const { coords } = useLocation();
  const canvasRef  = useRef<HTMLCanvasElement>(null);

  // Persistent per-device tracking (lives in memory; resets on page reload)
  const firstSeenMap = useRef<Map<string, number>>(new Map());
  const prevDistMap  = useRef<Map<string, { distM: number; time: number }>>(new Map());
  // Alert de-dupe: prevents re-firing the same alert within 60 s
  const alertedSet   = useRef<Set<string>>(new Set());
  // User-dismissed devices (cleared on reload)
  const dismissedSet = useRef<Set<string>>(new Set());

  const [devices,     setDevices]     = useState<TrackedDevice[]>([]);
  const [alerts,      setAlerts]      = useState<AlertEntry[]>([]);
  const [isLoading,   setIsLoading]   = useState(false);
  const [fetchError,  setFetchError]  = useState<string | null>(null);
  // ── Request notification permission once on mount (works on APK too) ──
  useEffect(() => {
    requestNotificationPermission().catch(() => {/* ignore */});
  }, []);

  // ── Fire a single alert (de-duped inside alertNotify, also push to log) ─
  const fireAlert = useCallback((entry: AlertEntry) => {
    // Push to in-app alert log (local de-dup via alertedSet)
    const key = `${entry.id}-${entry.kind}`;
    if (alertedSet.current.has(key)) return;
    alertedSet.current.add(key);
    setTimeout(() => alertedSet.current.delete(key), 60_000);

    setAlerts((prev) => [entry, ...prev].slice(0, 25));

    // Cross-platform: APK → LocalNotification, Browser → Web Notification
    sendAlert({
      dedupeKey:       key,
      title:           entry.kind === "fast_approach"
        ? `⚡ Fast Approach — ${entry.label}`
        : `🚨 Suspicious Device — ${entry.label}`,
      body:            entry.kind === "fast_approach"
        ? `Closing at ${entry.closingSpeedMps?.toFixed(1)} m/s — ${entry.distanceM.toFixed(1)} m away!`
        : `${entry.label} has been within 10 m for 5+ min`,
      vibrationPattern: entry.kind === "fast_approach"
        ? [200, 100, 200, 100, 500]
        : [300, 150, 300, 150, 600],
      beepFreq:  entry.kind === "fast_approach" ? 1100 : 880,
      beepTimes: entry.kind === "fast_approach" ? 4 : 3,
      cooldownMs: 60_000,
    });
  }, []);

  // ── Poll Supabase ──────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    if (!coords) return;
    setIsLoading(true);
    setFetchError(null);
    try {
      const now   = Date.now();
      const users = await fetchNearbyUsers({
        lat:          coords.lat,
        lng:          coords.lng,
        radiusMeters: RADAR_RANGE_M,
        limit:        50,
      });

      const tracked: TrackedDevice[] = [];

      for (const u of users) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const row = u as any;
        if (row.latitude == null || row.longitude == null) continue;
        if (dismissedSet.current.has(u.deviceId)) continue;

        // Distance + canvas projection
        const distM   = haversineMeters(coords.lat, coords.lng, row.latitude, row.longitude);
        if (distM > RADAR_RANGE_M) continue; // outside zone
        const bearing = bearingRad(coords.lat, coords.lng, row.latitude, row.longitude);
        const angle   = bearing - Math.PI / 2; // canvas: 0 = right, North = up
        const px      = Math.min(distM * PX_PER_METRE, RADAR_RADIUS_PX * 0.95);

        // First-seen tracking
        if (!firstSeenMap.current.has(u.deviceId)) {
          firstSeenMap.current.set(u.deviceId, now);
        }
        const seenForMs = now - (firstSeenMap.current.get(u.deviceId) ?? now);

        // Closing speed (positive = moving toward you)
        const prev    = prevDistMap.current.get(u.deviceId);
        let closingSpeedMps = 0;
        if (prev) {
          const dt = (now - prev.time) / 1000; // seconds
          if (dt > 0) closingSpeedMps = (prev.distM - distM) / dt;
        }
        prevDistMap.current.set(u.deviceId, { distM, time: now });

        // Threat classification
        let threatLevel: ThreatLevel = "new";
        if (seenForMs >= SUSPECT_MS) threatLevel = "suspicious";
        else if (seenForMs >= WATCH_MS) threatLevel = "watching";

        const device: TrackedDevice = {
          id:              u.deviceId,
          label:           shortLabel(u.deviceId),
          distanceM:       distM,
          offsetX:         Math.cos(angle) * px,
          offsetY:         Math.sin(angle) * px,
          threatLevel,
          seenForMs,
          closingSpeedMps,
          updatedAt:       u.updatedAt,
        };
        tracked.push(device);

        // Fast-approach alert
        if (closingSpeedMps >= FAST_APPROACH_MPS) {
          fireAlert({
            id:              u.deviceId,
            kind:            "fast_approach",
            label:           device.label,
            distanceM,
            closingSpeedMps,
            time:            new Date(),
          });
        }

        // Suspicious-dwell alert
        if (threatLevel === "suspicious") {
          fireAlert({
            id:       u.deviceId,
            kind:     "suspicious",
            label:    device.label,
            distanceM,
            time:     new Date(),
          });
        }
      }

      // Sort: suspicious → watching → new; ties broken by longest dwell
      const ORDER: Record<ThreatLevel, number> = { suspicious: 0, watching: 1, new: 2 };
      tracked.sort(
        (a, b) => ORDER[a.threatLevel] - ORDER[b.threatLevel] || b.seenForMs - a.seenForMs,
      );
      setDevices(tracked);
    } catch (err) {
      console.error("SuspiciousDeviceDetector poll error", err);
      const msg = err instanceof Error ? err.message : "Unknown error";
      setFetchError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [coords, fireAlert]);

  // Auto-poll
  useEffect(() => {
    if (!coords) return;
    refresh();
    const id = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [coords, refresh]);

  useRadarSweep(canvasRef, devices);

  // ── Derived stats ──────────────────────────────────────────────────────
  const suspiciousCount = devices.filter((d) => d.threatLevel === "suspicious").length;
  const watchingCount   = devices.filter((d) => d.threatLevel === "watching").length;
  const newCount        = devices.filter((d) => d.threatLevel === "new").length;
  const fastApproach    = devices.filter((d) => d.closingSpeedMps >= FAST_APPROACH_MPS);
  const hasThreat       = suspiciousCount > 0 || fastApproach.length > 0;

  const dismiss = (id: string) => {
    dismissedSet.current.add(id);
    firstSeenMap.current.delete(id);
    prevDistMap.current.delete(id);
    setDevices((prev) => prev.filter((d) => d.id !== id));
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">

      {/* ═══ Global threat banner ═══════════════════════════════════════ */}
      <AnimatePresence>
        {hasThreat && (
          <motion.div
            key="threat-banner"
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.97 }}
            transition={{ duration: 0.35 }}
            className="flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-md"
            style={{
              background: "rgba(69,10,10,0.7)",
              borderColor: "rgba(239,68,68,0.55)",
              boxShadow: "0 0 28px rgba(239,68,68,0.35), inset 0 1px 0 rgba(255,255,255,0.04)",
            }}
          >
            <Zap className="w-5 h-5 text-red-400 flex-shrink-0 animate-pulse" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-red-300 tracking-wide">
                {fastApproach.length > 0 ? "⚡ FAST APPROACH DETECTED" : "⚠ SUSPICIOUS DEVICE ALERT"}
              </p>
              <p className="text-[11px] text-red-400/80 truncate">
                {fastApproach.length > 0
                  ? `${fastApproach[0].label} closing at ${fastApproach[0].closingSpeedMps.toFixed(1)} m/s — ${fastApproach[0].distanceM.toFixed(1)} m away`
                  : `${suspiciousCount} device${suspiciousCount > 1 ? "s" : ""} within 10 m for 5+ minutes`}
              </p>
            </div>
            <BellRing className="w-4 h-4 text-red-400 animate-bounce flex-shrink-0" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Main card ══════════════════════════════════════════════════ */}
      <div className="glass-card p-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle
              className={`w-4 h-4 ${hasThreat ? "text-red-400 animate-pulse" : "text-primary"}`}
            />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Threat Detector
            </h3>
            <span
              className={`text-[9px] px-1.5 py-0.5 rounded font-bold tracking-wide border ${
                hasThreat
                  ? "bg-red-500/20 text-red-400 border-red-500/30 animate-pulse"
                  : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
              }`}
            >
              {hasThreat ? "ALERT" : "LIVE"}
            </span>
            <span className="text-[9px] text-muted-foreground/50 font-mono">
              ±10 m · 3 s scan
            </span>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={isLoading || !coords}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
          >
            {isLoading
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <RefreshCw className="w-3 h-3" />}
            Scan
          </button>
        </div>

        {/* Radar + right panel */}
        <div className="flex flex-col md:flex-row gap-5 items-center md:items-start">

          {/* ── Radar canvas ── */}
          <div className="relative flex-shrink-0">
            <canvas
              ref={canvasRef}
              width={RADAR_SIZE}
              height={RADAR_SIZE}
              className="rounded-full transition-all duration-500"
              style={{
                border: hasThreat
                  ? "2px solid rgba(239,68,68,0.65)"
                  : "1px solid rgba(99,102,241,0.30)",
                boxShadow: hasThreat
                  ? "0 0 32px rgba(239,68,68,0.35)"
                  : "0 4px 24px rgba(99,102,241,0.12)",
              }}
            />
            {/* Compass */}
            <span className="absolute top-2 left-1/2 -translate-x-1/2 text-[9px] text-primary/55 font-mono">N</span>
            <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[9px] text-primary/55 font-mono">S</span>
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] text-primary/55 font-mono">W</span>
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-primary/55 font-mono">E</span>
            {/* Zone label */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[9px] font-mono bg-black/60 px-2 py-0.5 rounded border border-red-500/25 text-red-400/70">
              10 m danger zone
            </div>
          </div>

          {/* ── Right panel ── */}
          <div className="flex-1 w-full space-y-4">

            {/* GPS anchor */}
            {coords ? (
              <div className="text-[10px] text-muted-foreground font-mono bg-secondary/30 px-3 py-2 rounded-lg border border-primary/10">
                <span className="text-primary/70">You: </span>
                {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
              </div>
            ) : (
              <div className="text-[10px] text-muted-foreground/70 font-mono bg-secondary/20 px-3 py-2 rounded-lg border border-primary/10 italic">
                Waiting for GPS fix…
              </div>
            )}

            {/* Error + setup guide */}
            {fetchError && (
              <div className="space-y-2">
                <div className="flex items-start gap-2 text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">
                  <WifiOff className="w-3 h-3 flex-shrink-0 mt-0.5" />
                  <span className="break-all">{fetchError}</span>
                </div>
                {/* Show SQL setup guide if table is missing */}
                {(fetchError.includes("table not found") || fetchError.includes("42P01") || fetchError.includes("does not exist")) && (
                  <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 space-y-2">
                    <p className="text-[10px] font-semibold text-amber-400">⚙ Supabase Setup Required</p>
                    <p className="text-[10px] text-muted-foreground">Run this SQL in your Supabase SQL Editor:</p>
                    <pre className="text-[9px] text-emerald-400/80 bg-black/40 p-2 rounded overflow-x-auto whitespace-pre-wrap">
{`CREATE TABLE IF NOT EXISTS public.locations (
  device_id TEXT PRIMARY KEY,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  accuracy DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  battery INTEGER,
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON public.locations
  FOR ALL TO anon USING (true) WITH CHECK (true);`}
                    </pre>
                  </div>
                )}
                {(fetchError.includes("RLS") || fetchError.includes("PGRST301") || fetchError.includes("42501")) && (
                  <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 space-y-1">
                    <p className="text-[10px] font-semibold text-amber-400">🔒 RLS Policy Missing</p>
                    <pre className="text-[9px] text-emerald-400/80 bg-black/40 p-2 rounded overflow-x-auto whitespace-pre-wrap">
{`CREATE POLICY "anon_all" ON public.locations
  FOR ALL TO anon USING (true) WITH CHECK (true);`}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* Threat-level badges */}
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: "Suspicious", count: suspiciousCount, color: "text-red-400",     bg: "bg-red-500/10 border-red-500/20" },
                { label: "Watching",   count: watchingCount,   color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/20" },
                { label: "New",        count: newCount,         color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
              ].map(({ label, count, color, bg }) => (
                <div key={label} className={`rounded-lg border p-2 ${bg}`}>
                  <p className={`text-lg font-bold ${color}`}>{count}</p>
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
              {[
                { dot: "#22c55e", label: "New (<2 min)" },
                { dot: "#f59e0b", label: "Watching (2–5 min)" },
                { dot: "#ef4444", label: "Suspicious (5+ min)" },
              ].map(({ dot, label }) => (
                <span key={label} className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dot }} />
                  {label}
                </span>
              ))}
            </div>

            {/* Device list */}
            <div className="max-h-[200px] overflow-y-auto space-y-1.5 pr-1">
              <AnimatePresence mode="popLayout">
                {devices.map((d) => {
                  const isFast   = d.closingSpeedMps >= FAST_APPROACH_MPS;
                  const dotColor = THREAT_COLORS[d.threatLevel];
                  return (
                    <motion.div
                      key={d.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 8 }}
                      transition={{ duration: 0.3 }}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg border text-[11px] ${
                        d.threatLevel === "suspicious" || isFast
                          ? "bg-red-950/40 border-red-500/30"
                          : d.threatLevel === "watching"
                          ? "bg-amber-950/30 border-amber-500/20"
                          : "bg-secondary/25 border-white/5"
                      }`}
                    >
                      {/* Left side */}
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ background: dotColor, boxShadow: `0 0 6px ${dotColor}88` }}
                        />
                        <span className="font-mono text-foreground/80 truncate">{d.label}</span>
                        {isFast && (
                          <span className="text-[9px] bg-orange-500/20 text-orange-400 border border-orange-500/30 px-1 rounded font-bold whitespace-nowrap">
                            ⚡ FAST
                          </span>
                        )}
                        {d.threatLevel === "suspicious" && !isFast && (
                          <span className="text-[9px] bg-red-500/20 text-red-400 border border-red-500/30 px-1 rounded font-bold">
                            TAIL
                          </span>
                        )}
                      </div>

                      {/* Right side */}
                      <div className="flex items-center gap-1.5 text-muted-foreground flex-shrink-0 ml-2">
                        <span className="font-mono text-[11px]">{d.distanceM.toFixed(1)} m</span>
                        {d.closingSpeedMps > 0.3 && (
                          <span className="text-orange-400 font-mono">
                            ↓{d.closingSpeedMps.toFixed(1)} m/s
                          </span>
                        )}
                        <span className="text-primary/25">·</span>
                        <Eye className="w-2.5 h-2.5 opacity-50" />
                        <span className="text-[10px]">{fmtDuration(d.seenForMs)}</span>
                        <button
                          onClick={() => dismiss(d.id)}
                          title="Mark safe / dismiss"
                          className="ml-1 opacity-35 hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {/* Empty state */}
              {devices.length === 0 && coords && !isLoading && !fetchError && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center gap-2 py-5 text-center"
                >
                  <ShieldCheck className="w-7 h-7 text-emerald-400/50" />
                  <p className="text-xs text-muted-foreground">No devices within 10 m</p>
                  <p className="text-[10px] text-muted-foreground/40">
                    Scanning every 3 s · GPS accuracy ±5–15 m
                  </p>
                </motion.div>
              )}

              {!coords && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Enable GPS to start threat scanning
                </p>
              )}
            </div>

            {/* Footer count */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Radio className="w-3 h-3 text-primary/50 animate-pulse" />
              <span>
                {coords
                  ? `${devices.length} device${devices.length !== 1 ? "s" : ""} in danger zone`
                  : "Awaiting GPS…"}
              </span>
            </div>
          </div>
        </div>

        {/* ═══ Alert log ═══════════════════════════════════════════════ */}
        <AnimatePresence>
          {alerts.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="border-t border-white/5 pt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                    Alert Log
                  </p>
                  <button
                    onClick={() => setAlerts([])}
                    className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                  >
                    Clear all
                  </button>
                </div>
                <div className="max-h-[130px] overflow-y-auto space-y-1.5 pr-1">
                  {alerts.map((a, i) => (
                    <div
                      key={`${a.id}-${i}`}
                      className={`flex items-start gap-2 text-[11px] px-3 py-1.5 rounded-lg border ${
                        a.kind === "fast_approach"
                          ? "bg-orange-950/30 border-orange-500/20"
                          : "bg-red-950/30 border-red-500/20"
                      }`}
                    >
                      <span className="flex-shrink-0 mt-0.5">
                        {a.kind === "fast_approach" ? "⚡" : "🚨"}
                      </span>
                      <div className="flex-1 min-w-0 text-muted-foreground">
                        <span className="font-mono text-foreground/70">{a.label}</span>
                        {" "}—{" "}
                        {a.kind === "fast_approach"
                          ? `Closing at ${a.closingSpeedMps?.toFixed(1)} m/s · ${a.distanceM.toFixed(1)} m away`
                          : `Within 10 m for 5+ min (possible tail)`}
                      </div>
                      <span className="flex-shrink-0 text-[10px] text-muted-foreground/40">
                        {a.time.toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
};

export default SuspiciousDeviceDetector;
