import { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card } from "@/components/common/Card";
import { Button } from "@/components/common/Button";
import { useAuth } from "@/context/AuthContext";
import { roundApi, eventApi, courseApi } from "@/services/api";
import { colors, spacing, fontSize } from "@/constants/theme";
import type { Round, LeagueEvent, Course } from "@/types";

export default function PlayScreen() {
  const { user } = useAuth();
  const [recentRounds, setRecentRounds] = useState<Round[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<LeagueEvent[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [rounds, events, courseList] = await Promise.allSettled([
        roundApi.list(5),
        eventApi.list("upcoming", 3),
        courseApi.list(),
      ]);
      if (rounds.status === "fulfilled") setRecentRounds(rounds.value);
      if (events.status === "fulfilled") setUpcomingEvents(events.value);
      if (courseList.status === "fulfilled") setCourses(courseList.value);
    } catch {
      // Silently handle — user may not be authenticated yet
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionRow}>
          <Button title="Start Round" onPress={() => router.push("/scoring/select-course")} size="lg" />
          <Button title="Practice" onPress={() => router.push("/scoring/select-course")} variant="secondary" size="lg" />
        </View>
      </View>

      {/* Upcoming Event */}
      {upcomingEvents.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming Event</Text>
          {upcomingEvents.map((event) => (
            <Card key={event.id} elevated>
              <Text style={styles.eventName}>{event.name || "League Event"}</Text>
              <Text style={styles.eventDate}>
                {new Date(event.event_date).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
              </Text>
              <Text style={styles.eventPlayers}>
                {event.num_players ?? 0} players registered
              </Text>
              <Button
                title="Check In"
                onPress={() => eventApi.checkin(event.id)}
                variant="primary"
                size="sm"
                style={{ marginTop: spacing.sm }}
              />
            </Card>
          ))}
        </View>
      )}

      {/* Recent Rounds */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Rounds</Text>
        {recentRounds.length === 0 ? (
          <Card>
            <Text style={styles.emptyTitle}>No rounds yet!</Text>
            <Text style={styles.emptyText}>
              Play your first round to start tracking progress.
            </Text>
          </Card>
        ) : (
          recentRounds.map((round) => (
            <Card
              key={round.id}
              onPress={() => router.push(`/round/${round.id}`)}
            >
              <View style={styles.roundRow}>
                <View>
                  <Text style={styles.roundDate}>
                    {new Date(round.started_at).toLocaleDateString()}
                  </Text>
                  <Text style={styles.roundLayout}>Layout #{round.layout_id}</Text>
                </View>
                {round.total_score !== null && (
                  <Text
                    style={[
                      styles.roundScore,
                      { color: round.total_score <= 0 ? colors.score.birdie : colors.score.bogey },
                    ]}
                  >
                    {round.total_score > 0 ? "+" : ""}
                    {round.total_score}
                  </Text>
                )}
              </View>
            </Card>
          ))
        )}
      </View>

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.secondary },
  section: { padding: spacing.md, gap: spacing.sm },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text.primary },
  actionRow: { flexDirection: "row", gap: spacing.sm },
  eventName: { fontSize: fontSize.lg, fontWeight: "600", color: colors.text.primary },
  eventDate: { fontSize: fontSize.base, color: colors.text.secondary, marginTop: 2 },
  eventPlayers: { fontSize: fontSize.sm, color: colors.text.secondary, marginTop: 2 },
  emptyTitle: { fontSize: fontSize.lg, fontWeight: "600", color: colors.text.primary, marginBottom: 4 },
  emptyText: { fontSize: fontSize.base, color: colors.text.secondary },
  roundRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  roundDate: { fontSize: fontSize.base, fontWeight: "500", color: colors.text.primary },
  roundLayout: { fontSize: fontSize.sm, color: colors.text.secondary },
  roundScore: { fontSize: fontSize["2xl"], fontWeight: "700" },
});
