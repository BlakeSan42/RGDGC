import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Dimensions,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ScoreBadge } from "@/components/common/ScoreBadge";
import { Button } from "@/components/common/Button";
import { roundApi, courseApi } from "@/services/api";
import { colors, spacing, fontSize, borderRadius } from "@/constants/theme";

const { width } = Dimensions.get("window");

interface HoleState {
  holeNumber: number;
  par: number;
  strokes: number;
  submitted: boolean;
}

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
  const [currentHole, setCurrentHole] = useState(0);
  const [completing, setCompleting] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const current = holes[currentHole];
  const totalStrokes = holes.reduce((sum, h) => sum + h.strokes, 0);
  const actualTotalPar = holes.reduce((sum, h) => sum + h.par, 0);
  const totalScore = totalStrokes - actualTotalPar;

  const updateStrokes = (delta: number) => {
    setHoles((prev) => {
      const updated = [...prev];
      const newVal = Math.max(1, Math.min(12, updated[currentHole].strokes + delta));
      updated[currentHole] = { ...updated[currentHole], strokes: newVal };
      return updated;
    });
  };

  const submitAndNext = async () => {
    const hole = holes[currentHole];
    if (!hole.submitted) {
      try {
        await roundApi.submitScore(Number(roundId), {
          hole_number: hole.holeNumber,
          strokes: hole.strokes,
        });
        setHoles((prev) => {
          const updated = [...prev];
          updated[currentHole] = { ...updated[currentHole], submitted: true };
          return updated;
        });
      } catch {
        Alert.alert("Error", "Failed to save score. Try again.");
        return;
      }
    }

    if (currentHole < numHoles - 1) {
      setCurrentHole(currentHole + 1);
    }
  };

  const goToHole = (index: number) => {
    setCurrentHole(index);
  };

  const completeRound = async () => {
    // Submit any unsubmitted holes first
    for (let i = 0; i < holes.length; i++) {
      if (!holes[i].submitted) {
        try {
          await roundApi.submitScore(Number(roundId), {
            hole_number: holes[i].holeNumber,
            strokes: holes[i].strokes,
          });
        } catch {
          Alert.alert("Error", `Failed to save hole ${holes[i].holeNumber}`);
          return;
        }
      }
    }

    setCompleting(true);
    try {
      const result = await roundApi.complete(Number(roundId));
      Alert.alert(
        "Round Complete!",
        `Total: ${result.total_strokes} (${result.total_score! > 0 ? "+" : ""}${result.total_score})`,
        [{ text: "Done", onPress: () => router.replace("/(tabs)") }]
      );
    } catch {
      Alert.alert("Error", "Failed to complete round.");
      setCompleting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.courseName}>{courseName} — {layoutName}</Text>
          <Text style={styles.holeLabel}>
            Hole {current.holeNumber} of {numHoles} · Par {current.par}
          </Text>
        </View>
        <View style={styles.totalBox}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={[styles.totalScore, { color: totalScore <= 0 ? colors.score.birdie : colors.score.bogey }]}>
            {totalScore > 0 ? `+${totalScore}` : totalScore === 0 ? "E" : totalScore}
          </Text>
        </View>
      </View>

      {/* Hole Navigator */}
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.holeNav}
        contentContainerStyle={styles.holeNavContent}
      >
        {holes.map((hole, i) => (
          <Pressable
            key={i}
            onPress={() => goToHole(i)}
            style={[
              styles.holeNavItem,
              i === currentHole && styles.holeNavActive,
              hole.submitted && styles.holeNavSubmitted,
            ]}
          >
            <Text
              style={[
                styles.holeNavNum,
                i === currentHole && styles.holeNavNumActive,
              ]}
            >
              {hole.holeNumber}
            </Text>
            {hole.submitted && (
              <ScoreBadge strokes={hole.strokes} par={hole.par} size="sm" />
            )}
          </Pressable>
        ))}
      </ScrollView>

      {/* Score Entry */}
      <View style={styles.scoreEntry}>
        <View style={styles.parDisplay}>
          <Text style={styles.parText}>Par {current.par}</Text>
        </View>

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
                      updated[currentHole] = { ...updated[currentHole], strokes: s };
                      return updated;
                    })
                  }
                  style={[
                    styles.quickButton,
                    current.strokes === s && styles.quickButtonActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.quickText,
                      current.strokes === s && styles.quickTextActive,
                    ]}
                  >
                    {s}
                  </Text>
                </Pressable>
              )
          )}
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        {currentHole < numHoles - 1 ? (
          <Button title="Next Hole →" onPress={submitAndNext} size="lg" />
        ) : (
          <Button
            title="Complete Round"
            onPress={completeRound}
            loading={completing}
            size="lg"
          />
        )}
      </View>
    </SafeAreaView>
  );
}

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
  holeNav: { maxHeight: 72, borderBottomWidth: 1, borderBottomColor: colors.gray[200] },
  holeNavContent: { paddingHorizontal: spacing.sm, alignItems: "center", gap: 4 },
  holeNavItem: {
    width: 44,
    height: 60,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: borderRadius.sm,
    gap: 2,
  },
  holeNavActive: { backgroundColor: colors.gray[100] },
  holeNavSubmitted: {},
  holeNavNum: { fontSize: fontSize.sm, fontWeight: "500", color: colors.text.secondary },
  holeNavNumActive: { color: colors.primary, fontWeight: "700" },
  scoreEntry: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.lg },
  parDisplay: { marginBottom: spacing.lg },
  parText: { fontSize: fontSize.lg, color: colors.text.secondary, fontWeight: "600" },
  scoreControl: { flexDirection: "row", alignItems: "center", gap: spacing.xl },
  scoreButton: { padding: spacing.xs },
  scoreDisplay: { minWidth: 80, alignItems: "center" },
  quickScores: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xl },
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
  actions: { padding: spacing.md, paddingBottom: spacing.xl },
});
