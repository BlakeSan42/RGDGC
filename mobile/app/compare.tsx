import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Modal,
  FlatList,
  Share,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Card } from "@/components/common/Card";
import { Avatar } from "@/components/common/Avatar";
import { Button } from "@/components/common/Button";
import { playerApi } from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import { colors, spacing, fontSize, borderRadius } from "@/constants/theme";
import type { PlayerComparison, HeadToHeadResult, PlayerProfile } from "@/types";

// ── Comparison data structure ──
interface ComparisonData {
  player1: PlayerComparison;
  player2: PlayerComparison;
  headToHead: HeadToHeadResult[];
}

export default function CompareScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [player1Id, setPlayer1Id] = useState<number | null>(user?.id ?? null);
  const [player2Id, setPlayer2Id] = useState<number | null>(null);
  const [player1Profile, setPlayer1Profile] = useState<PlayerProfile | null>(null);
  const [player2Profile, setPlayer2Profile] = useState<PlayerProfile | null>(null);
  const [comparison, setComparison] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Player search modal
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [searchModalTarget, setSearchModalTarget] = useState<1 | 2>(2);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PlayerProfile[]>([]);
  const [searching, setSearching] = useState(false);

  // ── Load player profiles ──
  useEffect(() => {
    if (player1Id) {
      playerApi.profile(player1Id).then(setPlayer1Profile).catch(() => {});
    }
  }, [player1Id]);

  useEffect(() => {
    if (player2Id) {
      playerApi.profile(player2Id).then(setPlayer2Profile).catch(() => {});
    }
  }, [player2Id]);

  // ── Load comparison ──
  useEffect(() => {
    if (!player1Id || !player2Id) {
      setComparison(null);
      return;
    }

    const loadComparison = async () => {
      setLoading(true);
      setError(null);
      try {
        const [compData, h2hData] = await Promise.all([
          playerApi.compare(player1Id, player2Id),
          playerApi.headToHead(player1Id, player2Id),
        ]);
        setComparison({
          player1: compData.player1,
          player2: compData.player2,
          headToHead: h2hData,
        });
      } catch {
        setError("Unable to load comparison data.");
      } finally {
        setLoading(false);
      }
    };

    loadComparison();
  }, [player1Id, player2Id]);

  // ── Search handler ──
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const results = await playerApi.search(query);
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const selectPlayer = (player: PlayerProfile) => {
    if (searchModalTarget === 1) {
      setPlayer1Id(Number(player.id));
      setPlayer1Profile(player);
    } else {
      setPlayer2Id(Number(player.id));
      setPlayer2Profile(player);
    }
    setSearchModalVisible(false);
    setSearchQuery("");
    setSearchResults([]);
  };

  // ── Share ──
  const handleShare = async () => {
    if (!comparison) return;
    const p1 = comparison.player1.player.display_name;
    const p2 = comparison.player2.player.display_name;

    const text = [
      `Player Comparison: ${p1} vs ${p2}`,
      "",
      `Handicap: ${comparison.player1.player.handicap ?? "-"} vs ${comparison.player2.player.handicap ?? "-"}`,
      `Avg Score: ${comparison.player1.scoring.average_score?.toFixed(1) ?? "-"} vs ${comparison.player2.scoring.average_score?.toFixed(1) ?? "-"}`,
      `C1X%: ${comparison.player1.putting.c1x_percentage?.toFixed(1) ?? "-"} vs ${comparison.player2.putting.c1x_percentage?.toFixed(1) ?? "-"}`,
      `Season Pts: ${comparison.player1.league.season_points} vs ${comparison.player2.league.season_points}`,
      "",
      "-- RGDGC Mobile",
    ].join("\n");

    await Share.share({ message: text });
  };

  // ── Stat comparison row ──
  const StatRow = ({
    label,
    value1,
    value2,
    higherIsBetter = true,
    formatFn,
  }: {
    label: string;
    value1: number | null;
    value2: number | null;
    higherIsBetter?: boolean;
    formatFn?: (v: number) => string;
  }) => {
    const v1 = value1;
    const v2 = value2;
    const format = formatFn ?? ((v: number) => String(v));

    let p1Better = false;
    let p2Better = false;

    if (v1 !== null && v2 !== null && v1 !== v2) {
      if (higherIsBetter) {
        p1Better = v1 > v2;
        p2Better = v2 > v1;
      } else {
        p1Better = v1 < v2;
        p2Better = v2 < v1;
      }
    }

    // Calculate bar width proportion
    let barRatio = 0.5;
    if (v1 !== null && v2 !== null && (v1 + v2) > 0) {
      barRatio = v1 / (v1 + v2);
    }

    return (
      <View style={styles.statRow}>
        <View style={styles.statValueContainer}>
          <Text
            style={[
              styles.statValue,
              { fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
              p1Better && styles.statBetter,
              p2Better && styles.statWorse,
            ]}
          >
            {v1 !== null ? format(v1) : "-"}
          </Text>
        </View>

        <View style={styles.statLabelContainer}>
          <Text style={styles.statLabel}>{label}</Text>
          {/* Comparison bar */}
          {v1 !== null && v2 !== null && (
            <View style={styles.comparisonBar}>
              <View
                style={[
                  styles.comparisonBarLeft,
                  {
                    flex: barRatio,
                    backgroundColor: p1Better ? colors.primary + "80" : colors.gray[300],
                  },
                ]}
              />
              <View
                style={[
                  styles.comparisonBarRight,
                  {
                    flex: 1 - barRatio,
                    backgroundColor: p2Better ? colors.primary + "80" : colors.gray[300],
                  },
                ]}
              />
            </View>
          )}
        </View>

        <View style={styles.statValueContainer}>
          <Text
            style={[
              styles.statValue,
              { fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
              p2Better && styles.statBetter,
              p1Better && styles.statWorse,
            ]}
          >
            {v2 !== null ? format(v2) : "-"}
          </Text>
        </View>
      </View>
    );
  };

  // ── Player selector slot ──
  const PlayerSlot = ({
    profile,
    side,
    onPress,
  }: {
    profile: PlayerProfile | null;
    side: 1 | 2;
    onPress: () => void;
  }) => (
    <Pressable style={styles.playerSlot} onPress={onPress}>
      {profile ? (
        <>
          <Avatar
            name={profile.display_name}
            uri={profile.avatar_url ?? undefined}
            size="lg"
          />
          <Text style={styles.slotName} numberOfLines={1}>{profile.display_name}</Text>
          {profile.handicap !== null && (
            <Text style={styles.slotHandicap}>HC: {profile.handicap}</Text>
          )}
        </>
      ) : (
        <View style={styles.emptySlot}>
          <View style={styles.emptyAvatarCircle}>
            <Text style={styles.emptyAvatarPlus}>+</Text>
          </View>
          <Text style={styles.emptySlotText}>Select Player</Text>
        </View>
      )}
    </Pressable>
  );

  // ── Search modal ──
  const renderSearchModal = () => (
    <Modal
      visible={searchModalVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setSearchModalVisible(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Select Player</Text>
          <Pressable onPress={() => setSearchModalVisible(false)}>
            <Text style={styles.modalClose}>Cancel</Text>
          </Pressable>
        </View>

        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name..."
            placeholderTextColor={colors.text.disabled}
            value={searchQuery}
            onChangeText={handleSearch}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {searching ? (
          <View style={styles.searchLoading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={searchResults}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <Pressable
                style={styles.searchResultRow}
                onPress={() => selectPlayer(item)}
              >
                <Avatar name={item.display_name} uri={item.avatar_url ?? undefined} size="md" />
                <View style={styles.searchResultInfo}>
                  <Text style={styles.searchResultName}>{item.display_name}</Text>
                  <Text style={styles.searchResultMeta}>
                    @{item.username}
                    {item.handicap !== null && ` · HC: ${item.handicap}`}
                  </Text>
                </View>
              </Pressable>
            )}
            ListEmptyComponent={
              searchQuery.length >= 2 ? (
                <Text style={styles.searchEmpty}>No players found.</Text>
              ) : (
                <Text style={styles.searchEmpty}>Type at least 2 characters to search.</Text>
              )
            }
          />
        )}
      </View>
    </Modal>
  );

  // ── Head to head section ──
  const renderHeadToHead = () => {
    if (!comparison || comparison.headToHead.length === 0) return null;

    let p1Wins = 0;
    let p2Wins = 0;
    let draws = 0;
    comparison.headToHead.forEach((r) => {
      if (r.player1_position !== null && r.player2_position !== null) {
        if (r.player1_position < r.player2_position) p1Wins++;
        else if (r.player2_position < r.player1_position) p2Wins++;
        else draws++;
      }
    });

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Head to Head</Text>

        {/* Record summary */}
        <Card elevated>
          <View style={styles.h2hSummary}>
            <View style={styles.h2hSummaryItem}>
              <Text style={[styles.h2hWins, { color: p1Wins > p2Wins ? colors.primary : colors.text.primary }]}>
                {p1Wins}
              </Text>
              <Text style={styles.h2hLabel}>Wins</Text>
            </View>
            <View style={styles.h2hSummaryItem}>
              <Text style={styles.h2hDraws}>{draws}</Text>
              <Text style={styles.h2hLabel}>Draws</Text>
            </View>
            <View style={styles.h2hSummaryItem}>
              <Text style={[styles.h2hWins, { color: p2Wins > p1Wins ? colors.primary : colors.text.primary }]}>
                {p2Wins}
              </Text>
              <Text style={styles.h2hLabel}>Wins</Text>
            </View>
          </View>

          {/* Individual events */}
          {comparison.headToHead.map((match) => (
            <View key={match.event_id} style={styles.h2hRow}>
              <Text
                style={[
                  styles.h2hScore,
                  {
                    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
                    color:
                      match.player1_position !== null &&
                      match.player2_position !== null &&
                      match.player1_position < match.player2_position
                        ? colors.primary
                        : colors.text.secondary,
                  },
                ]}
              >
                {match.player1_position ?? "-"}
              </Text>
              <View style={styles.h2hEventInfo}>
                <Text style={styles.h2hEventName} numberOfLines={1}>
                  {match.event_name}
                </Text>
                <Text style={styles.h2hEventDate}>
                  {new Date(match.event_date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </Text>
              </View>
              <Text
                style={[
                  styles.h2hScore,
                  {
                    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
                    color:
                      match.player1_position !== null &&
                      match.player2_position !== null &&
                      match.player2_position < match.player1_position
                        ? colors.primary
                        : colors.text.secondary,
                  },
                ]}
              >
                {match.player2_position ?? "-"}
              </Text>
            </View>
          ))}
        </Card>
      </View>
    );
  };

  // ── Main render ──
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Player selector header */}
      <View style={styles.selectorRow}>
        <PlayerSlot
          profile={player1Profile}
          side={1}
          onPress={() => {
            setSearchModalTarget(1);
            setSearchModalVisible(true);
          }}
        />
        <View style={styles.vsBadge}>
          <Text style={styles.vsText}>VS</Text>
        </View>
        <PlayerSlot
          profile={player2Profile}
          side={2}
          onPress={() => {
            setSearchModalTarget(2);
            setSearchModalVisible(true);
          }}
        />
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading comparison...</Text>
        </View>
      ) : error ? (
        <Card style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </Card>
      ) : !comparison ? (
        <Card style={styles.promptCard}>
          <Text style={styles.promptTitle}>Compare Players</Text>
          <Text style={styles.promptText}>
            Select two players to see a detailed side-by-side comparison of their stats, putting, and league performance.
          </Text>
        </Card>
      ) : (
        <>
          {/* Overview Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Overview</Text>
            <Card elevated>
              <StatRow
                label="Handicap"
                value1={comparison.player1.player.handicap}
                value2={comparison.player2.player.handicap}
                higherIsBetter={false}
                formatFn={(v) => v.toFixed(1)}
              />
              <StatRow
                label="Total Rounds"
                value1={comparison.player1.scoring.total_rounds}
                value2={comparison.player2.scoring.total_rounds}
              />
              <StatRow
                label="Member Since"
                value1={new Date(comparison.player1.player.member_since).getFullYear()}
                value2={new Date(comparison.player2.player.member_since).getFullYear()}
                higherIsBetter={false}
                formatFn={(v) => String(v)}
              />
            </Card>
          </View>

          {/* Scoring Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Scoring</Text>
            <Card elevated>
              <StatRow
                label="Avg Score"
                value1={comparison.player1.scoring.average_score}
                value2={comparison.player2.scoring.average_score}
                higherIsBetter={false}
                formatFn={(v) => (v > 0 ? `+${v.toFixed(1)}` : v.toFixed(1))}
              />
              <StatRow
                label="Best Round"
                value1={comparison.player1.scoring.best_round}
                value2={comparison.player2.scoring.best_round}
                higherIsBetter={false}
                formatFn={(v) => (v > 0 ? `+${v}` : String(v))}
              />
              <StatRow
                label="Under Par Rds"
                value1={comparison.player1.scoring.under_par_rounds}
                value2={comparison.player2.scoring.under_par_rounds}
              />
              <StatRow
                label="Aces"
                value1={comparison.player1.scoring.aces}
                value2={comparison.player2.scoring.aces}
              />
            </Card>
          </View>

          {/* Putting Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Putting</Text>
            <Card elevated>
              <StatRow
                label="C1X%"
                value1={comparison.player1.putting.c1x_percentage}
                value2={comparison.player2.putting.c1x_percentage}
                formatFn={(v) => `${v.toFixed(1)}%`}
              />
              <StatRow
                label="C2%"
                value1={comparison.player1.putting.c2_percentage}
                value2={comparison.player2.putting.c2_percentage}
                formatFn={(v) => `${v.toFixed(1)}%`}
              />
              <StatRow
                label="SG Putting"
                value1={comparison.player1.putting.strokes_gained_putting}
                value2={comparison.player2.putting.strokes_gained_putting}
                formatFn={(v) => (v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2))}
              />
            </Card>
          </View>

          {/* League Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>League</Text>
            <Card elevated>
              <StatRow
                label="Season Pts"
                value1={comparison.player1.league.season_points}
                value2={comparison.player2.league.season_points}
              />
              <StatRow
                label="Wins"
                value1={comparison.player1.league.wins}
                value2={comparison.player2.league.wins}
              />
              <StatRow
                label="Podiums"
                value1={comparison.player1.league.podiums}
                value2={comparison.player2.league.podiums}
              />
              <StatRow
                label="Best Finish"
                value1={comparison.player1.league.best_finish}
                value2={comparison.player2.league.best_finish}
                higherIsBetter={false}
                formatFn={(v) => `#${v}`}
              />
            </Card>
          </View>

          {/* Head to Head */}
          {renderHeadToHead()}

          {/* Share button */}
          <View style={styles.shareContainer}>
            <Button title="Share Comparison" onPress={handleShare} variant="secondary" />
          </View>
        </>
      )}

      <View style={{ height: spacing.xxl }} />

      {renderSearchModal()}
    </ScrollView>
  );
}

