/**
 * AR Distance Screen — full-screen camera overlay with distance to basket.
 * Supports switching to putting mode when inside C2.
 *
 * Route: /ar/distance?hole=1&lat=30.027&lng=-95.208&par=3&elev=48.5&tee_elev=47.2
 */

import { useState } from "react";
import { useLocalSearchParams, router } from "expo-router";
import { ARDistanceOverlay, ARPuttingOverlay } from "@/features/ar";

type Mode = "distance" | "putting";

export default function ARDistanceScreen() {
  const [mode, setMode] = useState<Mode>("distance");

  const params = useLocalSearchParams<{
    hole: string;
    lat: string;
    lng: string;
    par: string;
    elev?: string;
    tee_elev?: string;
    wind_speed?: string;
    wind_dir?: string;
    wind_deg?: string;
    skill?: string;
    round_id?: string;
  }>();

  const holeNumber = parseInt(params.hole || "1", 10);
  const lat = parseFloat(params.lat || "0");
  const lng = parseFloat(params.lng || "0");
  const par = parseInt(params.par || "3", 10);
  const elevFt = params.elev ? parseFloat(params.elev) : null;
  const teeElevFt = params.tee_elev ? parseFloat(params.tee_elev) : null;
  const windSpeed = params.wind_speed ? parseFloat(params.wind_speed) : 0;
  const windDir = params.wind_dir || "";
  const windDeg = params.wind_deg ? parseFloat(params.wind_deg) : undefined;
  const skill = params.skill || "intermediate";
  const roundId = params.round_id ? parseInt(params.round_id, 10) : undefined;

  const basket = {
    coordinates: [lng, lat] as [number, number],
    hole_number: holeNumber,
    par,
    elevation_ft: elevFt,
  };

  if (mode === "putting") {
    return (
      <ARPuttingOverlay
        basket={basket}
        teeElevationFt={teeElevFt}
        windSpeedMph={windSpeed}
        windDirection={windDir}
        windDegrees={windDeg}
        onClose={() => router.back()}
        onSwitchToDistance={() => setMode("distance")}
        skillLevel={skill}
        roundId={roundId}
      />
    );
  }

  return (
    <ARDistanceOverlay
      basket={basket}
      teeElevationFt={teeElevFt}
      windSpeedMph={windSpeed}
      windDirection={windDir}
      windDegrees={windDeg}
      onClose={() => router.back()}
      onSwitchToPutting={() => setMode("putting")}
      skillLevel={skill}
    />
  );
}
