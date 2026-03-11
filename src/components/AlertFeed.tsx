import { motion } from "framer-motion";
import { AlertTriangle, Shield, Zap, Clock } from "lucide-react";

interface Alert {
  id: string;
  type: "safe" | "warning" | "danger";
  message: string;
  time: string;
  detail: string;
}

const alerts: Alert[] = [
  { id: "1", type: "danger", message: "Fast movement detected", time: "2 min ago", detail: "Speed: 14.2 km/h — possible running" },
  { id: "2", type: "warning", message: "Suspicious following pattern", time: "8 min ago", detail: "Same entity trailing for 400m" },
  { id: "3", type: "safe", message: "Normal pattern resumed", time: "15 min ago", detail: "Walking speed stable at 4.1 km/h" },
  { id: "4", type: "warning", message: "Unusual route deviation", time: "22 min ago", detail: "Left familiar route zone" },
  { id: "5", type: "safe", message: "Tracking activated", time: "30 min ago", detail: "GPS monitoring started" },
];

const iconMap = { safe: Shield, warning: AlertTriangle, danger: Zap };
const colorMap = { safe: "text-safe", warning: "text-warning", danger: "text-danger" };
const bgMap = { safe: "bg-safe/10", warning: "bg-warning/10", danger: "bg-danger/10" };

const AlertFeed = () => (
  <div className="glass-card p-6 space-y-4">
    <div className="flex items-center gap-2">
      <Clock className="w-4 h-4 text-primary" />
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Recent Alerts
      </h3>
    </div>
    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
      {alerts.map((alert, i) => {
        const Icon = iconMap[alert.type];
        return (
          <motion.div
            key={alert.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="flex items-start gap-3 p-3 rounded-xl bg-secondary/30"
          >
            <div className={`p-1.5 rounded-lg ${bgMap[alert.type]} mt-0.5`}>
              <Icon className={`w-3.5 h-3.5 ${colorMap[alert.type]}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className={`text-sm font-medium ${colorMap[alert.type]}`}>{alert.message}</p>
                <span className="text-[10px] text-muted-foreground shrink-0 ml-2">{alert.time}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{alert.detail}</p>
            </div>
          </motion.div>
        );
      })}
    </div>
  </div>
);

export default AlertFeed;
