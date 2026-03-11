import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { z } from "zod";
import { MongoClient, ServerApiVersion } from "mongodb";

dotenv.config();

const PORT = Number(process.env.PORT || 4000);
const MONGODB_URI = process.env.MONGODB_URI;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const LOCATION_TTL_SECONDS = Number(process.env.LOCATION_TTL_SECONDS || 900);

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI is required in server/.env");
}

const app = express();
app.use(
  cors({
    origin: CORS_ORIGIN,
  })
);
app.use(express.json());

const client = new MongoClient(MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const pingSchema = z.object({
  deviceId: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().optional(),
  speed: z.number().optional(),
  heading: z.number().optional(),
  timestamp: z.number().optional(),
  battery: z.number().optional(),
});

const nearbyQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusMeters: z.coerce.number().min(1).max(5000).default(500),
  limit: z.coerce.number().min(1).max(100).default(20),
});

let isConnected = false;

async function initDB() {
  if (process.env.MONGODB_URI?.includes("<user>")) {
    throw new Error(
      "\n❌ ERROR: Your server/.env file contains the placeholder '<user>:<password>'.\n" +
      "You must replace this with a real MongoDB connection string (e.g. from MongoDB Atlas)\n" +
      "or use a local database string like: mongodb://127.0.0.1:27017/guardian_angel\n"
    );
  }

  if (!isConnected) {
    try {
      await client.connect();
      const db = client.db(process.env.MONGODB_DB || "guardian_angel");
      const collection = db.collection("locations");

      // Ensure indexes exist (idempotent)
      await collection.createIndex({ loc: "2dsphere" });
      await collection.createIndex(
        { updatedAt: 1 },
        { expireAfterSeconds: LOCATION_TTL_SECONDS }
      );

      isConnected = true;
      console.log("✅ Connected to MongoDB successfully.");
    } catch (err) {
      console.error("❌ MongoDB Connection failed:", err);
      throw err;
    }
  }
}

async function getLocationsCollection() {
  await initDB();
  const db = client.db(process.env.MONGODB_DB || "guardian_angel");
  return db.collection("locations");
}

app.post("/api/v1/location/ping", async (req, res) => {
  try {
    console.log(`[PING] Received from ${req.body?.deviceId || 'unknown'}`);
    const parsed = pingSchema.parse(req.body);
    const { deviceId, lat, lng, accuracy, speed, heading, timestamp, battery } = parsed;

    const collection = await getLocationsCollection();
    const now = timestamp ? new Date(timestamp) : new Date();

    await collection.updateOne(
      { deviceId },
      {
        $set: {
          deviceId,
          loc: {
            type: "Point",
            coordinates: [lng, lat],
          },
          accuracy,
          speed,
          heading,
          battery,
          updatedAt: now,
        },
      },
      { upsert: true }
    );

    res.status(204).send();
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid payload", details: err.errors });
    }
    console.error("Ping error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/v1/location/nearby", async (req, res) => {
  try {
    const { lat, lng, radiusMeters, limit } = nearbyQuerySchema.parse(req.query);

    const collection = await getLocationsCollection();

    const pipeline = [
      {
        $geoNear: {
          near: { type: "Point", coordinates: [lng, lat] },
          distanceField: "distanceMeters",
          spherical: true,
          maxDistance: radiusMeters,
        },
      },
      { $limit: limit },
      {
        $project: {
          _id: 0,
          deviceId: 1,
          distanceMeters: 1,
          accuracy: 1,
          speed: 1,
          heading: 1,
          updatedAt: 1,
        },
      },
    ];

    const results = await collection.aggregate(pipeline).toArray();

    res.json({ results });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid query", details: err.errors });
    }
    console.error("Nearby error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/v1/location/device/:deviceId", async (req, res) => {
  try {
    const { deviceId } = req.params;
    if (!deviceId) return res.status(400).json({ error: "Device ID is required" });

    const collection = await getLocationsCollection();
    const result = await collection.findOne(
      { deviceId },
      { projection: { _id: 0, deviceId: 1, loc: 1, accuracy: 1, speed: 1, heading: 1, battery: 1, updatedAt: 1 } }
    );

    if (!result) {
      return res.status(404).json({ error: "Device location not found" });
    }

    res.json(result);
  } catch (err) {
    console.error("Device fetch error", err);
    const errorMessage = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: errorMessage });
  }
});

app.get("/health", async (_req, res) => {
  try {
    await client.db().command({ ping: 1 });
    res.json({ status: "ok" });
  } catch {
    res.status(500).json({ status: "error" });
  }
});

if (process.env.VERCEL !== "1") {
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`AI & GPS Monitor API listening on port ${PORT}`);
  });
}

process.on("SIGINT", async () => {
  await client.close();
  process.exit(0);
});

export default app;
