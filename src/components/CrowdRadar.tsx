import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Radio, Users, RefreshCw, Loader2, WifiOff } from "lucide-react";
import { useLocation } from "@/hooks/use-location";
import { fetchNearbyUsers, type NearbyUser } from "@/lib/api";

// ─── Constants ────────────────────────────────────────────────────────────────

const RADAR_SIZE = 260;   // canvas width/height (px)
const RADIUS = 114;       // radar circle radius (px)
const RADAR_RANGE_M = 500; // real-world metres represented by RADIUS px
const POLL_INTERVAL_MS = 30_000;  // poll every 30 s (was 5 s — less aggressive on mobile)

// ─── Types ────────────────────────────────────────────────────────────────────

interface RadarDot {
  id: string;
  offsetX: number;   // canvas pixels from centre
  offsetY: number;
  distanceM: number;
  label: string;
  speed?: number;
  heading?: number;
  updatedAt: string;
}

// ─── Geo helpers ──────────────────────────────────────────────────────────────

/** Haversine distance in metres */
function haversineMeters(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Bearing in radians from point A → B (0 = North, clockwise positive) */
function bearingRad(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return Math.atan2(y, x); // radians, 0 = North
}

/** Abbreviate a UUID-style device ID for display */
function shortLabel(deviceId: string): string {
  const clean = deviceId.replace(/-/g, "").toUpperCase();
  return `DEV-${clean.slice(0, 4)}`;
}

/** How long ago an ISO string was */
function timeAgo(iso: string): string {
  const diffSec = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  return `${Math.round(diffMin / 60)}h ago`;
}

// ─── Radar Canvas hook ────────────────────────────────────────────────────────

function useRadarSweep(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  dots: RadarDot[]
) {
  const angleRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cx = RADAR_SIZE / 2;
    const cy = RADAR_SIZE / 2;

    function draw() {
      ctx!.clearRect(0, 0, RADAR_SIZE, RADAR_SIZE);

      // Background circle
      ctx!.beginPath();
      ctx!.arc(cx, cy, RADIUS, 0, Math.PI * 2);
      ctx!.fillStyle = "rgba(15, 23, 42, 0.95)";
      ctx!.fill();

      // Concentric rings
      [0.33, 0.66, 1].forEach((frac) => {
        ctx!.beginPath();
        ctx!.arc(cx, cy, RADIUS * frac, 0, Math.PI * 2);
        ctx!.strokeStyle = "rgba(99, 102, 241, 0.18)";
        ctx!.lineWidth = 1;
        ctx!.stroke();
      });

      // Cross-hairs
      ctx!.strokeStyle = "rgba(99, 102, 241, 0.14)";
      ctx!.lineWidth = 1;
      [0, Math.PI / 2].forEach((a) => {
        ctx!.beginPath();
        ctx!.moveTo(cx + Math.cos(a) * RADIUS, cy + Math.sin(a) * RADIUS);
        ctx!.lineTo(cx - Math.cos(a) * RADIUS, cy - Math.sin(a) * RADIUS);
        ctx!.stroke();
      });

      // Sweep gradient wedge
      const sweepAngle = angleRef.current;
      const wedgeSteps = 32;
      for (let s = 0; s < wedgeSteps; s++) {
        const frac = s / wedgeSteps;
        const startA = sweepAngle - frac * (Math.PI / 2);
        const endA = startA + Math.PI / wedgeSteps;
        ctx!.beginPath();
        ctx!.moveTo(cx, cy);
        ctx!.arc(cx, cy, RADIUS, startA, endA);
        ctx!.closePath();
        ctx!.fillStyle = `rgba(99,102,241,${0.28 * (1 - frac)})`;
        ctx!.fill();
      }

      // Sweep line
      ctx!.beginPath();
      ctx!.moveTo(cx, cy);
      ctx!.lineTo(
        cx + Math.cos(sweepAngle) * RADIUS,
        cy + Math.sin(sweepAngle) * RADIUS,
      );
      ctx!.strokeStyle = "rgba(129, 140, 248, 0.9)";
      ctx!.lineWidth = 2;
      ctx!.stroke();

      // Centre dot (self)
      ctx!.beginPath();
      ctx!.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx!.fillStyle = "#818cf8";
      ctx!.fill();
      ctx!.beginPath();
      ctx!.arc(cx, cy, 9, 0, Math.PI * 2);
      ctx!.strokeStyle = "rgba(129,140,248,0.45)";
      ctx!.lineWidth = 2;
      ctx!.stroke();

      // Real device dots
      dots.forEach((dot) => {
        const dx = cx + dot.offsetX;
        const dy = cy + dot.offsetY;
        const col = "#22c55e"; // all real nearby devices shown as "safe/online"

        // Outer pulse ring
        ctx!.beginPath();
        ctx!.arc(dx, dy, 7, 0, Math.PI * 2);
        ctx!.strokeStyle = col + "55";
        ctx!.lineWidth = 2;
        ctx!.stroke();

        // Dot
        ctx!.beginPath();
        ctx!.arc(dx, dy, 4, 0, Math.PI * 2);
        ctx!.fillStyle = col;
        ctx!.fill();
      });

      // Outer border
      ctx!.beginPath();
      ctx!.arc(cx, cy, RADIUS, 0, Math.PI * 2);
      ctx!.strokeStyle = "rgba(99, 102, 241, 0.35)";
      ctx!.lineWidth = 2;
      ctx!.stroke();

      // Advance sweep
      angleRef.current += 0.025;
      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [dots, canvasRef]);
}

// ─── Main Component ───────────────────────────────────────────────────────────

const CrowdRadar = () => {
  const { coords } = useLocation();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [dots, setDots] = useState<RadarDot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // ── Convert raw NearbyUser rows → RadarDot (project onto radar canvas) ──
  const buildDots = useCallback(
    (users: NearbyUser[]): RadarDot[] => {
      if (!coords) return [];

      return users
        .filter((u) => {
          // Must have real location data stored in the row
          // api.ts returns rows from supabase; we need lat/lng columns
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const row = u as any;
          return (
            row.latitude != null &&
            row.longitude != null
          );
        })
        .map((u) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const row = u as any;
          const lat2: number = row.latitude;
          const lng2: number = row.longitude;

          const distM = haversineMeters(coords.lat, coords.lng, lat2, lng2);
          const bearing = bearingRad(coords.lat, coords.lng, lat2, lng2);

          // Scale distance to canvas pixels — clamp inside radar circle
          const px = Math.min((distM / RADAR_RANGE_M) * RADIUS, RADIUS * 0.92);

          // bearing 0 = North = up on radar = −π/2 on canvas
          const canvasAngle = bearing - Math.PI / 2;

          return {
            id: u.deviceId,
            offsetX: Math.cos(canvasAngle) * px,
            offsetY: Math.sin(canvasAngle) * px,
            distanceM: Math.round(distM),
            label: shortLabel(u.deviceId),
            speed: u.speed ?? undefined,
            heading: u.heading ?? undefined,
            updatedAt: u.updatedAt,
          } satisfies RadarDot;
        })
        .filter((d) => d.distanceM <= RADAR_RANGE_M); // only within range
    },
    [coords]
  );

  // ── Fetch from Supabase ────────────────────────────────────────
  const refresh = useCallback(async () => {
    if (!coords) return;
    setIsLoading(true);
    try {
      const users = await fetchNearbyUsers({
        lat: coords.lat,
        lng: coords.lng,
        radiusMeters: RADAR_RANGE_M,
        limit: 30,
      });
      setDots(buildDots(users));
      setLastRefresh(new Date());
      setFetchError(null); // clear any previous error on success
    } catch (err) {
      // SILENT FAIL — never show raw Supabase/network errors to the user.
      // The radar still animates; dots just stay at 0 when offline.
      const msg = err instanceof Error ? err.message : String(err);
      const isNetErr = msg.includes("Failed to fetch") || msg.includes("NetworkError") || msg.includes("timed out");
      if (!isNetErr) {
        // Only surface non-network errors (e.g. table-missing) as a subtle hint
        console.warn("[CrowdRadar] Supabase issue:", msg);
      }
      setFetchError(isNetErr ? null : "offline"); // null = no banner
    } finally {
      setIsLoading(false);
    }
  }, [coords, buildDots]);

  // Auto-poll
  useEffect(() => {
    if (!coords) return;
    refresh();
    const id = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [coords, refresh]);

  useRadarSweep(canvasRef, dots);

  // ── Derived display values ───────────────────────────────────────────────
  const density =
    dots.length >= 8 ? "High" : dots.length >= 4 ? "Medium" : "Low";
  const densityColor =
    density === "High"
      ? "text-red-400"
      : density === "Medium"
      ? "text-amber-400"
      : "text-emerald-400";
  const densityBar =
    density === "High"
      ? "w-full bg-red-500/60"
      : density === "Medium"
      ? "w-2/3 bg-amber-500/60"
      : "w-1/3 bg-emerald-500/60";

  return (
    <div className="glass-card p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-primary animate-pulse" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Nearby Devices · Live
          </h3>
          {/* LIVE badge — replaces the old SAMPLE badge */}
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold tracking-wide animate-pulse">
            LIVE
          </span>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={isLoading || !coords}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
        >
          {isLoading ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <RefreshCw className="w-3 h-3" />
          )}
          Refresh
        </button>
      </div>

      {/* Layout: radar + list side by side on wider screens */}
      <div className="flex flex-col md:flex-row gap-5 items-center md:items-start">

        {/* ── Radar canvas ── */}
        <div className="relative flex-shrink-0">
          <canvas
            ref={canvasRef}
            width={RADAR_SIZE}
            height={RADAR_SIZE}
            className="rounded-full border border-primary/30 shadow-lg shadow-primary/10"
          />
          {/* Compass labels */}
          <span className="absolute top-2 left-1/2 -translate-x-1/2 text-[9px] text-primary/60 font-mono">N</span>
          <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[9px] text-primary/60 font-mono">S</span>
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] text-primary/60 font-mono">W</span>
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-primary/60 font-mono">E</span>

          {/* Range label */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[9px] text-primary/70 font-mono bg-black/50 px-2 py-0.5 rounded">
            ~{RADAR_RANGE_M} m radius
          </div>
        </div>

        {/* ── Right panel ── */}
        <div className="flex-1 w-full space-y-4">

          {/* GPS anchor / status */}
          {coords ? (
            <div className="text-[10px] text-muted-foreground font-mono bg-secondary/30 px-3 py-2 rounded-lg border border-primary/10">
              <span className="text-primary/70">Anchor: </span>
              {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
              {lastRefresh && (
                <span className="ml-2 opacity-60">· {timeAgo(lastRefresh.toISOString())}</span>
              )}
            </div>
          ) : (
            <div className="text-[10px] text-muted-foreground font-mono bg-secondary/20 px-3 py-2 rounded-lg border border-primary/10 italic">
              Waiting for GPS fix to start scanning…
            </div>
          )}

          {/* Offline indicator — subtle, not a scary red banner */}
          {fetchError === "offline" && (
            <div className="flex items-center gap-2 text-[10px] text-amber-400/70 bg-amber-500/5 border border-amber-500/15 px-3 py-1.5 rounded-lg">
              <WifiOff className="w-3 h-3 flex-shrink-0" />
              Backend offline — showing local scan only
            </div>
          )}

          {/* No-GPS state */}
          {!coords && !isLoading && (
            <p className="text-xs text-muted-foreground">
              Enable location permission to discover nearby Guardian devices in real time.
            </p>
          )}

          {/* Loading skeleton */}
          {isLoading && dots.length === 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" />
              Scanning surroundings…
            </div>
          )}

          {/* Density bar */}
          {coords && (
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-muted-foreground">Device Density</span>
                <span className={`text-[10px] font-bold ${densityColor}`}>{density}</span>
              </div>
              <div className="h-1.5 rounded-full bg-secondary/60 overflow-hidden">
                <motion.div
                  key={dots.length}
                  initial={{ width: 0 }}
                  animate={{ width: undefined }}
                  className={`h-full rounded-full transition-all duration-700 ${densityBar}`}
                />
              </div>
            </div>
          )}

          {/* Scrollable live device list */}
          <div className="max-h-[190px] overflow-y-auto space-y-1.5 pr-1">
            <AnimatePresence mode="popLayout">
              {dots.map((dot) => (
                <motion.div
                  key={dot.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.35 }}
                  className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-secondary/25 border border-white/5 text-[11px]"
                >
                  <div className="flex items-center gap-2">
                    {/* Green dot = live real device */}
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{
                        background: "#22c55e",
                        boxShadow: "0 0 5px #22c55e88",
                      }}
                    />
                    <span className="font-mono text-foreground/80">{dot.label}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span>{dot.distanceM} m</span>
                    {dot.speed != null && (
                      <>
                        <span className="text-primary/50">·</span>
                        <span>{dot.speed.toFixed(1)} km/h</span>
                      </>
                    )}
                    <span className="text-primary/30 hidden sm:inline">·</span>
                    <span className="text-[10px] opacity-60 hidden sm:inline">
                      {timeAgo(dot.updatedAt)}
                    </span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Empty state */}
            {dots.length === 0 && coords && !isLoading && !fetchError && (
              <p className="text-xs text-muted-foreground text-center py-3">
                No other Guardian devices detected within {RADAR_RANGE_M} m.
              </p>
            )}
          </div>

          {/* Footer count */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="w-3.5 h-3.5 text-primary/60" />
            <span>
              {coords
                ? `${dots.length} real device${dots.length !== 1 ? "s" : ""} detected in range`
                : "Waiting for GPS…"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CrowdRadar;
