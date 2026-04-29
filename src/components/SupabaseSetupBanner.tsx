import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, Loader2, Wifi, WifiOff, ExternalLink, Copy, Check } from "lucide-react";
import { diagnoseSupabase } from "@/lib/api";

const FIREBASE_DB_URL = import.meta.env.VITE_FIREBASE_DB_URL || "";

const SetupBanner = () => {
  const [status, setStatus] = useState<"checking" | "ok" | "no_url" | "auth_error" | "network_error" | "db_not_found" | "unknown">("checking");
  const [copied, setCopied] = useState(false);

  const check = async () => {
    setStatus("checking");
    if (!FIREBASE_DB_URL || FIREBASE_DB_URL.includes("placeholder")) {
      setStatus("no_url");
      return;
    }
    const result = await diagnoseSupabase();
    if (result.status === "ok")            setStatus("ok");
    else if (result.status === "network_error") setStatus("network_error");
    else if (result.status === "auth_error")    setStatus("auth_error");
    else if (result.status === "unknown" && (result as { message?: string }).message?.includes("404")) setStatus("db_not_found");
    else                                        setStatus("unknown");
  };

  useEffect(() => { void check(); }, []);

  // Don't show banner when OK
  if (status === "ok") return null;

  const copyUrl = () => {
    navigator.clipboard.writeText("VITE_FIREBASE_DB_URL=https://YOUR-PROJECT-default-rtdb.firebaseio.com");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  type StatusConfig = {
    icon: React.ElementType;
    title: string;
    desc: string;
    color: string;
    bg: string;
    border: string;
  };

  const cfg: Record<string, StatusConfig> = {
    checking:      { icon: Loader2,      title: "Checking connection…",    desc: "Verifying backend connectivity", color: "text-muted-foreground", bg: "bg-secondary/30",    border: "border-white/10" },
    no_url:        { icon: WifiOff,      title: "Firebase not configured",  desc: "Add VITE_FIREBASE_DB_URL to your .env file — see setup guide below", color: "text-amber-400", bg: "bg-amber-500/8",     border: "border-amber-500/25" },
    auth_error:    { icon: XCircle,      title: "Firebase rules blocking",  desc: "Your database exists but rules are blocking access — fix in 30 seconds below", color: "text-danger",      bg: "bg-danger/8",        border: "border-danger/20" },
    network_error: { icon: WifiOff,      title: "No internet connection",   desc: "Location sync will retry automatically when connected", color: "text-amber-400", bg: "bg-amber-500/8",     border: "border-amber-500/25" },
    db_not_found:  { icon: XCircle,      title: "Firebase database not found", desc: "The Firebase DB URL in .env doesn't exist — create a new Realtime Database and update the URL", color: "text-danger", bg: "bg-danger/8", border: "border-danger/20" },
    unknown:       { icon: XCircle,      title: "Backend error",            desc: "Check Firebase configuration", color: "text-danger",      bg: "bg-danger/8",        border: "border-danger/20" },
  };

  const c = cfg[status] ?? cfg.checking;
  const Icon = c.icon;
  const isLoading = status === "checking";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-xl border px-4 py-3 mb-4 space-y-2.5 ${c.bg} ${c.border}`}
      >
        <div className="flex items-center gap-2.5">
          <Icon className={`w-4 h-4 flex-shrink-0 ${c.color} ${isLoading ? "animate-spin" : ""}`} />
          <div className="flex-1">
            <p className={`text-xs font-semibold ${c.color}`}>{c.title}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{c.desc}</p>
          </div>
          <button
            type="button"
            onClick={check}
            className="text-[9px] text-muted-foreground border border-white/10 px-2 py-1 rounded-lg hover:text-foreground transition-colors flex-shrink-0"
          >
            Recheck
          </button>
        </div>

        {/* Setup guide — only show when Firebase URL is missing or DB not found */}
        {(status === "no_url" || status === "db_not_found") && (
          <div className="bg-black/30 rounded-lg p-3 space-y-2 text-[10px]">
            <p className="text-amber-300 font-semibold">Quick Setup (2 minutes):</p>
            <ol className="text-muted-foreground space-y-1.5 list-decimal list-inside">
              <li>Go to <a href="https://console.firebase.google.com" target="_blank" rel="noopener noreferrer" className="text-primary underline inline-flex items-center gap-0.5">console.firebase.google.com <ExternalLink className="w-2.5 h-2.5"/></a></li>
              <li>Create a new project → Add a <strong className="text-foreground">Realtime Database</strong></li>
              <li>In Realtime Database Rules, set: <code className="bg-white/10 px-1 rounded">{`{ "rules": { ".read": true, ".write": true } }`}</code></li>
              <li>Copy your database URL (looks like: <code className="bg-white/10 px-1 rounded">https://your-project-default-rtdb.firebaseio.com</code>)</li>
              <li>
                Add to <code className="bg-white/10 px-1 rounded">.env</code> file:
                <div className="mt-1.5 flex items-center gap-1.5 bg-white/5 rounded px-2 py-1.5 font-mono">
                  <span className="flex-1 text-green-400 text-[9px]">VITE_FIREBASE_DB_URL=https://your-project-default-rtdb.firebaseio.com</span>
                  <button type="button" onClick={copyUrl} className="flex-shrink-0">
                    {copied ? <Check className="w-3 h-3 text-safe" /> : <Copy className="w-3 h-3 text-muted-foreground hover:text-foreground" />}
                  </button>
                </div>
              </li>
              <li>Rebuild the app: <code className="bg-white/10 px-1 rounded">npm run build</code> then reinstall APK</li>
            </ol>
          </div>
        )}

        {/* Firebase rules fix — show when rules are blocking (403) */}
        {status === "auth_error" && (
          <div className="bg-black/30 rounded-lg p-3 space-y-2 text-[10px]">
            <p className="text-danger font-semibold">Fix Firebase Rules (30 seconds):</p>
            <ol className="text-muted-foreground space-y-1.5 list-decimal list-inside">
              <li>Go to <a href="https://console.firebase.google.com" target="_blank" rel="noopener noreferrer" className="text-primary underline inline-flex items-center gap-0.5">Firebase Console <ExternalLink className="w-2.5 h-2.5"/></a></li>
              <li>Select your project → <strong className="text-foreground">Realtime Database</strong> → <strong className="text-foreground">Rules</strong></li>
              <li>Replace the rules with:
                <div className="mt-1.5 bg-white/5 rounded px-2 py-1.5 font-mono text-green-400 text-[9px]">
                  {`{\n  "rules": {\n    ".read": true,\n    ".write": true\n  }\n}`}
                </div>
              </li>
              <li>Click <strong className="text-foreground">Publish</strong> — location sharing will start working immediately</li>
            </ol>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default SetupBanner;
