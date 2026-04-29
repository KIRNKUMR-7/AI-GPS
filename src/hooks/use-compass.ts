import { useState, useEffect, useCallback } from "react";

export function useCompass() {
  const [heading, setHeading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState<boolean>(false);

  // iOS 13+ requires a user interaction to request DeviceOrientation events
  const requestPermission = useCallback(async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (typeof (DeviceOrientationEvent as any).requestPermission === "function") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const permissionState = await (DeviceOrientationEvent as any).requestPermission();
        if (permissionState === "granted") {
          setPermissionGranted(true);
          setError(null);
        } else {
          setError("Compass permission denied. Enable motion sensors in settings.");
          setPermissionGranted(false);
        }
      } else {
        // Android and older iOS devices don't require explicit permissions
        setPermissionGranted(true);
        setError(null);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to access device sensors: ${msg}`);
    }
  }, []);

  useEffect(() => {
    // If permission not granted, don't listen
    if (!permissionGranted) {
      // Auto-grant for non-iOS devices
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (typeof (DeviceOrientationEvent as any).requestPermission !== "function") {
        setPermissionGranted(true);
      }
      return;
    }

    const handleOrientation = (event: DeviceOrientationEvent) => {
      let compassHeading = null;
      
      // iOS specific webkitCompassHeading
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((event as any).webkitCompassHeading !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        compassHeading = (event as any).webkitCompassHeading;
      } 
      // Android / Standard fallback using alpha, beta, gamma
      else if (event.alpha !== null) {
        // 'alpha' is degrees from North, but in standard spec it rotates counter-clockwise.
        // Convert to standard compass heading (0 = North, clockwise)
        compassHeading = 360 - event.alpha;
      }

      if (compassHeading !== null) {
        setHeading(compassHeading);
      }
    };

    // Absolute provides more accurate world-referenced orientation if available
    window.addEventListener("deviceorientationabsolute", handleOrientation as EventListener, true);
    window.addEventListener("deviceorientation", handleOrientation as EventListener, true);

    return () => {
      window.removeEventListener("deviceorientationabsolute", handleOrientation as EventListener, true);
      window.removeEventListener("deviceorientation", handleOrientation as EventListener, true);
    };
  }, [permissionGranted]);

  return { heading, error, permissionGranted, requestPermission };
}
