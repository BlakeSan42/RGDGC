/**
 * AR Putting Overlay — close-range camera overlay for putting.
 *
 * Shows:
 * - Basket target zone with probability ring
 * - Wind vector arrow showing drift direction
 * - Recommended aim offset based on wind
 * - Make probability with real-time distance updates
 * - Quick-log putt result (made/missed + direction)
 * - Elevation grade indicator
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
import * as Haptics from "expo-haptics";
import { distanceFeet, distanceMeters } from "@/services/geo";
import { puttingApi } from "@/services/api";
import { useCompass, bearingTo } from "./useCompass";
import CameraBackground from "./CameraBackground";
import {
  getZone,
  getZoneInfo,
  estimatePuttProb,
  formatProb,
  probColor,
  SKILL_LEVELS,
  type SkillParams,
  C1_FEET,
  C2_FEET,
} from "./arUtils";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

interface BasketTarget {
  coordinates: [number, number];
  hole_number: number;
  par: number;
  elevation_ft?: number | null;
}

interface ARPuttingOverlayProps {
  basket: BasketTarget;
  teeElevationFt?: number | null;
  windSpeedMph?: number;
  windDirection?: string;
  windDegrees?: number;
  onClose: () => void;
  onSwitchToDistance?: () => void;
  skillLevel?: string;
  roundId?: number;
}

type MissDirection = "left" | "right" | "long" | "short";

export default function ARPuttingOverlay({
  basket,
  teeElevationFt,
  windSpeedMph = 0,
  windDirection = "",
  windDegrees,
  onClose,
  onSwitchToDistance,
  skillLevel = "intermediate",
  roundId,
}: ARPuttingOverlayProps) {
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [puttLogged, setPuttLogged] = useState(false);
  const [logging, setLogging] = useState(false);
  const { heading } = useCompass(true);
  const locationSub = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      locationSub.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 0.5 },
        (pos) => setUserLocation([pos.coords.longitude, pos.coords.latitude]),
      );
    })();
    return () => { locationSub.current?.remove(); };
  }, []);

  const distance = userLocation ? distanceFeet(userLocation, basket.coordinates) : null;
  const distM = userLocation ? distanceMeters(userLocation, basket.coordinates) : null;
  const targetBearing = userLocation ? bearingTo(userLocation, basket.coordinates) : null;
  const relativeBearing =
    heading != null && targetBearing != null
      ? (targetBearing - heading + 360) % 360
      : null;

  const zone = distance != null ? getZone(distance) : null;
  const zoneInfo = zone ? getZoneInfo(zone) : null;

  const elevChange =
    basket.elevation_ft != null && teeElevationFt != null
      ? basket.elevation_ft - teeElevationFt
      : null;

  const params: SkillParams = SKILL_LEVELS[skillLevel] || SKILL_LEVELS.intermediate;
  const prob =
    distM != null
      ? estimatePuttProb(distM, params, windSpeedMph, elevChange ?? 0)
      : null;

  // Wind aim offset — pixels to shift the target indicator
  const windOffsetX =
    windDegrees != null && windSpeedMph > 0
      ? Math.sin((windDegrees * Math.PI) / 180) * windSpeedMph * 2
      : 0;
  const windOffsetY =
    windDegrees != null && windSpeedMph > 0
      ? -Math.cos((windDegrees * Math.PI) / 180) * windSpeedMph * 2
      : 0;

  // Log putt attempt
  const logPutt = async (made: boolean, missDir?: MissDirection) => {
    if (distM == null || logging) return;
    setLogging(true);
    try {
      const resultType = made
        ? "center_chains"
        : missDir
          ? `miss_${missDir}`
          : "miss_short";

      await puttingApi.logAttempt({
        distance_meters: Math.round(distM * 10) / 10,
        zone: zone === "c1" || zone === "c1x" ? (zone as "c1" | "c1x") : "c2",
        made,
        elevation_change: elevChange ?? undefined,
        wind_speed: windSpeedMph || undefined,
        wind_direction: windDegrees ?? undefined,
        result_type: resultType,
        round_id: roundId ?? undefined,
      });

      setPuttLogged(true);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(
          made
            ? Haptics.NotificationFeedbackType.Success
            : Haptics.NotificationFeedbackType.Warning,
        );
      }
      // Reset after 2 seconds
      setTimeout(() => {
        setPuttLogged(false);
        setLogging(false);
      }, 2000);
    } catch {
      setLogging(false);
    }
  };

  // Basket ring size — scales with distance (closer = bigger on screen)
  const basketScale = distance != null ? Math.max(0.5, Math.min(2, 40 / distance)) : 1;
  const ringSize = 120 * basketScale;

  return (
    <CameraBackground facing="back">
      <View style={styles.overlay} />

      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.headerBtn} onPress={onClose}>
          <Ionicons name="close" size={24} color="#fff" />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>PUTTING MODE</Text>
          {zoneInfo && (
            <Text style={[styles.headerZone, { color: zoneInfo.color }]}>
              {zoneInfo.label} • {distance != null ? `${Math.round(distance)}ft` : "..."}
            </Text>
          )}
        </View>
        {onSwitchToDistance && (
          <Pressable style={styles.headerBtn} onPress={onSwitchToDistance}>
            <Ionicons name="expand" size={24} color="#fff" />
          </Pressable>
        )}
      </View>

      {/* Basket target zone */}
      <View style={styles.targetArea}>
        {/* Wind drift indicator */}
        {windSpeedMph > 0 && (
          <View
            style={[
              styles.windDriftMarker,
              {
                transform: [
                  { translateX: windOffsetX * 3 },
                  { translateY: windOffsetY * 3 },
                ],
              },
            ]}
          >
            <View style={styles.windDriftDot} />
            <Text style={styles.windDriftLabel}>Aim here</Text>
          </View>
        )}

        {/* Basket ring */}
        <View
          style={[
            styles.basketRing,
            {
              width: ringSize,
              height: ringSize,
              borderRadius: ringSize / 2,
              borderColor: prob != null ? probColor(prob) : "#FF6B35",
            },
          ]}
        >
          {/* Inner chains */}
          <View style={styles.chainsInner}>
            <Ionicons name="disc" size={24} color="rgba(255,255,255,0.6)" />
          </View>
        </View>

        {/* Probability display */}
        {prob != null && (
          <View style={styles.probDisplay}>
            <Text style={[styles.probValue, { color: probColor(prob) }]}>
              {formatProb(prob)}
            </Text>
            <Text style={styles.probLabel}>Make Probability</Text>
          </View>
        )}
      </View>

      {/* Direction guide */}
      {relativeBearing != null && (
        <View style={styles.directionBar}>
          <View style={styles.directionTrack}>
            {/* Center marker */}
            <View style={styles.directionCenter} />
            {/* Current bearing indicator */}
            <View
              style={[
                styles.directionIndicator,
                {
                  left: `${Math.max(5, Math.min(95, 50 + (relativeBearing <= 180 ? relativeBearing : relativeBearing - 360) * 0.5))}%`,
                  backgroundColor:
                    relativeBearing < 10 || relativeBearing > 350
                      ? "#4CAF50"
                      : "#FF6B35",
                },
              ]}
            />
          </View>
          <Text style={styles.directionText}>
            {relativeBearing < 10 || relativeBearing > 350
              ? "Aligned"
              : relativeBearing <= 180
                ? `${Math.round(relativeBearing)}° Right`
                : `${Math.round(360 - relativeBearing)}° Left`}
          </Text>
        </View>
      )}

      {/* Putt result buttons */}
      {!puttLogged ? (
        <View style={styles.puttButtons}>
          <Text style={styles.puttPrompt}>Log your putt:</Text>
          <View style={styles.puttRow}>
            <Pressable
              style={[styles.puttBtn, styles.puttBtnMade]}
              onPress={() => logPutt(true)}
              disabled={logging}
            >
              <Ionicons name="checkmark-circle" size={28} color="#fff" />
              <Text style={styles.puttBtnText}>MADE</Text>
            </Pressable>
            <Pressable
              style={[styles.puttBtn, styles.puttBtnMiss]}
              onPress={() => logPutt(false)}
              disabled={logging}
            >
              <Ionicons name="close-circle" size={28} color="#fff" />
              <Text style={styles.puttBtnText}>MISS</Text>
            </Pressable>
          </View>
          {/* Miss direction */}
          <View style={styles.missRow}>
            {(["left", "short", "long", "right"] as MissDirection[]).map(
              (dir) => (
                <Pressable
                  key={dir}
                  style={styles.missBtn}
                  onPress={() => logPutt(false, dir)}
                  disabled={logging}
                >
                  <Ionicons
                    name={
                      dir === "left"
                        ? "arrow-back"
                        : dir === "right"
                          ? "arrow-forward"
                          : dir === "long"
                            ? "arrow-up"
                            : "arrow-down"
                    }
                    size={16}
                    color="#aaa"
                  />
                  <Text style={styles.missBtnText}>{dir}</Text>
                </Pressable>
              ),
            )}
          </View>
        </View>
      ) : (
        <View style={styles.puttConfirm}>
          <Ionicons name="checkmark-circle" size={40} color="#4CAF50" />
          <Text style={styles.puttConfirmText}>Putt logged!</Text>
        </View>
      )}

      {/* Bottom info strip */}
      <View style={styles.bottomInfo}>
        {elevChange != null && (
          <View style={styles.bottomChip}>
            <Ionicons
              name={elevChange > 0.5 ? "trending-up" : elevChange < -0.5 ? "trending-down" : "remove"}
              size={14}
              color={elevChange > 0.5 ? "#F44336" : elevChange < -0.5 ? "#4CAF50" : "#999"}
            />
            <Text style={styles.bottomChipText}>
              {elevChange > 0 ? "+" : ""}{elevChange.toFixed(1)}ft
            </Text>
          </View>
        )}
        {windSpeedMph > 0 && (
          <View style={styles.bottomChip}>
            <Ionicons name="flag" size={14} color="#2196F3" />
            <Text style={styles.bottomChipText}>
              {windSpeedMph}mph {windDirection}
            </Text>
          </View>
        )}
        <View style={styles.bottomChip}>
          <Ionicons name="person" size={14} color="#9C27B0" />
          <Text style={styles.bottomChipText}>{params.label}</Text>
        </View>
      </View>
    </CameraBackground>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.1)" },

  header: {
    position: "absolute",
    top: 50,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    zIndex: 20,
  },
  headerBtn: {
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 22,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 2,
  },
  headerZone: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 2,
  },

  targetArea: {
    position: "absolute",
    top: SCREEN_H * 0.22,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10,
  },
  basketRing: {
    borderWidth: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  chainsInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },

  windDriftMarker: {
    position: "absolute",
    alignItems: "center",
    zIndex: 15,
  },
  windDriftDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "rgba(33,150,243,0.8)",
    borderWidth: 2,
    borderColor: "#fff",
  },
  windDriftLabel: {
    color: "#2196F3",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
  },

  probDisplay: {
    marginTop: 12,
    alignItems: "center",
  },
  probValue: {
    fontSize: 36,
    fontWeight: "800",
    fontFamily: Platform.OS === "ios" ? "JetBrains Mono" : "monospace",
  },
  probLabel: {
    color: "#aaa",
    fontSize: 12,
    fontWeight: "600",
  },

  directionBar: {
    position: "absolute",
    top: SCREEN_H * 0.52,
    left: 20,
    right: 20,
    alignItems: "center",
    zIndex: 10,
  },
  directionTrack: {
    width: "100%",
    height: 6,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 3,
    position: "relative",
  },
  directionCenter: {
    position: "absolute",
    left: "50%",
    top: -4,
    width: 2,
    height: 14,
    backgroundColor: "rgba(255,255,255,0.4)",
    marginLeft: -1,
  },
  directionIndicator: {
    position: "absolute",
    top: -5,
    width: 16,
    height: 16,
    borderRadius: 8,
    marginLeft: -8,
  },
  directionText: {
    color: "#ccc",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 6,
  },

  puttButtons: {
    position: "absolute",
    bottom: 100,
    left: 20,
    right: 20,
    alignItems: "center",
    zIndex: 10,
  },
  puttPrompt: {
    color: "#aaa",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
  },
  puttRow: {
    flexDirection: "row",
    gap: 16,
  },
  puttBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 28,
  },
  puttBtnMade: {
    backgroundColor: "rgba(76,175,80,0.9)",
  },
  puttBtnMiss: {
    backgroundColor: "rgba(244,67,54,0.9)",
  },
  puttBtnText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
  },
  missRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 10,
  },
  missBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  missBtnText: {
    color: "#aaa",
    fontSize: 11,
    fontWeight: "600",
    textTransform: "capitalize",
  },

  puttConfirm: {
    position: "absolute",
    bottom: 120,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10,
  },
  puttConfirmText: {
    color: "#4CAF50",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 4,
  },

  bottomInfo: {
    position: "absolute",
    bottom: 40,
    left: 12,
    right: 12,
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    zIndex: 10,
  },
  bottomChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  bottomChipText: {
    color: "#ccc",
    fontSize: 12,
    fontWeight: "600",
  },
});
