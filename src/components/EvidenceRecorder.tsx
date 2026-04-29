import { useRef, useEffect, useCallback } from "react";
import {
  Mic, Square, Video, Play, AlertCircle,
  Download, Trash2, Clock, HardDrive
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Recording } from "@/hooks/use-media-recorder";

interface EvidenceRecorderProps {
  isRecording: boolean;
  mode: "audio" | "video";
  setMode: (mode: "audio" | "video") => void;
  startRecording: () => void;
  stopRecording: () => void;
  recordings: Recording[];
  deleteRecording: (index: number) => void;
}

// Formats milliseconds to m:ss
function fmtDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// Formats bytes to human-readable size
function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// Formats timestamp to HH:MM:SS
function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// ── Individual recording card ─────────────────────────────────────────────────
function RecordingCard({
  rec,
  index,
  onDelete,
}: {
  rec: Recording;
  index: number;
  onDelete: () => void;
}) {
  const mediaRef = useRef<HTMLAudioElement & HTMLVideoElement>(null);

  // Revoke URL on unmount
  useEffect(() => {
    return () => {
      // URL is revoked centrally in deleteRecording, but guard here anyway
    };
  }, []);

  const isVideo = rec.mimeType.startsWith("video");
  const filename = `evidence_${new Date(rec.timestamp).toISOString().replace(/[:.]/g, "-")}.${rec.extension}`;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 20, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="rounded-xl bg-secondary/30 border border-white/10 overflow-hidden"
    >
      {/* Media element */}
      <div className="w-full bg-black/40">
        {isVideo ? (
          <video
            ref={mediaRef as React.RefObject<HTMLVideoElement>}
            src={rec.objectUrl}
            controls
            playsInline
            preload="metadata"
            className="w-full max-h-36 object-contain rounded-t-xl"
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-3 gap-1">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <Mic className="w-4 h-4 text-primary" />
            </div>
            <audio
              ref={mediaRef as React.RefObject<HTMLAudioElement>}
              src={rec.objectUrl}
              controls
              preload="metadata"
              className="w-full px-2"
            />
          </div>
        )}
      </div>

      {/* Metadata + actions */}
      <div className="px-3 py-2 space-y-1.5">
        {/* Top row */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-mono text-primary/80 font-bold uppercase tracking-widest">
            #{index + 1} · {rec.extension.toUpperCase()}
          </span>
          <span className="text-[10px] text-muted-foreground">{fmtTime(rec.timestamp)}</span>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {fmtDuration(rec.durationMs)}
          </span>
          <span className="flex items-center gap-1">
            <HardDrive className="w-3 h-3" />
            {fmtSize(rec.blob.size)}
          </span>
          <span className="flex items-center gap-1">
            <Play className="w-3 h-3" />
            {isVideo ? "Video" : "Audio"}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 pt-0.5">
          <a
            href={rec.objectUrl}
            download={filename}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-semibold
              bg-primary/20 hover:bg-primary/35 text-primary border border-primary/20 rounded-lg transition-colors"
          >
            <Download className="w-3 h-3" />
            Download
          </a>
          <button
            type="button"
            onClick={onDelete}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold
              bg-red-500/10 hover:bg-red-500/25 text-red-400 border border-red-500/20 rounded-lg transition-colors"
          >
            <Trash2 className="w-3 h-3" />
            Delete
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Main EvidenceRecorder ─────────────────────────────────────────────────────
const EvidenceRecorder = ({
  isRecording,
  mode,
  setMode,
  startRecording,
  stopRecording,
  recordings,
  deleteRecording,
}: EvidenceRecorderProps) => {

  const handleStart = useCallback(() => {
    startRecording();
  }, [startRecording]);

  return (
    <div className="glass-card p-4 space-y-3 border-l-4 border-l-warning">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-warning" />
          Evidence Recorder
          {recordings.length > 0 && (
            <span className="ml-1 text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-bold">
              {recordings.length}
            </span>
          )}
        </h3>

        {/* Mode selector */}
        <div className="flex gap-1 bg-secondary/50 p-1 rounded-lg">
          <button
            type="button"
            disabled={isRecording}
            onClick={() => setMode("audio")}
            className={`p-1.5 rounded transition-colors ${
              mode === "audio"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            } disabled:opacity-40 disabled:cursor-not-allowed`}
            title="Audio only"
          >
            <Mic className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={isRecording}
            onClick={() => setMode("video")}
            className={`p-1.5 rounded transition-colors ${
              mode === "video"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            } disabled:opacity-40 disabled:cursor-not-allowed`}
            title="Audio + Video"
          >
            <Video className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Record / Stop button */}
      <div className="flex gap-3">
        {!isRecording ? (
          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={handleStart}
            className="flex-1 py-3 bg-gradient-to-r from-warning to-orange-600 text-white font-bold rounded-lg
              shadow-lg shadow-warning/25 flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
          >
            <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            REC {mode.toUpperCase()}
          </motion.button>
        ) : (
          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={stopRecording}
            className="flex-1 py-3 bg-red-600/20 text-red-400 font-bold rounded-lg border border-red-500/30
              flex items-center justify-center gap-2 hover:bg-red-600/30 transition-colors"
          >
            <Square className="w-4 h-4 fill-current" />
            STOP
          </motion.button>
        )}
      </div>

      {/* Live indicator */}
      {isRecording && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-center gap-2 text-[10px] text-red-400 font-mono"
        >
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block" />
          RECORDING {mode.toUpperCase()} EVIDENCE — DO NOT CLOSE APP
        </motion.div>
      )}

      {/* Recordings list */}
      {recordings.length > 0 && (
        <div className="mt-1 pt-2 border-t border-white/5 space-y-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
            Saved Recordings ({recordings.length})
          </p>
          <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
            <AnimatePresence mode="popLayout">
              {recordings.map((rec, i) => (
                <RecordingCard
                  key={`${rec.timestamp}-${i}`}
                  rec={rec}
                  index={i}
                  onDelete={() => deleteRecording(i)}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {recordings.length === 0 && !isRecording && (
        <p className="text-center text-[10px] text-muted-foreground/50 py-1">
          No recordings yet · tap REC to start
        </p>
      )}
    </div>
  );
};

export default EvidenceRecorder;
