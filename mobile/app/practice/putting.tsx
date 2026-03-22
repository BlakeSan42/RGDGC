import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { puttingApi } from "@/services/api";
import { colors, spacing, fontSize, borderRadius } from "@/constants/theme";
import type { PuttAttempt, PuttProbability } from "@/types";

// ── Constants ──

const DISTANCES = [3, 5, 7, 10, 12, 15, 20] as const;
type Distance = (typeof DISTANCES)[number];

const MISS_REASONS = [
  { key: "miss_left", label: "Left" },
  { key: "miss_right", label: "Right" },
  { key: "miss_long", label: "Long" },
  { key: "miss_short", label: "Short" },
] as const;

const WIND_OPTIONS = [
  { key: "none", label: "None", speed: 0 },
  { key: "light", label: "Light", speed: 5 },
  { key: "moderate", label: "Mod", speed: 12 },
  { key: "strong", label: "Strong", speed: 22 },
] as const;

const PUTT_STYLES = [
  { key: "spin", label: "Spin" },
  { key: "push", label: "Push" },
  { key: "spush", label: "Spush" },
  { key: "turbo", label: "Turbo" },
] as const;

type PracticeMode = "free" | "ladder" | "circle_of_death" | "twenty_one";

const PRACTICE_MODES: { key: PracticeMode; label: string }[] = [
  { key: "free", label: "Free" },
  { key: "ladder", label: "Ladder" },
  { key: "circle_of_death", label: "Circle" },
  { key: "twenty_one", label: "21" },
];

const LADDER_DISTANCES = [3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20] as const;
const LADDER_MAKES_NEEDED = 3;

const CIRCLE_STATIONS = 5;
const CIRCLE_DISTANCE = 10; // C1 edge

function getZone(distance: number): "c1" | "c1x" | "c2" {
  if (distance < 10) return "c1";
  if (distance === 10) return "c1x";
  return "c2";
}

// ── Offline Queue ──

interface QueuedPutt extends PuttAttempt {
  timestamp: number;
}

// ── Component ──

