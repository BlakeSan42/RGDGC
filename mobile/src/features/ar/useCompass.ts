/**
 * Hook for device compass heading.
 *
 * - Native: expo-sensors Magnetometer
 * - Web: DeviceOrientationEvent (webkitCompassHeading on iOS Safari,
 *         alpha on Android Chrome)
 *
 * Returns heading in degrees (0-360, 0 = North).
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Platform } from "react-native";

interface CompassState {
  heading: number | null;
  accuracy: number | null;
  error: string | null;
  /** True if iOS Safari needs a user gesture to grant permission. */
  needsPermission: boolean;
  /** Call from a button press handler to request compass permission (iOS Safari). */
  requestPermission: () => Promise<void>;
}

export function useCompass(enabled = true): CompassState {
  const [heading, setHeading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsPermission, setNeedsPermission] = useState(false);
  const [listening, setListening] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  // ── Web compass ──
  const startWebListening = useCallback(() => {
    if (listening) return;

    const handler = (event: DeviceOrientationEvent) => {
      // iOS Safari: webkitCompassHeading is degrees from North
      const iosHeading = (event as any).webkitCompassHeading;
      if (iosHeading != null && !isNaN(iosHeading)) {
        setHeading(Math.round(iosHeading));
        return;
      }
      // Android / other: alpha is rotation around z-axis
      if (event.alpha != null) {
        setHeading(Math.round((360 - event.alpha) % 360));
      }
    };

    // Prefer absolute orientation (Android)
    const w = window as any;
    if ("ondeviceorientationabsolute" in w) {
      w.addEventListener("deviceorientationabsolute", handler);
    } else {
      w.addEventListener("deviceorientation", handler);
    }
    setListening(true);

    // Store cleanup for unmount (via ref, not global)
    cleanupRef.current = () => {
      w.removeEventListener("deviceorientationabsolute", handler);
      w.removeEventListener("deviceorientation", handler);
    };
  }, [listening]);

  const requestPermission = useCallback(async () => {
    try {
      const DOE = DeviceOrientationEvent as any;
      if (typeof DOE.requestPermission === "function") {
        const result = await DOE.requestPermission();
        if (result === "granted") {
          setNeedsPermission(false);
          startWebListening();
        } else {
          setError("Compass permission denied");
        }
      } else {
        startWebListening();
      }
    } catch {
      setError("Compass unavailable");
    }
  }, [startWebListening]);

  useEffect(() => {
    if (!enabled) return;

    // ── Web path ──
    if (Platform.OS === "web") {
      const DOE = DeviceOrientationEvent as any;
      if (typeof DOE.requestPermission === "function") {
        // iOS Safari 13+ — needs user gesture
        setNeedsPermission(true);
      } else if ("DeviceOrientationEvent" in window) {
        startWebListening();
      } else {
        setError("Compass not supported in this browser");
      }

      return () => {
        cleanupRef.current?.();
      };
    }

    // ── Native path ──
    let subscription: { remove: () => void } | null = null;

    (async () => {
      try {
        const { Magnetometer } = await import("expo-sensors");
        const { status } = await Magnetometer.requestPermissionsAsync();
        if (status !== "granted") {
          setError("Magnetometer permission denied");
          return;
        }

        Magnetometer.setUpdateInterval(100); // 10 Hz

        subscription = Magnetometer.addListener(
          (data: { x: number; y: number; z: number }) => {
            const { x, y } = data;
            let angle = Math.atan2(y, x) * (180 / Math.PI);
            angle = (angle + 360) % 360;
            // Magnetometer reports from East, convert to North
            angle = (360 - angle + 90) % 360;
            setHeading(Math.round(angle));
          },
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Compass unavailable");
      }
    })();

    return () => {
      subscription?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { heading, accuracy: null, error, needsPermission, requestPermission };
}

/**
 * Calculate the bearing (in degrees) from point A to point B.
 * Both points are [longitude, latitude].
 */
export function bearingTo(
  from: [number, number],
  to: [number, number],
): number {
  const lat1 = toRad(from[1]);
  const lat2 = toRad(to[1]);
  const dLng = toRad(to[0] - from[0]);

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}
