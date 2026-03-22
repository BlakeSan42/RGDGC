import { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card } from "@/components/common/Card";
import { Button } from "@/components/common/Button";
import { courseApi, roundApi } from "@/services/api";
import { cacheLayoutData } from "@/services/offline";
import { useOffline } from "@/context/OfflineContext";
import { colors, spacing, fontSize } from "@/constants/theme";
import type { CourseDetail, Layout } from "@/types";

export default function SelectLayoutScreen() {
  const { courseId, courseName } = useLocalSearchParams<{ courseId: string; courseName: string }>();
  const { isOnline } = useOffline();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [fromCache, setFromCache] = useState(false);

  useEffect(() => {
    if (!courseId) return;
    (async () => {
      try {
        const data = await courseApi.get(Number(courseId));
        setCourse(data);
        // Cache each layout for offline use (cast — display only, no hole detail needed)
        for (const layout of data.layouts || []) {
          cacheLayoutData(String(layout.id), layout as any).catch(() => {});
        }
      } catch {
        // Try to build course from cached layouts
        // (limited — we only have layouts that were previously viewed)
        setFromCache(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [courseId]);

  const startRound = async (layout: Layout) => {
    setStarting(true);
    try {
      const round = await roundApi.start(layout.id);
      router.replace({
        pathname: "/scoring/scorecard",
        params: {
          roundId: String(round.id),
          layoutId: String(layout.id),
          courseId: courseId!,
          courseName: courseName || "Course",
          layoutName: layout.name,
          totalHoles: String(layout.holes),
          totalPar: String(layout.total_par),
        },
      });
    } catch {
      // Offline: proceed without server round ID — scorecard handles offline save
      router.replace({
        pathname: "/scoring/scorecard",
        params: {
          roundId: "offline",
          layoutId: String(layout.id),
          courseId: courseId!,
          courseName: courseName || "Course",
          layoutName: layout.name,
          totalHoles: String(layout.holes),
          totalPar: String(layout.total_par),
        },
      });
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>{courseName || "Select Layout"}</Text>
      <Text style={styles.subtitle}>Choose a layout to play</Text>
      {fromCache && (
        <Text style={styles.cacheNote}>Some data may be cached (offline)</Text>
      )}

      <ScrollView style={styles.list}>
        {course?.layouts.map((layout) => (
          <Card key={layout.id} elevated style={styles.card}>
            <View style={styles.layoutHeader}>
              <Text style={styles.layoutName}>{layout.name}</Text>
              {layout.is_default && (
                <View style={styles.defaultBadge}>
                  <Text style={styles.defaultText}>Default</Text>
                </View>
              )}
            </View>
            <View style={styles.layoutMeta}>
              <Text style={styles.metaText}>{layout.holes} holes</Text>
              <Text style={styles.metaDot}>·</Text>
              <Text style={styles.metaText}>Par {layout.total_par}</Text>
              {layout.total_distance && (
                <>
                  <Text style={styles.metaDot}>·</Text>
                  <Text style={styles.metaText}>{layout.total_distance.toLocaleString()} ft</Text>
                </>
              )}
            </View>
            {layout.difficulty && (
              <Text style={styles.difficulty}>{layout.difficulty}</Text>
            )}
            <Button
              title="Play This Layout"
              onPress={() => startRound(layout)}
              loading={starting}
              style={{ marginTop: spacing.sm }}
            />
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.secondary, padding: spacing.md },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: fontSize["2xl"], fontWeight: "700", color: colors.text.primary },
  subtitle: { fontSize: fontSize.base, color: colors.text.secondary, marginBottom: spacing.md },
  list: { flex: 1 },
  card: { marginBottom: spacing.md },
  layoutHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  layoutName: { fontSize: fontSize.xl, fontWeight: "700", color: colors.text.primary },
  defaultBadge: { backgroundColor: colors.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  defaultText: { color: colors.text.inverse, fontSize: fontSize.xs, fontWeight: "600" },
  layoutMeta: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  metaText: { fontSize: fontSize.sm, color: colors.text.secondary },
  metaDot: { marginHorizontal: 6, color: colors.text.disabled },
  difficulty: { fontSize: fontSize.xs, color: colors.accent.blue, marginTop: 2, textTransform: "capitalize" },
  cacheNote: { fontSize: fontSize.xs, color: colors.secondary, marginBottom: spacing.sm, fontWeight: "500" },
});
