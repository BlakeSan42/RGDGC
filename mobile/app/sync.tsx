import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/common/Button";
import { useOffline } from "@/context/OfflineContext";
import { useSync } from "@/hooks/useSync";
import { getPendingRounds, getPendingPutts, type OfflineRound } from "@/services/offline";
import type { PuttAttempt } from "@/types";
import { colors, spacing, fontSize, borderRadius } from "@/constants/theme";

function formatRelativeTime(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${diffDays}d ago`;
}

export default function SyncScreen() {
  const { isOnline, isSyncing, pendingRoundsCount, pendingPuttsCount, lastSync } =
    useOffline();
  const { sync } = useSync();

  const [pendingRounds, setPendingRounds] = useState<OfflineRound[]>([]);
  const [pendingPutts, setPendingPutts] = useState<PuttAttempt[]>([]);

  useEffect(() => {
    loadPendingData();
  }, [pendingRoundsCount, pendingPuttsCount]);

  const loadPendingData = async () => {
    const [rounds, putts] = await Promise.all([
      getPendingRounds(),
      getPendingPutts(),
    ]);
    setPendingRounds(rounds);
    setPendingPutts(putts);
  };

  const totalPending = pendingRoundsCount + pendingPuttsCount;

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: isOnline ? colors.success : colors.warning },
              ]}
            />
            <Text style={styles.statusText}>
              {isOnline ? "Online" : "Offline"}
            </Text>
          </View>

          {lastSync && (
            <Text style={styles.lastSyncText}>
              Last sync: {formatRelativeTime(lastSync)}
            </Text>
          )}
          {!lastSync && (
            <Text style={styles.lastSyncText}>Never synced</Text>
          )}
        </View>

        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Ionicons name="golf-outline" size={28} color={colors.primary} />
            <Text style={styles.summaryCount}>{pendingRoundsCount}</Text>
            <Text style={styles.summaryLabel}>Pending Rounds</Text>
          </View>
          <View style={styles.summaryCard}>
            <Ionicons name="disc-outline" size={28} color={colors.secondary} />
            <Text style={styles.summaryCount}>{pendingPuttsCount}</Text>
            <Text style={styles.summaryLabel}>Pending Putts</Text>
          </View>
        </View>

        {/* Sync Button */}
        <View style={styles.syncButtonContainer}>
          {isSyncing ? (
            <View style={styles.syncingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.syncingText}>Syncing...</Text>
            </View>
          ) : (
            <Button
              title={
                totalPending === 0
                  ? "All Synced"
                  : `Sync Now (${totalPending} item${totalPending !== 1 ? "s" : ""})`
              }
              onPress={sync}
              variant={totalPending === 0 ? "ghost" : "primary"}
              size="lg"
            />
          )}
        </View>

        {/* Pending Rounds List */}
        {pendingRounds.length > 0 && (
          <>
            <Text style={styles.sectionHeader}>PENDING ROUNDS</Text>
            <View style={styles.listSection}>
              {pendingRounds.map((round, index) => (
                <View key={round.id}>
                  {index > 0 && <View style={styles.divider} />}
                  <View style={styles.listItem}>
                    <View style={styles.listItemLeft}>
                      <Ionicons
                        name="time-outline"
                        size={20}
                        color={colors.warning}
                      />
                      <View style={styles.listItemInfo}>
                        <Text style={styles.listItemTitle}>
                          Layout #{round.layout_id} {round.is_practice ? "(Practice)" : ""}
                        </Text>
                        <Text style={styles.listItemSubtitle}>
                          {round.scores.length} holes · {round.total_strokes} strokes ·{" "}
                          {round.total_score > 0 ? "+" : ""}
                          {round.total_score === 0 ? "E" : round.total_score}
                        </Text>
                        <Text style={styles.listItemDate}>
                          {formatRelativeTime(round.completed_at)}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Pending Putts Summary */}
        {pendingPutts.length > 0 && (
          <>
            <Text style={styles.sectionHeader}>PENDING PUTTS</Text>
            <View style={styles.listSection}>
              <View style={styles.listItem}>
                <View style={styles.listItemLeft}>
                  <Ionicons
                    name="analytics-outline"
                    size={20}
                    color={colors.warning}
                  />
                  <View style={styles.listItemInfo}>
                    <Text style={styles.listItemTitle}>
                      {pendingPutts.length} putt attempt
                      {pendingPutts.length !== 1 ? "s" : ""}
                    </Text>
                    <Text style={styles.listItemSubtitle}>
                      {pendingPutts.filter((p) => p.made).length} makes /{" "}
                      {pendingPutts.filter((p) => !p.made).length} misses
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </>
        )}

        {/* Empty State */}
        {totalPending === 0 && (
          <View style={styles.emptyState}>
            <Ionicons
              name="checkmark-circle-outline"
              size={64}
              color={colors.success}
            />
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptySubtitle}>
              All your rounds and putts are synced to the server.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.secondary,
  },
  content: {
    paddingBottom: spacing.xxl,
  },
  statusCard: {
    backgroundColor: colors.bg.primary,
    margin: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.gray[200],
    alignItems: "center",
    gap: spacing.xs,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    color: colors.text.primary,
  },
  lastSyncText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  summaryRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.gray[200],
    alignItems: "center",
    gap: spacing.xs,
  },
  summaryCount: {
    fontSize: fontSize["2xl"],
    fontWeight: "700",
    color: colors.text.primary,
  },
  summaryLabel: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    fontWeight: "500",
  },
  syncButtonContainer: {
    padding: spacing.md,
  },
  syncingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  syncingText: {
    fontSize: fontSize.base,
    color: colors.text.secondary,
    fontWeight: "500",
  },
  sectionHeader: {
    fontSize: fontSize.xs,
    fontWeight: "600",
    color: colors.text.secondary,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
    letterSpacing: 0.5,
  },
  listSection: {
    backgroundColor: colors.bg.primary,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.gray[200],
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    minHeight: 56,
  },
  listItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
  },
  listItemInfo: {
    flex: 1,
  },
  listItemTitle: {
    fontSize: fontSize.base,
    fontWeight: "500",
    color: colors.text.primary,
  },
  listItemSubtitle: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginTop: 1,
  },
  listItemDate: {
    fontSize: fontSize.xs,
    color: colors.text.disabled,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.gray[100],
    marginLeft: spacing.md + 20 + spacing.sm,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  emptyTitle: {
    fontSize: fontSize.xl,
    fontWeight: "600",
    color: colors.text.primary,
  },
  emptySubtitle: {
    fontSize: fontSize.base,
    color: colors.text.secondary,
    textAlign: "center",
  },
});
