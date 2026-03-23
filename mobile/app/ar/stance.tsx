/**
 * AR Stance Guide Screen — camera overlay with putting form reference.
 *
 * Route: /ar/stance?style=spin
 */

import { useLocalSearchParams, router } from "expo-router";
import { ARStanceGuide } from "@/features/ar";

export default function ARStanceScreen() {
  const params = useLocalSearchParams<{
    style?: string;
  }>();

  const style = (params.style as "spin" | "push" | "spush" | "turbo") || "spin";

  return <ARStanceGuide onClose={() => router.back()} initialStyle={style} />;
}
