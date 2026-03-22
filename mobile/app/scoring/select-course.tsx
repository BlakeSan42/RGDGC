import { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card } from "@/components/common/Card";
import { courseApi } from "@/services/api";
import { cacheCourseData, getCachedCourses } from "@/services/offline";
import { useOffline } from "@/context/OfflineContext";
import { colors, spacing, fontSize } from "@/constants/theme";
import type { Course } from "@/types";

export default function SelectCourseScreen() {
  const { isOnline } = useOffline();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await courseApi.list();
        setCourses(data);
        // Cache for offline use
        cacheCourseData(data).catch(() => {});
      } catch {
        // Fall back to cached courses
        const cached = await getCachedCourses();
        if (cached && cached.length > 0) {
          setCourses(cached);
          setFromCache(true);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (courses.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>
          {isOnline ? "No courses found." : "No cached courses available.\nConnect to the internet to load courses."}
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Select Course</Text>
      {fromCache && (
        <Text style={styles.cacheNote}>Showing cached data (offline)</Text>
      )}
      <ScrollView style={styles.list}>
        {courses.map((course) => (
          <Card
            key={course.id}
            elevated
            onPress={() =>
              router.push({
                pathname: "/scoring/select-layout",
                params: { courseId: String(course.id), courseName: course.name },
              })
            }
            style={styles.card}
          >
            <Text style={styles.courseName}>{course.name}</Text>
            {course.city && (
              <Text style={styles.courseLocation}>
                {course.city}, {course.state}
              </Text>
            )}
            {course.description && (
              <Text style={styles.courseDesc} numberOfLines={2}>
                {course.description}
              </Text>
            )}
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.secondary, padding: spacing.md },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: fontSize["2xl"], fontWeight: "700", color: colors.text.primary, marginBottom: spacing.md },
  list: { flex: 1 },
  card: { marginBottom: spacing.sm },
  courseName: { fontSize: fontSize.lg, fontWeight: "600", color: colors.text.primary },
  courseLocation: { fontSize: fontSize.sm, color: colors.text.secondary, marginTop: 2 },
  courseDesc: { fontSize: fontSize.sm, color: colors.text.secondary, marginTop: spacing.xs },
  emptyText: { fontSize: fontSize.base, color: colors.text.secondary, textAlign: "center", padding: spacing.xl },
  cacheNote: { fontSize: fontSize.xs, color: colors.secondary, marginBottom: spacing.sm, fontWeight: "500" },
});
