/**
 * AR Distance Overlay — full-screen camera view with distance, direction,
 * zone indicators, putting probability, and trajectory guidance.
 *
 * Enhanced with:
 * - C1/C2 zone ring indicators on screen
 * - Personalized probability from player stats API
 * - Wind vector arrow
 * - Distance band coloring (green/yellow/red)
 * - Smooth distance updates with animation
 * - Mode switch: Distance → Putting (when inside C2)
 */

import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { distanceFeet, distanceMeters } from "@/services/geo";
import { puttingApi } from "@/services/api";
import { useCompass, bearingTo } from "./useCompass";
import CameraBackground from "./CameraBackground";
import {
  C1_FEET,
  C2_FEET,
  getZone,
  getZoneInfo,
  estimatePuttProb,
  formatProb,
  probColor,
  SKILL_LEVELS,
  type SkillParams,
} from "./arUtils";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

interface BasketTarget {
  coordinates: [number, number]; // [lng, lat]
  hole_number: number;
  par: number;
  elevation_ft?: number | null;
}

interface ARDistanceOverlayProps {
  basket: BasketTarget;
  teeElevationFt?: number | null;
  windSpeedMph?: number;
  windDirection?: string;
  windDegrees?: number;
  onClose: () => void;
  onSwitchToPutting?: () => void;
  skillLevel?: string;
}

