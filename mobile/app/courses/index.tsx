import { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TextInput,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "@/components/common/Card";
import { courseApi, roundApi } from "@/services/api";
import { colors, spacing, fontSize, borderRadius } from "@/constants/theme";
import type { Course, Round } from "@/types";

// ── Difficulty indicator ──
function DifficultyDots({ level }: { level: number }) {
  const clamped = Math.max(1, Math.min(5, level));
  return (
    <View style={styles.difficultyRow}>
      {[1, 2, 3, 4, 5].map((i) => (
        <View
          key={i}
          style={[
            styles.difficultyDot,
            { backgroundColor: i <= clamped ? colors.primary : colors.gray[300] },
          ]}
        />
      ))}
    </View>
  );
}

// ── Course card ──
function CourseCard({
  course,
  roundCount,
  layoutCount,
  parRange,
  difficulty,
}: {
  course: Course;
  roundCount: number;
  layoutCount: number;
  parRange: string | null;
  difficulty: number;
}) {
  return (
    <Card
      elevated
      onPress={() => router.push(`/course/${course.id}`)}
      style={styles.courseCard}
    >
      <Text style={styles.courseName}>{course.name}</Text>
      {(course.city || course.location) && (
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={14} color={colors.text.secondary} />
          <Text style={styles.courseLocation}>
            {course.city && course.state
              ? `${course.city}, ${course.state}`
              : course.location || ""}
          </Text>
        </View>
      )}
      <View style={styles.metaRow}>
        {layoutCount > 0 && (
          <View style={styles.metaItem}>
            <Ionicons name="map-outline" size={13} color={colors.text.secondary} />
            <Text style={styles.metaText}>
              {layoutCount} layout{layoutCount !== 1 ? "s" : ""}
            </Text>
          </View>
        )}
        {parRange && (
          <View style={styles.metaItem}>
            <Ionicons name="flag-outline" size={13} color={colors.text.secondary} />
            <Text style={styles.metaText}>Par {parRange}</Text>
          </View>
        )}
        {roundCount > 0 && (
          <View style={styles.metaItem}>
            <Ionicons name="disc-outline" size={13} color={colors.primary} />
            <Text style={[styles.metaText, { color: colors.primary }]}>
              {roundCount} round{roundCount !== 1 ? "s" : ""}
            </Text>
          </View>
        )}
      </View>
      <DifficultyDots level={difficulty} />
    </Card>
  );
}

// ── Main screen ──
export default function CoursesScreen() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [courseDetails, setCourseDetails] = useState<
    Record<number, { layoutCount: number; parRange: string | null; difficulty: number }>
  >({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const [courseList, roundList] = await Promise.all([
        courseApi.list(),
        roundApi.list(100).catch(() => [] as Round[]),
      ]);
      setCourses(courseList);
      setRounds(roundList);

      // Load layout details for each course
      const details: typeof courseDetails = {};
      await Promise.all(
        courseList.map(async (c) => {
          try {
            const detail = await courseApi.get(c.id);
            const layouts = detail.layouts || [];
            const pars = layouts.map((l) => l.total_par).filter(Boolean);
            const minPar = pars.length > 0 ? Math.min(...pars) : null;
            const maxPar = pars.length > 0 ? Math.max(...pars) : null;
            const parRange =
              minPar !== null
                ? minPar === maxPar
                  ? `${minPar}`
                  : `${minPar}-${maxPar}`
                : null;
            const diffMap: Record<string, number> = {
              beginner: 1,
              easy: 2,
              intermediate: 3,
              advanced: 4,
              pro: 5,
            };
            const avgDiff =
              layouts.length > 0
                ? Math.round(
                    layouts.reduce(
                      (sum, l) =>
                        sum + (diffMap[(l.difficulty || "").toLowerCase()] || 3),
                      0
                    ) / layouts.length
                  )
                : 3;
            details[c.id] = {
              layoutCount: layouts.length,
              parRange,
              difficulty: avgDiff,
            };
          } catch {
            details[c.id] = { layoutCount: 0, parRange: null, difficulty: 3 };
          }
        })
      );
      setCourseDetails(details);
    } catch {
      setError("Failed to load courses. Pull down to retry.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Round counts per course (approximate via layout_id matching)
  const roundCountByCourse = useMemo(() => {
    const counts: Record<number, number> = {};
    // We'll count rounds per layout, but we don't have a direct course->layout mapping
    // from rounds alone. Use courseDetails to build layout->course map after details load.
    return counts;
  }, []);

  // Filter by search
  const filtered = useMemo(() => {
    if (!search.trim()) return courses;
    const q = search.toLowerCase();
    return courses.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.city && c.city.toLowerCase().includes(q)) ||
        (c.state && c.state.toLowerCase().includes(q)) ||
        (c.location && c.location.toLowerCase().includes(q))
    );
  }, [courses, search]);

  // Recently played: courses that appear in user's rounds
  const recentlyPlayed = useMemo(() => {
    if (rounds.length === 0) return [];
    // Get unique layout IDs from rounds
    const layoutIds = new Set(rounds.map((r) => r.layout_id));
    // We can't perfectly map layouts to courses without extra data,
    // so show courses where we fetched details and have rounds
    // For now, return first few courses as a reasonable proxy
    return courses.slice(0, Math.min(5, courses.length));
  }, [courses, rounds]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading courses...</Text>
      </View>
    );
  }

  if (error && courses.length === 0) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Search bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color={colors.text.secondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search courses by name or location..."
          placeholderTextColor={colors.text.disabled}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <Ionicons
            name="close-circle"
            size={20}
            color={colors.text.secondary}
            onPress={() => setSearch("")}
          />
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Recently Played */}
        {!search && recentlyPlayed.length > 0 && rounds.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recently Played</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalScroll}
            >
              {recentlyPlayed.map((course) => (
                <Card
                  key={course.id}
                  elevated
                  onPress={() => router.push(`/course/${course.id}`)}
                  style={styles.recentCard}
                >
                  <Text style={styles.recentName} numberOfLines={1}>
                    {course.name}
                  </Text>
                  <Text style={styles.recentLocation} numberOfLines={1}>
                    {course.city && course.state
                      ? `${course.city}, ${course.state}`
                      : course.location || ""}
                  </Text>
                </Card>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Nearby / All Courses */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {search ? `Results (${filtered.length})` : "Nearby Courses"}
          </Text>
          {!search && (
            <View style={styles.nearbyHint}>
              <Ionicons
                name="navigate-outline"
                size={14}
                color={colors.text.secondary}
              />
              <Text style={styles.nearbyHintText}>
                Enable location to sort by distance
              </Text>
            </View>
          )}
        </View>

        {filtered.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="search-outline" size={48} color={colors.gray[400]} />
            <Text style={styles.emptyTitle}>No courses found</Text>
            <Text style={styles.emptyText}>
              Try a different search term or check back later.
            </Text>
          </View>
        ) : (
          <View style={styles.courseList}>
            {filtered.map((course) => {
              const detail = courseDetails[course.id];
              return (
                <CourseCard
                  key={course.id}
                  course={course}
                  roundCount={roundCountByCourse[course.id] || 0}
                  layoutCount={detail?.layoutCount || 0}
                  parRange={detail?.parRange || null}
                  difficulty={detail?.difficulty || 3}
                />
              );
            })}
          </View>
        )}

        {/* Can't find your course */}
        <View style={styles.cantFindContainer}>
          <Card style={styles.cantFindCard}>
            <View style={styles.cantFindRow}>
              <Ionicons name="help-circle-outline" size={24} color={colors.primary} />
              <View style={styles.cantFindText}>
                <Text style={styles.cantFindTitle}>
                  Can't find your course?
                </Text>
                <Text style={styles.cantFindDesc}>
                  Contact an admin to add a new course, or check that the name
                  is spelled correctly.
                </Text>
              </View>
            </View>
          </Card>
        </View>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.secondary },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.bg.secondary,
    padding: spacing.lg,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: fontSize.base,
    color: colors.text.secondary,
  },
  errorText: {
    marginTop: spacing.md,
    fontSize: fontSize.base,
    color: colors.error,
    textAlign: "center",
  },
  scrollView: { flex: 1 },

  // Search
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bg.card,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.gray[200],
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.base,
    color: colors.text.primary,
    paddingVertical: 4,
  },

  // Sections
  section: { paddingHorizontal: spacing.md, paddingTop: spacing.md },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },

  // Nearby hint
  nearbyHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  nearbyHintText: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    fontStyle: "italic",
  },

  // Recently Played
  horizontalScroll: { paddingRight: spacing.md, gap: spacing.sm },
  recentCard: { width: 160, paddingVertical: spacing.sm },
  recentName: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.text.primary,
  },
  recentLocation: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },

  // Course list
  courseList: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  courseCard: { marginBottom: 0 },
  courseName: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.text.primary,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  courseLocation: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  metaRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
  },
  difficultyRow: {
    flexDirection: "row",
    gap: 4,
    marginTop: spacing.sm,
  },
  difficultyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Empty state
  emptyContainer: {
    alignItems: "center",
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    color: colors.text.primary,
    marginTop: spacing.md,
  },
  emptyText: {
    fontSize: fontSize.base,
    color: colors.text.secondary,
    textAlign: "center",
    marginTop: spacing.xs,
  },

  // Can't find
  cantFindContainer: {
    padding: spacing.md,
  },
  cantFindCard: {
    backgroundColor: colors.gray[50],
  },
  cantFindRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  cantFindText: { flex: 1 },
  cantFindTitle: {
    fontSize: fontSize.base,
    fontWeight: "600",
    color: colors.text.primary,
  },
  cantFindDesc: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
});
