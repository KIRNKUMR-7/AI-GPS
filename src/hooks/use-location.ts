import { useEffect, useRef, useState } from "react";
import { sendLocationPing } from "@/lib/api";

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
  minDistanceChangeMeters: 15,
  minIntervalMs: 12_000,
};

function haversineDistanceMeters(a: Coords, b: Coords): number {
  const R = 6371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);

  const h =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;

  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
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

  const [coords, setCoords] = useState<Coords | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const lastSentRef = useRef<{ coords: Coords; time: number } | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const deviceIdRef = useRef<string | null>(null);

  useEffect(() => {
    deviceIdRef.current = getOrCreateDeviceId();

    if (!("geolocation" in navigator)) {
      setError("Geolocation is not supported on this device");
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const next: Coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
        setCoords((prev) => {
          if (!prev) return next;
          if (
            prev.lat === next.lat &&
            prev.lng === next.lng &&
            prev.accuracy === next.accuracy
          ) {
            return prev;
          }
          return next;
        });
        setError(null);

        void maybeSendPing(next);
      },
      (err) => {
        setError(`Location error: ${err.message}`);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 30000,
      }
    );

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const maybeSendPing = async (next: Coords) => {
    const now = Date.now();
    const last = lastSentRef.current;

    if (last) {
      const dt = now - last.time;
      const dist = haversineDistanceMeters(last.coords, next);

      if (dt < minIntervalMs && dist < minDistanceChangeMeters) {
        return;
      }
    }

    if (!deviceIdRef.current) return;

    try {
      let batteryLevel: number | undefined;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((navigator as any).getBattery) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const battery: any = await (navigator as any).getBattery();
          batteryLevel = Math.round(battery.level * 100);
        } catch { }
      }

      setIsSending(true);
      await sendLocationPing({
        deviceId: deviceIdRef.current,
        lat: next.lat,
        lng: next.lng,
        accuracy: next.accuracy,
        timestamp: now,
        battery: batteryLevel,
      });
      lastSentRef.current = { coords: next, time: now };
    } catch (err) {
      console.error("Failed to send location ping", err);
    } finally {
      setIsSending(false);
    }
  };

  return {
    coords,
    error,
    isSending,
  };
}

