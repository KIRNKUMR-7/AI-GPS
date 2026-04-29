import { useQuery } from "@tanstack/react-query";
import { fetchNearbyUsers } from "@/lib/api";
import { useLocation } from "@/hooks/use-location";
import { MapPin, Radar, Loader2, WifiOff, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const metersToReadable = (m: number) => {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(2)} km`;
};

const timeAgo = (iso: string) => {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.round((now - then) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  return `${diffHr}h ago`;
};

const NearbyUsers = () => {
  const { coords } = useLocation();

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["nearby-users", coords?.lat, coords?.lng],
    queryFn: async () => {
      if (!coords) return [];
      return fetchNearbyUsers({
        lat: coords.lat,
        lng: coords.lng,
        radiusMeters: 800,
        limit: 25,
      });
    },
    enabled: !!coords,
    refetchInterval: 60_000,         // every 60 s (fetchNearbyUsers is silent on failure)
    retry: 0,                        // no retry — api already handles it
    staleTime: 30_000,
  });

  // fetchNearbyUsers returns [] on network errors, so 'error' only fires
  // for schema/RLS issues — real errors worth showing.
  const errMsg = error instanceof Error ? error.message : null;

  return (
    <div className="glass-card p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radar className="w-4 h-4 text-primary animate-pulse" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Nearby Guardians
          </h3>
          {data && data.length > 0 && (
            <span className="text-[10px] bg-safe/20 text-safe border border-safe/20 px-1.5 py-0.5 rounded-full font-bold">
              {data.length}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          {isFetching ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <RefreshCw className="w-3 h-3" />
          )}
          Refresh
        </button>
      </div>

      {/* No GPS yet */}
      {!coords && (
        <p className="text-xs text-muted-foreground italic">
          Waiting for GPS fix to discover nearby users…
        </p>
      )}

      {/* Error state — friendly */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/8 border border-amber-500/20"
          >
            <WifiOff className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-amber-400">Setup Required</p>
              <p className="text-[10px] text-amber-400/70 mt-0.5 break-words">
                {errMsg || "Could not load nearby devices."}
              </p>
              {errMsg?.includes("locations table") && (
                <p className="text-[10px] text-amber-300 mt-1 font-mono">
                  Run the Supabase setup SQL in your project dashboard.
                </p>
              )}
              {errMsg?.includes("RLS") && (
                <p className="text-[10px] text-amber-300 mt-1 font-mono">
                  Run: GRANT SELECT ON locations TO anon;
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => refetch()}
              className="text-[10px] text-amber-400 border border-amber-400/30 px-2 py-1 rounded-lg hover:bg-amber-400/10 transition-colors flex-shrink-0"
            >
              Retry
            </button>
          </motion.div>
        )}
      </AnimatePresence>


      {/* Loading spinner */}
      {isLoading && coords && (
        <p className="text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-3 h-3 animate-spin" />
          Scanning your surroundings…
        </p>
      )}

      {/* Results */}
      {data && data.length > 0 && (
        <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
          <AnimatePresence>
            {data.map((user) => (
              <motion.div
                key={user.deviceId}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                className="flex items-start gap-3 p-2.5 rounded-xl bg-secondary/30 border border-white/5"
              >
                <div className="mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-safe" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-foreground">
                      Guardian within {metersToReadable(user.distanceMeters)}
                    </p>
                    <span className="text-[10px] text-muted-foreground ml-2 flex-shrink-0">
                      {timeAgo(user.updatedAt)}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Accuracy: {user.accuracy ? `${Math.round(user.accuracy)}m` : "unknown"}
                    {user.speed != null && ` · Speed ~ ${user.speed.toFixed(1)} km/h`}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Empty state */}
      {data && data.length === 0 && coords && !isLoading && !error && (
        <p className="text-xs text-muted-foreground italic">
          No other opted-in users detected within 800 m. You are the first Guardian here.
        </p>
      )}

      {data && (
        <p className="text-[10px] text-muted-foreground/50 text-center">
          {data.length} real device{data.length !== 1 ? "s" : ""} detected in range
        </p>
      )}
    </div>
  );
};

export default NearbyUsers;
