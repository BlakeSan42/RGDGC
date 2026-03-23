/**
 * NativeARView — Wrapper around ViroARSceneNavigator for the RGDGC app.
 *
 * Provides:
 * - ViroReact AR scene with plane detection
 * - HUD overlay with distance, probability, controls
 * - Graceful fallback to GPS-based overlay when AR unavailable
 * - Reset and mode switching controls
 *
 * Requires EAS build (not Expo Go).
 */

import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  estimatePuttProb,
  formatProb,
  probColor,
  getZone,
  getZoneInfo,
  metersToFeet,
  SKILL_LEVELS,
} from "../arUtils";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

interface NativeARViewProps {
  onClose: () => void;
  skillLevel?: string;
  windSpeedMph?: number;
  elevationChangeFt?: number;
  onFallback?: () => void;
}

export default function NativeARView({
  onClose,
  skillLevel = "intermediate",
  windSpeedMph = 0,
  elevationChangeFt = 0,
  onFallback,
}: NativeARViewProps) {
  const [arAvailable, setArAvailable] = useState<boolean | null>(null);
  const [distanceM, setDistanceM] = useState<number | null>(null);
  const [planeDetected, setPlaneDetected] = useState(false);
  const [ViroARSceneNavigator, setViroARSceneNavigator] = useState<any>(null);
  const [ViroScene, setViroScene] = useState<any>(null);
  const resetRef = useRef(0);

  // Lazy import ViroReact — fails gracefully if not available
  React.useEffect(() => {
    if (Platform.OS === "web") {
      setArAvailable(false);
      return;
    }

    (async () => {
      try {
        const viro = await import("@reactvision/react-viro");
        setViroARSceneNavigator(() => viro.ViroARSceneNavigator);
        const sceneModule = await import("./ViroARDistanceScene");
        setViroScene(() => sceneModule.default);
        setArAvailable(true);
      } catch {
        setArAvailable(false);
      }
    })();
  }, []);

  const handleDistanceUpdate = useCallback((dist: number) => {
    setDistanceM(dist);
  }, []);

  const handlePlaneDetected = useCallback(() => {
    setPlaneDetected(true);
  }, []);

  const handleReset = useCallback(() => {
    resetRef.current += 1;
    setDistanceM(null);
    setPlaneDetected(false);
  }, []);

  // Derived values
  const distanceFt = distanceM != null ? metersToFeet(distanceM) : null;
  const zone = distanceFt != null ? getZone(distanceFt) : null;
  const zoneInfo = zone ? getZoneInfo(zone) : null;
  const params = SKILL_LEVELS[skillLevel] || SKILL_LEVELS.intermediate;
  const prob =
    distanceM != null
      ? estimatePuttProb(distanceM, params, windSpeedMph, elevationChangeFt)
      : null;

  // AR not available — show fallback prompt
  if (arAvailable === false) {
    return (
      <View style={styles.fallback}>
        <Ionicons name="cube-outline" size={64} color="#666" />
        <Text style={styles.fallbackTitle}>AR Not Available</Text>
        <Text style={styles.fallbackText}>
          Native AR requires an EAS development build.{"\n"}
          ARKit (iOS) or ARCore (Android) is needed.
        </Text>
        {onFallback && (
          <Pressable style={styles.fallbackBtn} onPress={onFallback}>
            <Ionicons name="camera" size={18} color="#fff" />
            <Text style={styles.fallbackBtnText}>Use GPS Overlay</Text>
          </Pressable>
        )}
        <Pressable style={styles.fallbackCloseBtn} onPress={onClose}>
          <Text style={styles.fallbackCloseBtnText}>Close</Text>
        </Pressable>
      </View>
    );
  }

  // Loading
  if (arAvailable === null || !ViroARSceneNavigator || !ViroScene) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackTitle}>Loading AR...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ViroReact AR Scene */}
      <ViroARSceneNavigator
        key={resetRef.current}
        initialScene={{
          scene: ViroScene,
          passProps: {
            skillLevel,
            windSpeedMph,
            elevationChangeFt,
            onDistanceUpdate: handleDistanceUpdate,
            onPlaneDetected: handlePlaneDetected,
          },
        }}
        style={StyleSheet.absoluteFill}
        autofocus
        worldAlignment="GravityAndHeading"
      />

      {/* HUD Overlay */}
      <View style={styles.hud} pointerEvents="box-none">
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.headerBtn} onPress={onClose}>
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>SPATIAL AR</Text>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: planeDetected ? "#4CAF50" : "#FFC107",
                },
              ]}
            />
            <Text style={styles.headerStatus}>
              {planeDetected ? "Plane Found" : "Scanning..."}
            </Text>
          </View>
          <Pressable style={styles.headerBtn} onPress={handleReset}>
            <Ionicons name="refresh" size={24} color="#fff" />
          </Pressable>
        </View>

        {/* Instructions */}
        {!planeDetected && (
          <View style={styles.instructionBanner}>
            <Ionicons name="phone-portrait-outline" size={20} color="#FFC107" />
            <Text style={styles.instructionText}>
              Point your phone at the ground and move slowly
            </Text>
          </View>
        )}

        {/* Distance & probability display */}
        {distanceM != null && (
          <View style={styles.measurementCard}>
            <Text style={styles.measurementDistance}>
              {Math.round(distanceFt!)} ft
            </Text>
            <Text style={styles.measurementMetric}>
              ({distanceM.toFixed(1)}m)
            </Text>
            {zoneInfo && (
              <View
                style={[
                  styles.zoneBadge,
                  { backgroundColor: zoneInfo.color },
                ]}
              >
                <Text style={styles.zoneBadgeText}>{zoneInfo.label}</Text>
              </View>
            )}
            {prob != null && (
              <View style={styles.probRow}>
                <Text
                  style={[styles.probValue, { color: probColor(prob) }]}
                >
                  {formatProb(prob)}
                </Text>
                <Text style={styles.probLabel}>make probability</Text>
              </View>
            )}
          </View>
        )}

        {/* Bottom controls */}
        <View style={styles.bottomControls}>
          {onFallback && (
            <Pressable style={styles.switchBtn} onPress={onFallback}>
              <Ionicons name="camera" size={16} color="#fff" />
              <Text style={styles.switchBtnText}>GPS Mode</Text>
            </Pressable>
          )}
          <View style={styles.skillBadge}>
            <Text style={styles.skillBadgeText}>{params.label}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  fallback: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  fallbackTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
    marginTop: 16,
  },
  fallbackText: {
    color: "#aaa",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 22,
    marginTop: 8,
  },
  fallbackBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#1B5E20",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 24,
    marginTop: 24,
  },
  fallbackBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  fallbackCloseBtn: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  fallbackCloseBtnText: {
    color: "#aaa",
    fontSize: 14,
  },

  hud: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 56,
    paddingHorizontal: 16,
  },
  headerBtn: {
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 22,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  headerStatus: {
    color: "#ccc",
    fontSize: 12,
    fontWeight: "600",
  },

  instructionBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.8)",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    marginTop: 16,
  },
  instructionText: {
    color: "#FFC107",
    fontSize: 14,
    fontWeight: "600",
  },

  measurementCard: {
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.85)",
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 28,
    alignItems: "center",
  },
  measurementDistance: {
    color: "#fff",
    fontSize: 48,
    fontWeight: "800",
    fontFamily: Platform.OS === "ios" ? "JetBrains Mono" : "monospace",
  },
  measurementMetric: {
    color: "#aaa",
    fontSize: 16,
    marginTop: -4,
  },
  zoneBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  zoneBadgeText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },
  probRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    marginTop: 8,
  },
  probValue: {
    fontSize: 28,
    fontWeight: "800",
  },
  probLabel: {
    color: "#888",
    fontSize: 12,
  },

  bottomControls: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    paddingBottom: 50,
    paddingHorizontal: 20,
  },
  switchBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  switchBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  skillBadge: {
    backgroundColor: "rgba(156,39,176,0.8)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  skillBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
});
