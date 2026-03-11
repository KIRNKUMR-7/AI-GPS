import { useState, useEffect } from "react";
import { Battery, BatteryCharging, BatteryWarning } from "lucide-react";
import { motion } from "framer-motion";

interface BatteryManager extends EventTarget {
    charging: boolean;
    chargingTime: number;
    dischargingTime: number;
    level: number;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions): void;
}

const BatteryMonitor = () => {
    const [level, setLevel] = useState(1);
    const [charging, setCharging] = useState(false);
    const [supported, setSupported] = useState(true);

    useEffect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((navigator as any).getBattery) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (navigator as any).getBattery().then((battery: BatteryManager) => {
                setLevel(battery.level);
                setCharging(battery.charging);

                const updateLevel = () => setLevel(battery.level);
                const updateCharging = () => setCharging(battery.charging);

                battery.addEventListener("levelchange", updateLevel);
                battery.addEventListener("chargingchange", updateCharging);

                return () => {
                    battery.removeEventListener("levelchange", updateLevel);
                    battery.removeEventListener("chargingchange", updateCharging);
                };
            });
        } else {
            setSupported(false);
        }
    }, []);

    if (!supported) return null;

    const percentage = Math.round(level * 100);
    const isLow = percentage < 20 && !charging;

    return (
        <div className={`glass-card p-4 flex flex-col items-center justify-center space-y-2 border ${isLow ? 'border-danger/50 animate-pulse' : 'border-primary/20'}`}>
            <div className="flex items-center gap-2 w-full justify-between">
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Power</h3>
                <span className={`text-xs font-mono font-bold ${isLow ? 'text-danger' : 'text-primary'}`}>{percentage}%</span>
            </div>

            <div className="relative w-full h-8 bg-secondary/50 rounded-md overflow-hidden border border-white/5">
                <motion.div
                    className={`h-full ${isLow ? 'bg-danger' : 'bg-primary'} relative`}
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 1 }}
                >
                    {charging && (
                        <div className="absolute inset-0 bg-white/20 animate-pulse" />
                    )}
                </motion.div>

                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    {charging ? (
                        <BatteryCharging className="w-4 h-4 text-white drop-shadow-md" />
                    ) : isLow ? (
                        <BatteryWarning className="w-4 h-4 text-white drop-shadow-md" />
                    ) : (
                        <Battery className="w-4 h-4 text-white/50 drop-shadow-md" />
                    )}
                </div>
            </div>
            {isLow && <p className="text-[10px] text-danger font-medium text-center">Low Battery - GPS may drain power</p>}
        </div>
    );
};

export default BatteryMonitor;
