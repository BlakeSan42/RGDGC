import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Animated,
  Alert,
  Image,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Card } from "@/components/common/Card";
import { Button } from "@/components/common/Button";
import { eventApi } from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import { colors, spacing, fontSize, borderRadius } from "@/constants/theme";
import type { EventDetail, EventResult, EventCheckin } from "@/types";
import { getScoreColor } from "@/types";

// ── Status Badge ──

function StatusBadge({ status }: { status: EventDetail["status"] }) {
  const config = {
    upcoming: { bg: colors.info, label: "Upcoming" },
    active: { bg: colors.success, label: "Live" },
    completed: { bg: colors.gray[500], label: "Completed" },
    cancelled: { bg: colors.error, label: "Cancelled" },
  }[status];

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <Text style={styles.badgeText}>{config.label}</Text>
    </View>
  );
}

// ── Pulse Dot (for Live indicator) ──

function PulseDot() {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View style={[styles.pulseDot, { opacity }]} />
  );
}

// ── Podium Card ──

function PodiumCard({ result, place }: { result: EventResult; place: 1 | 2 | 3 }) {
  const podiumColors = {
    1: "#FFD700",
    2: "#C0C0C0",
    3: "#CD7F32",
  };
  const podiumLabels = { 1: "1st", 2: "2nd", 3: "3rd" };
  const podiumEmojis = { 1: "\uD83E\uDD47", 2: "\uD83E\uDD48", 3: "\uD83E\uDD49" };

  return (
    <View style={[styles.podiumCard, { borderColor: podiumColors[place] }]}>
      <Text style={styles.podiumEmoji}>{podiumEmojis[place]}</Text>
      <Text style={styles.podiumPlace}>{podiumLabels[place]}</Text>
      <Text style={styles.podiumName} numberOfLines={1}>
        {result.player_name ?? `Player #${result.user_id}`}
      </Text>
      <Text style={[styles.podiumScore, { color: getScoreColor(result.total_score) }]}>
        {result.total_score > 0 ? `+${result.total_score}` : result.total_score === 0 ? "E" : result.total_score}
      </Text>
      <Text style={styles.podiumStrokes}>{result.total_strokes} strokes</Text>
      {result.points_earned != null && (
        <Text style={styles.podiumPoints}>{result.points_earned} pts</Text>
      )}
    </View>
  );
}

// ── Results Table ──

