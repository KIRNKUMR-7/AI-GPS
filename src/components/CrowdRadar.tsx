import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Radio, Users, RefreshCw } from "lucide-react";
import { useLocation } from "@/hooks/use-location";

// ─── Types ───────────────────────────────────────────────────────────────────

interface CrowdDot {
  id: string;
  offsetX: number; // canvas pixels from centre
  offsetY: number;
  distanceM: number;
  label: string;
  status: "safe" | "caution" | "unknown";
  speed: number; // km/h
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const LABEL_POOL = [
  "DEV-4A1F", "SRC-29BC", "USR-8E3D", "MON-11AF",
  "TRK-55C2", "AGT-6F0A", "SYS-7A2E", "DEV-3301",
  "USR-C9D4", "TRK-002B", "SRC-8812", "AGT-AA41",
  "MON-F3B6", "DEV-09CE", "USR-5571",
];

const STATUS_POOL: CrowdDot["status"][] = [
  "safe", "safe", "safe", "caution", "unknown",
];

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

/** Generate N sample dots scattered within the radar circle radius (px). */
function generateDots(count: number, radarRadius: number): CrowdDot[] {
  const used = new Set<string>();
  return Array.from({ length: count }, (_, i) => {
    const angle = rand(0, Math.PI * 2);
    // Keep dots between 20 % and 90 % of radar radius so they stay inside
    const r = rand(radarRadius * 0.18, radarRadius * 0.90);
    const label = LABEL_POOL[i % LABEL_POOL.length];
    if (used.has(label)) return null;
    used.add(label);
    const distanceM = Math.round((r / radarRadius) * 500);
    return {
      id: `dot-${i}-${Date.now()}`,
      offsetX: Math.cos(angle) * r,
      offsetY: Math.sin(angle) * r,
      distanceM,
      label,
      status: STATUS_POOL[Math.floor(Math.random() * STATUS_POOL.length)],
      speed: parseFloat(rand(0.2, 4.5).toFixed(1)),
    } as CrowdDot;
  }).filter(Boolean) as CrowdDot[];
}

// ─── Radar Canvas ─────────────────────────────────────────────────────────────

const RADAR_SIZE = 260;   // canvas size (square)
const RADIUS = 114;       // radar circle radius

function useRadarSweep(canvasRef: React.RefObject<HTMLCanvasElement>, dots: CrowdDot[]) {
  const angleRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cx = RADAR_SIZE / 2;
    const cy = RADAR_SIZE / 2;

    const STATUS_COLORS: Record<CrowdDot["status"], string> = {
      safe: "#22c55e",
      caution: "#f59e0b",
      unknown: "#6366f1",
    };

    function draw() {
      ctx.clearRect(0, 0, RADAR_SIZE, RADAR_SIZE);

      // ── Background circle ──
      ctx.beginPath();
      ctx.arc(cx, cy, RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(15, 23, 42, 0.95)";
      ctx.fill();

      // ── Concentric rings ──
      [0.33, 0.66, 1].forEach((frac) => {
        ctx.beginPath();
        ctx.arc(cx, cy, RADIUS * frac, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(99, 102, 241, 0.18)";
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      // ── Cross-hairs ──
      ctx.strokeStyle = "rgba(99, 102, 241, 0.14)";
      ctx.lineWidth = 1;
      [0, Math.PI / 2].forEach((a) => {
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * RADIUS, cy + Math.sin(a) * RADIUS);
        ctx.lineTo(cx - Math.cos(a) * RADIUS, cy - Math.sin(a) * RADIUS);
        ctx.stroke();
      });

      // ── Sweep gradient wedge ──
      const sweepAngle = angleRef.current;
      const wedgeSteps = 32;
      for (let s = 0; s < wedgeSteps; s++) {
        const frac = s / wedgeSteps;
        const startA = sweepAngle - frac * (Math.PI / 2);
        const endA = startA + Math.PI / wedgeSteps;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, RADIUS, startA, endA);
        ctx.closePath();
        ctx.fillStyle = `rgba(99,102,241,${0.28 * (1 - frac)})`;
        ctx.fill();
      }

      // ── Sweep line ──
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(
        cx + Math.cos(sweepAngle) * RADIUS,
        cy + Math.sin(sweepAngle) * RADIUS,
      );
      ctx.strokeStyle = "rgba(129, 140, 248, 0.9)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // ── Centre dot (self) ──
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#818cf8";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, 9, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(129,140,248,0.45)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // ── Crowd dots ──
      dots.forEach((dot) => {
        const dx = cx + dot.offsetX;
        const dy = cy + dot.offsetY;
        const col = STATUS_COLORS[dot.status];

        // Outer pulse ring
        ctx.beginPath();
        ctx.arc(dx, dy, 7, 0, Math.PI * 2);
        ctx.strokeStyle = col + "55";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Dot
        ctx.beginPath();
        ctx.arc(dx, dy, 4, 0, Math.PI * 2);
        ctx.fillStyle = col;
        ctx.fill();
      });

      // ── Outer border ──
      ctx.beginPath();
      ctx.arc(cx, cy, RADIUS, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(99, 102, 241, 0.35)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // advance sweep
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

const DOT_COUNT = 12;
const REFRESH_INTERVAL_MS = 12_000;

const CrowdRadar = () => {
  const { coords } = useLocation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dots, setDots] = useState<CrowdDot[]>(() => generateDots(DOT_COUNT, RADIUS));
  const [tick, setTick] = useState(0);
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  // Auto-refresh dots
  useEffect(() => {
    const id = setInterval(() => {
      setDots(generateDots(DOT_COUNT, RADIUS));
      setLastRefresh(Date.now());
      setTick((t) => t + 1);
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  useRadarSweep(canvasRef, dots);

  const manualRefresh = () => {
    setDots(generateDots(DOT_COUNT, RADIUS));
    setLastRefresh(Date.now());
    setTick((t) => t + 1);
  };

  const density = dots.length >= 10 ? "High" : dots.length >= 6 ? "Medium" : "Low";
  const densityColor =
    density === "High" ? "text-red-400" :
    density === "Medium" ? "text-amber-400" : "text-emerald-400";
  const densityBar =
    density === "High" ? "w-full bg-red-500/60" :
    density === "Medium" ? "w-2/3 bg-amber-500/60" : "w-1/3 bg-emerald-500/60";

  const safeCount = dots.filter((d) => d.status === "safe").length;
  const cautionCount = dots.filter((d) => d.status === "caution").length;
  const unknownCount = dots.filter((d) => d.status === "unknown").length;

  return (
    <div className="glass-card p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-primary animate-pulse" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Surrounding GPS Crowd
          </h3>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold tracking-wide">
            SAMPLE
          </span>
        </div>
        <button
          type="button"
          onClick={manualRefresh}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          Refresh
        </button>
      </div>

      {/* Layout: radar + list side by side on wider screens */}
      <div className="flex flex-col md:flex-row gap-5 items-center md:items-start">

        {/* ── Radar ── */}
        <div className="relative flex-shrink-0">
          <canvas
            ref={canvasRef}
            width={RADAR_SIZE}
            height={RADAR_SIZE}
            className="rounded-full border border-primary/30 shadow-lg shadow-primary/10"
          />
          {/* Corner labels */}
          <span className="absolute top-2 left-1/2 -translate-x-1/2 text-[9px] text-primary/60 font-mono">N</span>
          <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[9px] text-primary/60 font-mono">S</span>
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] text-primary/60 font-mono">W</span>
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-primary/60 font-mono">E</span>

          {/* Centre label */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[9px] text-primary/70 font-mono bg-black/50 px-2 py-0.5 rounded">
            ~500 m radius
          </div>
        </div>

        {/* ── Right panel ── */}
        <div className="flex-1 w-full space-y-4">

          {/* GPS anchor */}
          {coords ? (
            <div className="text-[10px] text-muted-foreground font-mono bg-secondary/30 px-3 py-2 rounded-lg border border-primary/10">
              <span className="text-primary/70">Anchor: </span>
              {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
            </div>
          ) : (
            <div className="text-[10px] text-muted-foreground font-mono bg-secondary/20 px-3 py-2 rounded-lg border border-primary/10 italic">
              GPS not acquired · showing demo position
            </div>
          )}

          {/* Summary badges */}
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: "Safe", count: safeCount, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
              { label: "Caution", count: cautionCount, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
              { label: "Unknown", count: unknownCount, color: "text-indigo-400", bg: "bg-indigo-500/10 border-indigo-500/20" },
            ].map(({ label, count, color, bg }) => (
              <div key={label} className={`rounded-lg border p-2 ${bg}`}>
                <p className={`text-lg font-bold ${color}`}>{count}</p>
                <p className="text-[10px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>

          {/* Density bar */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-muted-foreground">Crowd Density</span>
              <span className={`text-[10px] font-bold ${densityColor}`}>{density}</span>
            </div>
            <div className="h-1.5 rounded-full bg-secondary/60 overflow-hidden">
              <motion.div
                key={tick}
                initial={{ width: 0 }}
                animate={{ width: undefined }}
                className={`h-full rounded-full transition-all duration-700 ${densityBar}`}
              />
            </div>
          </div>

          {/* Scrollable dot list */}
          <div className="max-h-[180px] overflow-y-auto space-y-1.5 pr-1">
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
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{
                        background:
                          dot.status === "safe" ? "#22c55e" :
                          dot.status === "caution" ? "#f59e0b" : "#6366f1",
                        boxShadow:
                          dot.status === "safe" ? "0 0 5px #22c55e88" :
                          dot.status === "caution" ? "0 0 5px #f59e0b88" : "0 0 5px #6366f188",
                      }}
                    />
                    <span className="font-mono text-foreground/80">{dot.label}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span>{dot.distanceM} m</span>
                    <span className="text-primary/50">·</span>
                    <span>{dot.speed} km/h</span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Users icon + total */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="w-3.5 h-3.5 text-primary/60" />
            <span>{dots.length} devices detected in range</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CrowdRadar;
