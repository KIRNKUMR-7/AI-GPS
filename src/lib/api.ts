// ─── LOCATION API — Firebase Realtime Database ───────────────────────────────
//
// We use Firebase RTDB REST API (plain fetch — no SDK issues in Android WebView).
// Database URL is stored in VITE_FIREBASE_DB_URL environment variable.
// Rules are set to allow public read/write (fine for a personal safety app).
//
// Data layout:
//   /locations/<deviceId> → { lat, lng, accuracy, speed, heading, battery, ts }
// ─────────────────────────────────────────────────────────────────────────────

const FIREBASE_DB_URL =
  import.meta.env.VITE_FIREBASE_DB_URL ||
  "https://guardian-angel-rtdb-default-rtdb.firebaseio.com"; // fallback — set your own!

const IS_MOCK = FIREBASE_DB_URL.includes("guardian-angel-rtdb-default-rtdb");

// ── Mock Backend (localStorage) ───────────────────────────────────────────────
function getMockLocations(): Record<string, any> {
  try { return JSON.parse(localStorage.getItem("guardian_mock_locations") || "{}"); } catch { return {}; }
}
function setMockLocation(deviceId: string, data: any) {
  const locs = getMockLocations();
  locs[deviceId] = data;
  localStorage.setItem("guardian_mock_locations", JSON.stringify(locs));
  // Fire event for same-tab reactivity (optional, since React Query / polling handles reads)
}

/** Build the REST endpoint for a device's location node */
function locationUrl(deviceId: string): string {
  return `${FIREBASE_DB_URL}/locations/${encodeURIComponent(deviceId)}.json`;
}

/** Build the REST endpoint for all locations */
function allLocationsUrl(): string {
  return `${FIREBASE_DB_URL}/locations.json`;
}

// ── Timeout helper ────────────────────────────────────────────────────────────

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  ms = 10_000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

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

export type PingResult =
  | { ok: true }
  | { ok: false; reason: "network" | "rls" | "table_missing" | "auth" | "unknown"; message: string };

// ── sendLocationPing ──────────────────────────────────────────────────────────

/**
 * Writes device location to Firebase RTDB.
 * Returns PingResult — never throws.
 */
export async function sendLocationPing(body: PingBody): Promise<PingResult> {
  const payload = {
    lat:      body.lat,
    lng:      body.lng,
    accuracy: body.accuracy ?? null,
    speed:    body.speed    ?? null,
    heading:  body.heading  ?? null,
    battery:  body.battery  ?? null,
    ts:       body.timestamp ?? Date.now(),
    updated:  new Date().toISOString(),
  };

  if (IS_MOCK) {
    setMockLocation(body.deviceId, payload);
    return { ok: true };
  }

  try {
    const res = await fetchWithTimeout(
      locationUrl(body.deviceId),
      {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      },
      10_000
    );

    if (res.ok) return { ok: true };

    if (res.status === 401 || res.status === 403) {
      return { ok: false, reason: "rls", message: "Firebase rules are blocking writes. Set database rules to allow public read/write." };
    }
    if (res.status === 404) {
      return { ok: false, reason: "table_missing", message: "Firebase database path not found. Check your DB URL in .env" };
    }
    return { ok: false, reason: "unknown", message: `HTTP ${res.status}` };

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const isNet = msg.includes("abort") || msg.includes("fetch") || msg.includes("network");
    return { ok: false, reason: isNet ? "network" : "unknown", message: msg };
  }
}

// ── fetchDeviceLocation ───────────────────────────────────────────────────────

export interface DeviceLocation {
  deviceId:  string;
  loc?:      { type: "Point"; coordinates: [number, number] };
  accuracy?: number;
  speed?:    number;
  heading?:  number;
  battery?:  number;
  updatedAt: string;
}

/**
 * Reads a single device's latest location from Firebase RTDB.
 * Throws human-readable errors.
 */
