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
import { useLocalSearchParams, router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "@/components/common/Card";
import { Button } from "@/components/common/Button";
import { useAuth } from "@/context/AuthContext";
import { leagueApi, eventApi } from "@/services/api";
import { colors, spacing, fontSize, borderRadius } from "@/constants/theme";
import type { League, LeaderboardEntry, LeagueEvent } from "@/types";

// ── Medal colors ──
const medalColors: Record<number, string> = {
  1: "#FFD700", // gold
  2: "#C0C0C0", // silver
  3: "#CD7F32", // bronze
};

// ── Points explanation card ──
function PointsExplanation({
  dropWorst,
  open,
  toggle,
}: {
  dropWorst: number;
  open: boolean;
  toggle: () => void;
}) {
  return (
    <Card style={styles.pointsCard}>
      <Pressable onPress={toggle} style={styles.pointsHeader}>
        <View style={styles.pointsHeaderLeft}>
          <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
          <Text style={styles.pointsTitle}>Points System</Text>
        </View>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={20}
          color={colors.text.secondary}
        />
      </Pressable>
      {open && (
        <View style={styles.pointsBody}>
          <Text style={styles.pointsFormula}>
            Points = # players - finish position + 1
          </Text>
          <Text style={styles.pointsExample}>
            Example: 8 players{"\n"}1st = 8 pts, 2nd = 7 pts, ... 8th = 1 pt
          </Text>
          <View style={styles.pointsRuleRow}>
            <Ionicons name="close-circle-outline" size={16} color={colors.error} />
            <Text style={styles.pointsRule}>DNF/DQ = 0 points</Text>
          </View>
          <View style={styles.pointsRuleRow}>
            <Ionicons name="swap-horizontal-outline" size={16} color={colors.info} />
            <Text style={styles.pointsRule}>
              Ties: same position, same points, next position skips
            </Text>
          </View>
          {dropWorst > 0 && (
            <View style={styles.pointsRuleRow}>
              <Ionicons name="shield-checkmark-outline" size={16} color={colors.success} />
              <Text style={styles.pointsRule}>
                Worst {dropWorst} event{dropWorst > 1 ? "s" : ""} dropped from
                season total
              </Text>
            </View>
          )}
          <Text style={styles.prizeTitle}>Prize Structure (Top 5)</Text>
          {["1st Place", "2nd Place", "3rd Place", "4th Place", "5th Place"].map(
            (place, i) => (
              <View key={i} style={styles.prizeRow}>
                <Text style={styles.prizePlace}>{place}</Text>
                <Text style={styles.prizeAmount}>TBD</Text>
              </View>
            )
          )}
        </View>
      )}
    </Card>
  );
}

export default function LeagueDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const leagueId = Number(id);

  const [league, setLeague] = useState<League | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [events, setEvents] = useState<LeagueEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [pointsOpen, setPointsOpen] = useState(false);

  const loadData = useCallback(async () => {
    if (!leagueId) return;
    setError(null);
    try {
      const [leagueData, lb, ev] = await Promise.all([
        leagueApi.get(leagueId),
        leagueApi.leaderboard(leagueId, 50),
        eventApi.list("upcoming", 10).catch(() => [] as LeagueEvent[]),
      ]);
      setLeague(leagueData);
      setLeaderboard(lb);
      setEvents(ev.filter((e) => e.league_id === leagueId).slice(0, 3));
    } catch {
      setError("Failed to load league details.");
    } finally {
      setLoading(false);
    }
  }, [leagueId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleLeave = () => {
    Alert.alert(
      "Leave League",
      `Are you sure you want to leave "${league?.name}"? Your points and history will be preserved.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: () => {
            // TODO: Call leave API endpoint
            Alert.alert("Left League", "You have left the league.");
            router.back();
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !league) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
        <Text style={styles.errorText}>{error || "League not found."}</Text>
        <Button title="Go Back" onPress={() => router.back()} variant="secondary" size="sm" />
      </View>
    );
  }

  const typeBadgeLabel = league.league_type.toLowerCase().includes("double")
    ? "Doubles"
    : "Singles";
  const typeBadgeColor = league.league_type.toLowerCase().includes("double")
    ? colors.accent.blue
    : colors.primary;

  // Stats
  const totalPlayers = leaderboard.length;
  const totalEventsPlayed = leaderboard.length > 0
    ? Math.max(...leaderboard.map((e) => e.events_played))
    : 0;

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
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroName}>{league.name}</Text>
          <View style={styles.heroRow}>
            {league.season && (
              <Text style={styles.heroSeason}>{league.season}</Text>
            )}
            <View style={[styles.typeBadge, { backgroundColor: typeBadgeColor }]}>
              <Text style={styles.typeBadgeText}>{typeBadgeLabel}</Text>
            </View>
            {!league.is_active && (
              <View style={[styles.typeBadge, { backgroundColor: colors.gray[500] }]}>
                <Text style={styles.typeBadgeText}>Archived</Text>
              </View>
            )}
          </View>
          {league.description && (
            <Text style={styles.heroDesc}>{league.description}</Text>
          )}
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{totalEventsPlayed}</Text>
            <Text style={styles.statLabel}>Events Played</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{totalPlayers}</Text>
            <Text style={styles.statLabel}>Total Players</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{events.length}</Text>
            <Text style={styles.statLabel}>Upcoming</Text>
          </View>
        </View>

        {/* Standings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Standings</Text>
          {leaderboard.length === 0 ? (
            <Card>
              <Text style={styles.emptyTitle}>No standings yet</Text>
              <Text style={styles.emptyText}>
                Results will appear here after the first event.
              </Text>
            </Card>
          ) : (
            <Card elevated>
              {/* Table header */}
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { width: 36 }]}>#</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Player</Text>
                <Text style={[styles.tableHeaderCell, styles.monoText, { width: 50 }]}>
                  Pts
                </Text>
                <Text style={[styles.tableHeaderCell, styles.monoText, { width: 36 }]}>
                  GP
                </Text>
                <Text style={[styles.tableHeaderCell, styles.monoText, { width: 30 }]}>
                  W
                </Text>
                <Text style={[styles.tableHeaderCell, styles.monoText, { width: 30 }]}>
                  Pod
                </Text>
              </View>

              {/* Rows */}
              {leaderboard.map((entry) => {
                const isCurrentUser = user?.id === entry.player_id;
                const medalColor = medalColors[entry.rank];
                return (
                  <View
                    key={entry.player_id}
                    style={[
                      styles.tableRow,
                      isCurrentUser && styles.highlightRow,
                      entry.rank <= 3 && { borderLeftWidth: 3, borderLeftColor: medalColor },
                    ]}
                  >
                    <View style={{ width: 36, alignItems: "center" }}>
                      {medalColor ? (
                        <Ionicons name="medal-outline" size={18} color={medalColor} />
                      ) : (
                        <Text style={[styles.rankText, styles.monoText]}>
                          {entry.rank}
                        </Text>
                      )}
                    </View>
                    <Text
                      style={[
                        styles.playerName,
                        { flex: 1 },
                        isCurrentUser && styles.highlightText,
                      ]}
                      numberOfLines={1}
                    >
                      {entry.player_name}
                      {isCurrentUser ? " (You)" : ""}
                    </Text>
                    <Text style={[styles.cellValue, styles.monoText, { width: 50 }]}>
                      {entry.total_points}
                    </Text>
                    <Text style={[styles.cellValue, styles.monoText, { width: 36 }]}>
                      {entry.events_played}
                    </Text>
                    <Text style={[styles.cellValue, styles.monoText, { width: 30 }]}>
                      {entry.wins}
                    </Text>
                    <Text style={[styles.cellValue, styles.monoText, { width: 30 }]}>
                      {entry.podiums}
                    </Text>
                  </View>
                );
              })}
            </Card>
          )}
        </View>

        {/* Upcoming Events */}
        {events.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Upcoming Events</Text>
            {events.map((event) => (
              <Card
                key={event.id}
                onPress={() => router.push(`/event/${event.id}`)}
                style={styles.eventCard}
              >
                <View style={styles.eventRow}>
                  <View style={styles.eventDateBox}>
                    <Text style={styles.eventMonth}>
                      {new Date(event.event_date)
                        .toLocaleDateString("en-US", { month: "short" })
                        .toUpperCase()}
                    </Text>
                    <Text style={styles.eventDay}>
                      {new Date(event.event_date).getDate()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.eventName}>
                      {event.name || "League Event"}
                    </Text>
                    <Text style={styles.eventMeta}>
                      {new Date(event.event_date).toLocaleDateString("en-US", {
                        weekday: "long",
                      })}
                      {event.num_players
                        ? ` - ${event.num_players} registered`
                        : ""}
                    </Text>
                    {event.entry_fee != null && event.entry_fee > 0 && (
                      <Text style={styles.eventFee}>
                        Entry: ${event.entry_fee.toFixed(2)}
                      </Text>
                    )}
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={colors.gray[400]}
                  />
                </View>
              </Card>
            ))}
          </View>
        )}

        {/* Points System */}
        <View style={styles.section}>
          <PointsExplanation
            dropWorst={league.drop_worst}
            open={pointsOpen}
            toggle={() => setPointsOpen(!pointsOpen)}
          />
        </View>

        {/* Leave League */}
        {league.is_active && (
          <View style={styles.leaveSection}>
            <Button
              title="Leave League"
              onPress={handleLeave}
              variant="ghost"
              size="sm"
            />
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
    gap: spacing.md,
  },
  errorText: {
    fontSize: fontSize.base,
    color: colors.error,
    textAlign: "center",
  },
  scrollView: { flex: 1 },

  // Hero
  hero: {
    backgroundColor: colors.bg.card,
    padding: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  heroName: {
    fontSize: fontSize["2xl"],
    fontWeight: "800",
    color: colors.text.primary,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  heroSeason: {
    fontSize: fontSize.base,
    color: colors.text.secondary,
  },
  heroDesc: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.sm,
  },
  typeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
  },
  typeBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: "600",
    color: colors.text.inverse,
  },

  // Stats
  statsRow: {
    flexDirection: "row",
    backgroundColor: colors.bg.card,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  statItem: { flex: 1, alignItems: "center" },
  statValue: {
    fontSize: fontSize.xl,
    fontWeight: "700",
    color: colors.primary,
    fontFamily: "JetBrains Mono",
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.gray[200],
    marginVertical: 4,
  },

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

  // Table
  tableHeader: {
    flexDirection: "row",
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
    alignItems: "center",
  },
  tableHeaderCell: {
    fontSize: fontSize.xs,
    fontWeight: "600",
    color: colors.text.secondary,
    textAlign: "center",
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[100],
  },
  highlightRow: {
    backgroundColor: "#E8F5E9",
    marginHorizontal: -spacing.md,
    paddingHorizontal: spacing.md,
  },
  highlightText: {
    fontWeight: "700",
    color: colors.primary,
  },
  rankText: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.text.secondary,
  },
  playerName: {
    fontSize: fontSize.sm,
    fontWeight: "500",
    color: colors.text.primary,
  },
  cellValue: {
    fontSize: fontSize.sm,
    color: colors.text.primary,
    textAlign: "center",
  },
  monoText: {
    fontFamily: "JetBrains Mono",
    fontVariant: ["tabular-nums"],
  },

  // Events
  eventCard: { marginBottom: 0 },
  eventRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  eventDateBox: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  eventMonth: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.text.inverse,
    letterSpacing: 0.5,
  },
  eventDay: {
    fontSize: fontSize.lg,
    fontWeight: "800",
    color: colors.text.inverse,
    marginTop: -2,
  },
  eventName: {
    fontSize: fontSize.base,
    fontWeight: "600",
    color: colors.text.primary,
  },
  eventMeta: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },
  eventFee: {
    fontSize: fontSize.xs,
    color: colors.secondary,
    fontWeight: "600",
    marginTop: 2,
  },

  // Points explanation
  pointsCard: {
    backgroundColor: colors.gray[50],
  },
  pointsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 44,
  },
  pointsHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  pointsTitle: {
    fontSize: fontSize.base,
    fontWeight: "600",
    color: colors.text.primary,
  },
  pointsBody: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  pointsFormula: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.primary,
    fontFamily: "JetBrains Mono",
    backgroundColor: colors.bg.card,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    textAlign: "center",
    overflow: "hidden",
  },
  pointsExample: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    fontStyle: "italic",
  },
  pointsRuleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  pointsRule: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    flex: 1,
  },
  prizeTitle: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.text.primary,
    marginTop: spacing.sm,
  },
  prizeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  prizePlace: {
    fontSize: fontSize.sm,
    color: colors.text.primary,
  },
  prizeAmount: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    fontFamily: "JetBrains Mono",
    fontVariant: ["tabular-nums"],
  },

  // Leave
  leaveSection: {
    alignItems: "center",
    paddingVertical: spacing.md,
  },

  // Empty
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
});
