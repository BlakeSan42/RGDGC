import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card } from "@/components/common/Card";
import { courseApi } from "@/services/api";
import { colors, spacing, fontSize, borderRadius } from "@/constants/theme";
import type { CourseDetail, Layout, LayoutDetail } from "@/types";

export default function CourseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [selectedLayout, setSelectedLayout] = useState<LayoutDetail | null>(null);
  const [expandedLayout, setExpandedLayout] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [layoutLoading, setLayoutLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    courseApi
      .get(Number(id))
      .then((data) => {
        setCourse(data);
        // Auto-expand default layout
        const defaultLayout = data.layouts.find((l) => l.is_default);
        if (defaultLayout) {
          setExpandedLayout(defaultLayout.id);
          loadLayoutDetail(Number(id), defaultLayout.id);
        }
      })
      .catch(() => setError("Failed to load course details"))
      .finally(() => setLoading(false));
  }, [id]);

  const loadLayoutDetail = useCallback(
    async (courseId: number, layoutId: number) => {
      setLayoutLoading(true);
      try {
        const detail = await courseApi.getLayout(courseId, layoutId);
        setSelectedLayout(detail);
      } catch {
        setSelectedLayout(null);
      } finally {
        setLayoutLoading(false);
      }
    },
    []
  );

  const toggleLayout = (layout: Layout) => {
    if (expandedLayout === layout.id) {
      setExpandedLayout(null);
      setSelectedLayout(null);
    } else {
      setExpandedLayout(layout.id);
      loadLayoutDetail(layout.course_id, layout.id);
    }
  };

  const handlePlayLayout = (layout: Layout) => {
    router.push({
      pathname: "/scoring/select-layout",
      params: { courseId: String(course!.id), courseName: course!.name },
    });
  };

  const handleStartRound = () => {
    router.push({
      pathname: "/scoring/select-layout",
      params: { courseId: String(course!.id), courseName: course!.name },
    });
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !course) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error ?? "Course not found"}</Text>
        <Pressable style={styles.retryBtn} onPress={() => router.back()}>
          <Text style={styles.retryBtnText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const totalHoles = course.layouts.length > 0 ? course.layouts[0].holes : 0;
  const totalPar = course.layouts.length > 0 ? course.layouts[0].total_par : 0;
  const totalDistance = course.layouts.length > 0 ? course.layouts[0].total_distance : null;

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Hero Section */}
        <View style={styles.hero}>
          <Text style={styles.heroName}>{course.name}</Text>
          {(course.city || course.location) && (
            <View style={styles.locationRow}>
              <Text style={styles.mapPin}>📍</Text>
              <Text style={styles.locationText}>
                {course.city && course.state
                  ? `${course.city}, ${course.state}`
                  : course.location}
              </Text>
            </View>
          )}
          {course.description && (
            <Text style={styles.description}>{course.description}</Text>
          )}
        </View>

        {/* Course Stats Card */}
        <Card elevated style={styles.statsCard}>
          <Text style={styles.sectionTitle}>Course Stats</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{totalHoles}</Text>
              <Text style={styles.statLabel}>Holes</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{totalPar}</Text>
              <Text style={styles.statLabel}>Total Par</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {totalDistance ? `${totalDistance}m` : "—"}
              </Text>
              <Text style={styles.statLabel}>Distance</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {course.layouts.length}
              </Text>
              <Text style={styles.statLabel}>Layouts</Text>
            </View>
          </View>
        </Card>

        {/* Layouts Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Layouts</Text>
          {course.layouts.map((layout) => (
            <View key={layout.id} style={styles.layoutWrapper}>
              <Card elevated style={styles.layoutCard}>
                <Pressable onPress={() => toggleLayout(layout)}>
                  <View style={styles.layoutHeader}>
                    <View style={styles.layoutInfo}>
                      <View style={styles.layoutNameRow}>
                        <Text style={styles.layoutName}>{layout.name}</Text>
                        {layout.is_default && (
                          <View style={styles.defaultBadge}>
                            <Text style={styles.defaultBadgeText}>Default</Text>
                          </View>
                        )}
                        {layout.difficulty && (
                          <View
                            style={[
                              styles.difficultyBadge,
                              {
                                backgroundColor: getDifficultyColor(layout.difficulty),
                              },
                            ]}
                          >
                            <Text style={styles.difficultyText}>
                              {layout.difficulty}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.layoutMeta}>
                        {layout.holes} holes · Par {layout.total_par}
                        {layout.total_distance
                          ? ` · ${layout.total_distance}m`
                          : ""}
                      </Text>
                    </View>
                    <Text style={styles.expandIcon}>
                      {expandedLayout === layout.id ? "▲" : "▼"}
                    </Text>
                  </View>
                </Pressable>

                {/* Play Button */}
                <Pressable
                  style={styles.playBtn}
                  onPress={() => handlePlayLayout(layout)}
                >
                  <Text style={styles.playBtnText}>Play This Layout</Text>
                </Pressable>

                {/* Expanded Hole Breakdown */}
                {expandedLayout === layout.id && (
                  <View style={styles.holeBreakdown}>
                    {layoutLoading ? (
                      <ActivityIndicator
                        size="small"
                        color={colors.primary}
                        style={{ marginVertical: spacing.md }}
                      />
                    ) : selectedLayout &&
                      selectedLayout.hole_list &&
                      selectedLayout.hole_list.length > 0 ? (
                      <>
                        <View style={styles.tableHeader}>
                          <Text style={[styles.tableHeaderCell, styles.holeCol]}>
                            Hole
                          </Text>
                          <Text style={[styles.tableHeaderCell, styles.parCol]}>
                            Par
                          </Text>
                          <Text style={[styles.tableHeaderCell, styles.distCol]}>
                            Distance
                          </Text>
                        </View>
                        {selectedLayout.hole_list.map((hole, index) => (
                          <View
                            key={hole.id}
                            style={[
                              styles.tableRow,
                              index % 2 === 0
                                ? styles.tableRowEven
                                : styles.tableRowOdd,
                            ]}
                          >
                            <Text style={[styles.tableCell, styles.holeCol, styles.monoText]}>
                              {hole.hole_number}
                            </Text>
                            <Text style={[styles.tableCell, styles.parCol, styles.monoText]}>
                              {hole.par}
                            </Text>
                            <Text style={[styles.tableCell, styles.distCol, styles.monoText]}>
                              {hole.distance ? `${hole.distance}m` : "—"}
                            </Text>
                          </View>
                        ))}
                        {/* Totals Row */}
                        <View style={[styles.tableRow, styles.tableTotals]}>
                          <Text
                            style={[
                              styles.tableCell,
                              styles.holeCol,
                              styles.monoText,
                              styles.totalLabel,
                            ]}
                          >
                            Total
                          </Text>
                          <Text
                            style={[
                              styles.tableCell,
                              styles.parCol,
                              styles.monoText,
                              styles.totalLabel,
                            ]}
                          >
                            {selectedLayout.total_par}
                          </Text>
                          <Text
                            style={[
                              styles.tableCell,
                              styles.distCol,
                              styles.monoText,
                              styles.totalLabel,
                            ]}
                          >
                            {selectedLayout.total_distance
                              ? `${selectedLayout.total_distance}m`
                              : "—"}
                          </Text>
                        </View>
                      </>
                    ) : (
                      <Text style={styles.noHolesText}>
                        No hole data available for this layout.
                      </Text>
                    )}
                  </View>
                )}
              </Card>
            </View>
          ))}
        </View>

        {/* Course Records (Placeholder) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Course Records</Text>
          <Card elevated>
            <View style={styles.recordsGrid}>
              <View style={styles.recordItem}>
                <Text style={styles.recordValue}>—</Text>
                <Text style={styles.recordLabel}>Course Record</Text>
              </View>
              <View style={styles.recordDivider} />
              <View style={styles.recordItem}>
                <Text style={styles.recordValue}>—</Text>
                <Text style={styles.recordLabel}>Your Best</Text>
              </View>
              <View style={styles.recordDivider} />
              <View style={styles.recordItem}>
                <Text style={styles.recordValue}>—</Text>
                <Text style={styles.recordLabel}>Avg Round</Text>
              </View>
            </View>
          </Card>
        </View>

        {/* Bottom padding for FAB */}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Floating Action Button */}
      <Pressable style={styles.fab} onPress={handleStartRound}>
        <Text style={styles.fabText}>Start Round</Text>
      </Pressable>
    </SafeAreaView>
  );
}

