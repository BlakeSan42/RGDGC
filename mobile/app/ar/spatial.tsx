/**
 * Spatial AR Screen — native ARKit/ARCore with plane detection.
 *
 * Uses ViroReact for true spatial AR. Falls back to GPS overlay
 * when native AR is unavailable (e.g., Expo Go, web).
 *
 * Route: /ar/spatial?skill=intermediate&wind_speed=5&elev=2.3
 */

import { useLocalSearchParams, router } from "expo-router";
import { NativeARView } from "@/features/ar/native";

export default function SpatialARScreen() {
  const params = useLocalSearchParams<{
    skill?: string;
    wind_speed?: string;
    wind_dir?: string;
    elev?: string;
    hole?: string;
    lat?: string;
    lng?: string;
    par?: string;
  }>();

  const skill = params.skill || "intermediate";
  const windSpeed = params.wind_speed ? parseFloat(params.wind_speed) : 0;
  const elevChange = params.elev ? parseFloat(params.elev) : 0;

  return (
    <NativeARView
      onClose={() => router.back()}
      skillLevel={skill}
      windSpeedMph={windSpeed}
      elevationChangeFt={elevChange}
      onFallback={() => {
        // Switch to GPS-based AR overlay
        router.replace({
          pathname: "/ar/distance",
          params: {
            hole: params.hole || "1",
            lat: params.lat || "0",
            lng: params.lng || "0",
            par: params.par || "3",
            wind_speed: params.wind_speed,
            wind_dir: params.wind_dir,
            elev: params.elev,
            skill: params.skill,
          },
        });
      }}
    />
  );
}