export default function ARDistanceOverlay({
  basket,
  teeElevationFt,
  windSpeedMph = 0,
  windDirection = "",
  windDegrees,
  onClose,
  onSwitchToPutting,
  skillLevel = "intermediate",
}: ARDistanceOverlayProps) {
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [apiProb, setApiProb] = useState<number | null>(null);
  const [showUnits, setShowUnits] = useState<"feet" | "meters">("feet");
  const [gpsTimeout, setGpsTimeout] = useState(false);
  const { heading, needsPermission, requestPermission } = useCompass(true);
  const locationSub = useRef<Location.LocationSubscription | null>(null);

  // Watch GPS position
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setGpsTimeout(true);
        return;
      }

      // Show timeout message after 15s if no fix
      timeoutId = setTimeout(() => {
        setGpsTimeout(true);
      }, 15000);

      locationSub.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 1 },
        (pos) => {
          setUserLocation([pos.coords.longitude, pos.coords.latitude]);
          setGpsTimeout(false);
          clearTimeout(timeoutId);
        },
      );
    })();

    return () => {
      clearTimeout(timeoutId);
      locationSub.current?.remove();
    };
  }, []);

  // Calculations
  const distance = userLocation
    ? distanceFeet(userLocation, basket.coordinates)
    : null;
  const distM = userLocation
    ? distanceMeters(userLocation, basket.coordinates)
    : null;
  const targetBearing = userLocation
    ? bearingTo(userLocation, basket.coordinates)
    : null;
  const relativeBearing =
    heading != null && targetBearing != null
      ? (targetBearing - heading + 360) % 360
      : null;

  // Zone info
  const zone = distance != null ? getZone(distance) : null;
  const zoneInfo = zone ? getZoneInfo(zone) : null;

  // Elevation change
  const elevChange =
    basket.elevation_ft != null && teeElevationFt != null
      ? basket.elevation_ft - teeElevationFt
      : null;

  // Skill params
  const params: SkillParams = SKILL_LEVELS[skillLevel] || SKILL_LEVELS.intermediate;

  // Local putting probability
  const localProb =
    distM != null
      ? estimatePuttProb(distM, params, windSpeedMph, elevChange ?? 0)
      : null;

  // Fetch personalized probability from API (throttled)
  const lastFetch = useRef<number>(0);
  useEffect(() => {
    if (distM == null || distM > 25) return;
    const now = Date.now();
    if (now - lastFetch.current < 3000) return; // throttle to every 3s
    lastFetch.current = now;

    puttingApi
      .probability(distM, windSpeedMph, windDegrees ?? 0, elevChange ?? 0)
      .then((data) => {
        if (data.personal_average != null) {
          setApiProb(data.personal_average);
        } else {
          setApiProb(data.make_probability);
        }
      })
      .catch(() => {
        // Offline — use local estimate
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [distM != null ? Math.round(distM) : null, windSpeedMph]);

  const displayProb = apiProb ?? localProb;

  // Direction state
  const isOnTarget =
    relativeBearing != null && (relativeBearing < 10 || relativeBearing > 350);
  const isClose =
    relativeBearing != null && (relativeBearing < 30 || relativeBearing > 330);

  // Inside putting range?
  const inPuttingRange = distance != null && distance <= C2_FEET;

  // Distance display value
  const displayDistance =
    distance != null
      ? showUnits === "feet"
        ? Math.round(distance)
        : Math.round(distance * 0.3048)
      : null;
  const displayUnit = showUnits === "feet" ? "ft" : "m";
  const altDistance =
    distance != null
      ? showUnits === "feet"
        ? `${(distance * 0.3048).toFixed(1)}m`
        : `${Math.round(distance)}ft`
      : "";

  // Zone ring scale — how far are we relative to C1/C2 boundary
  const zoneProgress = distance != null ? Math.min(distance / C2_FEET, 1.5) : 0;

  return (
    <CameraBackground facing="back">
      {/* Semi-transparent overlay for readability */}
      <View style={styles.overlay} />

      {/* Close button */}
      <Pressable style={styles.closeBtn} onPress={onClose}>
        <Ionicons name="close" size={28} color="#fff" />
      </Pressable>

      {/* Unit toggle */}
      <Pressable
        style={styles.unitToggle}
        onPress={() => setShowUnits((u) => (u === "feet" ? "meters" : "feet"))}
      >
        <Text style={styles.unitToggleText}>
          {showUnits === "feet" ? "FT" : "M"}
        </Text>
      </Pressable>

      {/* Hole info header */}
      <View style={styles.header}>
        <Text style={styles.holeLabel}>
          Hole {basket.hole_number} • Par {basket.par}
        </Text>
        {zoneInfo && (
          <View style={[styles.zoneBadge, { backgroundColor: zoneInfo.color }]}>
            <Text style={styles.zoneBadgeText}>{zoneInfo.label}</Text>
          </View>
        )}
      </View>

      {/* Zone ring visualization */}
      <View style={styles.zoneRingsContainer}>
        {/* C2 ring (outer) */}
        <View
          style={[
            styles.zoneRing,
            styles.c2Ring,
            zone === "c2" && styles.zoneRingActive,
          ]}
        >
          <Text style={styles.zoneRingLabel}>C2 (66ft)</Text>
        </View>
        {/* C1 ring (inner) */}
        <View
          style={[
            styles.zoneRing,
            styles.c1Ring,
            (zone === "c1" || zone === "c1x") && styles.zoneRingActive,
          ]}
        >
          <Text style={styles.zoneRingLabel}>C1 (33ft)</Text>
        </View>
        {/* Center basket dot */}
        <View style={styles.basketDot} />
      </View>

      {/* Direction arrow */}
      {relativeBearing != null && (
        <View style={styles.arrowContainer}>
          <View
            style={[
              styles.arrow,
              { transform: [{ rotate: `${relativeBearing}deg` }] },
            ]}
          >
            <Ionicons
              name="navigate"
              size={50}
              color={
                isOnTarget ? "#4CAF50" : isClose ? "#FFC107" : "#FF6B35"
              }
            />
          </View>
          <Text
            style={[
              styles.arrowLabel,
              isOnTarget && styles.arrowLabelOnTarget,
            ]}
          >
            {isOnTarget
              ? "ON TARGET"
              : relativeBearing <= 180
                ? `${Math.round(relativeBearing)}° R`
                : `${Math.round(360 - relativeBearing)}° L`}
          </Text>
        </View>
      )}

      {/* Distance display */}
      <View style={styles.distanceContainer}>
        {displayDistance != null ? (
          <>
            <Pressable
              onPress={() =>
                setShowUnits((u) => (u === "feet" ? "meters" : "feet"))
              }
            >
              <Text
                style={[
                  styles.distanceValue,
                  { color: zoneInfo?.color ?? "#fff" },
                ]}
              >
                {displayDistance}
              </Text>
            </Pressable>
            <Text style={styles.distanceUnit}>{displayUnit}</Text>
            <Text style={styles.distanceAlt}>{altDistance}</Text>
          </>
        ) : (
          <>
            <ActivityIndicator color="#fff" size="large" />
            <Text style={styles.gpsWaiting}>
              {gpsTimeout
                ? "GPS signal weak. Try moving outside or away from buildings."
                : "Acquiring GPS..."}
            </Text>
          </>
        )}
      </View>

      {/* Putting probability ring (when inside C2) */}
      {inPuttingRange && displayProb != null ? (
        <View style={styles.probContainer}>
          <View
            style={[
              styles.probRing,
              { borderColor: probColor(displayProb) },
            ]}
          >
            <Text
              style={[styles.probValue, { color: probColor(displayProb) }]}
            >
              {formatProb(displayProb)}
            </Text>
            <Text style={styles.probLabel}>Make %</Text>
          </View>
        </View>
      ) : distance != null && distance > C2_FEET ? (
        <View style={styles.probContainer}>
          <Text style={styles.outsideHint}>
            Walk closer for putting data
          </Text>
        </View>
      ) : null}

      {/* Info cards at bottom */}
      <View style={styles.infoBar}>
        {/* Elevation */}
        {elevChange != null && (
          <View style={styles.infoCard}>
            <Ionicons
              name={
                elevChange > 0.5
                  ? "arrow-up"
                  : elevChange < -0.5
                    ? "arrow-down"
                    : "remove"
              }
              size={18}
              color={
                elevChange > 0.5
                  ? "#F44336"
                  : elevChange < -0.5
                    ? "#4CAF50"
                    : "#999"
              }
            />
            <Text style={styles.infoValue}>
              {elevChange > 0 ? "+" : ""}
              {elevChange.toFixed(1)}ft
            </Text>
            <Text style={styles.infoLabel}>Elev</Text>
          </View>
        )}

        {/* Wind */}
        {windSpeedMph > 0 && (
          <View style={styles.infoCard}>
            <View style={styles.windArrow}>
              <Ionicons
                name="arrow-up"
                size={16}
                color="#2196F3"
                style={
                  windDegrees != null
                    ? { transform: [{ rotate: `${windDegrees}deg` }] }
                    : undefined
                }
              />
            </View>
            <Text style={styles.infoValue}>
              {windSpeedMph}mph
            </Text>
            <Text style={styles.infoLabel}>{windDirection || "Wind"}</Text>
          </View>
        )}

        {/* Compass heading */}
        {heading != null && (
          <View style={styles.infoCard}>
            <Ionicons name="compass" size={18} color="#FF9800" />
            <Text style={styles.infoValue}>{heading}°</Text>
            <Text style={styles.infoLabel}>
              {headingToCardinal(heading)}
            </Text>
          </View>
        )}

        {/* Skill level */}
        <View style={styles.infoCard}>
          <Ionicons name="person" size={18} color="#9C27B0" />
          <Text style={styles.infoValue}>{params.label}</Text>
          <Text style={styles.infoLabel}>Skill</Text>
        </View>
      </View>

      {/* Compass permission prompt (iOS Safari) */}
      {needsPermission && (
        <Pressable style={styles.compassPermBtn} onPress={requestPermission}>
          <Ionicons name="compass" size={20} color="#fff" />
          <Text style={styles.compassPermText}>Enable Compass</Text>
        </Pressable>
      )}

      {/* Switch to putting mode button (when inside C2) */}
      {inPuttingRange && onSwitchToPutting && (
        <Pressable style={styles.puttingModeBtn} onPress={onSwitchToPutting}>
          <Ionicons name="disc" size={20} color="#fff" />
          <Text style={styles.puttingModeBtnText}>Putting Mode</Text>
        </Pressable>
      )}
    </CameraBackground>
  );
}

/** Convert heading degrees to cardinal direction. */
function headingToCardinal(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  closeBtn: {
    position: "absolute",
    top: 60,
    right: 20,
    zIndex: 20,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 22,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  unitToggle: {
    position: "absolute",
    top: 60,
    right: 72,
    zIndex: 20,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 22,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  unitToggleText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  header: {
    position: "absolute",
    top: 60,
    left: 0,
    right: 140,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 20,
    zIndex: 10,
    gap: 8,
  },
  holeLabel: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    overflow: "hidden",
  },
  zoneBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  zoneBadgeText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },
  zoneRingsContainer: {
    position: "absolute",
    top: SCREEN_H * 0.2,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 3,
  },
  zoneRing: {
    position: "absolute",
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 4,
    opacity: 0.4,
  },
  zoneRingActive: {
    opacity: 0.9,
    borderWidth: 2.5,
    borderStyle: "solid",
  },
  c2Ring: {
    width: 220,
    height: 220,
    borderColor: "#FFC107",
    top: -110,
  },
  c1Ring: {
    width: 130,
    height: 130,
    borderColor: "#4CAF50",
    top: -65,
  },
  zoneRingLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 10,
    fontWeight: "600",
  },
  basketDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#FF6B35",
    borderWidth: 2,
    borderColor: "#fff",
  },
  arrowContainer: {
    position: "absolute",
    top: SCREEN_H * 0.28,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 8,
  },
  arrow: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  arrowLabel: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: "hidden",
  },
  arrowLabelOnTarget: {
    backgroundColor: "rgba(76,175,80,0.8)",
  },
  distanceContainer: {
    position: "absolute",
    top: SCREEN_H * 0.42,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 8,
  },
  distanceValue: {
    fontSize: 80,
    fontWeight: "800",
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
    fontFamily: Platform.OS === "ios" ? "JetBrains Mono" : "monospace",
  },
  distanceUnit: {
    fontSize: 26,
    fontWeight: "700",
    color: "#ddd",
    marginTop: -10,
  },
  distanceAlt: {
    fontSize: 16,
    color: "#aaa",
    marginTop: 2,
  },
  gpsWaiting: {
    color: "#aaa",
    fontSize: 14,
    marginTop: 8,
  },
  probContainer: {
    position: "absolute",
    top: SCREEN_H * 0.62,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 8,
  },
  probRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 4,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  probValue: {
    fontSize: 28,
    fontWeight: "800",
    fontFamily: Platform.OS === "ios" ? "JetBrains Mono" : "monospace",
  },
  probLabel: {
    color: "#aaa",
    fontSize: 10,
    fontWeight: "600",
    marginTop: -2,
  },
  outsideHint: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    fontStyle: "italic",
  },
  infoBar: {
    position: "absolute",
    bottom: 40,
    left: 12,
    right: 12,
    flexDirection: "row",
    justifyContent: "space-around",
    zIndex: 10,
  },
  infoCard: {
    backgroundColor: "rgba(0,0,0,0.75)",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: "center",
    minWidth: 70,
  },
  infoValue: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 4,
  },
  infoLabel: {
    color: "#999",
    fontSize: 10,
    marginTop: 2,
  },
  windArrow: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  puttingModeBtn: {
    position: "absolute",
    bottom: 110,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(27,94,32,0.9)",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    zIndex: 10,
  },
  puttingModeBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  compassPermBtn: {
    position: "absolute",
    top: SCREEN_H * 0.18,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,152,0,0.9)",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    zIndex: 15,
  },
  compassPermText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
});
