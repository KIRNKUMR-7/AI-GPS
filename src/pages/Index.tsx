import { motion } from "framer-motion";
import { Shield, CheckCircle2, XCircle, WifiOff, Loader2, AlertTriangle } from "lucide-react";
import GPSTracker from "@/components/GPSTracker";
import CrowdRadar from "@/components/CrowdRadar";
import SuspiciousDeviceDetector from "@/components/SuspiciousDeviceDetector";
import MovementMonitor from "@/components/MovementMonitor";
import SOSButton from "@/components/SOSButton";
import EmergencyContacts from "@/components/EmergencyContacts";
import AlertFeed from "@/components/AlertFeed";
import BatteryMonitor from "@/components/BatteryMonitor";
import NearbyUsers from "@/components/NearbyUsers";
import EvidenceRecorder from "@/components/EvidenceRecorder";
import DeviceIdQR from "@/components/DeviceIdQR";
import SupabaseSetupBanner from "@/components/SupabaseSetupBanner";

import { useMediaRecorder } from "@/hooks/use-media-recorder";
import { useLocation } from "@/hooks/use-location";

const Index = () => {
  const {
    isRecording,
    mode,
    setMode,
    startRecording,
    stopRecording,
    recordings,
    deleteRecording,
  } = useMediaRecorder();

  const { isSending, syncStatus, lastSynced, error: locationError } = useLocation();

  // Derive sync badge appearance from syncStatus
  const syncBadge = (() => {
    switch (syncStatus) {
      case "synced":        return { icon: CheckCircle2, label: "Location Synced",     color: "text-safe",    bg: "bg-safe/10 border-safe/20" };
      case "sending":       return { icon: Loader2,      label: "Syncing…",            color: "text-primary", bg: "bg-primary/10 border-primary/20", spin: true };
      case "network_error": return { icon: WifiOff,      label: "Network Error (retrying)", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" };
      case "rls_error":     return { icon: XCircle,      label: "Sync Blocked (RLS)", color: "text-danger",  bg: "bg-danger/10 border-danger/20" };
      case "table_missing": return { icon: AlertTriangle, label: "DB Table Missing",  color: "text-danger",  bg: "bg-danger/10 border-danger/20" };
      case "error":         return { icon: XCircle,      label: "Sync Error",         color: "text-danger",  bg: "bg-danger/10 border-danger/20" };
      default:              return { icon: Loader2,      label: "Waiting for GPS…",   color: "text-muted-foreground", bg: "bg-secondary/50 border-white/10", spin: true };
    }
  })();
  const SyncIcon = syncBadge.icon;

  const handleSOS = () => {
    // Auto-start video recording when SOS is triggered
    startRecording("video");
  };

  // Retrieve or create device ID robustly inside the component
  const deviceId = (() => {
    let id = localStorage.getItem("guardian_device_id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("guardian_device_id", id);
    }
    return id;
  })();

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-8"
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center cursor-pointer transition-colors hover:bg-primary/20"
            onClick={() => window.location.href = '/'}
          >
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">AI &amp; GPS Monitoring System</h1>
            <p className="text-xs text-muted-foreground">AI-Powered Location Tracking</p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          {/* Recording status */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-safe/10 border border-safe/20">
            <div className={`w-2 h-2 rounded-full ${isRecording ? "bg-red-500" : "bg-safe"} animate-pulse`} />
            <span className={`text-xs font-medium ${isRecording ? "text-red-500" : "text-safe"}`}>
              {isRecording ? "LIVE BROADCAST" : "Monitoring"}
            </span>
          </div>
          {/* Location sync status badge */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-medium ${syncBadge.bg} ${syncBadge.color}`}>
            <SyncIcon className={`w-3 h-3 flex-shrink-0 ${'spin' in syncBadge && syncBadge.spin ? 'animate-spin' : ''}`} />
            {syncBadge.label}
            {syncStatus === "synced" && lastSynced && (
              <span className="opacity-60 ml-0.5">
                {Math.round((Date.now() - lastSynced.getTime()) / 1000)}s ago
              </span>
            )}
          </div>
          {locationError && (
            <div
              className="text-[10px] text-danger bg-danger/5 px-2 py-0.5 rounded border border-danger/20 max-w-[180px] truncate"
              title={locationError}
            >
              {locationError}
            </div>
          )}
        </div>
      </motion.header>

      {/* Supabase setup banner — shows only if table missing / RLS blocking */}
      <SupabaseSetupBanner />

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Left column: GPS + Radar + Controls */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-2 space-y-4 md:space-y-6"
        >
          <GPSTracker />
          <SuspiciousDeviceDetector />
          <CrowdRadar />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <MovementMonitor />
            <SOSButton onSOS={handleSOS} />
            <EvidenceRecorder
              isRecording={isRecording}
              mode={mode}
              setMode={setMode}
              startRecording={() => startRecording(mode)}
              stopRecording={stopRecording}
              recordings={recordings}
              deleteRecording={deleteRecording}
            />
            <BatteryMonitor />
          </div>
        </motion.div>

        {/* Right column: Contacts + Alerts + Nearby */}
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

      {/* Footer: Device ID + QR */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="mt-8 flex flex-col items-center gap-3"
      >
        <DeviceIdQR deviceId={deviceId} />
        <p className="text-xs text-muted-foreground text-center">
          AI &amp; GPS Based Mobile Crowd Surveillance · Real-Time Incident Prevention
        </p>
      </motion.footer>
    </div>
  );
};

export default Index;
