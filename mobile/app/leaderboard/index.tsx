import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Card } from "@/components/common/Card";
import { Avatar } from "@/components/common/Avatar";
import { Button } from "@/components/common/Button";
import { leagueApi, leaderboardApi, eventApi } from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import { colors, spacing, fontSize, borderRadius } from "@/constants/theme";
import type {
  League,
  SeasonStanding,
  LeaderboardEntry,
  PuttingLeader,
  CourseRecord,
  EventResult,
  LeagueEvent,
} from "@/types";

// ── Tab definitions ──
const TABS = [
  { key: "standings", label: "Standings" },
  { key: "events", label: "Events" },
  { key: "putting", label: "Putting" },
  { key: "records", label: "Records" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

// ── Putting sort options ──
const PUTTING_SORT_OPTIONS = [
  { key: "c1x_percentage", label: "C1X%" },
  { key: "c2_percentage", label: "C2%" },
  { key: "total_putts", label: "Total" },
  { key: "strokes_gained_putting", label: "SG Putt" },
] as const;

type PuttingSortKey = (typeof PUTTING_SORT_OPTIONS)[number]["key"];

// ── Medal colors ──
const MEDAL_COLORS = {
  1: { bg: "#FFF8E1", border: "#FFD700", text: "#B8860B", icon: "1st" },
  2: { bg: "#F5F5F5", border: "#C0C0C0", text: "#6B6B6B", icon: "2nd" },
  3: { bg: "#FFF3E0", border: "#CD7F32", text: "#8B4513", icon: "3rd" },
} as const;

export default function LeaderboardScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<TabKey>("standings");
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Standings state
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeague, setSelectedLeague] = useState<number | null>(null);
  const [standings, setStandings] = useState<(SeasonStanding | LeaderboardEntry)[]>([]);

  // Event results state
  const [completedEvents, setCompletedEvents] = useState<LeagueEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<number | null>(null);
  const [eventResults, setEventResults] = useState<EventResult[]>([]);

  // Putting state
  const [puttingLeaders, setPuttingLeaders] = useState<PuttingLeader[]>([]);
  const [puttingSortBy, setPuttingSortBy] = useState<PuttingSortKey>("c1x_percentage");

  // Records state
  const [courseRecords, setCourseRecords] = useState<CourseRecord[]>([]);

  // ── Data loading ──
  const loadStandings = useCallback(async (leagueId: number) => {
    try {
      const data = await leaderboardApi.seasonStandings(leagueId, 50);
      setStandings(data);
    } catch {
      // Fallback to basic leaderboard
      try {
        const data = await leagueApi.leaderboard(leagueId, 50);
        setStandings(data);
      } catch {
        setStandings([]);
      }
    }
  }, []);

  const loadLeagues = useCallback(async () => {
    const leagueList = await leagueApi.list();
    setLeagues(leagueList);
    if (leagueList.length > 0) {
      const id = selectedLeague ?? leagueList[0].id;
      setSelectedLeague(id);
      await loadStandings(id);
    }
  }, [selectedLeague, loadStandings]);

  const loadEventResults = useCallback(async () => {
    try {
      const events = await eventApi.list("completed", 20);
      setCompletedEvents(events);
      if (events.length > 0) {
        const eventId = selectedEvent ?? events[0].id;
        setSelectedEvent(eventId);
        const results = await eventApi.results(eventId);
        setEventResults(results);
      }
    } catch {
      setCompletedEvents([]);
      setEventResults([]);
    }
  }, [selectedEvent]);

  const loadPuttingLeaders = useCallback(async () => {
    try {
      const data = await leaderboardApi.puttingLeaders(50);
      setPuttingLeaders(data);
    } catch {
      setPuttingLeaders([]);
    }
  }, []);

  const loadCourseRecords = useCallback(async () => {
    try {
      const data = await leaderboardApi.courseRecords();
      setCourseRecords(data);
    } catch {
      setCourseRecords([]);
    }
  }, []);

  const loadData = useCallback(async () => {
    setError(null);
    try {
      switch (activeTab) {
        case "standings":
          await loadLeagues();
          break;
        case "events":
          await loadEventResults();
          break;
        case "putting":
          await loadPuttingLeaders();
          break;
        case "records":
          await loadCourseRecords();
          break;
      }
    } catch (e) {
      setError("Failed to load data. Pull to refresh.");
    } finally {
      setLoading(false);
    }
  }, [activeTab, loadLeagues, loadEventResults, loadPuttingLeaders, loadCourseRecords]);

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [activeTab]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // ── Sorted putting leaders ──
  const sortedPuttingLeaders = [...puttingLeaders].sort((a, b) => {
    if (puttingSortBy === "strokes_gained_putting") {
      return b.strokes_gained_putting - a.strokes_gained_putting;
    }
    return b[puttingSortBy] - a[puttingSortBy];
  });

  // ── Rank change indicator ──
  const RankChange = ({ change }: { change: number }) => {
    if (change > 0) return <Text style={styles.rankUp}>{"\u25B2"}{change}</Text>;
    if (change < 0) return <Text style={styles.rankDown}>{"\u25BC"}{Math.abs(change)}</Text>;
    return <Text style={styles.rankSame}>{"\u2014"}</Text>;
  };

  // ── Podium visual ──
  const renderPodium = () => {
    if (standings.length < 3) return null;
    const top3 = standings.slice(0, 3);
    // Display order: 2nd, 1st, 3rd
    const podiumOrder = [top3[1], top3[0], top3[2]];
    const podiumHeights = [100, 130, 80];

    return (
      <View style={styles.podiumContainer}>
        <Text style={styles.podiumTitle}>Season Leaders</Text>
        <View style={styles.podiumRow}>
          {podiumOrder.map((entry, i) => {
            const rank = (i === 0 ? 2 : i === 1 ? 1 : 3) as 1 | 2 | 3;
            const medal = MEDAL_COLORS[rank];
            return (
              <Pressable
                key={entry.player_id}
                style={styles.podiumSlot}
                onPress={() => router.push(`/player/${entry.player_id}` as any)}
              >
                <Avatar
                  name={entry.player_name}
                  uri={"avatar_url" in entry ? (entry as SeasonStanding).avatar_url ?? undefined : undefined}
                  size={rank === 1 ? "lg" : "md"}
                />
                <Text style={styles.podiumName} numberOfLines={1}>
                  {entry.player_name}
                </Text>
                <Text style={[styles.podiumPoints, { fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" }]}>
                  {entry.total_points} pts
                </Text>
                <View
                  style={[
                    styles.podiumBar,
                    {
                      height: podiumHeights[i],
                      backgroundColor: medal.bg,
                      borderColor: medal.border,
                    },
                  ]}
                >
                  <Text style={[styles.podiumRankLabel, { color: medal.text }]}>
                    {medal.icon}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  };

  // ── Standings tab content ──
  const renderStandings = () => (
    <View>
      {/* League picker */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.leaguePicker}>
        {leagues.map((l) => (
          <Pressable
            key={l.id}
            style={[
              styles.leagueChip,
              selectedLeague === l.id && styles.leagueChipActive,
            ]}
            onPress={() => {
              setSelectedLeague(l.id);
              setLoading(true);
              loadStandings(l.id).then(() => setLoading(false));
            }}
          >
            <Text
              style={[
                styles.leagueChipText,
                selectedLeague === l.id && styles.leagueChipTextActive,
              ]}
            >
              {l.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Drop worst indicator */}
      {leagues.find((l) => l.id === selectedLeague)?.drop_worst ? (
        <View style={styles.dropWorstBanner}>
          <Text style={styles.dropWorstText}>
            Dropping {leagues.find((l) => l.id === selectedLeague)?.drop_worst} worst event(s) from totals
          </Text>
        </View>
      ) : null}

      {/* Podium */}
      {renderPodium()}

      {/* Full table */}
      {standings.length > 0 ? (
        <Card elevated style={styles.tableCard}>
          {/* Table header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.thCell, { width: 40 }]}>#</Text>
            <Text style={[styles.thCell, { flex: 1 }]}>Player</Text>
            <Text style={[styles.thCell, styles.thMono, { width: 55 }]}>Pts</Text>
            <Text style={[styles.thCell, { width: 35 }]}>Evts</Text>
            <Text style={[styles.thCell, { width: 30 }]}>W</Text>
            <Text style={[styles.thCell, { width: 30 }]}>Pod</Text>
            <Text style={[styles.thCell, { width: 35 }]}>Best</Text>
          </View>

          {/* Table rows */}
          {standings.map((entry, i) => {
            const isCurrentUser = user && entry.player_id === user.id;
            const isTopFive = entry.rank <= 5;
            const hasRankChange = "rank_change" in entry;

            return (
              <Pressable
                key={entry.player_id}
                style={[
                  styles.tableRow,
                  i > 0 && styles.tableBorder,
                  isCurrentUser && styles.currentUserRow,
                ]}
                onPress={() => router.push(`/player/${entry.player_id}` as any)}
              >
                {/* Rank */}
                <View style={[styles.rankCell, { width: 40 }]}>
                  <Text style={styles.rankText}>{entry.rank}</Text>
                  {hasRankChange && (
                    <RankChange change={(entry as SeasonStanding).rank_change} />
                  )}
                </View>

                {/* Player */}
                <View style={[styles.playerCell, { flex: 1 }]}>
                  <Avatar
                    name={entry.player_name}
                    uri={
                      "avatar_url" in entry
                        ? (entry as SeasonStanding).avatar_url ?? undefined
                        : undefined
                    }
                    size="sm"
                  />
                  <View style={styles.playerInfo}>
                    <Text style={styles.playerName} numberOfLines={1}>
                      {entry.player_name}
                      {isTopFive && " $"}
                    </Text>
                  </View>
                </View>

                {/* Points */}
                <Text
                  style={[
                    styles.tdMono,
                    { width: 55, fontWeight: "700" },
                    { fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
                  ]}
                >
                  {entry.total_points}
                </Text>

                {/* Events */}
                <Text style={[styles.tdCell, { width: 35 }]}>
                  {entry.events_played}
                </Text>

                {/* Wins */}
                <Text style={[styles.tdCell, { width: 30 }]}>
                  {entry.wins}
                </Text>

                {/* Podiums */}
                <Text style={[styles.tdCell, { width: 30 }]}>
                  {entry.podiums}
                </Text>

                {/* Best Finish */}
                <Text style={[styles.tdCell, { width: 35 }]}>
                  {entry.best_finish ?? "-"}
                </Text>
              </Pressable>
            );
          })}
        </Card>
      ) : (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No standings yet</Text>
          <Text style={styles.emptyText}>
            Play in league events to earn points and appear on the leaderboard.
          </Text>
        </Card>
      )}
    </View>
  );

  // ── Event Results tab content ──
  const renderEventResults = () => (
    <View>
      {/* Event picker */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.leaguePicker}>
        {completedEvents.map((ev) => (
          <Pressable
            key={ev.id}
            style={[
              styles.leagueChip,
              selectedEvent === ev.id && styles.leagueChipActive,
            ]}
            onPress={() => {
              setSelectedEvent(ev.id);
              setLoading(true);
              eventApi.results(ev.id).then((r) => {
                setEventResults(r);
                setLoading(false);
              });
            }}
          >
            <Text
              style={[
                styles.leagueChipText,
                selectedEvent === ev.id && styles.leagueChipTextActive,
              ]}
              numberOfLines={1}
            >
              {ev.name || new Date(ev.event_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {eventResults.length > 0 ? (
        <Card elevated style={styles.tableCard}>
          <View style={styles.tableHeader}>
            <Text style={[styles.thCell, { width: 35 }]}>#</Text>
            <Text style={[styles.thCell, { flex: 1 }]}>Player</Text>
            <Text style={[styles.thCell, styles.thMono, { width: 60 }]}>Score</Text>
            <Text style={[styles.thCell, styles.thMono, { width: 55 }]}>Pts</Text>
          </View>
          {eventResults.map((result, i) => {
            const isCurrentUser = user && result.user_id === user.id;
            return (
              <Pressable
                key={result.id}
                style={[
                  styles.tableRow,
                  i > 0 && styles.tableBorder,
                  isCurrentUser && styles.currentUserRow,
                ]}
                onPress={() => router.push(`/player/${result.user_id}` as any)}
              >
                <Text style={[styles.tdCell, { width: 35 }]}>
                  {result.dnf ? "DNF" : result.dq ? "DQ" : result.position ?? "-"}
                </Text>
                <Text style={[styles.playerName, { flex: 1 }]} numberOfLines={1}>
                  {result.player_name ?? `Player ${result.user_id}`}
                </Text>
                <Text
                  style={[
                    styles.tdMono,
                    { width: 60 },
                    { fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
                    {
                      color:
                        result.total_score < 0
                          ? colors.score.birdie
                          : result.total_score === 0
                          ? colors.score.par
                          : colors.score.bogey,
                    },
                  ]}
                >
                  {result.total_score > 0 ? `+${result.total_score}` : result.total_score === 0 ? "E" : result.total_score}
                </Text>
                <Text
                  style={[
                    styles.tdMono,
                    { width: 55, fontWeight: "700" },
                    { fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
                  ]}
                >
                  {result.points_earned ?? 0}
                </Text>
              </Pressable>
            );
          })}
        </Card>
      ) : (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No event results</Text>
          <Text style={styles.emptyText}>Completed events will show results here.</Text>
        </Card>
      )}
    </View>
  );

  // ── Putting Leaders tab content ──
  const renderPuttingLeaders = () => (
    <View>
      {/* Sort options */}
      <View style={styles.sortRow}>
        <Text style={styles.sortLabel}>Sort by:</Text>
        {PUTTING_SORT_OPTIONS.map((opt) => (
          <Pressable
            key={opt.key}
            style={[
              styles.sortChip,
              puttingSortBy === opt.key && styles.sortChipActive,
            ]}
            onPress={() => setPuttingSortBy(opt.key)}
          >
            <Text
              style={[
                styles.sortChipText,
                puttingSortBy === opt.key && styles.sortChipTextActive,
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {sortedPuttingLeaders.length > 0 ? (
        <Card elevated style={styles.tableCard}>
          <View style={styles.tableHeader}>
            <Text style={[styles.thCell, { width: 30 }]}>#</Text>
            <Text style={[styles.thCell, { flex: 1 }]}>Player</Text>
            <Text style={[styles.thCell, styles.thMono, { width: 52 }]}>C1X%</Text>
            <Text style={[styles.thCell, styles.thMono, { width: 48 }]}>C2%</Text>
            <Text style={[styles.thCell, styles.thMono, { width: 50 }]}>SG</Text>
          </View>
          {sortedPuttingLeaders.map((leader, i) => {
            const isCurrentUser = user && leader.player_id === user.id;
            return (
              <Pressable
                key={leader.player_id}
                style={[
                  styles.tableRow,
                  i > 0 && styles.tableBorder,
                  isCurrentUser && styles.currentUserRow,
                ]}
                onPress={() => router.push(`/player/${leader.player_id}` as any)}
              >
                <Text style={[styles.tdCell, { width: 30 }]}>{i + 1}</Text>
                <View style={[styles.playerCell, { flex: 1 }]}>
                  <Avatar name={leader.player_name} uri={leader.avatar_url ?? undefined} size="sm" />
                  <Text style={styles.playerName} numberOfLines={1}>
                    {leader.player_name}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.tdMono,
                    { width: 52 },
                    { fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
                    puttingSortBy === "c1x_percentage" && styles.highlightedValue,
                  ]}
                >
                  {leader.c1x_percentage.toFixed(1)}
                </Text>
                <Text
                  style={[
                    styles.tdMono,
                    { width: 48 },
                    { fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
                    puttingSortBy === "c2_percentage" && styles.highlightedValue,
                  ]}
                >
                  {leader.c2_percentage.toFixed(1)}
                </Text>
                <Text
                  style={[
                    styles.tdMono,
                    { width: 50 },
                    { fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
                    puttingSortBy === "strokes_gained_putting" && styles.highlightedValue,
                    {
                      color:
                        leader.strokes_gained_putting > 0
                          ? colors.success
                          : leader.strokes_gained_putting < 0
                          ? colors.error
                          : colors.text.primary,
                    },
                  ]}
                >
                  {leader.strokes_gained_putting > 0 ? "+" : ""}
                  {leader.strokes_gained_putting.toFixed(1)}
                </Text>
              </Pressable>
            );
          })}
        </Card>
      ) : (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No putting data yet</Text>
          <Text style={styles.emptyText}>Log putts during rounds to see putting leaderboards.</Text>
        </Card>
      )}
    </View>
  );

  // ── Course Records tab content ──
  const renderCourseRecords = () => (
    <View>
      {courseRecords.length > 0 ? (
        courseRecords.map((record) => (
          <Card key={record.layout_id} elevated style={styles.recordCard}>
            <View style={styles.recordHeader}>
              <View>
                <Text style={styles.recordCourseName}>{record.course_name}</Text>
                <Text style={styles.recordLayoutName}>{record.layout_name}</Text>
              </View>
              <View style={styles.recordScoreBadge}>
                <Text
                  style={[
                    styles.recordScore,
                    { fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
                    {
                      color:
                        record.best_score < 0
                          ? colors.score.birdie
                          : record.best_score === 0
                          ? colors.score.par
                          : colors.score.bogey,
                    },
                  ]}
                >
                  {record.best_score > 0 ? `+${record.best_score}` : record.best_score === 0 ? "E" : record.best_score}
                </Text>
                <Text style={styles.recordStrokes}>({record.best_strokes} strokes)</Text>
              </View>
            </View>
            <View style={styles.recordHolder}>
              <Pressable
                style={styles.recordHolderRow}
                onPress={() => router.push(`/player/${record.record_holder_id}` as any)}
              >
                <Avatar name={record.record_holder} size="sm" />
                <View>
                  <Text style={styles.recordHolderName}>{record.record_holder}</Text>
                  <Text style={styles.recordDate}>
                    {new Date(record.date).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </Text>
                </View>
              </Pressable>
            </View>

            {/* Aces */}
            {record.aces.length > 0 && (
              <View style={styles.acesSection}>
                <Text style={styles.acesTitle}>Aces</Text>
                {record.aces.map((ace, j) => (
                  <View key={`${ace.player_id}-${ace.hole_number}-${j}`} style={styles.aceRow}>
                    <Text style={styles.aceHole}>Hole {ace.hole_number}</Text>
                    <Pressable onPress={() => router.push(`/player/${ace.player_id}` as any)}>
                      <Text style={styles.aceName}>{ace.player_name}</Text>
                    </Pressable>
                    {ace.distance && (
                      <Text style={styles.aceDistance}>{ace.distance}ft</Text>
                    )}
                    <Text style={styles.aceDate}>
                      {new Date(ace.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </Card>
        ))
      ) : (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No course records yet</Text>
          <Text style={styles.emptyText}>Complete rounds to set course records.</Text>
        </Card>
      )}
    </View>
  );

  // ── Main render ──
  return (
    <View style={styles.container}>
      {/* Tab bar */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => (
          <Pressable
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        ) : error ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Error</Text>
            <Text style={styles.emptyText}>{error}</Text>
          </Card>
        ) : (
          <>
            {activeTab === "standings" && renderStandings()}
            {activeTab === "events" && renderEventResults()}
            {activeTab === "putting" && renderPuttingLeaders()}
            {activeTab === "records" && renderCourseRecords()}
          </>
        )}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </View>
  );
}

// ── Styles ──
const monoFont = Platform.OS === "ios" ? "Menlo" : "monospace";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.secondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
  },

  // Tab bar
  tabBar: {
    flexDirection: "row",
    backgroundColor: colors.bg.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm + 4,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: fontSize.sm,
    fontWeight: "500",
    color: colors.text.secondary,
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: "700",
  },

  // League picker
  leaguePicker: {
    marginBottom: spacing.md,
  },
  leagueChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray[100],
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  leagueChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  leagueChipText: {
    fontSize: fontSize.sm,
    fontWeight: "500",
    color: colors.text.secondary,
  },
  leagueChipTextActive: {
    color: colors.text.inverse,
    fontWeight: "600",
  },

  // Drop worst banner
  dropWorstBanner: {
    backgroundColor: colors.warning + "20",
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.warning + "40",
  },
  dropWorstText: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    textAlign: "center",
  },

  // Podium
  podiumContainer: {
    marginBottom: spacing.lg,
    alignItems: "center",
  },
  podiumTitle: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  podiumRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: spacing.sm,
    width: "100%",
  },
  podiumSlot: {
    flex: 1,
    alignItems: "center",
    maxWidth: 120,
  },
  podiumName: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.text.primary,
    marginTop: spacing.xs,
    textAlign: "center",
  },
  podiumPoints: {
    fontSize: fontSize.xs,
    fontWeight: "700",
    color: colors.primary,
    marginTop: 2,
    marginBottom: spacing.xs,
  },
  podiumBar: {
    width: "100%",
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  podiumRankLabel: {
    fontSize: fontSize["2xl"],
    fontWeight: "800",
  },

  // Table
  tableCard: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: colors.gray[300],
    paddingHorizontal: spacing.xs,
  },
  thCell: {
    fontSize: fontSize.xs,
    fontWeight: "700",
    color: colors.text.secondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  thMono: {
    fontFamily: monoFont,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    minHeight: 48,
  },
  tableBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.gray[100],
  },
  currentUserRow: {
    backgroundColor: "#E8F5E9",
    borderRadius: borderRadius.sm,
  },

  // Rank cell
  rankCell: {
    alignItems: "center",
  },
  rankText: {
    fontSize: fontSize.base,
    fontWeight: "700",
    color: colors.text.primary,
  },
  rankUp: {
    fontSize: 9,
    color: colors.success,
    fontWeight: "700",
  },
  rankDown: {
    fontSize: 9,
    color: colors.error,
    fontWeight: "700",
  },
  rankSame: {
    fontSize: 9,
    color: colors.gray[400],
  },

  // Player cell
  playerCell: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.text.primary,
  },

  // Table data cells
  tdCell: {
    fontSize: fontSize.sm,
    color: colors.text.primary,
    textAlign: "center",
  },
  tdMono: {
    fontSize: fontSize.sm,
    textAlign: "center",
    fontFamily: monoFont,
  },
  highlightedValue: {
    fontWeight: "700",
  },

  // Sort row
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  sortLabel: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginRight: spacing.xs,
  },
  sortChip: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray[100],
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  sortChipActive: {
    backgroundColor: colors.accent.blue,
    borderColor: colors.accent.blue,
  },
  sortChipText: {
    fontSize: fontSize.xs,
    fontWeight: "500",
    color: colors.text.secondary,
  },
  sortChipTextActive: {
    color: colors.text.inverse,
    fontWeight: "600",
  },

  // Course Records
  recordCard: {
    marginBottom: spacing.md,
  },
  recordHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.sm,
  },
  recordCourseName: {
    fontSize: fontSize.base,
    fontWeight: "700",
    color: colors.text.primary,
  },
  recordLayoutName: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  recordScoreBadge: {
    alignItems: "flex-end",
  },
  recordScore: {
    fontSize: fontSize["2xl"],
    fontWeight: "800",
  },
  recordStrokes: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
  },
  recordHolder: {
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
    paddingTop: spacing.sm,
  },
  recordHolderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  recordHolderName: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.text.primary,
  },
  recordDate: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
  },
  acesSection: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
  },
  acesTitle: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.accent.purple,
    marginBottom: spacing.xs,
  },
  aceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 3,
  },
  aceHole: {
    fontSize: fontSize.xs,
    fontWeight: "600",
    color: colors.text.primary,
    width: 50,
  },
  aceName: {
    fontSize: fontSize.xs,
    color: colors.accent.blue,
    fontWeight: "500",
    flex: 1,
  },
  aceDistance: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    fontFamily: monoFont,
  },
  aceDate: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
  },

  // Loading / empty
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxl * 2,
    gap: spacing.md,
  },
  loadingText: {
    fontSize: fontSize.base,
    color: colors.text.secondary,
  },
  emptyCard: {
    alignItems: "center",
    paddingVertical: spacing.xl,
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  emptyText: {
    fontSize: fontSize.base,
    color: colors.text.secondary,
    textAlign: "center",
  },
});
