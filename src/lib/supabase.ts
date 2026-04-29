import { createClient } from '@supabase/supabase-js';

// ── Credentials ───────────────────────────────────────────────────────────────
// VITE_ env vars are injected at build time by Vite.
// Fallback to hardcoded values so the Android APK (which bundles the dist)
// always has working credentials — these are PUBLIC anon keys, safe to embed.
const SUPABASE_URL =
    import.meta.env.VITE_SUPABASE_URL ||
    'https://yihftemcaytptmkttceq.supabase.co';

const SUPABASE_ANON_KEY =
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpaGZ0ZW1jYXl0cHRta3R0Y2VxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NjE0NzQsImV4cCI6MjA4ODUzNzQ3NH0.IxeDPHSKzLk_1GOglMjHUSpDghrExX8hlBDYOu1oTy0';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn(
        '[Supabase] Credentials missing — VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set.'
    );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: false,   // no auth needed — anonymous read/write via RLS
        autoRefreshToken: false,
    },
    global: {
        headers: {
            'X-Client-Info': 'guardian-angel/1.0',
        },
    },
    // Increase default timeout for Android WebView (slower than desktop)
    db: {
        schema: 'public',
    },
    realtime: {
        timeout: 15000,
    },
});

export { SUPABASE_URL, SUPABASE_ANON_KEY };
