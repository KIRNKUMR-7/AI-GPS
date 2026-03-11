import { motion } from "framer-motion";
import { MapPin, Navigation, Wifi } from "lucide-react";
import { useLocation } from "@/hooks/use-location";

const GPSTracker = () => {
  const { coords, error } = useLocation();

  const lat = coords?.lat ?? 11.6643;
  const lng = coords?.lng ?? 78.146;
  const accuracy = Math.round(coords?.accuracy ?? 12);

  return (
    <div className="glass-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Navigation className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Live GPS Tracking
          </h3>
        </div>
        <Wifi className="w-3.5 h-3.5" />
        <span className="text-xs font-medium">{error ? "Error" : "Active"}</span>
      </div>

      {error && (
        <div className="text-xs text-danger bg-danger/10 p-2 rounded border border-danger/20">
          {error}
        </div>
      )}

      <div className="relative h-48 rounded-xl bg-secondary overflow-hidden border border-primary/20 shadow-inner">
        <iframe
          width="100%"
          height="100%"
          frameBorder="0"
          style={{ border: 0, filter: "invert(90%) hue-rotate(180deg) contrast(1.2)" }} // Dark mode map filter
          src={`https://maps.google.com/maps?q=${lat},${lng}&hl=en&z=15&output=embed`}
          allowFullScreen
        ></iframe>

        <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-md px-2 py-1 rounded border border-primary/50 text-[10px] text-primary font-mono z-10">
          LIVE FEED
        </div>

        <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/50 to-transparent"></div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="text-center p-2 rounded-lg bg-secondary/50">
          <MapPin className="w-3.5 h-3.5 mx-auto text-primary mb-1" />
          <p className="text-[10px] text-muted-foreground">Latitude</p>
          <p className="text-xs font-mono font-semibold text-foreground">{lat.toFixed(4)}</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-secondary/50">
          <MapPin className="w-3.5 h-3.5 mx-auto text-primary mb-1" />
          <p className="text-[10px] text-muted-foreground">Longitude</p>
          <p className="text-xs font-mono font-semibold text-foreground">{lng.toFixed(4)}</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-secondary/50">
          <Navigation className="w-3.5 h-3.5 mx-auto text-safe mb-1" />
          <p className="text-[10px] text-muted-foreground">Accuracy</p>
          <p className="text-xs font-mono font-semibold text-foreground">±{accuracy}m</p>
        </div>
      </div>
    </div >
  );
};

export default GPSTracker;
