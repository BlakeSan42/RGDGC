/**
 * AR Practice Screen — camera overlay with putting drills.
 *
 * Route: /ar/practice?hole=1&lat=30.027&lng=-95.208&par=3&skill=intermediate
 */

import { useLocalSearchParams, router } from "expo-router";
import { ARPracticeMode } from "@/features/ar";

export default function ARPracticeScreen() {
  const params = useLocalSearchParams<{
    hole: string;
    lat: string;
    lng: string;
    par: string;
    elev?: string;
    skill?: string;
  }>();

  const holeNumber = parseInt(params.hole || "1", 10);
  const lat = parseFloat(params.lat || "0");
  const lng = parseFloat(params.lng || "0");
  const par = parseInt(params.par || "3", 10);
  const elevFt = params.elev ? parseFloat(params.elev) : null;
  const skill = params.skill || "intermediate";

  return (
    <ARPracticeMode
      basket={{
        coordinates: [lng, lat],
        hole_number: holeNumber,
        par,
        elevation_ft: elevFt,
      }}
      onClose={() => router.back()}
      skillLevel={skill}
    />
  );
}
