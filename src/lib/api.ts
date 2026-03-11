import { supabase } from "./supabase";

interface PingBody {
  deviceId: string;
  lat: number;
  lng: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  timestamp?: number;
  battery?: number;
}

export async function sendLocationPing(body: PingBody): Promise<void> {
  const { error } = await supabase
    .from('locations')
    .upsert({
      device_id: body.deviceId,
      latitude: body.lat,
      longitude: body.lng,
      accuracy: body.accuracy,
      speed: body.speed,
      heading: body.heading,
      battery: body.battery,
      updated_at: body.timestamp ? new Date(body.timestamp).toISOString() : new Date().toISOString()
    }, {
      onConflict: 'device_id'
    });

  if (error) {
    console.error("Supabase Ping Error:", error);
    throw new Error(`Ping failed: ${error.message}`);
  }
}

export interface NearbyUser {
  deviceId: string;
  distanceMeters: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  updatedAt: string;
}

/**
 * Fetch nearby users. 
 * Note: For high-performance proximity searches, we would use Supabase RPC with PostGIS.
 * For this demo version, we'll fetch recently active users.
 */
export async function fetchNearbyUsers(params: {
  lat: number;
  lng: number;
  radiusMeters?: number;
  limit?: number;
}): Promise<NearbyUser[]> {
  // Get users updated in the last 15 minutes
  const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .gt('updated_at', fifteenMinsAgo)
    .limit(params.limit || 20);

  if (error) {
    throw new Error(`Nearby query failed: ${error.message}`);
  }

  // Simple haversine-like filter on the frontend for now, or just return all recent
  return (data || []).map(row => ({
    deviceId: row.device_id,
    distanceMeters: 0, // Distance calculation could be added here
    accuracy: row.accuracy,
    speed: row.speed,
    heading: row.heading,
    updatedAt: row.updated_at
  }));
}

export interface DeviceLocation {
  deviceId: string;
  loc?: { type: "Point"; coordinates: [number, number] }; // [lng, lat]
  accuracy?: number;
  speed?: number;
  heading?: number;
  battery?: number;
  updatedAt: string;
}

export async function fetchDeviceLocation(deviceId: string): Promise<DeviceLocation> {
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .eq('device_id', deviceId)
    .maybeSingle();

  if (error) {
    throw new Error(`Device lookup failed: ${error.message}`);
  }
  if (!data) {
    throw new Error("Device not found or location expired");
  }

  return {
    deviceId: data.device_id,
    loc: { type: "Point", coordinates: [data.longitude, data.latitude] },
    accuracy: data.accuracy,
    speed: data.speed,
    heading: data.heading,
    battery: data.battery,
    updatedAt: data.updated_at
  };
}

/**
 * Subscribe to real-time location changes for a specific device
 */
export function subscribeToDeviceLocation(deviceId: string, onUpdate: (location: DeviceLocation) => void) {
  return supabase
    .channel(`location:${deviceId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'locations',
        filter: `device_id=eq.${deviceId}`
      },
      (payload) => {
        const data = payload.new;
        onUpdate({
          deviceId: data.device_id,
          loc: { type: "Point", coordinates: [data.longitude, data.latitude] },
          accuracy: data.accuracy,
          speed: data.speed,
          heading: data.heading,
          battery: data.battery,
          updatedAt: data.updated_at
        });
      }
    )
    .subscribe();
}

export async function checkServerHealth(): Promise<{ status: string }> {
  // For Supabase, "health" is checked by a simple query
  const { error } = await supabase.from('locations').select('count', { count: 'exact', head: true });
  if (error) throw new Error("Supabase connection failed");
  return { status: "ok" };
}
