/**
 * AR Practice Mode — camera overlay with C1/C2 ring visualization,
 * distance challenges, and automatic putt logging.
 *
 * Practice types:
 * - Free: Putt from any distance, track streaks
 * - Ladder: Progressive distances, advance on 3 consecutive makes
 * - Circle Walk: Walk the C1 circle, putt from 8 stations
 * - Pressure: Make 5 in a row or restart
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  Platform,
  ScrollView,
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
  feetToMeters,
} from "./arUtils";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

type PracticeType = "free" | "ladder" | "circle_walk" | "pressure";

interface ARPracticeModeProps {
  basket: {
    coordinates: [number, number];
    hole_number: number;
    par: number;
    elevation_ft?: number | null;
  };
  onClose: () => void;
  skillLevel?: string;
}

interface PracticeSession {
  totalPutts: number;
  totalMakes: number;
  currentStreak: number;
  bestStreak: number;
  ladderDistance: number; // current ladder distance in meters
  ladderConsecutive: number;
  circleStation: number; // 1-8
  pressureCount: number;
}

const LADDER_DISTANCES = [3, 5, 7, 10, 12, 15, 20]; // meters

export default function ARPracticeMode({
  basket,
  onClose,
  skillLevel = "intermediate",
}: ARPracticeModeProps) {
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [practiceType, setPracticeType] = useState<PracticeType>("free");
  const [session, setSession] = useState<PracticeSession>({
    totalPutts: 0,
    totalMakes: 0,
    currentStreak: 0,
    bestStreak: 0,
    ladderDistance: LADDER_DISTANCES[0],
    ladderConsecutive: 0,
    circleStation: 1,
    pressureCount: 0,
  });
  const [feedback, setFeedback] = useState<string | null>(null);
  const { heading } = useCompass(true);
  const locationSub = useRef<Location.LocationSubscription | null>(null);
  const offlineQueue = useRef<any[]>([]);

  // GPS
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
  const zone = distance != null ? getZone(distance) : null;
  const zoneInfo = zone ? getZoneInfo(zone) : null;

  const params = SKILL_LEVELS[skillLevel] || SKILL_LEVELS.intermediate;
  const prob = distM != null ? estimatePuttProb(distM, params) : null;

  const targetBearing = userLocation ? bearingTo(userLocation, basket.coordinates) : null;
  const relativeBearing =
    heading != null && targetBearing != null
      ? (targetBearing - heading + 360) % 360
      : null;

  // Show feedback briefly
  const showFeedback = useCallback((msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 1500);
  }, []);

  // Log putt and update session
  const logPutt = useCallback(
    async (made: boolean) => {
      if (distM == null) return;

      const attempt = {
        distance_meters: Math.round(distM * 10) / 10,
        zone: (zone === "c1" || zone === "c1x" ? zone : "c2") as "c1" | "c1x" | "c2",
        made,
        putt_style: "spin" as const,
        pressure: "casual" as const,
      };

      // Queue for batch sync
      offlineQueue.current.push(attempt);

      // Try to log immediately
      try {
        await puttingApi.logAttempt(attempt);
      } catch {
        // Will batch sync later
      }

      if (Platform.OS !== "web") {
        Haptics.impactAsync(
          made
            ? Haptics.ImpactFeedbackStyle.Light
            : Haptics.ImpactFeedbackStyle.Medium,
        );
      }

      setSession((prev) => {
        const newStreak = made ? prev.currentStreak + 1 : 0;
        const updated: PracticeSession = {
          ...prev,
          totalPutts: prev.totalPutts + 1,
          totalMakes: prev.totalMakes + (made ? 1 : 0),
          currentStreak: newStreak,
          bestStreak: Math.max(prev.bestStreak, newStreak),
        };

        // Practice type specific logic
        switch (practiceType) {
          case "ladder":
            if (made) {
              const newConsec = prev.ladderConsecutive + 1;
              if (newConsec >= 3) {
                const nextIdx = LADDER_DISTANCES.indexOf(prev.ladderDistance) + 1;
                if (nextIdx < LADDER_DISTANCES.length) {
                  updated.ladderDistance = LADDER_DISTANCES[nextIdx];
                  updated.ladderConsecutive = 0;
                  showFeedback(`Advanced to ${LADDER_DISTANCES[nextIdx]}m!`);
                } else {
                  showFeedback("Ladder complete!");
                }
              } else {
                updated.ladderConsecutive = newConsec;
                showFeedback(`${newConsec}/3 makes`);
              }
            } else {
              updated.ladderConsecutive = 0;
              showFeedback("Reset — 0/3");
            }
            break;

          case "circle_walk":
            updated.circleStation = ((prev.circleStation) % 8) + 1;
            showFeedback(
              made
                ? `Station ${updated.circleStation}/8`
                : `Miss — Station ${updated.circleStation}/8`,
            );
            break;

          case "pressure":
            if (made) {
              updated.pressureCount = prev.pressureCount + 1;
              if (updated.pressureCount >= 5) {
                showFeedback("5 in a row! Challenge complete!");
                updated.pressureCount = 0;
              } else {
                showFeedback(`${updated.pressureCount}/5 — keep going!`);
              }
            } else {
              updated.pressureCount = 0;
              showFeedback("Miss — back to 0/5");
            }
            break;

          default:
            showFeedback(made ? "Made it!" : "Miss");
        }

        return updated;
      });
    },
    [distM, zone, practiceType, showFeedback],
  );

  // Batch sync remaining putts on unmount
  useEffect(() => {
    return () => {
      if (offlineQueue.current.length > 0) {
        puttingApi.batchSync(offlineQueue.current).catch(() => {});
      }
    };
  }, []);

  // Reset session
  const resetSession = () => {
    setSession({
      totalPutts: 0,
      totalMakes: 0,
      currentStreak: 0,
      bestStreak: 0,
      ladderDistance: LADDER_DISTANCES[0],
      ladderConsecutive: 0,
      circleStation: 1,
      pressureCount: 0,
    });
  };

  const makePercent =
    session.totalPutts > 0
      ? Math.round((session.totalMakes / session.totalPutts) * 100)
      : 0;

  return (
    <CameraBackground facing="back">
      <View style={styles.overlay} />

      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.closeBtn} onPress={onClose}>
          <Ionicons name="close" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>AR PRACTICE</Text>
        <Pressable style={styles.resetBtn} onPress={resetSession}>
          <Ionicons name="refresh" size={24} color="#fff" />
        </Pressable>
      </View>

      {/* Practice type selector */}
      <ScrollView
        horizontal
        style={styles.typeSelector}
        contentContainerStyle={styles.typeSelectorContent}
        showsHorizontalScrollIndicator={false}
      >
        {(
          [
            { key: "free", label: "Free", icon: "disc" },
            { key: "ladder", label: "Ladder", icon: "trending-up" },
            { key: "circle_walk", label: "Circle Walk", icon: "ellipse" },
            { key: "pressure", label: "Pressure", icon: "flame" },
          ] as const
        ).map(({ key, label, icon }) => (
          <Pressable
            key={key}
            style={[
              styles.typeBtn,
              practiceType === key && styles.typeBtnActive,
            ]}
            onPress={() => {
              setPracticeType(key);
              resetSession();
            }}
          >
            <Ionicons
              name={icon as any}
              size={16}
              color={practiceType === key ? "#fff" : "#aaa"}
            />
            <Text
              style={[
                styles.typeBtnText,
                practiceType === key && styles.typeBtnTextActive,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Zone rings on camera */}
      <View style={styles.zoneDisplay}>
        <View
          style={[
            styles.outerRing,
            zone === "c2" && styles.ringHighlight,
            { borderColor: zone === "c2" ? "#FFC107" : "rgba(255,193,7,0.3)" },
          ]}
        />
        <View
          style={[
            styles.innerRing,
            (zone === "c1" || zone === "c1x") && styles.ringHighlight,
            {
              borderColor:
                zone === "c1" || zone === "c1x"
                  ? "#4CAF50"
                  : "rgba(76,175,80,0.3)",
            },
          ]}
        />
        <View style={styles.centerDot} />
      </View>

      {/* Distance + zone */}
      <View style={styles.distanceArea}>
        <Text style={[styles.distanceText, { color: zoneInfo?.color ?? "#fff" }]}>
          {distance != null ? `${Math.round(distance)}ft` : "..."}
        </Text>
        {zoneInfo && (
          <Text style={[styles.zoneText, { color: zoneInfo.color }]}>
            {zoneInfo.label}
          </Text>
        )}
        {prob != null && (
          <Text style={[styles.probText, { color: probColor(prob) }]}>
            {formatProb(prob)} make
          </Text>
        )}
      </View>

      {/* Practice-specific info */}
      {practiceType === "ladder" && (
        <View style={styles.practiceInfo}>
          <Text style={styles.practiceInfoLabel}>Target Distance</Text>
          <Text style={styles.practiceInfoValue}>
            {session.ladderDistance}m ({Math.round(session.ladderDistance / 0.3048)}ft)
          </Text>
          <Text style={styles.practiceInfoSub}>
            {session.ladderConsecutive}/3 consecutive makes to advance
          </Text>
        </View>
      )}
      {practiceType === "circle_walk" && (
        <View style={styles.practiceInfo}>
          <Text style={styles.practiceInfoLabel}>Station</Text>
          <Text style={styles.practiceInfoValue}>
            {session.circleStation} / 8
          </Text>
          <Text style={styles.practiceInfoSub}>Walk the C1 circle</Text>
        </View>
      )}
      {practiceType === "pressure" && (
        <View style={styles.practiceInfo}>
          <Text style={styles.practiceInfoLabel}>Consecutive Makes</Text>
          <Text style={styles.practiceInfoValue}>
            {session.pressureCount} / 5
          </Text>
          <Text style={styles.practiceInfoSub}>Make 5 in a row to win</Text>
        </View>
      )}

      {/* Feedback toast */}
      {feedback && (
        <View style={styles.feedbackToast}>
          <Text style={styles.feedbackText}>{feedback}</Text>
        </View>
      )}

      {/* Made/Miss buttons */}
      <View style={styles.actionArea}>
        <Pressable
          style={[styles.actionBtn, styles.missBtn]}
          onPress={() => logPutt(false)}
        >
          <Ionicons name="close" size={32} color="#fff" />
          <Text style={styles.actionBtnText}>MISS</Text>
        </Pressable>
        <Pressable
          style={[styles.actionBtn, styles.madeBtn]}
          onPress={() => logPutt(true)}
        >
          <Ionicons name="checkmark" size={32} color="#fff" />
          <Text style={styles.actionBtnText}>MADE</Text>
        </Pressable>
      </View>

      {/* Session stats bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{session.totalPutts}</Text>
          <Text style={styles.statLabel}>Putts</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{session.totalMakes}</Text>
          <Text style={styles.statLabel}>Makes</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: makePercent >= 50 ? "#4CAF50" : "#FFC107" }]}>
            {makePercent}%
          </Text>
          <Text style={styles.statLabel}>Rate</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{session.currentStreak}</Text>
          <Text style={styles.statLabel}>Streak</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: "#FF6B35" }]}>
            {session.bestStreak}
          </Text>
          <Text style={styles.statLabel}>Best</Text>
        </View>
      </View>
    </CameraBackground>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.15)" },

  header: {
    position: "absolute",
    top: 50,
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 20,
  },
  closeBtn: {
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 22,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 2,
  },
  resetBtn: {
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 22,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  typeSelector: {
    position: "absolute",
    top: 104,
    left: 0,
    right: 0,
    maxHeight: 44,
    zIndex: 15,
  },
  typeSelectorContent: {
    paddingHorizontal: 12,
    gap: 8,
  },
  typeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  typeBtnActive: {
    backgroundColor: "rgba(27,94,32,0.9)",
    borderColor: "#4CAF50",
  },
  typeBtnText: { color: "#aaa", fontSize: 13, fontWeight: "600" },
  typeBtnTextActive: { color: "#fff" },

  zoneDisplay: {
    position: "absolute",
    top: SCREEN_H * 0.22,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 3,
  },
  outerRing: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1.5,
    borderStyle: "dashed",
    top: -100,
  },
  innerRing: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1.5,
    borderStyle: "dashed",
    top: -60,
  },
  ringHighlight: {
    borderWidth: 3,
    borderStyle: "solid",
  },
  centerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#FF6B35",
    borderWidth: 2,
    borderColor: "#fff",
  },

  distanceArea: {
    position: "absolute",
    top: SCREEN_H * 0.35,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 8,
  },
  distanceText: {
    fontSize: 48,
    fontWeight: "800",
    fontFamily: Platform.OS === "ios" ? "JetBrains Mono" : "monospace",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  zoneText: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 2,
  },
  probText: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: 4,
  },

  practiceInfo: {
    position: "absolute",
    top: SCREEN_H * 0.48,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 8,
  },
  practiceInfoLabel: {
    color: "#aaa",
    fontSize: 12,
    fontWeight: "600",
  },
  practiceInfoValue: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "800",
    fontFamily: Platform.OS === "ios" ? "JetBrains Mono" : "monospace",
  },
  practiceInfoSub: {
    color: "#888",
    fontSize: 12,
    marginTop: 2,
  },

  feedbackToast: {
    position: "absolute",
    top: SCREEN_H * 0.58,
    left: 40,
    right: 40,
    backgroundColor: "rgba(0,0,0,0.85)",
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: "center",
    zIndex: 15,
  },
  feedbackText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },

  actionArea: {
    position: "absolute",
    bottom: 100,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "center",
    gap: 24,
    zIndex: 10,
  },
  actionBtn: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  madeBtn: {
    backgroundColor: "rgba(76,175,80,0.9)",
  },
  missBtn: {
    backgroundColor: "rgba(244,67,54,0.85)",
  },
  actionBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 2,
  },

  statsBar: {
    position: "absolute",
    bottom: 30,
    left: 12,
    right: 12,
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "rgba(0,0,0,0.8)",
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 8,
    zIndex: 10,
  },
  statItem: { alignItems: "center", minWidth: 50 },
  statValue: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    fontFamily: Platform.OS === "ios" ? "JetBrains Mono" : "monospace",
  },
  statLabel: {
    color: "#888",
    fontSize: 10,
    fontWeight: "600",
    marginTop: 1,
  },
});
