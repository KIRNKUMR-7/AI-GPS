import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Shield, AlertTriangle, Zap } from "lucide-react";

type Status = "safe" | "warning" | "danger";

interface MovementData {
  speed: number;
  pattern: string;
  status: Status;
  followScore: number;
}

const useMovementSimulator = () => {
  const [data, setData] = useState<MovementData>({
    speed: 3.2,
    pattern: "Normal Walking",
    status: "safe",
    followScore: 12,
  });

  useEffect(() => {
    // Check if DeviceMotionEvent is available
    if (typeof window !== 'undefined' && 'DeviceMotionEvent' in window) {
      const handleMotion = (event: DeviceMotionEvent) => {
        const acceleration = event.accelerationIncludingGravity;
        if (acceleration && acceleration.x && acceleration.y && acceleration.z) {
          const magnitude = Math.sqrt(
            acceleration.x ** 2 + acceleration.y ** 2 + acceleration.z ** 2
          );

          // Simple logic to detect movement intensity
          // Standard gravity is ~9.8m/s^2. 
          const motionVal = Math.abs(magnitude - 9.8);

          let newStatus: Status = "safe";
          let newPattern = "Stationary";
          let newSpeed = 0;

          if (motionVal > 8) {
            newStatus = "danger";
            newPattern = "Running/Impact";
            newSpeed = 15 + Math.random() * 5;
          } else if (motionVal > 2) {
            newStatus = "warning";
            newPattern = "Walking/Active";
            newSpeed = 4 + Math.random() * 2;
          }

          setData(prev => ({
            ...prev,
            speed: newSpeed > 0 ? newSpeed : prev.speed * 0.9, // decay speed if stationary
            pattern: newPattern,
            status: newStatus,
            // Randomize follow score for demo purposes since we can't real-detect that easily without more sensors/logic
            followScore: newStatus === "danger" ? 80 : newStatus === "warning" ? 40 : 10
          }));
        }
      };

      window.addEventListener('devicemotion', handleMotion);
      return () => window.removeEventListener('devicemotion', handleMotion);
    } else {
      // Fallback for desktop/unsupported devices - keep simulation
      const interval = setInterval(() => {
        const rand = Math.random();
        if (rand > 0.85) {
          setData({
            speed: 12 + Math.random() * 6,
            pattern: "Running Detected (Sim)",
            status: "danger",
            followScore: 75 + Math.floor(Math.random() * 25),
          });
        } else if (rand > 0.65) {
          setData({
            speed: 4 + Math.random() * 3,
            pattern: "Suspicious Following (Sim)",
            status: "warning",
            followScore: 45 + Math.floor(Math.random() * 30),
          });
        } else {
          setData({
            speed: 2.5 + Math.random() * 2.5,
            pattern: "Normal Walking (Sim)",
            status: "safe",
            followScore: Math.floor(Math.random() * 20),
          });
        }
      }, 3000);
      return () => clearInterval(interval);
    }
  }, []);

  return data;
};

const statusConfig = {
  safe: { icon: Shield, label: "All Safe", color: "text-safe", bg: "bg-safe/10", border: "border-safe/30" },
  warning: { icon: AlertTriangle, label: "Caution", color: "text-warning", bg: "bg-warning/10", border: "border-warning/30" },
  danger: { icon: Zap, label: "Alert!", color: "text-danger", bg: "bg-danger/10", border: "border-danger/30" },
};

const MovementMonitor = () => {
  const data = useMovementSimulator();
  const config = statusConfig[data.status];
  const Icon = config.icon;

  return (
    <div className="glass-card p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Movement Analysis
        </h3>
        <motion.div
          key={data.status}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${config.bg} ${config.color} ${config.border} border`}
        >
          <Icon className="w-3.5 h-3.5" />
          {config.label}
        </motion.div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Speed</p>
          <motion.p
            key={data.speed}
            initial={{ y: 5, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="text-2xl font-bold text-foreground"
          >
            {data.speed.toFixed(1)} <span className="text-sm font-normal text-muted-foreground">km/h</span>
          </motion.p>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Pattern</p>
          <motion.p
            key={data.pattern}
            initial={{ y: 5, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className={`text-sm font-semibold ${config.color}`}
          >
            {data.pattern}
          </motion.p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Follow Threat Score</span>
          <span className={config.color}>{data.followScore}%</span>
        </div>
        <div className="h-2 rounded-full bg-secondary overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${data.status === "safe" ? "bg-safe" : data.status === "warning" ? "bg-warning" : "bg-danger"
              }`}
            initial={{ width: 0 }}
            animate={{ width: `${data.followScore}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>
    </div>
  );
};

export default MovementMonitor;
