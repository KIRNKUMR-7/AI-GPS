import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Eye, MapPin, Navigation, Activity, Zap, Search, AlertCircle, Database } from "lucide-react";
import { fetchDeviceLocation, checkServerHealth, subscribeToDeviceLocation, type DeviceLocation } from "@/lib/api";

const ParentDashboard = () => {
    const [deviceIdInput, setDeviceIdInput] = useState("");
    const [pairedDeviceId, setPairedDeviceId] = useState<string | null>(() => {
        return localStorage.getItem("guardian_parent_paired_device");
    });

    const [location, setLocation] = useState<DeviceLocation | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [dbStatus, setDbStatus] = useState<"checking" | "connected" | "disconnected">("checking");

    useEffect(() => {
        const checkHealth = async () => {
            try {
                const health = await checkServerHealth();
                setDbStatus(health.status === "ok" ? "connected" : "disconnected");
            } catch {
                setDbStatus("disconnected");
            }
        };
        checkHealth();
        const interval = setInterval(checkHealth, 30000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!pairedDeviceId) return;

        // Initial fetch
        const fetchData = async () => {
            try {
                const data = await fetchDeviceLocation(pairedDeviceId!);
                setLocation(data);
                setError(null);
            } catch (err) {
                if (err instanceof Error) {
                    setError(err.message);
                } else {
                    setError("Failed to fetch location");
                }
            }
        };

        fetchData();

        // Subscribe to real-time updates
        const subscription = subscribeToDeviceLocation(pairedDeviceId, (newLocation) => {
            setLocation(newLocation);
            setError(null);
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [pairedDeviceId]);

    const [timeAgo, setTimeAgo] = useState("--");

    useEffect(() => {
        if (!location?.updatedAt) return;

        const updateTimeAgo = () => {
            const diff = Date.now() - new Date(location.updatedAt).getTime();
            const seconds = Math.floor(diff / 1000);

            if (seconds < 60) setTimeAgo("Just now");
            else if (seconds < 3600) setTimeAgo(`${Math.floor(seconds / 60)}m ago`);
            else setTimeAgo(`${Math.floor(seconds / 3600)}h ago`);
        };

        updateTimeAgo();
        const t = setInterval(updateTimeAgo, 30000);
        return () => clearInterval(t);
    }, [location]);

    const handlePair = (e: React.FormEvent) => {
        e.preventDefault();
        if (!deviceIdInput.trim()) return;
        setPairedDeviceId(deviceIdInput.trim());
        localStorage.setItem("guardian_parent_paired_device", deviceIdInput.trim());
        setIsLoading(true);
        // Location effect will trigger and clear loading when done
        setTimeout(() => setIsLoading(false), 2000);
    };

    const handleUnpair = () => {
        setPairedDeviceId(null);
        setLocation(null);
        setError(null);
        setTimeAgo("--");
        localStorage.removeItem("guardian_parent_paired_device");
    };

    if (!pairedDeviceId) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative">
                <div className="absolute inset-0 z-0 bg-grid-white/[0.02]" />

                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="glass-card p-8 w-full max-w-md relative z-10"
                >
                    <div className="w-16 h-16 bg-safe/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-safe/20">
                        <Eye className="w-8 h-8 text-safe" />
                    </div>
                    <h1 className="text-2xl font-bold text-center mb-2">Connect to Device</h1>
                    <p className="text-sm text-center text-muted-foreground mb-8">
                        Enter the Monitoring Pairing ID from the protecting device to begin live tracking.
                    </p>

                    <form onSubmit={handlePair} className="space-y-4">
                        <div>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder="e.g. 1a2b3c4d-..."
                                    className="w-full bg-secondary/50 border border-primary/20 rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-safe/50 focus:border-transparent transition-all"
                                    value={deviceIdInput}
                                    onChange={(e) => setDeviceIdInput(e.target.value)}
                                />
                            </div>
                        </div>
                        <button
                            type="submit"
                            className="w-full bg-safe hover:bg-safe/90 text-safe-foreground font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                            disabled={!deviceIdInput.trim()}
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                "Start Monitoring"
                            )}
                        </button>
                    </form>
                </motion.div>
            </div>
        );
    }

    const lat = location?.loc?.coordinates[1] ?? 0;
    const lng = location?.loc?.coordinates[0] ?? 0;
    const accuracy = location?.accuracy ? Math.round(location.accuracy) : "--";
    const speed = location?.speed ? Math.round(location.speed * 3.6) : 0; // m/s to km/h

    return (
        <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8 max-w-6xl mx-auto flex flex-col">
            {/* Header */}
            <motion.header
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between mb-6"
            >
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-safe/15 flex items-center justify-center border border-safe/30 shadow-[0_0_15px_rgba(var(--safe),0.2)]">
                        <Eye className="w-6 h-6 text-safe" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground tracking-tight">Monitor Dashboard</h1>
                        <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                            Tracking ID: <span className="font-mono text-safe bg-safe/10 px-1.5 rounded">{pairedDeviceId.slice(0, 8)}...</span>
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium ${dbStatus === "connected" ? "bg-safe/10 border-safe/20 text-safe" :
                        dbStatus === "checking" ? "bg-secondary text-muted-foreground" :
                            "bg-danger/10 border-danger/20 text-danger"
                        }`}>
                        <Database className="w-3.5 h-3.5" />
                        {dbStatus === "connected" ? "DB Connected" : dbStatus === "checking" ? "Checking DB..." : "DB Disconnected"}
                    </div>
                    <button
                        onClick={() => window.location.reload()}
                        className="p-2 rounded-lg bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors"
                        title="Refresh Data"
                    >
                        <Activity className="w-4 h-4" />
                    </button>
                    <button
                        onClick={handleUnpair}
                        className="text-xs px-3 py-1.5 rounded-lg border border-danger/30 text-danger hover:bg-danger/10 transition-colors"
                    >
                        Disconnect
                    </button>
                </div>
            </motion.header>

            {error && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="glass-card bg-danger/5 border-danger/20 p-4 mb-6 flex items-start gap-3"
                >
                    <AlertCircle className="w-5 h-5 text-danger shrink-0 mt-0.5" />
                    <div>
                        <h3 className="font-semibold text-danger text-sm">System Connection Issue</h3>
                        <p className="text-xs text-danger/80">{error}</p>
                        <p className="text-[10px] text-danger/60 mt-1 font-mono">Check if the 'locations' table exists in your Supabase project.</p>
                    </div>
                </motion.div>
            )}

            {/* Main Map Area */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="glass-card p-1 flex-1 min-h-[400px] mb-6 relative overflow-hidden flex flex-col"
            >
                <div className="absolute top-4 left-4 z-10 flex gap-2">
                    <div className="glass-card px-3 py-1.5 flex items-center gap-2 border-safe/30 bg-background/80 backdrop-blur-xl">
                        <div className="w-2 h-2 rounded-full bg-safe animate-pulse" />
                        <span className="text-xs font-semibold text-safe tracking-wider uppercase">Live Connection</span>
                    </div>
                    <div className="glass-card px-3 py-1.5 flex items-center gap-2 border-primary/20 bg-background/80 backdrop-blur-xl">
                        <span className="text-xs font-medium text-muted-foreground">Updated: {timeAgo}</span>
                    </div>
                </div>

                {location ? (
                    <iframe
                        width="100%"
                        className="flex-1 rounded-xl"
                        frameBorder="0"
                        style={{ border: 0, filter: "invert(90%) hue-rotate(180deg) contrast(1.2) brightness(0.9)" }}
                        src={`https://maps.google.com/maps?q=${lat},${lng}&hl=en&z=16&output=embed`}
                        allowFullScreen
                    ></iframe>
                ) : (
                    <div className="flex-1 rounded-xl bg-secondary/30 flex items-center justify-center">
                        <div className="w-8 h-8 border-4 border-safe/30 border-t-safe rounded-full animate-spin" />
                    </div>
                )}
            </motion.div>

            {/* Stats Grid */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="grid grid-cols-2 lg:grid-cols-4 gap-4"
            >
                <div className="glass-card p-4 flex items-center gap-4 hover:border-safe/40 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <MapPin className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Coordinates</p>
                        <p className="text-sm font-mono font-semibold">{lat.toFixed(4)}, {lng.toFixed(4)}</p>
                    </div>
                </div>

                <div className="glass-card p-4 flex items-center gap-4 hover:border-safe/40 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-safe/10 flex items-center justify-center">
                        <Zap className="w-5 h-5 text-safe" />
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Speed</p>
                        <p className="text-sm font-mono font-semibold">{speed} <span className="text-[10px] text-muted-foreground">km/h</span></p>
                    </div>
                </div>

                <div className="glass-card p-4 flex items-center gap-4 hover:border-safe/40 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center">
                        <Navigation className="w-5 h-5 text-warning" />
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Accuracy</p>
                        <p className="text-sm font-mono font-semibold">±{accuracy} <span className="text-[10px] text-muted-foreground">m</span></p>
                    </div>
                </div>

                <div className="glass-card p-4 flex items-center gap-4 hover:border-safe/40 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Activity className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Status</p>
                        <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-safe">Online</p>
                            {location?.battery !== undefined && (
                                <span className={`text-xs font-mono px-1.5 py-0.5 rounded-md ${location.battery < 20 ? 'bg-danger/20 text-danger' : 'bg-primary/20 text-primary'}`}>
                                    {location.battery}% Battery
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default ParentDashboard;