function ResultsTable({
  results,
  currentUserId,
}: {
  results: EventResult[];
  currentUserId: number | null;
}) {
  return (
    <View style={styles.table}>
      {/* Header */}
      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderCell, styles.colPos]}>#</Text>
        <Text style={[styles.tableHeaderCell, styles.colName]}>Player</Text>
        <Text style={[styles.tableHeaderCell, styles.colNum]}>Strks</Text>
        <Text style={[styles.tableHeaderCell, styles.colNum]}>Score</Text>
        <Text style={[styles.tableHeaderCell, styles.colNum]}>Pts</Text>
      </View>
      {/* Rows */}
      {results.map((r, i) => {
        const isMe = currentUserId != null && r.user_id === currentUserId;
        const isEven = i % 2 === 0;
        return (
          <View
            key={r.id}
            style={[
              styles.tableRow,
              isEven && styles.tableRowEven,
              isMe && styles.tableRowMe,
            ]}
          >
            <Text style={[styles.tableCell, styles.colPos]}>
              {r.dnf ? "DNF" : r.dq ? "DQ" : r.position ?? "-"}
            </Text>
            <Text
              style={[styles.tableCell, styles.colName, isMe && styles.tableCellMe]}
              numberOfLines={1}
            >
              {r.player_name ?? `Player #${r.user_id}`}
            </Text>
            <Text style={[styles.tableCell, styles.colNum]}>
              {r.dnf || r.dq ? "-" : r.total_strokes}
            </Text>
            <Text
              style={[
                styles.tableCell,
                styles.colNum,
                { color: r.dnf || r.dq ? colors.gray[400] : getScoreColor(r.total_score) },
              ]}
            >
              {r.dnf || r.dq
                ? "-"
                : r.total_score > 0
                  ? `+${r.total_score}`
                  : r.total_score === 0
                    ? "E"
                    : r.total_score}
            </Text>
            <Text style={[styles.tableCell, styles.colNum, styles.tableCellPoints]}>
              {r.points_earned ?? 0}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ── Player Avatar ──

function PlayerAvatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  if (avatarUrl) {
    return <Image source={{ uri: avatarUrl }} style={styles.avatar} />;
  }
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <View style={styles.avatarPlaceholder}>
      <Text style={styles.avatarInitials}>{initials || "?"}</Text>
    </View>
  );
}

// ── Main Screen ──

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [results, setResults] = useState<EventResult[]>([]);
  const [checkins, setCheckins] = useState<EventCheckin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [hasCheckedIn, setHasCheckedIn] = useState(false);

  const eventId = parseInt(id, 10);

  useEffect(() => {
    loadEvent();
  }, [eventId]);

  const loadEvent = async () => {
    setLoading(true);
    setError(null);
    try {
      const ev = await eventApi.get(eventId);
      setEvent(ev);

      if (ev.status === "completed") {
        const res = await eventApi.results(eventId);
        setResults(res.sort((a, b) => (a.position ?? 999) - (b.position ?? 999)));
      }

      if (ev.status === "upcoming" || ev.status === "active") {
        try {
          const ci = await eventApi.checkins(eventId);
          setCheckins(ci);
          if (user) {
            setHasCheckedIn(ci.some((c) => c.user_id === user.id));
          }
        } catch {
          // checkins endpoint may not be available yet
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load event");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckin = async () => {
    setCheckingIn(true);
    try {
      await eventApi.checkin(eventId);
      setHasCheckedIn(true);
      // Reload checkins
      try {
        const ci = await eventApi.checkins(eventId);
        setCheckins(ci);
      } catch {}
      Alert.alert("Checked In", "You're all set for this event!");
    } catch (e: unknown) {
      Alert.alert("Check-in Failed", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setCheckingIn(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  // ── Loading State ──
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading event...</Text>
      </View>
    );
  }

  // ── Error State ──
  if (error || !event) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error ?? "Event not found"}</Text>
        <Button title="Go Back" variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  // ── My result (for completed events) ──
  const myResult = user ? results.find((r) => r.user_id === user.id) : null;

  // Top 3 for podium
  const podiumResults = results.filter(
    (r) => r.position != null && r.position <= 3 && !r.dnf && !r.dq
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <StatusBadge status={event.status} />
          {event.status === "active" && (
            <View style={styles.liveRow}>
              <PulseDot />
              <Text style={styles.liveText}>Live</Text>
            </View>
          )}
        </View>
        <Text style={styles.eventTitle}>{event.name || "League Event"}</Text>
        <Text style={styles.eventDate}>{formatDate(event.event_date)}</Text>
        <Text style={styles.eventTime}>{formatTime(event.event_date)}</Text>
        {event.course_name && (
          <Text style={styles.eventCourse}>{event.course_name}{event.layout_name ? ` \u2022 ${event.layout_name}` : ""}</Text>
        )}
        {event.league_name && (
          <Text style={styles.eventLeague}>{event.league_name}</Text>
        )}
      </View>

      {/* ── Upcoming: Check-in Section ── */}
      {event.status === "upcoming" && (
        <View style={styles.section}>
          <Card elevated>
            <View style={styles.checkinHeader}>
              <Text style={styles.sectionTitle}>Check In</Text>
              <Text style={styles.checkinCount}>
                {checkins.length}{event.max_players ? ` of ${event.max_players}` : ""} checked in
              </Text>
            </View>

            {/* Entry Fee */}
            {(event.entry_fee != null || event.entry_fee_rgdg != null) && (
              <View style={styles.feeRow}>
                <Text style={styles.feeLabel}>Entry Fee</Text>
                <Text style={styles.feeValue}>
                  {event.entry_fee != null ? `$${event.entry_fee} USD` : ""}
                  {event.entry_fee != null && event.entry_fee_rgdg != null ? " or " : ""}
                  {event.entry_fee_rgdg != null ? `${event.entry_fee_rgdg} $RGDG` : ""}
                </Text>
              </View>
            )}

            {/* CTA */}
            {hasCheckedIn ? (
              <View style={styles.checkedInBanner}>
                <Text style={styles.checkedInText}>You're checked in</Text>
              </View>
            ) : (
              <Button
                title="Check In"
                variant="primary"
                size="lg"
                loading={checkingIn}
                onPress={handleCheckin}
                style={styles.checkinButton}
              />
            )}
          </Card>

          {/* Checked-in Players */}
          {checkins.length > 0 && (
            <Card style={styles.checkinList}>
              <Text style={styles.subsectionTitle}>Players</Text>
              {checkins.map((ci) => (
                <View key={ci.user_id} style={styles.playerRow}>
                  <PlayerAvatar
                    name={ci.display_name || ci.username}
                    avatarUrl={ci.avatar_url}
                  />
                  <Text style={styles.playerName}>
                    {ci.display_name || ci.username}
                  </Text>
                </View>
              ))}
            </Card>
          )}
        </View>
      )}

      {/* ── Active: Live Scores ── */}
      {event.status === "active" && (
        <View style={styles.section}>
          <Card elevated>
            <View style={styles.liveHeader}>
              <PulseDot />
              <Text style={styles.sectionTitle}>Event In Progress</Text>
            </View>

            {checkins.length > 0 && (
              <Text style={styles.activeCount}>{checkins.length} players on course</Text>
            )}

            <Button
              title="Score Round"
              variant="primary"
              size="lg"
              onPress={() => router.push("/scoring/select-course")}
              style={styles.scoreButton}
            />
          </Card>

          {/* Show checked-in players for active events too */}
          {checkins.length > 0 && (
            <Card style={styles.checkinList}>
              <Text style={styles.subsectionTitle}>Players</Text>
              {checkins.map((ci) => (
                <View key={ci.user_id} style={styles.playerRow}>
                  <PlayerAvatar
                    name={ci.display_name || ci.username}
                    avatarUrl={ci.avatar_url}
                  />
                  <Text style={styles.playerName}>
                    {ci.display_name || ci.username}
                  </Text>
                </View>
              ))}
            </Card>
          )}
        </View>
      )}

      {/* ── Completed: Results ── */}
      {event.status === "completed" && (
        <View style={styles.section}>
          {/* My Result (highlighted) */}
          {myResult && (
            <Card elevated style={styles.myResultCard}>
              <Text style={styles.myResultLabel}>My Result</Text>
              <View style={styles.myResultRow}>
                <View style={styles.myResultStat}>
                  <Text style={styles.myResultValue}>
                    {myResult.dnf ? "DNF" : myResult.dq ? "DQ" : `#${myResult.position}`}
                  </Text>
                  <Text style={styles.myResultCaption}>Position</Text>
                </View>
                <View style={styles.myResultStat}>
                  <Text
                    style={[
                      styles.myResultValue,
                      { color: getScoreColor(myResult.total_score) },
                    ]}
                  >
                    {myResult.total_score > 0
                      ? `+${myResult.total_score}`
                      : myResult.total_score === 0
                        ? "E"
                        : myResult.total_score}
                  </Text>
                  <Text style={styles.myResultCaption}>Score</Text>
                </View>
                <View style={styles.myResultStat}>
                  <Text style={styles.myResultValue}>{myResult.total_strokes}</Text>
                  <Text style={styles.myResultCaption}>Strokes</Text>
                </View>
                <View style={styles.myResultStat}>
                  <Text style={[styles.myResultValue, { color: colors.primary }]}>
                    {myResult.points_earned ?? 0}
                  </Text>
                  <Text style={styles.myResultCaption}>Points</Text>
                </View>
              </View>
            </Card>
          )}

          {/* Podium */}
          {podiumResults.length > 0 && (
            <View style={styles.podiumRow}>
              {podiumResults
                .sort((a, b) => (a.position ?? 99) - (b.position ?? 99))
                .map((r) => (
                  <PodiumCard
                    key={r.id}
                    result={r}
                    place={r.position as 1 | 2 | 3}
                  />
                ))}
            </View>
          )}

          {/* Full Results Table */}
          {results.length > 0 && (
            <Card>
              <Text style={styles.sectionTitle}>Full Results</Text>
              <ResultsTable results={results} currentUserId={user?.id ?? null} />
            </Card>
          )}
        </View>
      )}

      {/* ── General Info ── */}
      <View style={styles.section}>
        <Card>
          <Text style={styles.sectionTitle}>Event Info</Text>
          <View style={styles.infoGrid}>
            {event.format && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Format</Text>
                <Text style={styles.infoValue}>{event.format}</Text>
              </View>
            )}
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Players</Text>
              <Text style={styles.infoValue}>{event.num_players ?? 0}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Status</Text>
              <Text style={styles.infoValue}>{event.status}</Text>
            </View>
          </View>
          {event.notes && (
            <View style={styles.notesSection}>
              <Text style={styles.infoLabel}>Notes</Text>
              <Text style={styles.notesText}>{event.notes}</Text>
            </View>
          )}
        </Card>
      </View>

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

// ── Styles ──

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.secondary,
  },
  contentContainer: {
    paddingBottom: spacing.xxl,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
    gap: spacing.md,
    backgroundColor: colors.bg.secondary,
  },
  loadingText: {
    fontSize: fontSize.base,
    color: colors.text.secondary,
    marginTop: spacing.sm,
  },
  errorText: {
    fontSize: fontSize.base,
    color: colors.error,
    textAlign: "center",
    marginBottom: spacing.md,
  },

  // Header
  header: {
    backgroundColor: colors.bg.card,
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  badgeText: {
    fontSize: fontSize.xs,
    fontWeight: "700",
    color: colors.text.inverse,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  liveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.success,
  },
  liveText: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.success,
  },
  eventTitle: {
    fontSize: fontSize["2xl"],
    fontWeight: "700",
    color: colors.text.primary,
    marginBottom: 4,
  },
  eventDate: {
    fontSize: fontSize.base,
    color: colors.text.primary,
    fontWeight: "500",
  },
  eventTime: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  eventCourse: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: "600",
    marginTop: spacing.xs,
  },
  eventLeague: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },

  // Sections
  section: {
    padding: spacing.md,
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  subsectionTitle: {
    fontSize: fontSize.base,
    fontWeight: "600",
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },

  // Check-in
  checkinHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  checkinCount: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    fontWeight: "500",
  },
  feeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
    marginTop: spacing.sm,
  },
  feeLabel: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  feeValue: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.text.primary,
  },
  checkinButton: {
    marginTop: spacing.md,
  },
  checkedInBanner: {
    backgroundColor: colors.success + "18",
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: "center",
    marginTop: spacing.md,
  },
  checkedInText: {
    fontSize: fontSize.base,
    fontWeight: "600",
    color: colors.success,
  },
  checkinList: {
    marginTop: 0,
  },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xs + 2,
    minHeight: 44,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.gray[200],
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.text.inverse,
  },
  playerName: {
    fontSize: fontSize.base,
    color: colors.text.primary,
    fontWeight: "500",
  },

  // Active
  liveHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  activeCount: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  scoreButton: {
    marginTop: spacing.sm,
  },

  // My Result
  myResultCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  myResultLabel: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  myResultRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  myResultStat: {
    alignItems: "center",
  },
  myResultValue: {
    fontSize: fontSize["2xl"],
    fontWeight: "700",
    color: colors.text.primary,
    fontFamily: "monospace",
  },
  myResultCaption: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },

  // Podium
  podiumRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.sm,
  },
  podiumCard: {
    flex: 1,
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    padding: spacing.sm,
    alignItems: "center",
    maxWidth: 120,
  },
  podiumEmoji: {
    fontSize: 28,
  },
  podiumPlace: {
    fontSize: fontSize.xs,
    fontWeight: "700",
    color: colors.text.secondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  podiumName: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.text.primary,
    marginTop: 2,
    textAlign: "center",
  },
  podiumScore: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    fontFamily: "monospace",
    marginTop: 2,
  },
  podiumStrokes: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
  },
  podiumPoints: {
    fontSize: fontSize.xs,
    fontWeight: "600",
    color: colors.primary,
    marginTop: 2,
  },

  // Results Table
  table: {
    marginTop: spacing.xs,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 2,
    borderBottomColor: colors.gray[300],
    paddingBottom: spacing.xs,
    marginBottom: spacing.xs,
  },
  tableHeaderCell: {
    fontSize: fontSize.xs,
    fontWeight: "700",
    color: colors.text.secondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.xs + 2,
    minHeight: 44,
  },
  tableRowEven: {
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.sm,
  },
  tableRowMe: {
    backgroundColor: colors.primary + "14",
    borderRadius: borderRadius.sm,
  },
  tableCell: {
    fontSize: fontSize.sm,
    color: colors.text.primary,
  },
  tableCellMe: {
    fontWeight: "700",
    color: colors.primary,
  },
  tableCellPoints: {
    fontWeight: "600",
    color: colors.primary,
  },
  colPos: {
    width: 36,
    textAlign: "center",
  },
  colName: {
    flex: 1,
    paddingRight: spacing.xs,
  },
  colNum: {
    width: 50,
    textAlign: "right",
    fontFamily: "monospace",
  },

  // Info
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  infoItem: {
    minWidth: 80,
  },
  infoLabel: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: fontSize.base,
    fontWeight: "600",
    color: colors.text.primary,
  },
  notesSection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
  },
  notesText: {
    fontSize: fontSize.base,
    color: colors.text.primary,
    lineHeight: 22,
  },
});