export default function PuttingPracticeScreen() {
  // Mode
  const [mode, setMode] = useState<PracticeMode>("free");

  // Distance & options
  const [distance, setDistance] = useState<number>(5);
  const [wind, setWind] = useState(WIND_OPTIONS[0]);
  const [puttStyle, setPuttStyle] = useState(PUTT_STYLES[0]);
  const [showOptions, setShowOptions] = useState(false);

  // Probability
  const [probability, setProbability] = useState<PuttProbability | null>(null);

  // Miss reason overlay
  const [showMissReason, setShowMissReason] = useState(false);

  // Session tracking
  const [sessionPutts, setSessionPutts] = useState<QueuedPutt[]>([]);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);

  // Ladder state
  const [ladderLevel, setLadderLevel] = useState(0);
  const [ladderConsecutive, setLadderConsecutive] = useState(0);
  const [ladderBest, setLadderBest] = useState(0);

  // Circle of Death state
  const [circleStation, setCircleStation] = useState(0);
  const [circleResults, setCircleResults] = useState<(boolean | null)[]>(
    Array(CIRCLE_STATIONS).fill(null)
  );

  // 21 state
  const [score21, setScore21] = useState(0);
  const [busted, setBusted] = useState(false);

  // Offline queue
  const offlineQueue = useRef<QueuedPutt[]>([]);

  // Animations
  const makeFlash = useRef(new Animated.Value(0)).current;
  const missFlash = useRef(new Animated.Value(0)).current;
  const advanceAnim = useRef(new Animated.Value(1)).current;
  const bustAnim = useRef(new Animated.Value(0)).current;

  // ── Fetch probability when distance or wind changes ──

  useEffect(() => {
    let cancelled = false;
    puttingApi
      .probability(distance, wind.speed)
      .then((data) => {
        if (!cancelled) setProbability(data);
      })
      .catch(() => {
        // Offline or error - use local estimate
        if (!cancelled) {
          setProbability({
            distance_meters: distance,
            distance_feet: distance * 3.281,
            zone: getZone(distance),
            make_probability: estimateLocalProbability(distance),
            tour_average: estimateTourAverage(distance),
            personal_average: null,
            wind_adjustment: null,
            elevation_adjustment: null,
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [distance, wind]);

  // ── Reset mode state on mode change ──

  useEffect(() => {
    setSessionPutts([]);
    setStreak(0);
    setBestStreak(0);
    if (mode === "ladder") {
      setLadderLevel(0);
      setLadderConsecutive(0);
      setLadderBest(0);
      setDistance(LADDER_DISTANCES[0]);
    } else if (mode === "circle_of_death") {
      setCircleStation(0);
      setCircleResults(Array(CIRCLE_STATIONS).fill(null));
      setDistance(CIRCLE_DISTANCE);
    } else if (mode === "twenty_one") {
      setScore21(0);
      setBusted(false);
      setDistance(5);
    }
  }, [mode]);

  // ── Sync offline queue ──

  useEffect(() => {
    const interval = setInterval(async () => {
      if (offlineQueue.current.length > 0) {
        const batch = [...offlineQueue.current];
        try {
          await puttingApi.batchSync(batch);
          offlineQueue.current = offlineQueue.current.filter(
            (p) => !batch.includes(p)
          );
        } catch {
          // Still offline, keep in queue
        }
      }
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // ── Log putt to API (with offline fallback) ──

  const logPutt = useCallback(
    async (made: boolean, resultType?: string) => {
      const attempt: QueuedPutt = {
        distance_meters: distance,
        zone: getZone(distance),
        made,
        wind_speed: wind.speed > 0 ? wind.speed : undefined,
        putt_style: puttStyle.key as PuttAttempt["putt_style"],
        result_type: resultType || (made ? "center_chains" : undefined),
        pressure: "casual",
        timestamp: Date.now(),
      };

      // Update session
      setSessionPutts((prev) => [...prev, attempt]);

      // Streak tracking
      if (made) {
        setStreak((prev) => {
          const next = prev + 1;
          setBestStreak((best) => Math.max(best, next));
          return next;
        });
      } else {
        setStreak(0);
      }

      // Send to API
      try {
        await puttingApi.logAttempt(attempt);
      } catch {
        offlineQueue.current.push(attempt);
      }
    },
    [distance, wind, puttStyle]
  );

  // ── Flash animation helper ──

  const flashAnimation = (animValue: Animated.Value) => {
    animValue.setValue(1);
    Animated.timing(animValue, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    }).start();
  };

  // ── Handle make ──

  const handleMake = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    flashAnimation(makeFlash);
    logPutt(true);

    // Mode-specific logic
    if (mode === "ladder") {
      const next = ladderConsecutive + 1;
      if (next >= LADDER_MAKES_NEEDED) {
        // Advance to next level
        const nextLevel = ladderLevel + 1;
        setLadderLevel(nextLevel);
        setLadderConsecutive(0);
        setLadderBest((b) => Math.max(b, nextLevel));
        if (nextLevel < LADDER_DISTANCES.length) {
          setDistance(LADDER_DISTANCES[nextLevel]);
          // Advance animation
          advanceAnim.setValue(1.3);
          Animated.spring(advanceAnim, {
            toValue: 1,
            useNativeDriver: true,
          }).start();
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setLadderConsecutive(next);
      }
    } else if (mode === "circle_of_death") {
      const newResults = [...circleResults];
      newResults[circleStation] = true;
      setCircleResults(newResults);
      if (circleStation < CIRCLE_STATIONS - 1) {
        setCircleStation(circleStation + 1);
      }
    } else if (mode === "twenty_one") {
      const points = Math.max(1, Math.floor(distance / 3));
      const newScore = score21 + points;
      if (newScore > 21) {
        // Bust!
        setBusted(true);
        setScore21(0);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        bustAnim.setValue(1);
        Animated.timing(bustAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }).start(() => setBusted(false));
      } else {
        setScore21(newScore);
        if (newScore === 21) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    }
  }, [
    mode,
    logPutt,
    ladderConsecutive,
    ladderLevel,
    circleStation,
    circleResults,
    score21,
    distance,
    makeFlash,
    advanceAnim,
    bustAnim,
  ]);

  // ── Handle miss ──

  const handleMiss = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    flashAnimation(missFlash);
    setShowMissReason(true);
  }, [missFlash]);

  const handleMissReason = useCallback(
    (reason: string) => {
      setShowMissReason(false);
      logPutt(false, reason);

      if (mode === "ladder") {
        // Reset to beginning
        setLadderLevel(0);
        setLadderConsecutive(0);
        setDistance(LADDER_DISTANCES[0]);
      } else if (mode === "circle_of_death") {
        const newResults = [...circleResults];
        newResults[circleStation] = false;
        setCircleResults(newResults);
        if (circleStation < CIRCLE_STATIONS - 1) {
          setCircleStation(circleStation + 1);
        }
      } else if (mode === "twenty_one") {
        setScore21(0);
      }
    },
    [mode, logPutt, circleStation, circleResults]
  );

  // ── Session stats ──

  const sessionMakes = sessionPutts.filter((p) => p.made).length;
  const sessionTotal = sessionPutts.length;
  const sessionPct =
    sessionTotal > 0 ? Math.round((sessionMakes / sessionTotal) * 100) : 0;

  const byDistance = sessionPutts.reduce(
    (acc, p) => {
      const d = p.distance_meters;
      if (!acc[d]) acc[d] = { makes: 0, total: 0 };
      acc[d].total++;
      if (p.made) acc[d].makes++;
      return acc;
    },
    {} as Record<number, { makes: number; total: number }>
  );

  // ── Render helpers ──

  const screenWidth = Dimensions.get("window").width;
  const greenSize = Math.min(screenWidth - spacing.md * 2, 240);

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Practice Mode Tabs */}
        <View style={styles.modeTabs}>
          {PRACTICE_MODES.map((m) => (
            <Pressable
              key={m.key}
              onPress={() => setMode(m.key)}
              style={[
                styles.modeTab,
                mode === m.key && styles.modeTabActive,
              ]}
            >
              <Text
                style={[
                  styles.modeTabText,
                  mode === m.key && styles.modeTabTextActive,
                ]}
              >
                {m.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Mode-specific header */}
        {mode === "ladder" && (
          <Animated.View
            style={[
              styles.modeHeader,
              { transform: [{ scale: advanceAnim }] },
            ]}
          >
            <Text style={styles.modeHeaderTitle}>Ladder Drill</Text>
            <Text style={styles.modeHeaderSubtitle}>
              Make {LADDER_MAKES_NEEDED} in a row to advance
            </Text>
            <View style={styles.ladderProgress}>
              {Array.from({ length: LADDER_MAKES_NEEDED }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.ladderDot,
                    i < ladderConsecutive && styles.ladderDotFilled,
                  ]}
                />
              ))}
            </View>
            <Text style={styles.modeHeaderStat}>
              Level {ladderLevel + 1} / {LADDER_DISTANCES.length} | Best: Level{" "}
              {ladderBest + 1}
            </Text>
          </Animated.View>
        )}

        {mode === "circle_of_death" && (
          <View style={styles.modeHeader}>
            <Text style={styles.modeHeaderTitle}>Circle of Death</Text>
            <Text style={styles.modeHeaderSubtitle}>
              {CIRCLE_STATIONS} stations around C1 (10m)
            </Text>
            <View style={styles.circleStations}>
              {circleResults.map((result, i) => (
                <View
                  key={i}
                  style={[
                    styles.stationDot,
                    i === circleStation && styles.stationDotCurrent,
                    result === true && styles.stationDotMade,
                    result === false && styles.stationDotMissed,
                  ]}
                >
                  <Text style={styles.stationDotText}>{i + 1}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {mode === "twenty_one" && (
          <View style={styles.modeHeader}>
            <Text style={styles.modeHeaderTitle}>21</Text>
            <View style={styles.score21Container}>
              <Text style={styles.score21}>{score21}</Text>
              <Text style={styles.score21Label}> / 21</Text>
            </View>
            {busted && (
              <Animated.Text style={[styles.bustText, { opacity: bustAnim }]}>
                BUST! Score reset
              </Animated.Text>
            )}
            <Text style={styles.modeHeaderStat}>
              +{Math.max(1, Math.floor(distance / 3))} pts at {distance}m |
              Miss = reset to 0
            </Text>
          </View>
        )}

        {/* Putting Green Visualization */}
        <View style={[styles.greenContainer, { width: greenSize, height: greenSize }]}>
          {/* C2 ring (outer) */}
          <View
            style={[
              styles.c2Ring,
              {
                width: greenSize,
                height: greenSize,
                borderRadius: greenSize / 2,
              },
            ]}
          >
            {/* C1 ring (inner) */}
            <View
              style={[
                styles.c1Ring,
                {
                  width: greenSize / 2,
                  height: greenSize / 2,
                  borderRadius: greenSize / 4,
                },
              ]}
            >
              {/* Basket center */}
              <View style={styles.basket} />
            </View>
          </View>
          {/* Distance marker */}
          <View
            style={[
              styles.distanceMarker,
              {
                bottom: (distance / 20) * (greenSize / 2 - 12) + greenSize / 2 - 8,
                left: greenSize / 2 - 8,
              },
            ]}
          />
          {/* C1 / C2 labels */}
          <Text style={[styles.ringLabel, { top: greenSize * 0.27, right: spacing.sm }]}>
            C1
          </Text>
          <Text style={[styles.ringLabel, { top: spacing.xs, right: spacing.sm }]}>
            C2
          </Text>
        </View>

        {/* Probability display */}
        <View style={styles.probRow}>
          <Text style={styles.probDistance}>{distance}m</Text>
          <View style={styles.probStats}>
            <Text style={styles.probLabel}>
              Make:{" "}
              <Text style={styles.probValue}>
                {probability
                  ? `${Math.round(probability.make_probability * 100)}%`
                  : "--"}
              </Text>
            </Text>
            <Text style={styles.probLabel}>
              Tour Avg:{" "}
              <Text style={styles.probValue}>
                {probability
                  ? `${Math.round(probability.tour_average * 100)}%`
                  : "--"}
              </Text>
            </Text>
            {probability?.personal_average != null && (
              <Text style={styles.probLabel}>
                Your Avg:{" "}
                <Text style={styles.probValuePersonal}>
                  {Math.round(probability.personal_average * 100)}%
                </Text>
              </Text>
            )}
          </View>
        </View>

        {/* Distance Selection */}
        {mode !== "ladder" && mode !== "circle_of_death" && (
          <View style={styles.distanceRow}>
            {DISTANCES.map((d) => (
              <Pressable
                key={d}
                onPress={() => {
                  setDistance(d);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={[
                  styles.distanceBtn,
                  distance === d && styles.distanceBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.distanceBtnText,
                    distance === d && styles.distanceBtnTextActive,
                  ]}
                >
                  {d}m
                </Text>
                {d === 10 && (
                  <Text style={styles.distanceBtnSub}>C1X</Text>
                )}
              </Pressable>
            ))}
          </View>
        )}

        {/* Options toggle */}
        <Pressable
          onPress={() => setShowOptions(!showOptions)}
          style={styles.optionsToggle}
        >
          <Text style={styles.optionsToggleText}>
            {showOptions ? "Hide Options" : "Options"}{" "}
            {wind.key !== "none" || puttStyle.key !== "spin"
              ? `(${wind.label}, ${puttStyle.label})`
              : ""}
          </Text>
        </Pressable>

        {showOptions && (
          <View style={styles.optionsPanel}>
            {/* Wind */}
            <Text style={styles.optionLabel}>Wind</Text>
            <View style={styles.optionRow}>
              {WIND_OPTIONS.map((w) => (
                <Pressable
                  key={w.key}
                  onPress={() => setWind(w)}
                  style={[
                    styles.optionChip,
                    wind.key === w.key && styles.optionChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      wind.key === w.key && styles.optionChipTextActive,
                    ]}
                  >
                    {w.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            {/* Style */}
            <Text style={[styles.optionLabel, { marginTop: spacing.sm }]}>
              Putting Style
            </Text>
            <View style={styles.optionRow}>
              {PUTT_STYLES.map((s) => (
                <Pressable
                  key={s.key}
                  onPress={() => setPuttStyle(s)}
                  style={[
                    styles.optionChip,
                    puttStyle.key === s.key && styles.optionChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      puttStyle.key === s.key && styles.optionChipTextActive,
                    ]}
                  >
                    {s.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Make / Miss Buttons */}
        <View style={styles.puttButtons}>
          <Animated.View style={[styles.puttBtnWrap, { opacity: makeFlash.interpolate({ inputRange: [0, 1], outputRange: [1, 0.5] }) }]}>
            <Pressable
              onPress={handleMake}
              style={({ pressed }) => [
                styles.puttBtn,
                styles.puttBtnMake,
                pressed && styles.puttBtnPressed,
              ]}
            >
              <Text style={styles.puttBtnText}>MADE IT</Text>
            </Pressable>
          </Animated.View>

          <Animated.View style={[styles.puttBtnWrap, { opacity: missFlash.interpolate({ inputRange: [0, 1], outputRange: [1, 0.5] }) }]}>
            <Pressable
              onPress={handleMiss}
              style={({ pressed }) => [
                styles.puttBtn,
                styles.puttBtnMiss,
                pressed && styles.puttBtnPressed,
              ]}
            >
              <Text style={styles.puttBtnText}>MISSED</Text>
            </Pressable>
          </Animated.View>
        </View>

        {/* Miss Reason Overlay */}
        {showMissReason && (
          <View style={styles.missReasonOverlay}>
            <Text style={styles.missReasonTitle}>Where did it miss?</Text>
            <View style={styles.missReasonGrid}>
              {MISS_REASONS.map((r) => (
                <Pressable
                  key={r.key}
                  onPress={() => handleMissReason(r.key)}
                  style={styles.missReasonBtn}
                >
                  <Text style={styles.missReasonBtnText}>{r.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Session Stats */}
        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>Session</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {sessionMakes}/{sessionTotal}
              </Text>
              <Text style={styles.statLabel}>Made</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{sessionPct}%</Text>
              <Text style={styles.statLabel}>Rate</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{streak}</Text>
              <Text style={styles.statLabel}>Streak</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{bestStreak}</Text>
              <Text style={styles.statLabel}>Best</Text>
            </View>
          </View>

          {/* Breakdown by distance */}
          {Object.keys(byDistance).length > 0 && (
            <View style={styles.breakdownSection}>
              <Text style={styles.breakdownTitle}>By Distance</Text>
              {Object.entries(byDistance)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([d, stats]) => (
                  <View key={d} style={styles.breakdownRow}>
                    <Text style={styles.breakdownDistance}>{d}m</Text>
                    <View style={styles.breakdownBar}>
                      <View
                        style={[
                          styles.breakdownFill,
                          {
                            width: `${stats.total > 0 ? (stats.makes / stats.total) * 100 : 0}%`,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.breakdownPct}>
                      {stats.makes}/{stats.total} (
                      {stats.total > 0
                        ? Math.round((stats.makes / stats.total) * 100)
                        : 0}
                      %)
                    </Text>
                  </View>
                ))}
            </View>
          )}
        </View>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Local probability estimate (offline fallback using Gelman & Nolan) ──

function estimateLocalProbability(distanceMeters: number): number {
  // Simplified Gelman & Nolan model for intermediate player
  const R = 0.3365; // basket radius in meters (chain area)
  const r = 0.1325; // disc radius
  const sigma_angle = 0.035; // intermediate player
  const sigma_distance = 0.5;
  const epsilon = 0.04;

  const theta0 = Math.asin((R - r) / distanceMeters);
  // P_angle ~ integral of normal over [-theta0, theta0]
  const pAngle = erf(theta0 / (sigma_angle * Math.sqrt(2)));
  // P_distance ~ probability landing within tolerance
  const distTolerance = 0.5; // half-meter landing zone
  const pDistance = erf(distTolerance / (sigma_distance * Math.sqrt(2)));

  return Math.max(0.01, pAngle * pDistance * (1 - epsilon));
}

function estimateTourAverage(distanceMeters: number): number {
  // Pro-level sigma values
  const R = 0.3365;
  const r = 0.1325;
  const sigma_angle = 0.018;
  const sigma_distance = 0.25;
  const epsilon = 0.02;

  const theta0 = Math.asin(Math.min(1, (R - r) / distanceMeters));
  const pAngle = erf(theta0 / (sigma_angle * Math.sqrt(2)));
  const pDistance = erf(0.5 / (sigma_distance * Math.sqrt(2)));

  return Math.max(0.01, pAngle * pDistance * (1 - epsilon));
}

// Approximation of the error function
function erf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x >= 0 ? 1 : -1;
  const absX = Math.abs(x);
  const t = 1 / (1 + p * absX);
  const y =
    1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
  return sign * y;
}

// ── Styles ──

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg.secondary,
  },
  container: {
    flex: 1,
  },
  content: {
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },

  // Mode tabs
  modeTabs: {
    flexDirection: "row",
    backgroundColor: colors.gray[200],
    borderRadius: borderRadius.lg,
    padding: 3,
    marginBottom: spacing.md,
    alignSelf: "stretch",
  },
  modeTab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: "center",
    borderRadius: borderRadius.md,
  },
  modeTabActive: {
    backgroundColor: colors.bg.card,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  modeTabText: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.text.secondary,
  },
  modeTabTextActive: {
    color: colors.primary,
  },

  // Mode headers
  modeHeader: {
    alignItems: "center",
    marginBottom: spacing.md,
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignSelf: "stretch",
  },
  modeHeaderTitle: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.text.primary,
  },
  modeHeaderSubtitle: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  modeHeaderStat: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },

  // Ladder
  ladderProgress: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  ladderDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: "transparent",
  },
  ladderDotFilled: {
    backgroundColor: colors.primary,
  },

  // Circle of Death
  circleStations: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  stationDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.gray[400],
    alignItems: "center",
    justifyContent: "center",
  },
  stationDotCurrent: {
    borderColor: colors.secondary,
    borderWidth: 3,
  },
  stationDotMade: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  stationDotMissed: {
    backgroundColor: colors.error,
    borderColor: colors.error,
  },
  stationDotText: {
    fontSize: fontSize.xs,
    fontWeight: "700",
    color: colors.text.primary,
  },

  // 21
  score21Container: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: spacing.xs,
  },
  score21: {
    fontSize: fontSize["4xl"],
    fontWeight: "800",
    color: colors.primary,
  },
  score21Label: {
    fontSize: fontSize.xl,
    fontWeight: "600",
    color: colors.text.secondary,
  },
  bustText: {
    fontSize: fontSize.lg,
    fontWeight: "800",
    color: colors.error,
    marginTop: spacing.xs,
  },

  // Green visualization
  greenContainer: {
    alignSelf: "center",
    marginBottom: spacing.md,
    position: "relative",
  },
  c2Ring: {
    backgroundColor: "#C8E6C9",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#81C784",
  },
  c1Ring: {
    backgroundColor: "#A5D6A7",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#66BB6A",
  },
  basket: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primaryDark,
    borderWidth: 2,
    borderColor: colors.gray[700],
  },
  distanceMarker: {
    position: "absolute",
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.secondary,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  ringLabel: {
    position: "absolute",
    fontSize: fontSize.xs,
    fontWeight: "700",
    color: colors.primaryDark,
    opacity: 0.7,
  },

  // Probability
  probRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    alignSelf: "stretch",
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  probDistance: {
    fontSize: fontSize["3xl"],
    fontWeight: "800",
    color: colors.primary,
  },
  probStats: {
    alignItems: "flex-end",
    gap: 2,
  },
  probLabel: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  probValue: {
    fontWeight: "700",
    color: colors.text.primary,
  },
  probValuePersonal: {
    fontWeight: "700",
    color: colors.secondary,
  },

  // Distance buttons
  distanceRow: {
    flexDirection: "row",
    gap: spacing.xs,
    marginBottom: spacing.md,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  distanceBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.bg.card,
    borderWidth: 2,
    borderColor: colors.gray[300],
    alignItems: "center",
    minWidth: 44,
    minHeight: 44,
    justifyContent: "center",
  },
  distanceBtnActive: {
    borderColor: colors.secondary,
    backgroundColor: colors.secondary,
  },
  distanceBtnText: {
    fontSize: fontSize.base,
    fontWeight: "700",
    color: colors.text.primary,
  },
  distanceBtnTextActive: {
    color: colors.text.inverse,
  },
  distanceBtnSub: {
    fontSize: 9,
    color: colors.text.secondary,
    marginTop: -2,
  },

  // Options
  optionsToggle: {
    alignSelf: "stretch",
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  optionsToggleText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    fontWeight: "500",
  },
  optionsPanel: {
    alignSelf: "stretch",
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  optionLabel: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  optionRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  optionChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray[100],
    borderWidth: 1,
    borderColor: colors.gray[300],
    minHeight: 44,
    justifyContent: "center",
  },
  optionChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  optionChipText: {
    fontSize: fontSize.sm,
    color: colors.text.primary,
    fontWeight: "500",
  },
  optionChipTextActive: {
    color: colors.text.inverse,
  },

  // Putt buttons
  puttButtons: {
    flexDirection: "row",
    gap: spacing.md,
    alignSelf: "stretch",
    marginVertical: spacing.md,
  },
  puttBtnWrap: {
    flex: 1,
  },
  puttBtn: {
    paddingVertical: 22,
    borderRadius: borderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 64,
  },
  puttBtnMake: {
    backgroundColor: colors.success,
  },
  puttBtnMiss: {
    backgroundColor: colors.error,
  },
  puttBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  puttBtnText: {
    fontSize: fontSize.xl,
    fontWeight: "800",
    color: colors.text.inverse,
    letterSpacing: 1,
  },

  // Miss reason
  missReasonOverlay: {
    alignSelf: "stretch",
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: colors.error,
    marginBottom: spacing.sm,
  },
  missReasonTitle: {
    fontSize: fontSize.base,
    fontWeight: "600",
    color: colors.text.primary,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  missReasonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "center",
  },
  missReasonBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    backgroundColor: colors.gray[100],
    borderWidth: 1,
    borderColor: colors.gray[300],
    minWidth: 80,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  missReasonBtnText: {
    fontSize: fontSize.base,
    fontWeight: "600",
    color: colors.text.primary,
  },

  // Session stats
  statsCard: {
    alignSelf: "stretch",
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  statsTitle: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontSize: fontSize["2xl"],
    fontWeight: "800",
    color: colors.text.primary,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },

  // Breakdown
  breakdownSection: {
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
    paddingTop: spacing.md,
  },
  breakdownTitle: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  breakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  breakdownDistance: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.text.primary,
    width: 32,
  },
  breakdownBar: {
    flex: 1,
    height: 8,
    backgroundColor: colors.gray[200],
    borderRadius: 4,
    overflow: "hidden",
  },
  breakdownFill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  breakdownPct: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    width: 80,
    textAlign: "right",
  },
});
