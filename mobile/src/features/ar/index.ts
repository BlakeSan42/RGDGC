export { default as ARDistanceOverlay } from "./ARDistanceOverlay";
export { default as ARPuttingOverlay } from "./ARPuttingOverlay";
export { default as ARStanceGuide } from "./ARStanceGuide";
export { default as ARPracticeMode } from "./ARPracticeMode";
export { useCompass, bearingTo } from "./useCompass";
export { default as CameraBackground } from "./CameraBackground";
export {
  estimatePuttProb,
  getZone,
  getZoneInfo,
  formatProb,
  probColor,
  C1_FEET,
  C2_FEET,
  SKILL_LEVELS,
} from "./arUtils";

// Native AR — import directly from "@/features/ar/native" when needed.
// NOT re-exported here to avoid crashing Expo Go (ViroReact is native-only).
