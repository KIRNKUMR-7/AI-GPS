import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";

type MediaType = "audio" | "video";

export interface Recording {
  blob: Blob;
  mimeType: string;
  timestamp: number;       // Date.now() when recording stopped
  durationMs: number;      // approx total recording length in ms
  objectUrl: string;       // pre-created URL for immediate playback
  extension: string;       // mp4 / webm / ogg
}

// ── MIME-type priority lists (most compatible first) ──────────────────────────
// Android WebView heavily prefers mp4. Desktop Chrome prefers webm.
const VIDEO_MIME_PRIORITY = [
  "video/mp4",
  "video/webm;codecs=vp8,opus",
  "video/webm;codecs=vp8",
  "video/webm",
  "video/ogg",
];

const AUDIO_MIME_PRIORITY = [
  "audio/mp4",
  "audio/aac",
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/ogg",
];

function getSupportedMime(list: string[]): string {
  for (const mime of list) {
    try {
      if (MediaRecorder.isTypeSupported(mime)) return mime;
    } catch {
      // some browsers throw on unsupported — treat as not supported
    }
  }
  return ""; // browser default
}

function mimeToExtension(mime: string): string {
  if (mime.startsWith("video/mp4") || mime.startsWith("audio/mp4") || mime.startsWith("audio/aac")) return "mp4";
  if (mime.startsWith("video/ogg") || mime.startsWith("audio/ogg")) return "ogg";
  return "webm"; // default for any webm variant
}

export const useMediaRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [mode, setMode] = useState<MediaType>("audio");
  const [recordings, setRecordings] = useState<Recording[]>([]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const mimeTypeRef = useRef<string>("");

  const startRecording = useCallback(async (selectedMode: MediaType = mode) => {
    // Don't double-start
    if (mediaRecorderRef.current && isRecording) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: selectedMode === "video"
          ? { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
          : false,
      });

      streamRef.current = stream;
      chunksRef.current = [];

      // Pick the best supported MIME type
      const mimeList = selectedMode === "video" ? VIDEO_MIME_PRIORITY : AUDIO_MIME_PRIORITY;
      const mimeType = getSupportedMime(mimeList);
      mimeTypeRef.current = mimeType;

      const recorderOptions = mimeType ? { mimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, recorderOptions);
      mediaRecorderRef.current = mediaRecorder;

      // Collect data every 1 second (timeslice) — critical for Android reliability
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const allChunks = chunksRef.current;
        if (allChunks.length === 0) {
          toast.error("Recording failed — no data captured.");
          return;
        }

        // Determine the actual MIME type for the final blob
        const finalMime = mimeTypeRef.current || (selectedMode === "video" ? "video/webm" : "audio/webm");
        const blob = new Blob(allChunks, { type: finalMime });
        const extension = mimeToExtension(finalMime);
        const durationMs = Date.now() - startTimeRef.current;
        const objectUrl = URL.createObjectURL(blob);

        const rec: Recording = {
          blob,
          mimeType: finalMime,
          timestamp: Date.now(),
          durationMs,
          objectUrl,
          extension,
        };

        setRecordings((prev) => [...prev, rec]);
        toast.success(`Evidence saved! (${extension.toUpperCase()}, ${(blob.size / 1024).toFixed(1)} KB)`);

        // Release the stream tracks
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        chunksRef.current = [];
      };

      mediaRecorder.onerror = (e) => {
        console.error("MediaRecorder error:", e);
        toast.error("Recording error — please try again.");
        setIsRecording(false);
        stream.getTracks().forEach((t) => t.stop());
      };

      startTimeRef.current = Date.now();
      // timeslice = 1000 ms → ondataavailable fires every second (reliable on Android)
      mediaRecorder.start(1000);
      setIsRecording(true);
      setMode(selectedMode);
      toast.info(`Recording ${selectedMode} evidence... (${mimeType || "default codec"})`);
    } catch (err) {
      console.error("Media device error:", err);
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Cannot access ${mode === "video" ? "camera/microphone" : "microphone"}: ${msg}`);
    }
  }, [mode, isRecording]);

  const stopRecording = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (mr && (mr.state === "recording" || mr.state === "paused")) {
      mr.stop();
      setIsRecording(false);
    }
  }, []);

  const deleteRecording = useCallback((index: number) => {
    setRecordings((prev) => {
      const target = prev[index];
      if (target) URL.revokeObjectURL(target.objectUrl); // free memory
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  return {
    isRecording,
    mode,
    setMode,
    startRecording,
    stopRecording,
    recordings,
    deleteRecording,
    // legacy alias — some components may still use "chunks"
    chunks: recordings.map((r) => r.blob),
  };
};
