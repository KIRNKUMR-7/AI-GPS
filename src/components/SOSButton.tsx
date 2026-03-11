import { motion } from "framer-motion";
import { useLocation } from "@/hooks/use-location";

interface SOSButtonProps {
  onSOS: () => void;
}

const SOSButton = ({ onSOS }: SOSButtonProps) => {
  const { coords } = useLocation();

  const handleSOS = () => {
    const lat = coords?.lat ?? 0;
    const lng = coords?.lng ?? 0;
    const mapsUrl = `https://maps.google.com/?q=${lat},${lng}`;
    const message = encodeURIComponent(
      `HELP! I am in danger. Track my live location here: ${mapsUrl}`
    );
    window.location.href = `sms:?body=${message}`;

    onSOS();
    alert("🚨 SOS Initiated!\n\nOpening messaging app with your live location and starting secure recording...");
  };

  return (
    <div className="glass-card p-6 flex flex-col items-center justify-center space-y-4">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Emergency
      </h3>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleSOS}
        className="relative w-32 h-32 rounded-full bg-danger text-danger-foreground font-black text-2xl tracking-widest animate-sos-pulse cursor-pointer"
      >
        <span className="absolute inset-0 rounded-full bg-danger/30 pulse-ring" />
        <span className="relative z-10">SOS</span>
      </motion.button>
      <p className="text-xs text-muted-foreground text-center">
        Tap to alert all emergency contacts with your live location
      </p>
    </div>
  );
};

export default SOSButton;
