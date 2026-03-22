import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card } from "@/components/common/Card";
import { Button } from "@/components/common/Button";
import { discApi } from "@/services/api";
import { colors, spacing, fontSize, borderRadius } from "@/constants/theme";
import type { RegisteredDisc } from "@/types";

type FilterTab = "all" | "active" | "lost" | "found";

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "lost", label: "Lost" },
  { key: "found", label: "Found" },
];

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  active: { color: colors.success, bg: "#E8F5E9", label: "Active" },
  lost: { color: colors.error, bg: "#FFEBEE", label: "Lost" },
  found: { color: "#F9A825", bg: "#FFF8E1", label: "Found" },
  retired: { color: colors.gray[500], bg: colors.gray[100], label: "Retired" },
};

export default function MyDiscsScreen() {
  const [discs, setDiscs] = useState<RegisteredDisc[]>([]);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDiscs = useCallback(async () => {
    try {
      setError(null);
      const data = await discApi.myDiscs();
      setDiscs(data);
    } catch (err) {
      setError("Failed to load discs. Pull to retry.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDiscs();
  }, [loadDiscs]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDiscs();
    setRefreshing(false);
  };

  const filteredDiscs =
    filter === "all" ? discs : discs.filter((d) => d.status === filter);

  const renderDiscCard = ({ item }: { item: RegisteredDisc }) => {
    const status = STATUS_CONFIG[item.status] || STATUS_CONFIG.active;

    return (
      <Card
        elevated
        onPress={() => router.push(`/discs/${item.disc_code}`)}
        style={styles.discCard}
      >
        <View style={styles.discHeader}>
          <View style={styles.discInfo}>
            <Text style={styles.discMold}>{item.mold}</Text>
            <Text style={styles.discManufacturer}>{item.manufacturer}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusText, { color: status.color }]}>
              {status.label}
            </Text>
          </View>
        </View>

        <View style={styles.discDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Plastic</Text>
            <Text style={styles.detailValue}>{item.plastic || "N/A"}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Weight</Text>
            <Text style={styles.detailValue}>
              {item.weight_grams ? `${item.weight_grams}g` : "N/A"}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Color</Text>
            <View style={styles.colorDisplay}>
              <View
                style={[
                  styles.colorDot,
                  { backgroundColor: item.color || colors.gray[400] },
                ]}
              />
              <Text style={styles.detailValue}>{item.color || "N/A"}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.discCode}>{item.disc_code}</Text>
      </Card>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>💿</Text>
      <Text style={styles.emptyTitle}>No discs registered yet</Text>
      <Text style={styles.emptyText}>
        Tap the button above to add your first disc and get a unique QR code for
        lost disc recovery.
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading your discs...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Discs</Text>
        <Button
          title="+ Register Disc"
          onPress={() => router.push("/discs/register")}
          size="sm"
        />
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {FILTER_TABS.map((tab) => {
          const isActive = filter === tab.key;
          const count =
            tab.key === "all"
              ? discs.length
              : discs.filter((d) => d.status === tab.key).length;

          return (
            <Pressable
              key={tab.key}
              onPress={() => setFilter(tab.key)}
              style={[styles.filterTab, isActive && styles.filterTabActive]}
            >
              <Text
                style={[
                  styles.filterTabText,
                  isActive && styles.filterTabTextActive,
                ]}
              >
                {tab.label} ({count})
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Error State */}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Disc List */}
      <FlatList
        data={filteredDiscs}
        keyExtractor={(item) => item.id}
        renderItem={renderDiscCard}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.secondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.bg.secondary,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: fontSize.base,
    color: colors.text.secondary,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  headerTitle: {
    fontSize: fontSize["2xl"],
    fontWeight: "700",
    color: colors.text.primary,
  },
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  filterTab: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray[200],
  },
  filterTabActive: {
    backgroundColor: colors.primary,
  },
  filterTabText: {
    fontSize: fontSize.sm,
    fontWeight: "500",
    color: colors.text.secondary,
  },
  filterTabTextActive: {
    color: colors.text.inverse,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  separator: {
    height: spacing.sm,
  },
  discCard: {
    gap: spacing.sm,
  },
  discHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  discInfo: {
    flex: 1,
  },
  discMold: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.text.primary,
  },
  discManufacturer: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
  },
  statusText: {
    fontSize: fontSize.xs,
    fontWeight: "600",
  },
  discDetails: {
    flexDirection: "row",
    gap: spacing.lg,
  },
  detailRow: {
    gap: 2,
  },
  detailLabel: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: fontSize.sm,
    fontWeight: "500",
    color: colors.text.primary,
  },
  colorDisplay: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.gray[300],
  },
  discCode: {
    fontSize: fontSize.sm,
    fontFamily: "JetBrainsMono",
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: fontSize.base,
    color: colors.text.secondary,
    textAlign: "center",
    lineHeight: 22,
  },
  errorBanner: {
    backgroundColor: "#FFEBEE",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
  },
  errorText: {
    color: colors.error,
    fontSize: fontSize.sm,
  },
});
