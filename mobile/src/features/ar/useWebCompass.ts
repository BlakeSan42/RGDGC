/**
 * useWebCompass — Browser-based compass using DeviceOrientationEvent.
 *
 * On iPhone Safari, requires user gesture to request permission
 * (DeviceOrientationEvent.requestPermission). Returns heading in
 * degrees (0-360, 0 = North).
 *
 * Falls back gracefully when not available (desktop browsers, denied).
 */

import { useState, useEffect, useCallback } from "react";
import { Platform } from "react-native";

interface WebCompassState {
  heading: number | null;
  error: string | null;
  needsPermission: boolean;
  requestPermission: () => Promise<void>;
}

export function useWebCompass(enabled = true): WebCompassState {
  const [heading, setHeading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsPermission, setNeedsPermission] = useState(false);
  const [listening, setListening] = useState(false);

  const startListening = useCallback(() => {
    if (listening) return;

    const handler = (event: DeviceOrientationEvent) => {
      // iOS Safari provides webkitCompassHeading (degrees from North)
      const iosHeading = (event as any).webkitCompassHeading;
      if (iosHeading != null && !isNaN(iosHeading)) {
        setHeading(Math.round(iosHeading));
        return;
      }

      // Android Chrome provides alpha (degrees from North when absolute)
      if (event.alpha != null) {
        // alpha is rotation around z-axis, 0-360
        // On Android with "deviceorientationabsolute", alpha is compass heading
        setHeading(Math.round(360 - event.alpha));
        return;
      }
    };

    // Try absolute orientation first (Android)
    const w = window as any;
    if ("ondeviceorientationabsolute" in w) {
      w.addEventListener("deviceorientationabsolute", handler);
    } else {
      w.addEventListener("deviceorientation", handler);
    }

    setListening(true);

    // Cleanup stored for unmount
    w.__rgdgc_compass_cleanup = () => {
      w.removeEventListener("deviceorientationabsolute", handler);
      w.removeEventListener("deviceorientation", handler);
    };
  }, [listening]);

  const requestPermission = useCallback(async () => {
    try {
      // iOS 13+ requires explicit permission request via user gesture
      const DOE = DeviceOrientationEvent as any;
      if (typeof DOE.requestPermission === "function") {
        const result = await DOE.requestPermission();
        if (result === "granted") {
          setNeedsPermission(false);
          startListening();
        } else {
          setError("Compass permission denied");
        }
      } else {
        // Non-iOS or older — just start listening
        startListening();
      }
    } catch {
      setError("Compass unavailable");
    }
  }, [startListening]);

  useEffect(() => {
    if (Platform.OS !== "web" || !enabled) return;

    // Check if permission request is needed (iOS Safari)
    const DOE = DeviceOrientationEvent as any;
    if (typeof DOE.requestPermission === "function") {
      // Need user gesture to request — set flag
      setNeedsPermission(true);
    } else if ("DeviceOrientationEvent" in window) {
      // Can start immediately (Android, desktop)
      startListening();
    } else {
      setError("Compass not supported");
    }

    return () => {
      const cleanup = (window as any).__rgdgc_compass_cleanup;
      if (cleanup) cleanup();
    };
  }, [enabled, startListening]);

  return { heading, error, needsPermission, requestPermission };
}
