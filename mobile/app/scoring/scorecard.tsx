import { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Dimensions,
  Modal,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ScoreBadge } from "@/components/common/ScoreBadge";
import { Button } from "@/components/common/Button";
import { roundApi, courseApi, discApi } from "@/services/api";
import { useOffline } from "@/context/OfflineContext";
import { type OfflineRound } from "@/services/offline";
import { colors, spacing, fontSize, borderRadius } from "@/constants/theme";
import { getScoreColor, getScoreLabel } from "@/types";
import type { RegisteredDisc } from "@/types";

const { width } = Dimensions.get("window");

const DNF_OVER_PAR = 4; // DNF records as par + 4

interface HoleState {
  holeNumber: number;
  par: number;
  strokes: number;
  submitted: boolean;
  isDnf: boolean;
  discUsed: string | null;
}

// ── Toast Component ──
function Toast({ message, visible }: { message: string; visible: boolean }) {
  if (!visible) return null;
  return (
    <View style={toastStyles.container}>
      <View style={toastStyles.pill}>
        <Ionicons name="checkmark-circle" size={18} color={colors.success} />
        <Text style={toastStyles.text}>{message}</Text>
      </View>
    </View>
  );
}

const toastStyles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 100,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 999,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.gray[900],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  text: {
    color: colors.text.inverse,
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
});