function getDifficultyColor(difficulty: string): string {
  switch (difficulty.toLowerCase()) {
    case "easy":
      return colors.success;
    case "moderate":
      return colors.warning;
    case "hard":
      return colors.secondary;
    case "expert":
      return colors.error;
    default:
      return colors.gray[500];
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.secondary },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.lg },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: spacing.xxl },
  errorText: { fontSize: fontSize.lg, color: colors.error, marginBottom: spacing.md, textAlign: "center" },
  retryBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
  },
  retryBtnText: { color: colors.text.inverse, fontWeight: "600", fontSize: fontSize.base },

  // Hero
  hero: {
    backgroundColor: colors.primary,
    padding: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  heroName: {
    fontSize: fontSize["3xl"],
    fontWeight: "700",
    color: colors.text.inverse,
    marginBottom: spacing.xs,
  },
  locationRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.xs },
  mapPin: { fontSize: fontSize.base, marginRight: spacing.xs },
  locationText: { fontSize: fontSize.base, color: colors.text.inverse, opacity: 0.9 },
  description: {
    fontSize: fontSize.sm,
    color: colors.text.inverse,
    opacity: 0.8,
    marginTop: spacing.sm,
    lineHeight: 20,
  },

  // Stats Card
  statsCard: { marginHorizontal: spacing.md, marginTop: -spacing.md },
  statsGrid: { flexDirection: "row", justifyContent: "space-around", marginTop: spacing.sm },
  statItem: { alignItems: "center", flex: 1 },
  statValue: { fontSize: fontSize.xl, fontWeight: "700", color: colors.text.primary, fontFamily: "JetBrainsMono" },
  statLabel: { fontSize: fontSize.xs, color: colors.text.secondary, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: colors.gray[200], marginVertical: spacing.xs },

  // Section
  section: { padding: spacing.md, gap: spacing.sm },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text.primary, marginBottom: spacing.xs },

  // Layout Card
  layoutWrapper: { marginBottom: spacing.sm },
  layoutCard: { padding: spacing.md },
  layoutHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  layoutInfo: { flex: 1 },
  layoutNameRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  layoutName: { fontSize: fontSize.lg, fontWeight: "600", color: colors.text.primary },
  defaultBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  defaultBadgeText: { color: colors.text.inverse, fontSize: fontSize.xs, fontWeight: "600" },
  difficultyBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  difficultyText: { color: colors.text.inverse, fontSize: fontSize.xs, fontWeight: "600" },
  layoutMeta: { fontSize: fontSize.sm, color: colors.text.secondary, marginTop: 4 },
  expandIcon: { fontSize: fontSize.sm, color: colors.text.secondary, marginLeft: spacing.sm },

  // Play Button
  playBtn: {
    backgroundColor: colors.secondary,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  playBtnText: { color: colors.text.inverse, fontWeight: "700", fontSize: fontSize.base },

  // Hole Breakdown Table
  holeBreakdown: { marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.gray[200], paddingTop: spacing.sm },
  tableHeader: {
    flexDirection: "row",
    paddingVertical: spacing.xs,
    borderBottomWidth: 2,
    borderBottomColor: colors.gray[300],
  },
  tableHeaderCell: { fontWeight: "700", fontSize: fontSize.sm, color: colors.text.primary },
  tableRow: { flexDirection: "row", paddingVertical: spacing.xs + 2 },
  tableRowEven: { backgroundColor: colors.gray[50] },
  tableRowOdd: { backgroundColor: colors.bg.card },
  tableTotals: {
    borderTopWidth: 2,
    borderTopColor: colors.gray[300],
    backgroundColor: colors.gray[100],
  },
  tableCell: { fontSize: fontSize.sm, color: colors.text.primary },
  monoText: { fontFamily: "JetBrainsMono" },
  totalLabel: { fontWeight: "700" },
  holeCol: { width: 60, textAlign: "center" },
  parCol: { width: 60, textAlign: "center" },
  distCol: { flex: 1, textAlign: "center" },
  noHolesText: { fontSize: fontSize.sm, color: colors.text.secondary, textAlign: "center", paddingVertical: spacing.md },

  // Course Records
  recordsGrid: { flexDirection: "row", justifyContent: "space-around" },
  recordItem: { alignItems: "center", flex: 1 },
  recordValue: { fontSize: fontSize.xl, fontWeight: "700", color: colors.text.primary, fontFamily: "JetBrainsMono" },
  recordLabel: { fontSize: fontSize.xs, color: colors.text.secondary, marginTop: 4 },
  recordDivider: { width: 1, backgroundColor: colors.gray[200], marginVertical: spacing.xs },

  // FAB
  fab: {
    position: "absolute",
    bottom: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.secondary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: {
    color: colors.text.inverse,
    fontWeight: "700",
    fontSize: fontSize.lg,
  },
});