// ── Styles ──
const monoFont = Platform.OS === "ios" ? "Menlo" : "monospace";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.secondary,
  },
  scrollContent: {
    padding: spacing.md,
  },

  // Player selector
  selectorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  playerSlot: {
    flex: 1,
    alignItems: "center",
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray[200],
    minHeight: 130,
    justifyContent: "center",
  },
  slotName: {
    fontSize: fontSize.base,
    fontWeight: "600",
    color: colors.text.primary,
    marginTop: spacing.sm,
    textAlign: "center",
  },
  slotHandicap: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },
  emptySlot: {
    alignItems: "center",
  },
  emptyAvatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: colors.gray[300],
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyAvatarPlus: {
    fontSize: fontSize["2xl"],
    color: colors.gray[400],
    fontWeight: "300",
  },
  emptySlotText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.sm,
  },
  vsBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.secondary,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
    marginHorizontal: -spacing.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  vsText: {
    color: colors.text.inverse,
    fontSize: fontSize.sm,
    fontWeight: "800",
  },

  // Section
  section: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },

  // Stat rows
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  statValueContainer: {
    width: 70,
    alignItems: "center",
  },
  statValue: {
    fontSize: fontSize.base,
    fontWeight: "600",
    color: colors.text.primary,
  },
  statBetter: {
    color: colors.primary,
    fontWeight: "800",
  },
  statWorse: {
    color: colors.error + "90",
    fontWeight: "500",
  },
  statLabelContainer: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: spacing.xs,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    fontWeight: "500",
    textAlign: "center",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  comparisonBar: {
    flexDirection: "row",
    width: "100%",
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  comparisonBarLeft: {
    height: "100%",
    borderTopLeftRadius: 2,
    borderBottomLeftRadius: 2,
  },
  comparisonBarRight: {
    height: "100%",
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },

  // Head to head
  h2hSummary: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
    marginBottom: spacing.sm,
  },
  h2hSummaryItem: {
    alignItems: "center",
  },
  h2hWins: {
    fontSize: fontSize["2xl"],
    fontWeight: "800",
    fontFamily: monoFont,
  },
  h2hDraws: {
    fontSize: fontSize["2xl"],
    fontWeight: "700",
    color: colors.text.secondary,
    fontFamily: monoFont,
  },
  h2hLabel: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },
  h2hRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  h2hScore: {
    width: 40,
    textAlign: "center",
    fontSize: fontSize.base,
    fontWeight: "700",
  },
  h2hEventInfo: {
    flex: 1,
    alignItems: "center",
  },
  h2hEventName: {
    fontSize: fontSize.sm,
    fontWeight: "500",
    color: colors.text.primary,
  },
  h2hEventDate: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
  },

  // Share
  shareContainer: {
    marginTop: spacing.md,
    alignItems: "center",
  },

  // Loading / error / prompt
  loadingContainer: {
    alignItems: "center",
    paddingVertical: spacing.xxl * 2,
    gap: spacing.md,
  },
  loadingText: {
    fontSize: fontSize.base,
    color: colors.text.secondary,
  },
  errorCard: {
    alignItems: "center",
    paddingVertical: spacing.xl,
  },
  errorText: {
    fontSize: fontSize.base,
    color: colors.error,
    textAlign: "center",
  },
  promptCard: {
    alignItems: "center",
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  promptTitle: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  promptText: {
    fontSize: fontSize.base,
    color: colors.text.secondary,
    textAlign: "center",
    lineHeight: 22,
  },

  // Search Modal
  modalContainer: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.text.primary,
  },
  modalClose: {
    fontSize: fontSize.base,
    color: colors.secondary,
    fontWeight: "600",
  },
  searchBar: {
    padding: spacing.md,
  },
  searchInput: {
    backgroundColor: colors.gray[100],
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: fontSize.base,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  searchLoading: {
    paddingVertical: spacing.xl,
    alignItems: "center",
  },
  searchResultRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultName: {
    fontSize: fontSize.base,
    fontWeight: "600",
    color: colors.text.primary,
  },
  searchResultMeta: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  searchEmpty: {
    textAlign: "center",
    color: colors.text.secondary,
    fontSize: fontSize.base,
    paddingVertical: spacing.xl,
  },
});
