import { Mic, Square, Video, Play, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

interface EvidenceRecorderProps {
    isRecording: boolean;
    mode: "audio" | "video";
    setMode: (mode: "audio" | "video") => void;
    startRecording: () => void;
    stopRecording: () => void;
    chunks: Blob[];
}

const EvidenceRecorder = ({
    isRecording,
    mode,
    setMode,
    startRecording,
    stopRecording,
    chunks
}: EvidenceRecorderProps) => {

    return (
        <div className="glass-card p-4 space-y-3 border-l-4 border-l-warning">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-warning" />
                    Evidence Recorder
                </h3>
                <div className="flex gap-1 bg-secondary/50 p-1 rounded-lg">
                    <button
                        onClick={() => setMode("audio")}
                        className={`p-1.5 rounded ${mode === "audio" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    >
                        <Mic className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={() => setMode("video")}
                        className={`p-1.5 rounded ${mode === "video" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    >
                        <Video className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            <div className="flex gap-3">
                {!isRecording ? (
                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => startRecording()}
                        className="flex-1 py-3 bg-gradient-to-r from-warning to-orange-600 text-white font-bold rounded-lg shadow-lg flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                    >
                        <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                        REC {mode.toUpperCase()}
                    </motion.button>
                ) : (
                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={stopRecording}
                        className="flex-1 py-3 bg-secondary text-foreground font-bold rounded-lg border border-white/10 flex items-center justify-center gap-2 hover:bg-secondary/80"
                    >
                        <Square className="w-4 h-4 fill-current" />
                        STOP
                    </motion.button>
                )}
            </div>

            {isRecording && (
                <div className="text-[10px] text-center text-red-400 animate-pulse font-mono">
                    ● RECORDING SECURE EVIDENCE
                </div>
            )}

            {chunks.length > 0 && (
                <div className="mt-2 pt-2 border-t border-white/5">
                    <p className="text-[10px] text-muted-foreground mb-1">Recent Captures:</p>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                        {chunks.slice(-3).map((chunk, i) => (
                            <div key={i} className="flex-shrink-0">
                                <a
                                    href={URL.createObjectURL(chunk)}
                                    download={`evidence_${Date.now()}.${mode === 'video' ? 'webm' : 'webm'}`}
                                    className="flex items-center gap-1 px-2 py-1 bg-secondary rounded text-[10px] hover:bg-white/10"
                                >
                                    <Play className="w-3 h-3" />
                                    File_{i + 1}
                                </a>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default EvidenceRecorder;
