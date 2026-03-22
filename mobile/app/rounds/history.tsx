import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Pressable,
  RefreshControl,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card } from "@/components/common/Card";
import { roundApi, courseApi } from "@/services/api";
import { colors, spacing, fontSize, borderRadius } from "@/constants/theme";
import { getScoreColor } from "@/types";
import type { Round, CourseDetail } from "@/types";

type FilterType = "all" | "practice" | "league" | "casual";
type SortType = "recent" | "best" | "course";

const PAGE_SIZE = 20;

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDuration(startedAt: string, completedAt: string | null): string | null {
  if (!completedAt) return null;
  const start = new Date(startedAt).getTime();
  const end = new Date(completedAt).getTime();
  const mins = Math.round((end - start) / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remaining = mins % 60;
  return `${hours}h ${remaining}m`;
}

function formatScore(score: number | null): string {
  if (score === null) return "—";
  if (score === 0) return "E";
  return score > 0 ? `+${score}` : String(score);
}

function getRoundType(round: Round): "practice" | "league" | "casual" {
  if (round.is_practice) return "practice";
  // Rounds linked to events would be "league" - for now infer from context
  return "casual";
}

export default function RoundHistoryScreen() {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [courseMap, setCourseMap] = useState<Map<number, CourseDetail>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [sort, setSort] = useState<SortType>("recent");
  const [error, setError] = useState<string | null>(null);

  const loadRounds = useCallback(
    async (reset = false) => {
      try {
        const limit = reset ? PAGE_SIZE : PAGE_SIZE;
        const data = await roundApi.list(reset ? PAGE_SIZE : rounds.length + PAGE_SIZE);
        if (reset) {
          setRounds(data);
        } else {
          setRounds(data);
        }
        setHasMore(data.length >= (reset ? PAGE_SIZE : rounds.length + PAGE_SIZE));

        // Build course map for layout names
        const layoutIds = [...new Set(data.map((r) => r.layout_id))];
        const newMap = new Map(courseMap);
        for (const lid of layoutIds) {
          if (!newMap.has(lid)) {
            try {
              const layout = await courseApi.getLayoutById(lid);
              // Store partial info keyed by layout_id
              newMap.set(lid, {
                id: layout.course_id,
                name: "",
                layouts: [layout],
              } as unknown as CourseDetail);
            } catch {
              // skip
            }
          }
        }
        setCourseMap(newMap);
        setError(null);
      } catch {
        setError("Failed to load rounds");
      }
    },
    [rounds.length, courseMap]
  );

  useEffect(() => {
    loadRounds(true).finally(() => setLoading(false));
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRounds(true);
    setRefreshing(false);
  };

  const onLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    await loadRounds(false);
    setLoadingMore(false);
  };

  // Filter rounds
  const filteredRounds = rounds.filter((round) => {
    if (filter === "all") return true;
    const type = getRoundType(round);
    return type === filter;
  });

  // Sort rounds
  const sortedRounds = [...filteredRounds].sort((a, b) => {
    switch (sort) {
      case "recent":
        return new Date(b.started_at).getTime() - new Date(a.started_at).getTime();
      case "best":
        return (a.total_score ?? 999) - (b.total_score ?? 999);
      case "course":
        return a.layout_id - b.layout_id;
      default:
        return 0;
    }
  });

  const getLayoutName = (layoutId: number): string | null => {
    const info = courseMap.get(layoutId);
    if (info && info.layouts && info.layouts.length > 0) {
      return info.layouts[0].name;
    }
    return null;
  };

  const renderRoundCard = ({ item: round }: { item: Round }) => {
    const roundType = getRoundType(round);
    const layoutName = getLayoutName(round.layout_id);
    const duration = formatDuration(round.started_at, round.completed_at);
    const isCompleted = round.completed_at !== null;

    return (
      <Card
        elevated
        style={styles.roundCard}
        onPress={() => router.push({ pathname: "/round/[id]", params: { id: String(round.id) } })}
      >
        <View style={styles.roundCardTop}>
          <View style={styles.roundCardLeft}>
            <Text style={styles.roundDate}>{formatDate(round.started_at)}</Text>
            <Text style={styles.roundCourse}>
              {layoutName ?? `Layout #${round.layout_id}`}
            </Text>
            {duration && <Text style={styles.roundDuration}>{duration}</Text>}
          </View>
          <View style={styles.roundCardRight}>
            {isCompleted ? (
              <>
                {round.total_strokes !== null && (
                  <Text style={styles.roundStrokes}>{round.total_strokes}</Text>
                )}
                <Text
                  style={[
                    styles.roundScore,
                    { color: getScoreColor(round.total_score ?? 0) },
                  ]}
                >
                  {formatScore(round.total_score)}
                </Text>
              </>
            ) : (
              <Text style={styles.roundIncomplete}>In Progress</Text>
            )}
          </View>
        </View>
        <View style={styles.roundCardBottom}>
          <View
            style={[
              styles.typeBadge,
              {
                backgroundColor:
                  roundType === "practice"
                    ? colors.accent.blue
                    : roundType === "league"
                    ? colors.accent.purple
                    : colors.gray[500],
              },
            ]}
          >
            <Text style={styles.typeBadgeText}>
              {roundType.charAt(0).toUpperCase() + roundType.slice(1)}
            </Text>
          </View>
        </View>
      </Card>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No rounds yet</Text>
        <Text style={styles.emptyText}>
          Play your first round to see your history here.
        </Text>
        <Pressable
          style={styles.emptyBtn}
          onPress={() => router.push("/scoring/select-course")}
        >
          <Text style={styles.emptyBtnText}>Start a Round</Text>
        </Pressable>
      </View>
    );
  };

  const renderFooter = () => {
    if (!loadingMore) return <View style={{ height: spacing.xxl }} />;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error && rounds.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.retryBtn} onPress={() => { setLoading(true); loadRounds(true).finally(() => setLoading(false)); }}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      {/* Filters */}
      <View style={styles.filterContainer}>
        <View style={styles.filterRow}>
          {(["all", "practice", "league", "casual"] as FilterType[]).map((f) => (
            <Pressable
              key={f}
              style={[styles.filterChip, filter === f && styles.filterChipActive]}
              onPress={() => setFilter(f)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  filter === f && styles.filterChipTextActive,
                ]}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.sortRow}>
          <Text style={styles.sortLabel}>Sort:</Text>
          {(
            [
              { key: "recent", label: "Recent" },
              { key: "best", label: "Best Score" },
              { key: "course", label: "Course" },
            ] as { key: SortType; label: string }[]
          ).map((s) => (
            <Pressable
              key={s.key}
              style={[styles.sortChip, sort === s.key && styles.sortChipActive]}
              onPress={() => setSort(s.key)}
            >
              <Text
                style={[
                  styles.sortChipText,
                  sort === s.key && styles.sortChipTextActive,
                ]}
              >
                {s.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Round List */}
      <FlatList
        data={sortedRounds}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderRoundCard}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.3}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.secondary },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.lg },
  errorText: { fontSize: fontSize.lg, color: colors.error, marginBottom: spacing.md, textAlign: "center" },
  retryBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
  },
  retryBtnText: { color: colors.text.inverse, fontWeight: "600", fontSize: fontSize.base },

  // Filters
  filterContainer: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xs },
  filterRow: { flexDirection: "row", gap: spacing.xs, marginBottom: spacing.sm },
  filterChip: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.sm + 4,
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray[200],
  },
  filterChipActive: { backgroundColor: colors.primary },
  filterChipText: { fontSize: fontSize.sm, color: colors.text.secondary, fontWeight: "500" },
  filterChipTextActive: { color: colors.text.inverse },
  sortRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  sortLabel: { fontSize: fontSize.sm, color: colors.text.secondary, marginRight: spacing.xs },
  sortChip: {
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.gray[300],
  },
  sortChipActive: { borderColor: colors.primary, backgroundColor: colors.primary + "10" },
  sortChipText: { fontSize: fontSize.xs, color: colors.text.secondary },
  sortChipTextActive: { color: colors.primary, fontWeight: "600" },

  // List
  listContent: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },

  // Round Card
  roundCard: { marginBottom: spacing.sm },
  roundCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  roundCardLeft: { flex: 1 },
  roundCardRight: { alignItems: "flex-end", marginLeft: spacing.sm },
  roundDate: { fontSize: fontSize.sm, color: colors.text.secondary },
  roundCourse: { fontSize: fontSize.base, fontWeight: "600", color: colors.text.primary, marginTop: 2 },
  roundDuration: { fontSize: fontSize.xs, color: colors.text.secondary, marginTop: 2 },
  roundStrokes: {
    fontSize: fontSize["2xl"],
    fontWeight: "700",
    color: colors.text.primary,
    fontFamily: "JetBrainsMono",
  },
  roundScore: { fontSize: fontSize.base, fontWeight: "700", fontFamily: "JetBrainsMono" },
  roundIncomplete: { fontSize: fontSize.sm, color: colors.warning, fontWeight: "600" },
  roundCardBottom: { flexDirection: "row", marginTop: spacing.sm },
  typeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  typeBadgeText: { color: colors.text.inverse, fontSize: fontSize.xs, fontWeight: "600" },

  // Empty
  emptyContainer: { alignItems: "center", paddingVertical: spacing.xxl },
  emptyTitle: { fontSize: fontSize.lg, fontWeight: "600", color: colors.text.primary, marginBottom: spacing.xs },
  emptyText: { fontSize: fontSize.base, color: colors.text.secondary, marginBottom: spacing.lg, textAlign: "center" },
  emptyBtn: {
    backgroundColor: colors.secondary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
  },
  emptyBtnText: { color: colors.text.inverse, fontWeight: "600", fontSize: fontSize.base },

  // Footer
  footerLoader: { paddingVertical: spacing.lg, alignItems: "center" },
});
