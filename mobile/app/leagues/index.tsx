import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Pressable,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "@/components/common/Card";
import { Button } from "@/components/common/Button";
import { leagueApi, eventApi } from "@/services/api";
import { colors, spacing, fontSize, borderRadius } from "@/constants/theme";
import type { League, LeagueEvent } from "@/types";

// ── League type badge ──
function TypeBadge({ type }: { type: string }) {
  const label = type.toLowerCase().includes("double") ? "Doubles" : "Singles";
  const bgColor = type.toLowerCase().includes("double")
    ? colors.accent.blue
    : colors.primary;
  return (
    <View style={[styles.badge, { backgroundColor: bgColor }]}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

export default function LeaguesBrowseScreen() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<LeagueEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [pastSeasonsOpen, setPastSeasonsOpen] = useState(false);

  // TODO: Replace with actual membership check from backend
  // For now, treat all active leagues as available
  const myLeagueIds = new Set<number>();

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const [leagueList, events] = await Promise.all([
        leagueApi.list(),
        eventApi.list("upcoming", 10).catch(() => [] as LeagueEvent[]),
      ]);
      setLeagues(leagueList);
      setUpcomingEvents(events);
    } catch {
      setError("Failed to load leagues. Pull down to retry.");
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

  const myLeagues = leagues.filter((l) => l.is_active && myLeagueIds.has(l.id));
  const availableLeagues = leagues.filter(
    (l) => l.is_active && !myLeagueIds.has(l.id)
  );
  const pastLeagues = leagues.filter((l) => !l.is_active);

  // Get next event for a league
  const getNextEvent = (leagueId: number): LeagueEvent | undefined =>
    upcomingEvents.find((e) => e.league_id === leagueId);

  const handleJoin = (league: League) => {
    Alert.alert(
      "Join League",
      `Join "${league.name}" for the ${league.season || "current"} season?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Join",
          onPress: () => {
            // TODO: Call join API endpoint
            Alert.alert("Joined!", `You've joined ${league.name}.`);
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading leagues...</Text>
      </View>
    );
  }

  if (error && leagues.length === 0) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
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
        {/* My Leagues */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Leagues</Text>
          {myLeagues.length === 0 ? (
            <Card>
              <View style={styles.emptyRow}>
                <Ionicons name="trophy-outline" size={32} color={colors.gray[400]} />
                <View style={styles.emptyTextContainer}>
                  <Text style={styles.emptyTitle}>No leagues yet</Text>
                  <Text style={styles.emptyText}>
                    Join a league below to start competing and earning points.
                  </Text>
                </View>
              </View>
            </Card>
          ) : (
            myLeagues.map((league) => {
              const nextEvent = getNextEvent(league.id);
              return (
                <Card
                  key={league.id}
                  elevated
                  onPress={() => router.push(`/leagues/${league.id}`)}
                  style={styles.leagueCard}
                >
                  <View style={styles.leagueHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.leagueName}>{league.name}</Text>
                      {league.season && (
                        <Text style={styles.leagueSeason}>{league.season}</Text>
                      )}
                    </View>
                    <TypeBadge type={league.league_type} />
                  </View>
                  {nextEvent && (
                    <View style={styles.nextEventRow}>
                      <Ionicons
                        name="calendar-outline"
                        size={14}
                        color={colors.text.secondary}
                      />
                      <Text style={styles.nextEventText}>
                        Next:{" "}
                        {new Date(nextEvent.event_date).toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                      </Text>
                    </View>
                  )}
                  <View style={styles.leagueArrow}>
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color={colors.gray[400]}
                    />
                  </View>
                </Card>
              );
            })
          )}
        </View>

        {/* Available Leagues */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Available Leagues</Text>
          {availableLeagues.length === 0 ? (
            <Card>
              <Text style={styles.emptyTitle}>No leagues available</Text>
              <Text style={styles.emptyText}>
                Check back soon for new league openings.
              </Text>
            </Card>
          ) : (
            availableLeagues.map((league) => {
              const nextEvent = getNextEvent(league.id);
              return (
                <Card key={league.id} elevated style={styles.leagueCard}>
                  <View style={styles.leagueHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.leagueName}>{league.name}</Text>
                      {league.season && (
                        <Text style={styles.leagueSeason}>{league.season}</Text>
                      )}
                    </View>
                    <TypeBadge type={league.league_type} />
                  </View>
                  {league.description && (
                    <Text style={styles.leagueDesc} numberOfLines={2}>
                      {league.description}
                    </Text>
                  )}
                  <View style={styles.availableMeta}>
                    <View style={styles.metaItem}>
                      <Ionicons
                        name="people-outline"
                        size={14}
                        color={colors.text.secondary}
                      />
                      <Text style={styles.metaText}>
                        {league.league_type}
                      </Text>
                    </View>
                    {league.drop_worst > 0 && (
                      <View style={styles.metaItem}>
                        <Ionicons
                          name="shield-outline"
                          size={14}
                          color={colors.text.secondary}
                        />
                        <Text style={styles.metaText}>
                          Drop worst {league.drop_worst}
                        </Text>
                      </View>
                    )}
                    {nextEvent && (
                      <View style={styles.metaItem}>
                        <Ionicons
                          name="calendar-outline"
                          size={14}
                          color={colors.text.secondary}
                        />
                        <Text style={styles.metaText}>
                          Next:{" "}
                          {new Date(nextEvent.event_date).toLocaleDateString(
                            "en-US",
                            { month: "short", day: "numeric" }
                          )}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Button
                    title="Join League"
                    onPress={() => handleJoin(league)}
                    size="md"
                    style={styles.joinButton}
                  />
                </Card>
              );
            })
          )}
        </View>

        {/* Past Seasons */}
        {pastLeagues.length > 0 && (
          <View style={styles.section}>
            <Pressable
              onPress={() => setPastSeasonsOpen(!pastSeasonsOpen)}
              style={styles.collapsibleHeader}
            >
              <Text style={styles.sectionTitle}>Past Seasons</Text>
              <Ionicons
                name={pastSeasonsOpen ? "chevron-up" : "chevron-down"}
                size={20}
                color={colors.text.secondary}
              />
            </Pressable>
            {pastSeasonsOpen &&
              pastLeagues.map((league) => (
                <Card
                  key={league.id}
                  onPress={() => router.push(`/leagues/${league.id}`)}
                  style={styles.pastCard}
                >
                  <View style={styles.pastRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pastName}>{league.name}</Text>
                      <Text style={styles.pastSeason}>
                        {league.season || "Completed"}
                      </Text>
                    </View>
                    <View style={styles.pastBadge}>
                      <Text style={styles.pastBadgeText}>Archived</Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={colors.gray[400]}
                    />
                  </View>
                </Card>
              ))}
          </View>
        )}

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

  // Sections
  section: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.text.primary,
  },

  // Badge
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
  },
  badgeText: {
    fontSize: fontSize.xs,
    fontWeight: "600",
    color: colors.text.inverse,
  },

  // League card
  leagueCard: { marginBottom: 0 },
  leagueHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  leagueName: {
    fontSize: fontSize.base,
    fontWeight: "700",
    color: colors.text.primary,
  },
  leagueSeason: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  leagueDesc: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  leagueArrow: {
    position: "absolute",
    right: 0,
    top: "50%",
  },

  // Next event
  nextEventRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: spacing.sm,
  },
  nextEventText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },

  // Available meta
  availableMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
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

  // Join button
  joinButton: {
    marginTop: spacing.md,
  },

  // Empty
  emptyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  emptyTextContainer: { flex: 1 },
  emptyTitle: {
    fontSize: fontSize.base,
    fontWeight: "600",
    color: colors.text.primary,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },

  // Collapsible
  collapsibleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 44,
  },

  // Past seasons
  pastCard: { marginBottom: 0 },
  pastRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  pastName: {
    fontSize: fontSize.base,
    fontWeight: "600",
    color: colors.text.primary,
  },
  pastSeason: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  pastBadge: {
    backgroundColor: colors.gray[200],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  pastBadgeText: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    fontWeight: "500",
  },
});
