import { useState, useRef } from "react";
import { toast } from "sonner";

type MediaType = "audio" | "video";

export const useMediaRecorder = () => {
    const [isRecording, setIsRecording] = useState(false);
    const [mode, setMode] = useState<MediaType>("audio");
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const [chunks, setChunks] = useState<Blob[]>([]);

    const startRecording = async (selectedMode: MediaType = mode) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: selectedMode === "video",
            });

            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            const localChunks: Blob[] = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) localChunks.push(e.data);
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(localChunks, {
                    type: selectedMode === "video" ? "video/webm" : "audio/webm",
                });
                setChunks((prev) => [...prev, blob]);
                toast.success("Evidence saved locally!");

                // Stop all tracks to release camera/mic
                stream.getTracks().forEach((track) => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
            setMode(selectedMode);
            toast.info(`Recording ${selectedMode} evidence...`);
        } catch (err) {
            console.error("Error accessing media devices:", err);
            toast.error("Could not access microphone/camera. Permission denied?");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    return {
        isRecording,
        mode,
        setMode,
        startRecording,
        stopRecording,
        chunks,
    };
};
