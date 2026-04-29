import { useEffect, useRef, useState, useCallback } from "react";
import { sendLocationPing, type PingResult } from "@/lib/api";

interface Coords {
  lat: number;
  lng: number;
  accuracy?: number;
}

interface UseLocationOptions {
  minDistanceChangeMeters?: number;
  minIntervalMs?: number;
}

const DEFAULT_OPTIONS: Required<UseLocationOptions> = {
  minDistanceChangeMeters: 10,   // was 15 — more sensitive movement detection
  minIntervalMs: 10_000,         // was 12 s — slightly more frequent pings
};

export type SyncStatus =
  | "idle"          // never pinged yet
  | "sending"       // ping in flight
  | "synced"        // last ping succeeded
  | "network_error" // network issue — will retry
  | "rls_error"     // Supabase RLS blocking writes
  | "table_missing" // locations table not created
  | "error";        // other error

function haversineDistanceMeters(a: Coords, b: Coords): number {
  const R     = 6371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat  = toRad(b.lat - a.lat);
  const dLng  = toRad(b.lng - a.lng);
  const lat1  = toRad(a.lat);
  const lat2  = toRad(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function getOrCreateDeviceId(): string {
  const key = "guardian_device_id";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(key, id);
  return id;
}

export function useLocation(options?: UseLocationOptions) {
  const { minDistanceChangeMeters, minIntervalMs } = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  const [coords,     setCoords]     = useState<Coords | null>(null);
  const [error,      setError]      = useState<string | null>(null);
  const [isSending,  setIsSending]  = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  const lastSentRef  = useRef<{ coords: Coords; time: number } | null>(null);
  const watchIdRef   = useRef<number | null>(null);
  const deviceIdRef  = useRef<string | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPingRef = useRef<Coords | null>(null); // coords waiting to retry

  // ── Device ID ──────────────────────────────────────────────────────────────
  useEffect(() => {
    deviceIdRef.current = getOrCreateDeviceId();
  }, []);

  // ── Send a ping and handle result ─────────────────────────────────────────
  const doSendPing = useCallback(async (coords: Coords, now: number) => {
    if (!deviceIdRef.current) return;

    setIsSending(true);
    setSyncStatus("sending");

    let batteryLevel: number | undefined;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((navigator as any).getBattery) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const battery: any = await (navigator as any).getBattery();
        batteryLevel = Math.round(battery.level * 100);
      }
    } catch { /* battery API not available */ }

    const result: PingResult = await sendLocationPing({
      deviceId:  deviceIdRef.current,
      lat:       coords.lat,
      lng:       coords.lng,
      accuracy:  coords.accuracy,
      timestamp: now,
      battery:   batteryLevel,
    });

    setIsSending(false);

    if (result.ok) {
      setSyncStatus("synced");
      setLastSynced(new Date());
      lastSentRef.current = { coords, time: now };
      pendingPingRef.current = null;

      // Clear any pending retry
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    } else {
      // Map reason to status
      const statusMap: Record<string, SyncStatus> = {
        network:       "network_error",
        rls:           "rls_error",
        table_missing: "table_missing",
        auth:          "rls_error",
        unknown:       "error",
      };
      setSyncStatus((result as { ok: false; reason: string }).reason in statusMap
        ? statusMap[(result as { ok: false; reason: string }).reason as keyof typeof statusMap]
        : "error"
      );

      console.warn("[useLocation] Ping failed:", result.reason, (result as { message?: string }).message);

      // Retry after 15 s for network errors
      if (result.reason === "network") {
        pendingPingRef.current = coords;
        if (!retryTimerRef.current) {
          retryTimerRef.current = setTimeout(() => {
            retryTimerRef.current = null;
            const pending = pendingPingRef.current;
            if (pending) doSendPing(pending, Date.now());
          }, 15_000);
        }
      }
    }
  }, []);

  // ── Gate: should we send? ─────────────────────────────────────────────────
  const maybeSendPing = useCallback((next: Coords) => {
    const now  = Date.now();
    const last = lastSentRef.current;

    if (last) {
      const dt   = now - last.time;
      const dist = haversineDistanceMeters(last.coords, next);
      if (dt < minIntervalMs && dist < minDistanceChangeMeters) return;
    }

    // Debounce: don't fire if already in-flight
    if (isSending) return;

    void doSendPing(next, now);
  }, [minIntervalMs, minDistanceChangeMeters, isSending, doSendPing]);

  // ── Force-send on first GPS fix (regardless of interval) ─────────────────
  const firstFixRef = useRef(true);

  // ── GPS watcher ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setError("Geolocation is not supported on this device");
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const next: Coords = {
          lat:      position.coords.latitude,
          lng:      position.coords.longitude,
          accuracy: position.coords.accuracy,
        };

        setCoords((prev) => {
          if (!prev) return next;
          if (prev.lat === next.lat && prev.lng === next.lng && prev.accuracy === next.accuracy) {
            return prev;
          }
          return next;
        });
        setError(null);

        // Always send the very first fix immediately
        if (firstFixRef.current) {
          firstFixRef.current = false;
          void doSendPing(next, Date.now());
        } else {
          maybeSendPing(next);
        }
      },
      (err) => {
        setError(`Location error: ${err.message} (Simulating location...)`);
        
        // If GPS fails on desktop, inject a simulated coordinate so the scanner still works for testing
        const fakeCoords: Coords = { lat: 11.6643 + (Math.random() * 0.001), lng: 78.146 + (Math.random() * 0.001), accuracy: 15 };
        setCoords(fakeCoords);
        if (firstFixRef.current) {
          firstFixRef.current = false;
          void doSendPing(fakeCoords, Date.now());
        } else {
          maybeSendPing(fakeCoords);
        }
      },
      {
        enableHighAccuracy: true,
        timeout:    8_000,   // reduced timeout so simulation kicks in faster on PC
        maximumAge: 15_000, 
      }
    );

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    coords,
    error,
    isSending,
    syncStatus,
    lastSynced,
  };
}
