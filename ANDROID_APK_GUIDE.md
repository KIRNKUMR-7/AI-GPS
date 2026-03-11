## Building the Android APK for Guardian Angel Alert

This app is a Vite + React web UI wrapped by Capacitor, with a small Node/Mongo backend for crowd GPS.

### 1) Install Android & Capacitor tooling

- Install **Android Studio** (includes SDK + platform tools).
- Add `ANDROID_HOME` and platform-tools to your `PATH` if not already done.
- From the project root, install dependencies:

```bash
npm install
cd server && npm install && cd ..
```

### 2) Configure server environment

- In `server/`, create a `.env` by copying `.env.example` and filling:
  - `MONGODB_URI` / `MONGODB_DB`
  - `PORT` (e.g. `4000`)
  - `CORS_ORIGIN`:
    - For web dev: `http://localhost:8080`
    - For Android emulator: `http://10.0.2.2:8080` (front-end) or your production URL

Run the API locally during development:

```bash
cd server
npm run dev
```

### 3) Point the app at Supabase

Create/Update the `.env` file in the project root with your Supabase credentials. These will be baked into the APK during the build process:

```bash
VITE_SUPABASE_URL=https://yihftemcaytptmkttceq.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpaGZ0ZW1jYXl0cHRta3R0Y2VxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NjE0NzQsImV4cCI6MjA4ODUzNzQ3NH0.IxeDPHSKzLk_1GOglMjHUSpDghrExX8hlBDYOu1oTy0
# VITE_API_URL is optional if using Supabase directly for everything
VITE_API_URL=http://your-machine-ip:4000 
```

On a physical device, replace `10.0.2.2` with your machine IP reachable from the phone (e.g. `http://192.168.1.50:4000`), or use a public URL.

### 4) Build the web app and sync Android

From the project root:

```bash
npm run build
npx cap sync android
```

This generates/updates the `android/` project and copies the built web assets into it.

### 5) Open Android Studio and run

1. Open **Android Studio**.
2. Choose **Open an existing project** and select the `android/` folder in this repo.
3. Let Gradle sync finish.
4. Select a device (emulator or real phone with USB debugging).
5. Press **Run** to install a debug build.

### 6) Create a signed release APK/AAB

Inside Android Studio:

1. Go to **Build → Generate Signed App Bundle / APK…**
2. Choose **Android App Bundle** or **APK** (for direct install).
3. Create a new keystore or use an existing one:
   - Keep the keystore file and passwords backed up safely.
4. Select the `release` build variant.
5. After build, Android Studio shows the output folder for the `.aab` or `.apk`.

You can now upload the AAB to Play Console or sideload the APK for testing.

### 7) Permissions & behavior

`android/app/src/main/AndroidManifest.xml` already includes:

- Location: `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `ACCESS_BACKGROUND_LOCATION`
- Camera/mic for evidence recording
- SMS/call for SOS (actual auto-SMS sending may require extra handling beyond the current `sms:` deeplink)

On first launch, the app will prompt for GPS and camera/mic permissions when features are used.

