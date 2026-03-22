import { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { Card } from "@/components/common/Card";
import { puttingApi, roundApi } from "@/services/api";
import { colors, spacing, fontSize } from "@/constants/theme";
import type { PuttingStats as PuttingStatsType, Round } from "@/types";

export default function StatsScreen() {
  const [puttingStats, setPuttingStats] = useState<PuttingStatsType | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [stats, roundList] = await Promise.allSettled([
        puttingApi.stats(),
        roundApi.list(50),
      ]);
      if (stats.status === "fulfilled") setPuttingStats(stats.value);
      if (roundList.status === "fulfilled") setRounds(roundList.value);
    } catch {}
  };

  useEffect(() => { loadData(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const completedRounds = rounds.filter((r) => r.completed_at);
  const avgScore = completedRounds.length > 0
    ? completedRounds.reduce((sum, r) => sum + (r.total_score ?? 0), 0) / completedRounds.length
    : null;
  const bestScore = completedRounds.length > 0
    ? Math.min(...completedRounds.map((r) => r.total_score ?? 999))
    : null;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {/* Overview */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Overview</Text>
        <View style={styles.statGrid}>
          <StatCard label="Rounds Played" value={String(completedRounds.length)} />
          <StatCard
            label="Average Score"
            value={avgScore !== null ? (avgScore > 0 ? `+${avgScore.toFixed(1)}` : avgScore.toFixed(1)) : "—"}
          />
          <StatCard
            label="Best Round"
            value={bestScore !== null ? (bestScore > 0 ? `+${bestScore}` : String(bestScore)) : "—"}
          />
          <StatCard label="Total Rounds" value={String(rounds.length)} />
        </View>
      </View>

      {/* Putting */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Putting</Text>
        {puttingStats && puttingStats.total_attempts > 0 ? (
          <Card elevated>
            <View style={styles.puttingRow}>
              <PuttingZone label="C1" pct={puttingStats.c1_percentage} color={colors.success} />
              <PuttingZone label="C1X" pct={puttingStats.c1x_percentage} color={colors.accent.blue} />
              <PuttingZone label="C2" pct={puttingStats.c2_percentage} color={colors.accent.purple} />
            </View>
            <Text style={styles.puttingTotal}>
              {puttingStats.total_makes}/{puttingStats.total_attempts} putts made ({puttingStats.make_percentage}%)
            </Text>
          </Card>
        ) : (
          <Card>
            <Text style={styles.emptyTitle}>No putting data yet</Text>
            <Text style={styles.emptyText}>
              Log putts during rounds or in practice to see your analytics here.
            </Text>
          </Card>
        )}
      </View>

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card style={styles.statCard} elevated>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  );
}

function PuttingZone({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <View style={styles.zoneItem}>
      <Text style={[styles.zonePct, { color }]}>{pct.toFixed(1)}%</Text>
      <Text style={styles.zoneLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.secondary },
  section: { padding: spacing.md, gap: spacing.sm },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text.primary },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  statCard: { flex: 1, minWidth: "45%", alignItems: "center", paddingVertical: spacing.lg },
  statValue: { fontSize: fontSize["2xl"], fontWeight: "700", color: colors.text.primary },
  statLabel: { fontSize: fontSize.xs, color: colors.text.secondary, marginTop: 4 },
  puttingRow: { flexDirection: "row", justifyContent: "space-around", marginBottom: spacing.md },
  puttingTotal: { textAlign: "center", color: colors.text.secondary, fontSize: fontSize.sm },
  zoneItem: { alignItems: "center" },
  zonePct: { fontSize: fontSize.xl, fontWeight: "700" },
  zoneLabel: { fontSize: fontSize.sm, color: colors.text.secondary, marginTop: 2 },
  emptyTitle: { fontSize: fontSize.lg, fontWeight: "600", color: colors.text.primary, marginBottom: 4 },
  emptyText: { fontSize: fontSize.base, color: colors.text.secondary },
});
