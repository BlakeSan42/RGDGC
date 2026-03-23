import { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Card } from "@/components/common/Card";
import { Button } from "@/components/common/Button";
import { leagueApi, eventApi } from "@/services/api";
import { colors, spacing, fontSize, borderRadius } from "@/constants/theme";
import type { League, LeaderboardEntry, LeagueEvent } from "@/types";

export default function LeagueScreen() {
  const router = useRouter();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [events, setEvents] = useState<LeagueEvent[]>([]);
  const [selectedLeague, setSelectedLeague] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const leagueList = await leagueApi.list();
      setLeagues(leagueList);
      if (leagueList.length > 0) {
        const id = selectedLeague ?? leagueList[0].id;
        setSelectedLeague(id);
        const [lb, ev] = await Promise.all([
          leagueApi.leaderboard(id, 20),
          eventApi.list("upcoming", 5),
        ]);
        setLeaderboard(lb);
        setEvents(ev);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load league data");
    }
  };

  useEffect(() => { loadData(); }, []);

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
      {/* League Selector */}
      <View style={styles.section}>
        <View style={styles.leagueRow}>
          {leagues.map((l) => (
            <Button
              key={l.id}
              title={l.name}
              variant={selectedLeague === l.id ? "primary" : "secondary"}
              size="sm"
              onPress={() => {
                setSelectedLeague(l.id);
                leagueApi.leaderboard(l.id, 20).then(setLeaderboard);
              }}
            />
          ))}
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionRow}>
        <Pressable
          style={styles.actionBtn}
          onPress={() => router.push("/leaderboard" as any)}
        >
          <Text style={styles.actionBtnText}>Full Leaderboard</Text>
          <Text style={styles.actionBtnArrow}>{"\u2192"}</Text>
        </Pressable>
        <Pressable
          style={[styles.actionBtn, styles.actionBtnSecondary]}
          onPress={() => router.push("/compare" as any)}
        >
          <Text style={[styles.actionBtnText, styles.actionBtnTextSecondary]}>Compare Players</Text>
          <Text style={[styles.actionBtnArrow, styles.actionBtnTextSecondary]}>{"\u2192"}</Text>
        </Pressable>
      </View>

      {/* Leaderboard */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Standings</Text>
        {leaderboard.length > 0 ? (
          <Card elevated>
            {leaderboard.map((entry, i) => (
              <View key={entry.player_id} style={[styles.lbRow, i > 0 && styles.lbBorder]}>
                <View style={styles.lbLeft}>
                  <Text style={styles.lbRank}>
                    {entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : `${entry.rank}.`}
                  </Text>
                  <View>
                    <Text style={styles.lbName}>{entry.player_name}</Text>
                    <Text style={styles.lbMeta}>
                      {entry.events_played} events • {entry.wins} wins
                    </Text>
                  </View>
                </View>
                <Text style={styles.lbPoints}>{entry.total_points} pts</Text>
              </View>
            ))}
          </Card>
        ) : (
          <Card>
            <Text style={styles.emptyTitle}>{error ? "Connection Error" : "No standings yet"}</Text>
            <Text style={styles.emptyText}>
              {error
                ? "Pull down to retry. Check your internet connection."
                : "Play in league events to earn points and appear on the leaderboard."}
            </Text>
          </Card>
        )}
      </View>

      {/* Upcoming Events */}
      {events.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming Events</Text>
          {events.map((event) => (
            <Card key={event.id} onPress={() => router.push(`/event/${event.id}`)}>
              <Text style={styles.eventName}>{event.name || "League Event"}</Text>
              <Text style={styles.eventDate}>
                {new Date(event.event_date).toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </Text>
              <Text style={styles.eventPlayers}>{event.num_players ?? 0} registered</Text>
            </Card>
          ))}
        </View>
      )}

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.secondary },
  section: { padding: spacing.md, gap: spacing.sm },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text.primary },
  leagueRow: { flexDirection: "row", gap: spacing.sm },
  lbRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.sm },
  lbBorder: { borderTopWidth: 1, borderTopColor: colors.gray[200] },
  lbLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  lbRank: { fontSize: fontSize.lg, width: 30 },
  lbName: { fontSize: fontSize.base, fontWeight: "600", color: colors.text.primary },
  lbMeta: { fontSize: fontSize.xs, color: colors.text.secondary },
  lbPoints: { fontSize: fontSize.lg, fontWeight: "700", color: colors.primary },
  eventName: { fontSize: fontSize.base, fontWeight: "600", color: colors.text.primary },
  eventDate: { fontSize: fontSize.sm, color: colors.text.secondary },
  eventPlayers: { fontSize: fontSize.xs, color: colors.text.secondary },
  emptyTitle: { fontSize: fontSize.lg, fontWeight: "600", color: colors.text.primary, marginBottom: 4 },
  emptyText: { fontSize: fontSize.base, color: colors.text.secondary },
  actionRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  actionBtnSecondary: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  actionBtnText: {
    color: colors.text.inverse,
    fontWeight: "600",
    fontSize: fontSize.sm,
  },
  actionBtnTextSecondary: {
    color: colors.primary,
  },
  actionBtnArrow: {
    color: colors.text.inverse,
    fontSize: fontSize.base,
  },
});
