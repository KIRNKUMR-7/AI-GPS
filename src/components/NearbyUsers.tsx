import { useQuery } from "@tanstack/react-query";
import { fetchNearbyUsers } from "@/lib/api";
import { useLocation } from "@/hooks/use-location";
import { MapPin, Radar, Loader2 } from "lucide-react";

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
    refetchInterval: 5000,
  });

  return (
    <div className="glass-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radar className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Nearby Guardians
          </h3>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          {isFetching ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <span className="w-2 h-2 rounded-full bg-safe animate-pulse" />
          )}
          Refresh
        </button>
      </div>

      {!coords && (
        <p className="text-xs text-muted-foreground">
          Waiting for your GPS fix to discover nearby users…
        </p>
      )}

      {error && (
        <p className="text-xs text-danger">
          Could not load nearby users. They may be out of range or the network is offline.
        </p>
      )}

      {isLoading && coords && (
        <p className="text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-3 h-3 animate-spin" />
          Scanning your surroundings…
        </p>
      )}

      {data && data.length > 0 && (
        <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
          {data.map((user) => (
            <div
              key={user.deviceId}
              className="flex items-start gap-3 p-2 rounded-lg bg-secondary/30"
            >
              <div className="mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-safe" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-foreground">
                    Guardian within {metersToReadable(user.distanceMeters)}
                  </p>
                  <span className="text-[10px] text-muted-foreground ml-2">
                    {timeAgo(user.updatedAt)}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Accuracy: {user.accuracy ? `${Math.round(user.accuracy)}m` : "unknown"}
                  {user.speed != null && ` · Speed ~ ${user.speed.toFixed(1)} km/h`}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {data && data.length === 0 && coords && !isLoading && !error && (
        <p className="text-xs text-muted-foreground">
          No other opted-in users detected within your radius yet. You are the first Guardian here.
        </p>
      )}
    </div>
  );
};

export default NearbyUsers;

