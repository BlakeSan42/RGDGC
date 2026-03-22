import { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card } from "@/components/common/Card";
import { courseApi } from "@/services/api";
import { colors, spacing, fontSize } from "@/constants/theme";
import type { Course } from "@/types";

export default function SelectCourseScreen() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    courseApi
      .list()
      .then(setCourses)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Select Course</Text>
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
});
