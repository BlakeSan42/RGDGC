/**
 * League Day Operations — Card assignments, CTP results, ace fund.
 *
 * Shows everything a player needs on league day:
 * - Their card assignment (who they're playing with)
 * - CTP results as they come in
 * - Ace fund balance + recent payouts
 * - Share results button
 */

import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Pressable,
  Share,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card } from "@/components/common/Card";
import { Button } from "@/components/common/Button";
import { leagueDayApi, eventApi } from "@/services/api";
import { colors, spacing, fontSize, borderRadius } from "@/constants/theme";
import type {
  CardAssignment,
  CTPResult,
  AceFundBalance,
  EventDetail,
} from "@/types";

type Tab = "cards" | "ctp" | "ace-fund";

export default function LeagueDayScreen() {
  const { eventId, eventName } = useLocalSearchParams<{
    eventId: string;
    eventName?: string;
  }>();

  const [tab, setTab] = useState<Tab>("cards");
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [cards, setCards] = useState<CardAssignment[]>([]);
  const [ctpResults, setCtpResults] = useState<CTPResult[]>([]);
  const [aceFund, setAceFund] = useState<AceFundBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!eventId) return;
    const eid = Number(eventId);
    setError(null);
    try {
      const [ev, cardData, ctpData, fundData] = await Promise.allSettled([
        eventApi.get(eid),
        leagueDayApi.cardAssignments(eid),
        leagueDayApi.ctpResults(eid),
        leagueDayApi.aceFundBalance(),
      ]);

      if (ev.status === "fulfilled") setEvent(ev.value);
      if (cardData.status === "fulfilled") setCards(cardData.value);
      if (ctpData.status === "fulfilled") setCtpResults(ctpData.value);
      if (fundData.status === "fulfilled") setAceFund(fundData.value);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleShare = async () => {
    try {
      const result = await leagueDayApi.shareResults(Number(eventId));
      await Share.share({ message: result.text });
    } catch {
      // User cancelled or API error — silent
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
        <Text style={styles.errorText}>{error}</Text>
        <Button title="Go Back" onPress={() => router.back()} variant="secondary" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>League Day</Text>
          <Text style={styles.headerSubtitle}>
            {eventName || event?.name || `Event #${eventId}`}
          </Text>
        </View>
        <Pressable onPress={handleShare} hitSlop={8}>
          <Ionicons name="share-outline" size={22} color={colors.primary} />
        </Pressable>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {(
          [
            { key: "cards", label: "Cards", icon: "people-outline" },
            { key: "ctp", label: "CTP", icon: "flag-outline" },
            { key: "ace-fund", label: "Ace Fund", icon: "cash-outline" },
          ] as const
        ).map((t) => (
          <Pressable
            key={t.key}
            onPress={() => setTab(t.key)}
            style={[styles.tabItem, tab === t.key && styles.tabItemActive]}
          >
            <Ionicons
              name={t.icon}
              size={18}
              color={tab === t.key ? colors.primary : colors.gray[400]}
            />
            <Text
              style={[
                styles.tabLabel,
                tab === t.key && styles.tabLabelActive,
              ]}
            >
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {tab === "cards" && <CardsTab cards={cards} />}
        {tab === "ctp" && <CTPTab results={ctpResults} />}
        {tab === "ace-fund" && <AceFundTab fund={aceFund} />}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Cards Tab ──

function CardsTab({ cards }: { cards: CardAssignment[] }) {
  if (cards.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="people-outline" size={48} color={colors.gray[300]} />
        <Text style={styles.emptyTitle}>No Card Assignments Yet</Text>
        <Text style={styles.emptyText}>
          Card assignments will appear here once the admin sets them up.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        {cards.length} Card{cards.length !== 1 ? "s" : ""}
      </Text>
      {cards.map((card) => (
        <Card key={card.card_number}>
          <View style={styles.cardHeader}>
            <View style={styles.cardNumberBadge}>
              <Text style={styles.cardNumberText}>{card.card_number}</Text>
            </View>
            <Text style={styles.cardTitle}>Card {card.card_number}</Text>
            {card.starting_hole && (
              <Text style={styles.startingHole}>
                Hole {card.starting_hole}
              </Text>
            )}
          </View>
          {card.players.map((player, i) => (
            <View
              key={player.id}
              style={[
                styles.playerRow,
                i === card.players.length - 1 && { borderBottomWidth: 0 },
              ]}
            >
              <View style={styles.playerInfo}>
                <Text style={styles.playerName}>
                  {player.display_name || player.username}
                </Text>
                {player.handicap != null && (
                  <Text style={styles.playerHandicap}>
                    HC: {player.handicap > 0 ? "+" : ""}
                    {player.handicap}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </Card>
      ))}
    </View>
  );
}

// ── CTP Tab ──

function CTPTab({ results }: { results: CTPResult[] }) {
  if (results.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="flag-outline" size={48} color={colors.gray[300]} />
        <Text style={styles.emptyTitle}>No CTP Results Yet</Text>
        <Text style={styles.emptyText}>
          Closest to Pin measurements will appear here as they're recorded.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Closest to Pin</Text>
      {results.map((r) => (
        <Card key={r.hole_number}>
          <View style={styles.ctpRow}>
            <View style={styles.ctpHole}>
              <Text style={styles.ctpHoleLabel}>Hole</Text>
              <Text style={styles.ctpHoleNumber}>{r.hole_number}</Text>
            </View>
            <View style={styles.ctpDetails}>
              <Text style={styles.ctpWinner}>{r.winner_name}</Text>
              <Text style={styles.ctpDistance}>{r.distance}</Text>
            </View>
            {r.pot != null && r.pot > 0 && (
              <View style={styles.ctpPot}>
                <Text style={styles.ctpPotAmount}>
                  ${r.pot.toFixed(0)}
                </Text>
              </View>
            )}
          </View>
        </Card>
      ))}
    </View>
  );
}

// ── Ace Fund Tab ──

function AceFundTab({ fund }: { fund: AceFundBalance | null }) {
  if (!fund) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="cash-outline" size={48} color={colors.gray[300]} />
        <Text style={styles.emptyTitle}>Ace Fund</Text>
        <Text style={styles.emptyText}>
          Ace fund information is not available yet.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      {/* Balance Hero Card */}
      <Card>
        <View style={styles.aceFundHero}>
          <Text style={styles.aceFundLabel}>Current Ace Fund</Text>
          <Text style={styles.aceFundBalance}>
            ${fund.balance.toFixed(2)}
          </Text>
          <Text style={styles.aceFundNote}>{fund.note}</Text>
        </View>
      </Card>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <Card>
          <View style={styles.statBox}>
            <Text style={styles.statBoxValue}>
              ${fund.total_collected.toFixed(0)}
            </Text>
            <Text style={styles.statBoxLabel}>Total Collected</Text>
          </View>
        </Card>
        <Card>
          <View style={styles.statBox}>
            <Text style={styles.statBoxValue}>
              ${fund.total_paid_out.toFixed(0)}
            </Text>
            <Text style={styles.statBoxLabel}>Total Paid Out</Text>
          </View>
        </Card>
      </View>

      {/* Info */}
      <Card>
        <View style={styles.infoRow}>
          <Ionicons
            name="information-circle-outline"
            size={20}
            color={colors.info}
          />
          <Text style={styles.infoText}>
            $1 per player per event goes to the ace fund. Hit an ace during a
            league round to win the entire pot!
          </Text>
        </View>
      </Card>
    </View>
  );
}

// ── Styles ──

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.secondary },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
    backgroundColor: colors.bg.secondary,
    gap: spacing.md,
  },
  errorText: {
    fontSize: fontSize.base,
    color: colors.text.secondary,
    textAlign: "center",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bg.primary,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[200],
  },
  headerCenter: { flex: 1, marginLeft: spacing.md },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.text.primary,
  },
  headerSubtitle: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
  },

  // Tabs
  tabBar: {
    flexDirection: "row",
    backgroundColor: colors.bg.primary,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[200],
    paddingHorizontal: spacing.sm,
  },
  tabItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabItemActive: {
    borderBottomColor: colors.primary,
  },
  tabLabel: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.gray[400],
  },
  tabLabelActive: {
    color: colors.primary,
  },

  // Content
  content: { flex: 1 },
  section: { padding: spacing.md, gap: spacing.sm },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },

  // Empty state
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.text.primary,
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    textAlign: "center",
    lineHeight: 20,
  },

  // Card assignments
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  cardNumberBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  cardNumberText: {
    color: "#FFFFFF",
    fontSize: fontSize.sm,
    fontWeight: "700",
  },
  cardTitle: {
    fontSize: fontSize.base,
    fontWeight: "700",
    color: colors.text.primary,
    flex: 1,
  },
  startingHole: {
    fontSize: fontSize.xs,
    fontWeight: "600",
    color: colors.secondary,
    backgroundColor: "rgba(255,107,53,0.1)",
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[100],
  },
  playerInfo: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  playerName: {
    fontSize: fontSize.base,
    color: colors.text.primary,
    fontWeight: "500",
  },
  playerHandicap: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    fontWeight: "600",
  },

  // CTP
  ctpRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  ctpHole: { alignItems: "center", width: 44 },
  ctpHoleLabel: {
    fontSize: 9,
    fontWeight: "600",
    color: colors.text.secondary,
    textTransform: "uppercase",
  },
  ctpHoleNumber: {
    fontSize: fontSize["2xl"],
    fontWeight: "800",
    color: colors.primary,
  },
  ctpDetails: { flex: 1 },
  ctpWinner: {
    fontSize: fontSize.base,
    fontWeight: "600",
    color: colors.text.primary,
  },
  ctpDistance: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  ctpPot: {
    backgroundColor: "rgba(76,175,80,0.1)",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  ctpPotAmount: {
    fontSize: fontSize.base,
    fontWeight: "700",
    color: colors.success,
  },

  // Ace Fund
  aceFundHero: {
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  aceFundLabel: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.text.secondary,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  aceFundBalance: {
    fontSize: 48,
    fontWeight: "800",
    color: colors.primary,
    fontVariant: ["tabular-nums"],
    marginVertical: spacing.xs,
  },
  aceFundNote: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    textAlign: "center",
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  statBox: {
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  statBoxValue: {
    fontSize: fontSize.xl,
    fontWeight: "700",
    color: colors.text.primary,
    fontVariant: ["tabular-nums"],
  },
  statBoxLabel: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    fontWeight: "600",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  infoText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
  },
});
