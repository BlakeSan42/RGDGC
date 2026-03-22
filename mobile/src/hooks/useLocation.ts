import { useState, useCallback } from "react";

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface LocationState {
  location: Coordinates | null;
  loading: boolean;
  error: string | null;
}

/**
 * Hook for accessing the device's location.
 *
 * Used primarily for the "nearby courses" feature. Wraps expo-location
 * with permission handling and a Haversine distance helper.
 */
export function useLocation() {
  const [state, setState] = useState<LocationState>({
    location: null,
    loading: false,
    error: null,
  });

  const getCurrentLocation = useCallback(async (): Promise<Coordinates | null> => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const Location = await import("expo-location");

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setState({ location: null, loading: false, error: "Location permission denied" });
        return null;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const coords: Coordinates = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

      setState({ location: coords, loading: false, error: null });
      return coords;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to get location";
      setState({ location: null, loading: false, error: message });
      return null;
    }
  }, []);

  /**
   * Calculate distance in kilometers from the user's current location
   * to a target coordinate using the Haversine formula.
   *
   * Returns null if current location is unavailable.
   */
  const getDistanceTo = useCallback(
    (lat: number, lng: number): number | null => {
      if (!state.location) return null;
      return haversineKm(
        state.location.latitude,
        state.location.longitude,
        lat,
        lng,
      );
    },
    [state.location],
  );

  return {
    location: state.location,
    loading: state.loading,
    error: state.error,
    getCurrentLocation,
    getDistanceTo,
  };
}

/** Haversine distance between two lat/lng pairs, in kilometers. */
function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
