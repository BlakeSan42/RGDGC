/**
 * Shared AR utilities — zone calculations, probability, constants.
 */

// ── Zone Constants (in feet) ──
export const C1_FEET = 33; // 10 meters
export const C1X_FEET = 33; // same radius, just excludes tap-ins
export const C2_FEET = 66; // 20 meters
export const C1_METERS = 10;
export const C2_METERS = 20;

// ── Basket Dimensions ──
export const BASKET_RADIUS_M = 0.3302; // 13" diameter
export const DISC_RADIUS_M = 0.1055; // standard disc

// ── Skill Parameters (Gelman & Nolan) ──
export interface SkillParams {
  sigma_angle: number;
  sigma_distance: number;
  epsilon: number;
  label: string;
}

export const SKILL_LEVELS: Record<string, SkillParams> = {
  beginner: { sigma_angle: 0.08, sigma_distance: 1.2, epsilon: 0.1, label: "Beginner" },
  recreational: { sigma_angle: 0.05, sigma_distance: 0.8, epsilon: 0.06, label: "Recreational" },
  intermediate: { sigma_angle: 0.035, sigma_distance: 0.5, epsilon: 0.04, label: "Intermediate" },
  advanced: { sigma_angle: 0.025, sigma_distance: 0.35, epsilon: 0.03, label: "Advanced" },
  pro: { sigma_angle: 0.018, sigma_distance: 0.25, epsilon: 0.02, label: "Pro" },
  elite: { sigma_angle: 0.015, sigma_distance: 0.2, epsilon: 0.015, label: "Elite" },
};

/** Standard normal CDF approximation (Abramowitz & Stegun). */
export function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const abs = Math.abs(x) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * abs);
  const y =
    1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-abs * abs);
  return 0.5 * (1.0 + sign * y);
}

/**
 * Putting probability using Gelman & Nolan model.
 * Can use custom skill params or default to intermediate.
 */
export function estimatePuttProb(
  distanceM: number,
  params: SkillParams = SKILL_LEVELS.intermediate,
  windSpeedMph = 0,
  elevationChangeFt = 0,
): number {
  if (distanceM <= 0) return 1;
  if (distanceM > 25) return 0.02;

  const theta0 = Math.asin(
    Math.min(1, (BASKET_RADIUS_M - DISC_RADIUS_M) / distanceM),
  );
  const p_angle = 2 * normalCDF(theta0 / params.sigma_angle) - 1;
  const p_dist = 2 * normalCDF(BASKET_RADIUS_M / params.sigma_distance) - 1;

  let prob = p_angle * p_dist * (1 - params.epsilon);

  // Wind adjustment: reduces accuracy
  if (windSpeedMph > 0) {
    const windFactor = 1 - windSpeedMph * distanceM * 0.0006;
    prob *= Math.max(0.3, windFactor);
  }

  // Elevation adjustment: uphill/downhill increases distance variance
  if (elevationChangeFt !== 0) {
    const elevFactor = 1 - Math.abs(elevationChangeFt) * 0.01;
    prob *= Math.max(0.5, elevFactor);
  }

  return Math.max(0, Math.min(1, prob));
}

/** Determine putting zone from distance in feet.
 * C1 = full Circle 1 (0-33ft / 0-10m)
 * C1X = Circle 1 eXclusive (excludes tap-ins inside ~3.3m / ~11ft)
 * C2 = Circle 2 (33-66ft / 10-20m)
 */
export function getZone(distanceFeet: number): "c1" | "c1x" | "c2" | "outside" {
  if (distanceFeet <= C1_FEET) {
    // Inside C1. C1X means >11ft (tap-ins excluded from C1X stats)
    return distanceFeet > 11 ? "c1x" : "c1";
  }
  if (distanceFeet <= C2_FEET) return "c2";
  return "outside";
}

/** Zone display info. */
export function getZoneInfo(zone: "c1" | "c1x" | "c2" | "outside") {
  switch (zone) {
    case "c1":
      return { label: "C1", color: "#4CAF50", description: "Inside Circle 1" };
    case "c1x":
      return { label: "C1X", color: "#8BC34A", description: "Circle 1 Exclusive" };
    case "c2":
      return { label: "C2", color: "#FFC107", description: "Circle 2" };
    case "outside":
      return { label: "Outside C2", color: "#F44336", description: "Outside Circle 2" };
  }
}

/** Feet to meters. */
export function feetToMeters(ft: number): number {
  return ft * 0.3048;
}

/** Meters to feet. */
export function metersToFeet(m: number): number {
  return m / 0.3048;
}

/** Format probability as percentage string. */
export function formatProb(p: number): string {
  if (p >= 0.995) return "99%";
  if (p < 0.01) return "<1%";
  return `${Math.round(p * 100)}%`;
}

/** Get a color for probability (red → yellow → green). */
export function probColor(p: number): string {
  if (p >= 0.7) return "#4CAF50";
  if (p >= 0.4) return "#8BC34A";
  if (p >= 0.2) return "#FFC107";
  if (p >= 0.1) return "#FF9800";
  return "#F44336";
}
