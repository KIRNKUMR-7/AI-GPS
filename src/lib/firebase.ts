import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get, onValue, off } from "firebase/database";

// ── Firebase Config ───────────────────────────────────────────────────────────
// DB URL is read from VITE_FIREBASE_DB_URL (same URL that api.ts REST calls use).
// Set VITE_FIREBASE_DB_URL in your .env file.
// Data path: /locations/<deviceId>
const DB_URL =
  import.meta.env.VITE_FIREBASE_DB_URL ||
  "https://guardian-angel-rtdb-default-rtdb.firebaseio.com";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyD-placeholder-replace-with-yours",
  authDomain: "guardian-angel-rtdb.firebaseapp.com",
  databaseURL: DB_URL,
  projectId: "guardian-angel-rtdb",
  storageBucket: "guardian-angel-rtdb.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:placeholder",
};

// Initialise
const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

// Re-export Firebase RTDB helpers so api.ts doesn't need direct Firebase imports
export { ref, set, get, onValue, off };
