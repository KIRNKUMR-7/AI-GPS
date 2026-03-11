import { motion } from "framer-motion";
import { Shield, Eye } from "lucide-react";
import { Link } from "react-router-dom";

const Landing = () => {
    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Background gradients */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-safe/20 rounded-full blur-[100px] pointer-events-none" />

            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center mb-12 relative z-10"
            >
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground mb-3">Monitor System</h1>
                <p className="text-lg text-muted-foreground w-full max-w-sm mx-auto">
                    AI-Powered real-time monitoring. How are you using the system today?
                </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl relative z-10">
                <Link to="/child">
                    <motion.div
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="glass-card p-8 flex flex-col items-center text-center space-y-4 hover:border-primary/50 transition-colors h-full cursor-pointer"
                    >
                        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                            <Shield className="w-8 h-8 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold mb-2">Protecting Mode</h2>
                            <p className="text-sm text-muted-foreground">
                                Broadcast location, detect falls, and alert guardians in real-time.
                            </p>
                        </div>
                    </motion.div>
                </Link>

                <Link to="/parent">
                    <motion.div
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="glass-card p-8 flex flex-col items-center text-center space-y-4 hover:border-safe/50 transition-colors h-full cursor-pointer"
                    >
                        <div className="w-16 h-16 bg-safe/10 rounded-full flex items-center justify-center">
                            <Eye className="w-8 h-8 text-safe" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold mb-2">Monitor Mode</h2>
                            <p className="text-sm text-muted-foreground">
                                Access the dashboard to view live location, speed, and device stats.
                            </p>
                        </div>
                    </motion.div>
                </Link>
            </div>

            <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="absolute bottom-6 text-xs text-muted-foreground"
            >
                Select your role to continue securely.
            </motion.p>
        </div>
    );
};

export default Landing;
