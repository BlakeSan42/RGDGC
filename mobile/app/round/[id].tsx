import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { roundApi } from "@/services/api";
import { ScoreBadge } from "@/components/common/ScoreBadge";
import { colors, spacing, fontSize } from "@/constants/theme";
import type { RoundDetail } from "@/types";

export default function RoundDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [round, setRound] = useState<RoundDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      roundApi
        .get(Number(id))
        .then(setRound)
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!round) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Round not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Summary */}
      <View style={styles.summary}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total</Text>
            <Text style={styles.summaryValue}>{round.total_strokes ?? "—"}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>vs Par</Text>
            <Text
              style={[
                styles.summaryValue,
                {
                  color:
                    (round.total_score ?? 0) <= 0
                      ? colors.score.birdie
                      : colors.score.bogey,
                },
              ]}
            >
              {round.total_score !== null
                ? round.total_score > 0
                  ? `+${round.total_score}`
                  : round.total_score === 0
                    ? "E"
                    : String(round.total_score)
                : "—"}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Date</Text>
            <Text style={styles.summaryDate}>
              {new Date(round.started_at).toLocaleDateString()}
            </Text>
          </View>
        </View>
      </View>

      {/* Hole-by-Hole Scores */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Scorecard</Text>
        <View style={styles.scorecard}>
          {/* Header */}
          <View style={styles.scorecardRow}>
            <Text style={[styles.colHeader, styles.colHole]}>Hole</Text>
            <Text style={[styles.colHeader, styles.colPar]}>Par</Text>
            <Text style={[styles.colHeader, styles.colScore]}>Score</Text>
            <Text style={[styles.colHeader, styles.colVsPar]}>+/-</Text>
          </View>

          {round.scores
            .sort((a, b) => a.hole_id - b.hole_id)
            .map((score, i) => {
              // We don't have par data in score, use a default
              const par = 3; // TODO: load from layout
              const relative = score.strokes - par;
              return (
                <View
                  key={score.id}
                  style={[styles.scorecardRow, i % 2 === 0 && styles.rowAlt]}
                >
                  <Text style={styles.colHole}>{i + 1}</Text>
                  <Text style={styles.colPar}>{par}</Text>
                  <View style={styles.colScore}>
                    <ScoreBadge strokes={score.strokes} par={par} size="sm" />
                  </View>
                  <Text
                    style={[
                      styles.colVsPar,
                      {
                        color:
                          relative < 0
                            ? colors.score.birdie
                            : relative === 0
                              ? colors.score.par
                              : colors.score.bogey,
                      },
                    ]}
                  >
                    {relative > 0 ? `+${relative}` : relative === 0 ? "E" : String(relative)}
                  </Text>
                </View>
              );
            })}
        </View>
      </View>

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.secondary },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  errorText: { fontSize: fontSize.lg, color: colors.text.secondary },
  summary: {
    backgroundColor: colors.bg.primary,
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  summaryRow: { flexDirection: "row", justifyContent: "space-around" },
  summaryItem: { alignItems: "center" },
  summaryLabel: { fontSize: fontSize.xs, color: colors.text.secondary, marginBottom: 4 },
  summaryValue: { fontSize: fontSize["3xl"], fontWeight: "700", color: colors.text.primary },
  summaryDate: { fontSize: fontSize.base, fontWeight: "500", color: colors.text.primary },
  section: { padding: spacing.md },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text.primary, marginBottom: spacing.sm },
  scorecard: {
    backgroundColor: colors.bg.primary,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  scorecardRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  rowAlt: { backgroundColor: colors.gray[50] },
  colHeader: { fontWeight: "600", color: colors.text.secondary, fontSize: fontSize.sm },
  colHole: { flex: 1 },
  colPar: { flex: 1, textAlign: "center" },
  colScore: { flex: 1, alignItems: "center" },
  colVsPar: { flex: 1, textAlign: "right", fontWeight: "600", fontSize: fontSize.base },
});
