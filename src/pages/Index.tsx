import { motion } from "framer-motion";
import { Shield } from "lucide-react";
import GPSTracker from "@/components/GPSTracker";
import CrowdRadar from "@/components/CrowdRadar";
import MovementMonitor from "@/components/MovementMonitor";
import SOSButton from "@/components/SOSButton";
import EmergencyContacts from "@/components/EmergencyContacts";
import AlertFeed from "@/components/AlertFeed";
import BatteryMonitor from "@/components/BatteryMonitor";
import NearbyUsers from "@/components/NearbyUsers";
import EvidenceRecorder from "@/components/EvidenceRecorder";

import { useMediaRecorder } from "@/hooks/use-media-recorder";
import { useLocation } from "@/hooks/use-location";

const Index = () => {
  const {
    isRecording,
    mode,
    setMode,
    startRecording,
    stopRecording,
    chunks
  } = useMediaRecorder();
  const { isSending, error: locationError } = useLocation();

  const handleSOS = () => {
    // Start video recording when SOS is triggered
    startRecording("video");
  };

  const deviceId = localStorage.getItem("guardian_device_id") || "Unknown";

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-8"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center cursor-pointer transition-colors hover:bg-primary/20" onClick={() => window.location.href = '/'}>
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">AI & GPS Monitoring System</h1>
            <p className="text-xs text-muted-foreground">AI-Powered Location Tracking</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-safe/10 border border-safe/20">
            <div className={`w-2 h-2 rounded-full ${isRecording ? "bg-red-500" : "bg-safe"} animate-pulse`} />
            <span className={`text-xs font-medium ${isRecording ? "text-red-500" : "text-safe"}`}>
              {isRecording ? "LIVE BROADCAST" : "Monitoring"}
            </span>
          </div>
          {isSending && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-[10px] text-primary animate-pulse font-medium">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              Syncing...
            </div>
          )}
          {locationError && (
            <div className="text-[10px] text-danger bg-danger/5 px-2 py-0.5 rounded border border-danger/20 max-w-[150px] truncate" title={locationError}>
              {locationError}
            </div>
          )}
        </div>
      </motion.header>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Left column: GPS + Movement */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-2 space-y-4 md:space-y-6"
        >
          <GPSTracker />
          <CrowdRadar />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <MovementMonitor />
            <SOSButton onSOS={handleSOS} />
            <EvidenceRecorder
              isRecording={isRecording}
              mode={mode}
              setMode={setMode}
              startRecording={() => startRecording(mode)} // Start with current selected mode if clicked manually
              stopRecording={stopRecording}
              chunks={chunks}
            />
            <BatteryMonitor />
          </div>
        </motion.div>

        {/* Right column: Contacts + Alerts */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-4 md:space-y-6"
        >
          <EmergencyContacts />
          <AlertFeed />
          <NearbyUsers />
        </motion.div>
      </div>

      {/* Footer */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="mt-8 text-center"
      >
        <div className="inline-flex items-center gap-2 glass-card px-4 py-2 border-primary/20 mb-2">
          <span className="text-xs text-muted-foreground">Monitoring Pairing ID:</span>
          <span className="text-sm font-mono font-bold text-primary">{deviceId}</span>
          <button
            onClick={() => {
              navigator.clipboard.writeText(deviceId);
              const btn = document.getElementById('copy-btn');
              if (btn) {
                btn.innerText = 'Copied!';
                setTimeout(() => btn.innerText = 'Copy', 2000);
              }
            }}
            id="copy-btn"
            className="ml-2 text-[10px] bg-primary/20 hover:bg-primary/30 text-primary px-2 py-0.5 rounded transition-colors"
          >
            Copy
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          AI & GPS Based Mobile Crowd Surveillance · Real-Time Incident Prevention
        </p>
      </motion.footer>
    </div>
  );
};

export default Index;