export async function fetchDeviceLocation(deviceId: string): Promise<DeviceLocation> {
  if (IS_MOCK) {
    const data = getMockLocations()[deviceId];
    if (!data) throw new Error("Device not found in local mock testing. Make sure the protecting phone is running.");
    return {
      deviceId,
      loc:       { type: "Point", coordinates: [data.lng, data.lat] },
      accuracy:  data.accuracy ?? undefined,
      speed:     data.speed    ?? undefined,
      heading:   data.heading  ?? undefined,
      battery:   data.battery  ?? undefined,
      updatedAt: data.updated  ?? new Date().toISOString(),
    };
  }

  let res: Response;
  try {
    res = await fetchWithTimeout(locationUrl(deviceId), {}, 10_000);
  } catch (e) {
    throw new Error("Network unavailable — check your internet connection.");
  }

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error("Firebase rules are blocking reads — set rules to allow public.");
    }
    throw new Error(`Server error: HTTP ${res.status}`);
  }

  const data = await res.json();

  if (!data || typeof data !== "object" || data.lat == null) {
    throw new Error(
      "Device not found — make sure the protecting phone is running and has sent at least one location update."
    );
  }

  return {
    deviceId,
    loc:       { type: "Point", coordinates: [data.lng, data.lat] },
    accuracy:  data.accuracy ?? undefined,
    speed:     data.speed    ?? undefined,
    heading:   data.heading  ?? undefined,
    battery:   data.battery  ?? undefined,
    updatedAt: data.updated  ?? new Date().toISOString(),
  };
}

// ── fetchNearbyUsers ──────────────────────────────────────────────────────────

export interface NearbyUser {
  deviceId:       string;
  distanceMeters: number;
  latitude:       number;
  longitude:      number;
  accuracy?:      number;
  speed?:         number;
  heading?:       number;
  battery?:       number;
  updatedAt:      string;
}

const toRad = (d: number) => (d * Math.PI) / 180;
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Reads all locations from Firebase and filters to within radiusMeters.
 * Returns [] silently on network error (no error banner).
 */
export async function fetchNearbyUsers(params: {
  lat:           number;
  lng:           number;
  radiusMeters?: number;
  limit?:        number;
}): Promise<NearbyUser[]> {
  try {
    let data: Record<string, any> | null = null;
    
    if (IS_MOCK) {
      data = getMockLocations();
    } else {
      const res = await fetchWithTimeout(allLocationsUrl(), {}, 10_000);
      if (!res.ok) return [];
      data = await res.json();
    }

    if (!data) return [];

    const fifteenMinsAgo = Date.now() - 15 * 60 * 1000;
    const radiusM = params.radiusMeters ?? 800;

    return Object.entries(data)
      .filter(([, v]) => v.lat != null && v.lng != null && (v.ts ?? 0) > fifteenMinsAgo)
      .map(([deviceId, v]) => ({
        deviceId,
        latitude:       v.lat,
        longitude:      v.lng,
        distanceMeters: Math.round(haversine(params.lat, params.lng, v.lat, v.lng)),
        accuracy:       v.accuracy  ?? undefined,
        speed:          v.speed     ?? undefined,
        heading:        v.heading   ?? undefined,
        battery:        v.battery   ?? undefined,
        updatedAt:      v.updated   ?? new Date().toISOString(),
      }))
      .filter((u) => u.distanceMeters <= radiusM)
      .slice(0, params.limit ?? 50);

  } catch {
    return []; // silent on network error
  }
}

// ── Real-time subscription ────────────────────────────────────────────────────

/**
 * Polls Firebase every 5 s for real-time-like updates.
 * Returns a cleanup function that stops polling.
 */
export function subscribeToDeviceLocation(
  deviceId: string,
  onUpdate: (location: DeviceLocation) => void
): { unsubscribe: () => void } {
  let active = true;

  const poll = async () => {
    if (!active) return;
    try {
      const loc = await fetchDeviceLocation(deviceId);
      if (active) onUpdate(loc);
    } catch { /* ignore — parent UI handles errors */ }
    if (active) setTimeout(poll, 5_000);
  };

  poll();
  return { unsubscribe: () => { active = false; } };
}

// ── Diagnostics ───────────────────────────────────────────────────────────────

export type DiagnosticResult =
  | { status: "ok" }
  | { status: "network_error" }
  | { status: "auth_error" }
  | { status: "unknown"; message: string };

export async function diagnoseSupabase(): Promise<DiagnosticResult> {
  if (IS_MOCK) return { status: "ok" };
  
  try {
    const res = await fetchWithTimeout(allLocationsUrl(), {}, 8_000);
    if (res.ok || res.status === 204) return { status: "ok" };
    if (res.status === 401 || res.status === 403) return { status: "auth_error" };
    return { status: "unknown", message: `HTTP ${res.status}` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("abort") || msg.includes("fetch") || msg.includes("network")) {
      return { status: "network_error" };
    }
    return { status: "unknown", message: msg };
  }
}

export async function checkServerHealth(): Promise<{ status: string }> {
  const result = await diagnoseSupabase();
  if (result.status === "ok") return { status: "ok" };
  throw new Error(result.status === "network_error" ? "Network unavailable" : "Firebase error");
}
