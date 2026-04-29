import { useEffect, useRef, useState, useCallback } from "react";
import QRCode from "qrcode";
import {
  Eye, EyeOff, QrCode, X, Copy, Check,
  ShieldCheck, RefreshCw, AlertTriangle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface DeviceIdQRProps {
  deviceId: string;
}

const AUTO_HIDE_SECONDS = 15;

const DeviceIdQR = ({ deviceId }: DeviceIdQRProps) => {
  const [revealed, setRevealed] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState(AUTO_HIDE_SECONDS);

  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Generate QR on canvas whenever modal opens ───────────────────────────
  useEffect(() => {
    if (!showQR || !qrCanvasRef.current) return;
    QRCode.toCanvas(qrCanvasRef.current, deviceId, {
      width: 240,
      margin: 2,
      color: {
        dark: "#e2e8f0",   // light dots
        light: "#0f172a",  // dark background — matches app theme
      },
      errorCorrectionLevel: "H",
    }).catch((err) => console.error("QR gen error:", err));
  }, [showQR, deviceId]);

  // ── Auto-hide revealed ID after N seconds ─────────────────────────────────
  const startHideTimer = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);

    setCountdown(AUTO_HIDE_SECONDS);

    countdownRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(countdownRef.current!);
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    hideTimerRef.current = setTimeout(() => {
      setRevealed(false);
      clearInterval(countdownRef.current!);
    }, AUTO_HIDE_SECONDS * 1000);
  }, []);

  const handleReveal = useCallback(() => {
    if (revealed) {
      // Hide manually
      setRevealed(false);
      clearTimeout(hideTimerRef.current!);
      clearInterval(countdownRef.current!);
    } else {
      setRevealed(true);
      startHideTimer();
    }
  }, [revealed, startHideTimer]);

  // Cleanup
  useEffect(() => {
    return () => {
      clearTimeout(hideTimerRef.current!);
      clearInterval(countdownRef.current!);
    };
  }, []);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(deviceId).then(() => {
      setCopied(true);
      toast.success("Device ID copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      toast.error("Failed to copy — try manually.");
    });
  }, [deviceId]);

  // Masked ID: show first 4 + last 4, hide rest
  const maskedId = `${deviceId.slice(0, 4)}${"•".repeat(Math.max(0, deviceId.length - 8))}${deviceId.slice(-4)}`;

  return (
    <>
      {/* ── Inline display card ─────────────────────────────────────────────── */}
      <div className="inline-flex flex-col items-center gap-2 glass-card px-4 py-3 border-primary/20 w-full max-w-md">
        {/* Title row */}
        <div className="flex items-center gap-2 w-full">
          <ShieldCheck className="w-4 h-4 text-primary/70 flex-shrink-0" />
          <span className="text-xs text-muted-foreground font-medium">Monitoring Pairing ID</span>
          {revealed && (
            <span className="ml-auto text-[10px] text-amber-400 font-mono animate-pulse">
              Auto-hide in {countdown}s
            </span>
          )}
        </div>

        {/* ID display */}
        <div className="flex items-center gap-2 w-full bg-secondary/40 rounded-lg px-3 py-2 border border-white/5">
          <span className={`flex-1 text-sm font-mono font-bold transition-all duration-300 ${
            revealed ? "text-primary blur-0 select-text" : "text-primary/60 blur-[4px] select-none"
          }`}>
            {revealed ? deviceId : maskedId}
          </span>

          {/* Security note */}
          {!revealed && (
            <span title="ID is hidden for security">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500/70 flex-shrink-0" />
            </span>
          )}
        </div>

        {/* Action buttons row */}
        <div className="flex gap-2 w-full">
          {/* Reveal/Hide toggle */}
          <button
            type="button"
            onClick={handleReveal}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg border transition-all ${
              revealed
                ? "bg-amber-500/20 border-amber-500/30 text-amber-400 hover:bg-amber-500/30"
                : "bg-secondary/60 border-white/10 text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {revealed ? "Hide ID" : "Reveal ID"}
          </button>

          {/* Copy */}
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold
              bg-primary/15 hover:bg-primary/25 text-primary border border-primary/20 rounded-lg transition-all"
            title="Copy full ID"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied!" : "Copy"}
          </button>

          {/* Show QR */}
          <button
            type="button"
            onClick={() => setShowQR(true)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold
              bg-safe/15 hover:bg-safe/25 text-safe border border-safe/20 rounded-lg transition-all"
            title="Show QR Code for parent to scan"
          >
            <QrCode className="w-3.5 h-3.5" />
            QR
          </button>
        </div>

        <p className="text-[10px] text-muted-foreground/60 text-center">
          Share this ID with the guardian monitoring device securely
        </p>
      </div>

      {/* ── QR Modal ────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showQR && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowQR(false)}
              className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 20 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="glass-card p-6 w-full max-w-xs flex flex-col items-center gap-4 relative">
                {/* Close button */}
                <button
                  type="button"
                  onClick={() => setShowQR(false)}
                  className="absolute top-3 right-3 p-1.5 rounded-lg bg-secondary/60 text-muted-foreground
                    hover:text-foreground hover:bg-secondary transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>

                {/* Title */}
                <div className="flex flex-col items-center gap-1">
                  <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center border border-primary/20">
                    <QrCode className="w-5 h-5 text-primary" />
                  </div>
                  <h2 className="text-base font-bold">Scan to Connect</h2>
                  <p className="text-[11px] text-muted-foreground text-center">
                    Guardian app: tap "Connect to Device" and scan this QR
                  </p>
                </div>

                {/* QR Canvas */}
                <div className="p-3 bg-slate-900 rounded-2xl border border-primary/20 shadow-lg shadow-primary/10">
                  <canvas ref={qrCanvasRef} className="rounded-lg" />
                </div>

                {/* Device ID snippet below QR */}
                <div className="flex flex-col items-center gap-1 w-full">
                  <p className="text-[9px] text-muted-foreground/60 uppercase tracking-widest">Device ID</p>
                  <div className="flex items-center gap-2 bg-secondary/40 rounded-lg px-3 py-1.5 w-full">
                    <span className="flex-1 text-[10px] font-mono text-primary/80 truncate">
                      {deviceId}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="p-1 rounded text-muted-foreground hover:text-primary transition-colors flex-shrink-0"
                    >
                      {copied ? <Check className="w-3 h-3 text-safe" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>

                {/* Refresh hint */}
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <RefreshCw className="w-3 h-3" />
                  ID is persistent — same across sessions
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default DeviceIdQR;