export default function ScorecardScreen() {
  const {
    roundId,
    layoutId,
    courseId,
    courseName,
    layoutName,
    totalHoles,
    totalPar,
  } = useLocalSearchParams<{
    roundId: string;
    layoutId: string;
    courseId: string;
    courseName: string;
    layoutName: string;
    totalHoles: string;
    totalPar: string;
  }>();

  const numHoles = Number(totalHoles) || 18;
  const par = Number(totalPar) || 54;
  const fallbackPar = Math.round(par / numHoles);

  const [holes, setHoles] = useState<HoleState[]>(
    Array.from({ length: numHoles }, (_, i) => ({
      holeNumber: i + 1,
      par: fallbackPar,
      strokes: fallbackPar, // default to par
      submitted: false,
      isDnf: false,
      discUsed: null,
    }))
  );

  // Fetch actual per-hole par data from the layout
  useEffect(() => {
    const fetchLayout = async () => {
      try {
        const layout = courseId
          ? await courseApi.getLayout(Number(courseId), Number(layoutId))
          : await courseApi.getLayoutById(Number(layoutId));
        if (layout.hole_list?.length) {
          const sorted = [...layout.hole_list].sort((a, b) => a.hole_number - b.hole_number);
          setHoles((prev) =>
            prev.map((h, i) => {
              const layoutHole = sorted[i];
              if (!layoutHole) return h;
              const holePar = layoutHole.par;
              return {
                ...h,
                par: holePar,
                // Only update strokes to match par if not yet submitted
                strokes: h.submitted ? h.strokes : holePar,
              };
            })
          );
        }
      } catch {
        // Fall back to evenly divided par (already set)
      }
    };
    fetchLayout();
  }, [courseId, layoutId]);

  const { isOnline, saveRound } = useOffline();
  const [currentHole, setCurrentHole] = useState(0);
  const [completing, setCompleting] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const [summaryVisible, setSummaryVisible] = useState(false);
  const [summaryData, setSummaryData] = useState<{
    totalStrokes: number;
    totalScore: number;
    birdies: number;
    pars: number;
    bogeys: number;
    doubles: number;
    eagles: number;
    bestHole: { number: number; score: number };
    worstHole: { number: number; score: number };
  } | null>(null);

  // Disc picker state
  const [discPickerVisible, setDiscPickerVisible] = useState(false);
  const [myDiscs, setMyDiscs] = useState<RegisteredDisc[]>([]);
  const [discsLoaded, setDiscsLoaded] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const holeNavRef = useRef<ScrollView>(null);

  const current = holes[currentHole];
  const scoredHoles = holes.filter((h) => h.submitted);
  const scoredStrokes = scoredHoles.reduce((sum, h) => sum + h.strokes, 0);
  const scoredPar = scoredHoles.reduce((sum, h) => sum + h.par, 0);
  const runningScore = scoredStrokes - scoredPar;
  const totalStrokes = holes.reduce((sum, h) => sum + h.strokes, 0);
  const actualTotalPar = holes.reduce((sum, h) => sum + h.par, 0);
  const totalScore = totalStrokes - actualTotalPar;

  // Show a temporary toast
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2000);
  }, []);

  // Scroll hole nav to keep current hole visible
  useEffect(() => {
    holeNavRef.current?.scrollTo({
      x: Math.max(0, currentHole * 52 - width / 2 + 26),
      animated: true,
    });
  }, [currentHole]);

  const updateStrokes = (delta: number) => {
    setHoles((prev) => {
      const updated = [...prev];
      const hole = updated[currentHole];
      const newVal = Math.max(1, Math.min(12, hole.strokes + delta));
      updated[currentHole] = { ...hole, strokes: newVal, isDnf: false };
      return updated;
    });
  };

  // FIX 4: DNF a hole
  const markDnf = () => {
    setHoles((prev) => {
      const updated = [...prev];
      const hole = updated[currentHole];
      updated[currentHole] = {
        ...hole,
        strokes: hole.par + DNF_OVER_PAR,
        isDnf: true,
      };
      return updated;
    });
  };

  // FIX 5: Disc selection
  const openDiscPicker = async () => {
    if (!discsLoaded) {
      try {
        const discs = await discApi.myDiscs();
        setMyDiscs(discs);
      } catch {
        // If disc fetch fails, show empty picker
      }
      setDiscsLoaded(true);
    }
    setDiscPickerVisible(true);
  };

  const selectDisc = (disc: RegisteredDisc | null) => {
    setHoles((prev) => {
      const updated = [...prev];
      updated[currentHole] = {
        ...updated[currentHole],
        discUsed: disc ? `${disc.manufacturer} ${disc.mold}` : null,
      };
      return updated;
    });
    setDiscPickerVisible(false);
  };

  // FIX 3: Submit or update score
  const submitAndNext = async () => {
    const hole = holes[currentHole];
    const scoreData = {
      hole_number: hole.holeNumber,
      strokes: hole.strokes,
      ...(hole.discUsed ? { disc_used: hole.discUsed } : {}),
      ...(hole.isDnf ? { is_dnf: true } : {}),
    };

    if (hole.submitted) {
      // Update existing score
      try {
        await roundApi.updateScore(Number(roundId), hole.holeNumber, {
          strokes: hole.strokes,
          ...(hole.discUsed ? { disc_used: hole.discUsed } : {}),
          ...(hole.isDnf ? { is_dnf: true } : {}),
        });
        showToast("Score Updated");
      } catch {
        showToast("Saved locally");
      }
    } else {
      // Submit new score
      try {
        await roundApi.submitScore(Number(roundId), scoreData);
      } catch {
        // Offline or error — mark as submitted locally, will sync with full round later
      }
      setHoles((prev) => {
        const updated = [...prev];
        updated[currentHole] = { ...updated[currentHole], submitted: true };
        return updated;
      });
    }

    if (currentHole < numHoles - 1) {
      setCurrentHole(currentHole + 1);
    }
  };

  const goToHole = (index: number) => {
    setCurrentHole(index);
  };

  // FIX 6: Compute round summary data
  const computeSummary = () => {
    let birdies = 0, pars = 0, bogeys = 0, doubles = 0, eagles = 0;
    let bestRelative = Infinity, worstRelative = -Infinity;
    let bestHole = { number: 1, score: 0 };
    let worstHole = { number: 1, score: 0 };

    for (const h of holes) {
      const rel = h.strokes - h.par;
      if (rel <= -2) eagles++;
      else if (rel === -1) birdies++;
      else if (rel === 0) pars++;
      else if (rel === 1) bogeys++;
      else doubles++;

      if (rel < bestRelative) {
        bestRelative = rel;
        bestHole = { number: h.holeNumber, score: rel };
      }
      if (rel > worstRelative) {
        worstRelative = rel;
        worstHole = { number: h.holeNumber, score: rel };
      }
    }

    return {
      totalStrokes,
      totalScore,
      birdies,
      pars,
      bogeys,
      doubles,
      eagles,
      bestHole,
      worstHole,
    };
  };

  const completeRound = async () => {
    setCompleting(true);

    // Try online submission first
    try {
      // Submit any unsubmitted holes
      for (let i = 0; i < holes.length; i++) {
        if (!holes[i].submitted) {
          await roundApi.submitScore(Number(roundId), {
            hole_number: holes[i].holeNumber,
            strokes: holes[i].strokes,
            ...(holes[i].discUsed ? { disc_used: holes[i].discUsed! } : {}),
            ...(holes[i].isDnf ? { is_dnf: true } : {}),
          });
        }
      }

      await roundApi.complete(Number(roundId));
      setSummaryData(computeSummary());
      setSummaryVisible(true);
    } catch {
      // Network error — save round offline
      const offlineRound: OfflineRound = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        layout_id: Number(layoutId),
        started_at: new Date().toISOString(),
        scores: holes.map((h) => ({
          hole_id: h.holeNumber,
          hole_number: h.holeNumber,
          strokes: h.strokes,
        })),
        completed_at: new Date().toISOString(),
        total_score: totalScore,
        total_strokes: totalStrokes,
        is_practice: false,
      };

      await saveRound(offlineRound);
      setSummaryData(computeSummary());
      setSummaryVisible(true);
    } finally {
      setCompleting(false);
    }
  };

  // ── Format score relative to par ──
  const formatRelative = (score: number) => {
    if (score > 0) return `+${score}`;
    if (score === 0) return "E";
    return `${score}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <Toast message={toastMessage} visible={toastVisible} />

      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.courseName}>{courseName} -- {layoutName}</Text>
          <Text style={styles.holeLabel}>
            Hole {current.holeNumber} of {numHoles} -- Par {current.par}
          </Text>
        </View>
        <View style={styles.totalBox}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={[styles.totalScore, { color: totalScore <= 0 ? colors.score.birdie : colors.score.bogey }]}>
            {formatRelative(totalScore)}
          </Text>
        </View>
      </View>

      {/* FIX 1: Running Total Bar */}
      <View style={styles.runningTotalBar}>
        <View style={styles.runningTotalItem}>
          <Text style={styles.runningTotalLabel}>Scored</Text>
          <Text style={styles.runningTotalValue}>{scoredHoles.length}/{numHoles}</Text>
        </View>
        <View style={styles.runningTotalItem}>
          <Text style={styles.runningTotalLabel}>Strokes</Text>
          <Text style={styles.runningTotalValue}>{scoredStrokes}</Text>
        </View>
        <View style={styles.runningTotalItem}>
          <Text style={styles.runningTotalLabel}>vs Par</Text>
          <Text
            style={[
              styles.runningTotalScore,
              {
                color:
                  runningScore < 0
                    ? colors.score.birdie
                    : runningScore > 0
                    ? colors.score.bogey
                    : colors.score.par,
              },
            ]}
          >
            {formatRelative(runningScore)}
          </Text>
        </View>
        <View style={styles.runningTotalItem}>
          <Text style={styles.runningTotalLabel}>Projected</Text>
          <Text
            style={[
              styles.runningTotalScore,
              {
                color:
                  totalScore < 0
                    ? colors.score.birdie
                    : totalScore > 0
                    ? colors.score.bogey
                    : colors.score.par,
              },
            ]}
          >
            {formatRelative(totalScore)}
          </Text>
        </View>
      </View>

      {/* FIX 2: Hole Navigator with par, score indicators */}
      <ScrollView
        ref={holeNavRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.holeNav}
        contentContainerStyle={styles.holeNavContent}
      >
        {holes.map((hole, i) => {
          const isActive = i === currentHole;
          const isScored = hole.submitted;
          return (
            <Pressable
              key={i}
              onPress={() => goToHole(i)}
              style={[
                styles.holeNavItem,
                isActive && styles.holeNavActive,
                isScored && !isActive && styles.holeNavScored,
              ]}
            >
              <Text
                style={[
                  styles.holeNavNum,
                  isActive && styles.holeNavNumActive,
                  isScored && !isActive && styles.holeNavNumScored,
                ]}
              >
                {hole.holeNumber}
              </Text>
              <Text style={[styles.holeNavPar, isActive && { color: colors.secondary }]}>
                P{hole.par}
              </Text>
              {isScored ? (
                hole.isDnf ? (
                  <Text style={styles.holeNavDnf}>DNF</Text>
                ) : (
                  <ScoreBadge strokes={hole.strokes} par={hole.par} size="sm" />
                )
              ) : (
                <View style={styles.holeNavDot}>
                  <View
                    style={[
                      styles.holeNavDotInner,
                      isActive && { backgroundColor: colors.secondary },
                    ]}
                  />
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Score Entry */}
      <View style={styles.scoreEntry}>
        <View style={styles.parDisplay}>
          <Text style={styles.parText}>Par {current.par}</Text>
          {current.submitted && (
            <Text style={styles.editingLabel}>Editing</Text>
          )}
        </View>

        {/* DNF badge if marked */}
        {current.isDnf && (
          <View style={styles.dnfBadge}>
            <Ionicons name="close-circle" size={16} color={colors.text.inverse} />
            <Text style={styles.dnfBadgeText}>DNF</Text>
          </View>
        )}

        <View style={styles.scoreControl}>
          <Pressable
            onPress={() => updateStrokes(-1)}
            style={styles.scoreButton}
            hitSlop={12}
          >
            <Ionicons name="remove-circle" size={56} color={colors.score.birdie} />
          </Pressable>

          <View style={styles.scoreDisplay}>
            <ScoreBadge strokes={current.strokes} par={current.par} size="lg" showLabel />
          </View>

          <Pressable
            onPress={() => updateStrokes(1)}
            style={styles.scoreButton}
            hitSlop={12}
          >
            <Ionicons name="add-circle" size={56} color={colors.score.bogey} />
          </Pressable>
        </View>

        {/* Quick Score Buttons */}
        <View style={styles.quickScores}>
          {[current.par - 2, current.par - 1, current.par, current.par + 1, current.par + 2].map(
            (s) =>
              s >= 1 && (
                <Pressable
                  key={s}
                  onPress={() =>
                    setHoles((prev) => {
                      const updated = [...prev];
                      updated[currentHole] = { ...updated[currentHole], strokes: s, isDnf: false };
                      return updated;
                    })
                  }
                  style={[
                    styles.quickButton,
                    current.strokes === s && !current.isDnf && styles.quickButtonActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.quickText,
                      current.strokes === s && !current.isDnf && styles.quickTextActive,
                    ]}
                  >
                    {s}
                  </Text>
                </Pressable>
              )
          )}
        </View>

        {/* FIX 4: DNF Button + FIX 5: Disc Selector */}
        <View style={styles.extraRow}>
          <Pressable
            onPress={markDnf}
            style={[styles.dnfButton, current.isDnf && styles.dnfButtonActive]}
          >
            <Ionicons
              name="close-circle-outline"
              size={18}
              color={current.isDnf ? colors.text.inverse : colors.error}
            />
            <Text
              style={[
                styles.dnfButtonText,
                current.isDnf && styles.dnfButtonTextActive,
              ]}
            >
              DNF
            </Text>
          </Pressable>

          <Pressable onPress={openDiscPicker} style={styles.discButton}>
            <Ionicons name="disc-outline" size={18} color={colors.text.secondary} />
            <Text style={styles.discButtonText}>
              {current.discUsed ? current.discUsed : "Disc: --"}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        {currentHole < numHoles - 1 ? (
          <Button
            title={current.submitted ? "Save & Next Hole" : "Next Hole"}
            onPress={submitAndNext}
            size="lg"
          />
        ) : (
          <Button
            title="Complete Round"
            onPress={completeRound}
            loading={completing}
            size="lg"
          />
        )}
      </View>

      {/* FIX 5: Disc Picker Modal */}
      <Modal visible={discPickerVisible} transparent animationType="slide">
        <View style={modalStyles.overlay}>
          <View style={modalStyles.sheet}>
            <View style={modalStyles.header}>
              <Text style={modalStyles.title}>Select Disc</Text>
              <Pressable onPress={() => setDiscPickerVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </Pressable>
            </View>

            <Pressable onPress={() => selectDisc(null)} style={modalStyles.discRow}>
              <Text style={modalStyles.discName}>No disc selected</Text>
              <Ionicons name="close-circle-outline" size={20} color={colors.text.secondary} />
            </Pressable>

            {myDiscs.length === 0 && discsLoaded ? (
              <Text style={modalStyles.emptyText}>
                No discs registered. Add discs in your profile to track them here.
              </Text>
            ) : (
              <FlatList
                data={myDiscs}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <Pressable onPress={() => selectDisc(item)} style={modalStyles.discRow}>
                    <View>
                      <Text style={modalStyles.discName}>
                        {item.manufacturer} {item.mold}
                      </Text>
                      <Text style={modalStyles.discMeta}>
                        {item.plastic} -- {item.weight_grams}g -- {item.color}
                      </Text>
                    </View>
                    {current.discUsed === `${item.manufacturer} ${item.mold}` && (
                      <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                    )}
                  </Pressable>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* FIX 6: Round Summary Modal */}
      <Modal visible={summaryVisible} transparent animationType="fade">
        <View style={summaryStyles.overlay}>
          <View style={summaryStyles.card}>
            <Text style={summaryStyles.title}>Round Complete!</Text>

            {summaryData && (
              <>
                {/* Big score display */}
                <View style={summaryStyles.bigScore}>
                  <Text style={summaryStyles.bigStrokes}>{summaryData.totalStrokes}</Text>
                  <Text
                    style={[
                      summaryStyles.bigRelative,
                      {
                        color:
                          summaryData.totalScore < 0
                            ? colors.score.birdie
                            : summaryData.totalScore > 0
                            ? colors.score.bogey
                            : colors.score.par,
                      },
                    ]}
                  >
                    {formatRelative(summaryData.totalScore)}
                  </Text>
                </View>

                {/* Scoring breakdown */}
                <View style={summaryStyles.breakdown}>
                  {summaryData.eagles > 0 && (
                    <View style={summaryStyles.breakdownItem}>
                      <View style={[summaryStyles.breakdownDot, { backgroundColor: colors.score.eagle }]} />
                      <Text style={summaryStyles.breakdownLabel}>Eagles</Text>
                      <Text style={summaryStyles.breakdownCount}>{summaryData.eagles}</Text>
                    </View>
                  )}
                  <View style={summaryStyles.breakdownItem}>
                    <View style={[summaryStyles.breakdownDot, { backgroundColor: colors.score.birdie }]} />
                    <Text style={summaryStyles.breakdownLabel}>Birdies</Text>
                    <Text style={summaryStyles.breakdownCount}>{summaryData.birdies}</Text>
                  </View>
                  <View style={summaryStyles.breakdownItem}>
                    <View style={[summaryStyles.breakdownDot, { backgroundColor: colors.score.par }]} />
                    <Text style={summaryStyles.breakdownLabel}>Pars</Text>
                    <Text style={summaryStyles.breakdownCount}>{summaryData.pars}</Text>
                  </View>
                  <View style={summaryStyles.breakdownItem}>
                    <View style={[summaryStyles.breakdownDot, { backgroundColor: colors.score.bogey }]} />
                    <Text style={summaryStyles.breakdownLabel}>Bogeys</Text>
                    <Text style={summaryStyles.breakdownCount}>{summaryData.bogeys}</Text>
                  </View>
                  {summaryData.doubles > 0 && (
                    <View style={summaryStyles.breakdownItem}>
                      <View style={[summaryStyles.breakdownDot, { backgroundColor: colors.score.double }]} />
                      <Text style={summaryStyles.breakdownLabel}>Double+</Text>
                      <Text style={summaryStyles.breakdownCount}>{summaryData.doubles}</Text>
                    </View>
                  )}
                </View>

                {/* Best / Worst */}
                <View style={summaryStyles.highlights}>
                  <View style={summaryStyles.highlightItem}>
                    <Ionicons name="trophy" size={18} color={colors.accent.gold} />
                    <Text style={summaryStyles.highlightLabel}>Best: Hole {summaryData.bestHole.number}</Text>
                    <Text
                      style={[
                        summaryStyles.highlightScore,
                        { color: getScoreColor(summaryData.bestHole.score) },
                      ]}
                    >
                      {getScoreLabel(summaryData.bestHole.score)}
                    </Text>
                  </View>
                  <View style={summaryStyles.highlightItem}>
                    <Ionicons name="skull-outline" size={18} color={colors.error} />
                    <Text style={summaryStyles.highlightLabel}>Worst: Hole {summaryData.worstHole.number}</Text>
                    <Text
                      style={[
                        summaryStyles.highlightScore,
                        { color: getScoreColor(summaryData.worstHole.score) },
                      ]}
                    >
                      {getScoreLabel(summaryData.worstHole.score)}
                    </Text>
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={summaryStyles.actions}>
                  <Button
                    title="Share Scorecard"
                    onPress={() => {
                      // TODO: implement share via Share API
                      Alert.alert("Coming Soon", "Scorecard sharing will be available in a future update.");
                    }}
                    size="md"
                  />
                  <Button
                    title="View Full Scorecard"
                    onPress={() => {
                      setSummaryVisible(false);
                      router.push({
                        pathname: "/scoring/round-detail",
                        params: { roundId },
                      });
                    }}
                    size="md"
                  />
                  <Pressable
                    onPress={() => {
                      setSummaryVisible(false);
                      router.replace("/(tabs)");
                    }}
                    style={summaryStyles.doneButton}
                  >
                    <Text style={summaryStyles.doneText}>Done</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Main Styles ──
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.md,
    backgroundColor: colors.primary,
  },
  courseName: { color: colors.text.inverse, fontSize: fontSize.sm, fontWeight: "500" },
  holeLabel: { color: colors.text.inverse, fontSize: fontSize.xl, fontWeight: "700", marginTop: 2 },
  totalBox: { alignItems: "center" },
  totalLabel: { color: "rgba(255,255,255,0.7)", fontSize: fontSize.xs },
  totalScore: { fontSize: fontSize["2xl"], fontWeight: "700" },

  // FIX 1: Running total bar
  runningTotalBar: {
    flexDirection: "row",
    backgroundColor: colors.bg.secondary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    justifyContent: "space-around",
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  runningTotalItem: { alignItems: "center" },
  runningTotalLabel: { fontSize: fontSize.xs, color: colors.text.secondary, fontWeight: "500" },
  runningTotalValue: { fontSize: fontSize.base, color: colors.text.primary, fontWeight: "700" },
  runningTotalScore: { fontSize: fontSize.base, fontWeight: "700" },

  // FIX 2: Hole navigator
  holeNav: { maxHeight: 82, borderBottomWidth: 1, borderBottomColor: colors.gray[200] },
  holeNavContent: { paddingHorizontal: spacing.sm, alignItems: "center", gap: 4 },
  holeNavItem: {
    width: 48,
    height: 74,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: borderRadius.sm,
    gap: 1,
    paddingVertical: 2,
  },
  holeNavActive: {
    backgroundColor: colors.gray[100],
    borderWidth: 2,
    borderColor: colors.secondary,
  },
  holeNavScored: {
    backgroundColor: colors.gray[50],
  },
  holeNavNum: { fontSize: fontSize.sm, fontWeight: "500", color: colors.text.secondary },
  holeNavNumActive: { color: colors.secondary, fontWeight: "700" },
  holeNavNumScored: { color: colors.primary, fontWeight: "600" },
  holeNavPar: { fontSize: 10, color: colors.text.secondary },
  holeNavDnf: { fontSize: 9, fontWeight: "700", color: colors.error },
  holeNavDot: { width: 14, height: 14, justifyContent: "center", alignItems: "center" },
  holeNavDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.gray[300],
  },

  // Score entry
  scoreEntry: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.lg },
  parDisplay: { marginBottom: spacing.md, alignItems: "center" },
  parText: { fontSize: fontSize.lg, color: colors.text.secondary, fontWeight: "600" },
  editingLabel: {
    fontSize: fontSize.xs,
    color: colors.secondary,
    fontWeight: "700",
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  dnfBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.error,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.sm,
  },
  dnfBadgeText: { color: colors.text.inverse, fontSize: fontSize.xs, fontWeight: "700" },
  scoreControl: { flexDirection: "row", alignItems: "center", gap: spacing.xl },
  scoreButton: { padding: spacing.xs },
  scoreDisplay: { minWidth: 80, alignItems: "center" },
  quickScores: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  quickButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: colors.gray[300],
    justifyContent: "center",
    alignItems: "center",
  },
  quickButtonActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  quickText: { fontSize: fontSize.lg, fontWeight: "600", color: colors.text.secondary },
  quickTextActive: { color: colors.text.inverse },

  // FIX 4 & 5: Extra row (DNF + Disc)
  extraRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.lg,
    alignItems: "center",
  },
  dnfButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.error,
  },
  dnfButtonActive: {
    backgroundColor: colors.error,
    borderColor: colors.error,
  },
  dnfButtonText: { fontSize: fontSize.sm, fontWeight: "600", color: colors.error },
  dnfButtonTextActive: { color: colors.text.inverse },
  discButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.gray[300],
  },
  discButtonText: { fontSize: fontSize.sm, fontWeight: "500", color: colors.text.secondary },

  actions: { padding: spacing.md, paddingBottom: spacing.xl },
});

// ── Disc Picker Modal Styles ──
const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.bg.primary,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: "60%",
    padding: spacing.md,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  title: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text.primary },
  discRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  discName: { fontSize: fontSize.base, fontWeight: "600", color: colors.text.primary },
  discMeta: { fontSize: fontSize.xs, color: colors.text.secondary, marginTop: 2 },
  emptyText: {
    textAlign: "center",
    color: colors.text.secondary,
    fontSize: fontSize.sm,
    padding: spacing.lg,
  },
});

// ── Summary Modal Styles ──
const summaryStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.md,
  },
  card: {
    backgroundColor: colors.bg.primary,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    width: "100%",
    maxWidth: 380,
  },
  title: {
    fontSize: fontSize["2xl"],
    fontWeight: "700",
    color: colors.text.primary,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  bigScore: {
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  bigStrokes: {
    fontSize: fontSize["4xl"],
    fontWeight: "700",
    color: colors.text.primary,
  },
  bigRelative: {
    fontSize: fontSize["2xl"],
    fontWeight: "700",
  },
  breakdown: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  breakdownItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  breakdownDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  breakdownLabel: {
    flex: 1,
    fontSize: fontSize.base,
    color: colors.text.primary,
    fontWeight: "500",
  },
  breakdownCount: {
    fontSize: fontSize.base,
    fontWeight: "700",
    color: colors.text.primary,
  },
  highlights: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
  },
  highlightItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  highlightLabel: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  highlightScore: {
    fontSize: fontSize.sm,
    fontWeight: "700",
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  doneButton: {
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  doneText: {
    fontSize: fontSize.base,
    fontWeight: "600",
    color: colors.text.secondary,
  },
});
