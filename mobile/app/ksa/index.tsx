/**
 * KSA Knowledge Base — Main Screen
 *
 * Security: Published articles are readable by all logged-in players.
 * Admin-only content (drafts, edit, create) is gated by role check.
 *
 * UI/UX: Card-based category browser → article list → full article reader.
 * Tow alert banner appears at top when an active alert exists.
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet,
  RefreshControl, Alert, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, fontSize, borderRadius } from "@/constants/theme";
import { api } from "@/services/api";
import { useAuth } from "@/context/AuthContext";

const CATEGORIES = [
  { key: "parking", label: "Parking & Stickers", icon: "car", color: colors.error },
  { key: "rights", label: "Your Rights", icon: "shield-checkmark", color: colors.accent.blue },
  { key: "finances", label: "KSA Finances", icon: "cash", color: colors.primary },
  { key: "governance", label: "Governance", icon: "people", color: colors.accent.purple },
  { key: "history", label: "KSA History", icon: "time", color: colors.secondary },
  { key: "legal", label: "Legal", icon: "document-text", color: colors.warning },
  { key: "reform", label: "RGPC Proposal", icon: "rocket", color: colors.primaryLight },
  { key: "parks", label: "Parks", icon: "leaf", color: colors.success },
];

type Article = {
  id: number;
  title: string;
  slug: string;
  summary: string;
  category: string;
  is_pinned: boolean;
  read_count: number;
  updated_at: string;
};

type ActiveAlert = {
  id: number;
  alert_type: string;
  park_name: string;
  location_description: string | null;
  created_at: string;
};

export default function KSAKnowledgeBase() {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const [articles, setArticles] = useState<Article[]>([]);
  const [activeAlert, setActiveAlert] = useState<ActiveAlert | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (selectedCategory) params.category = selectedCategory;
      if (searchQuery) params.search = searchQuery;

      const [articlesRes, alertsRes] = await Promise.all([
        api.get("/ksa/articles", { params }),
        api.get("/tow-alerts", { params: { status: "active", limit: "1" } }),
      ]);
      setArticles(articlesRes.data);
      setActiveAlert(alertsRes.data.length > 0 ? alertsRes.data[0] : null);
    } catch {
      // Silently handle — articles may not be seeded yet
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCategory, searchQuery]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const alertLabels: Record<string, string> = {
    tow_truck_spotted: "TOW TRUCK SPOTTED",
    car_being_towed: "CAR BEING TOWED",
    enforcement_patrol: "ENFORCEMENT PATROL",
    boot_applied: "BOOT ON VEHICLE",
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {/* Active Tow Alert Banner */}
      {activeAlert && (
        <TouchableOpacity
          style={styles.alertBanner}
          onPress={() => router.push(`/ksa/tow-alert/${activeAlert.id}`)}
        >
          <Ionicons name="warning" size={24} color="#fff" />
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <Text style={styles.alertTitle}>
              {alertLabels[activeAlert.alert_type] || "TOW ALERT"}
            </Text>
            <Text style={styles.alertSubtitle}>
              {activeAlert.park_name}
              {activeAlert.location_description ? ` — ${activeAlert.location_description}` : ""}
            </Text>
          </View>
          <Text style={styles.alertAction}>VIEW →</Text>
        </TouchableOpacity>
      )}

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Know Your Park</Text>
        <Text style={styles.headerSubtitle}>
          Learn about KSA, your rights, and how River Grove Park is managed
        </Text>
      </View>

      {/* Tow Alert Button */}
      <TouchableOpacity
        style={styles.towAlertButton}
        onPress={() => router.push("/ksa/report-tow")}
      >
        <Ionicons name="warning" size={22} color="#fff" />
        <Text style={styles.towAlertButtonText}>Report Tow Truck</Text>
      </TouchableOpacity>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={colors.text.secondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search articles..."
          placeholderTextColor={colors.text.disabled}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={fetchData}
          returnKeyType="search"
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => { setSearchQuery(""); fetchData(); }}>
            <Ionicons name="close-circle" size={18} color={colors.text.secondary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Categories */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
        <TouchableOpacity
          style={[styles.categoryChip, !selectedCategory && styles.categoryChipActive]}
          onPress={() => { setSelectedCategory(null); }}
        >
          <Text style={[styles.categoryChipText, !selectedCategory && styles.categoryChipTextActive]}>All</Text>
        </TouchableOpacity>
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat.key}
            style={[styles.categoryChip, selectedCategory === cat.key && { backgroundColor: cat.color }]}
            onPress={() => setSelectedCategory(selectedCategory === cat.key ? null : cat.key)}
          >
            <Ionicons
              name={cat.icon as any}
              size={14}
              color={selectedCategory === cat.key ? "#fff" : cat.color}
              style={{ marginRight: 4 }}
            />
            <Text style={[
              styles.categoryChipText,
              selectedCategory === cat.key && { color: "#fff" },
            ]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Quick Actions — Parking Info */}
      {!selectedCategory && !searchQuery && (
        <TouchableOpacity
          style={styles.quickCard}
          onPress={() => router.push("/ksa/parking-info")}
        >
          <View style={styles.quickCardIcon}>
            <Ionicons name="car" size={28} color={colors.error} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.quickCardTitle}>Playing River Grove?</Text>
            <Text style={styles.quickCardSubtitle}>
              K-sticker rules, where to park, tow fees, your rights
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.text.secondary} />
        </TouchableOpacity>
      )}

      {/* Articles */}
      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : articles.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="book-outline" size={48} color={colors.text.disabled} />
          <Text style={styles.emptyTitle}>No articles yet</Text>
          <Text style={styles.emptySubtitle}>
            {isAdmin ? "Tap + to create the first article" : "Check back soon — knowledge base is being built"}
          </Text>
        </View>
      ) : (
        articles.map(article => (
          <TouchableOpacity
            key={article.id}
            style={styles.articleCard}
            onPress={() => router.push(`/ksa/article/${article.slug}`)}
          >
            {article.is_pinned && (
              <View style={styles.pinnedBadge}>
                <Ionicons name="pin" size={10} color={colors.primary} />
                <Text style={styles.pinnedText}>PINNED</Text>
              </View>
            )}
            <Text style={styles.articleTitle}>{article.title}</Text>
            <Text style={styles.articleSummary} numberOfLines={2}>{article.summary}</Text>
            <View style={styles.articleMeta}>
              <View style={[styles.categoryTag, {
                backgroundColor: CATEGORIES.find(c => c.key === article.category)?.color + "20" || colors.gray[100]
              }]}>
                <Text style={[styles.categoryTagText, {
                  color: CATEGORIES.find(c => c.key === article.category)?.color || colors.text.secondary
                }]}>
                  {CATEGORIES.find(c => c.key === article.category)?.label || article.category}
                </Text>
              </View>
              <Text style={styles.readCount}>{article.read_count} reads</Text>
            </View>
          </TouchableOpacity>
        ))
      )}

      {/* Admin FAB */}
      {isAdmin && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push("/ksa/admin")}
        >
          <Ionicons name="settings" size={24} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Admin Stats Link */}
      {isAdmin && (
        <TouchableOpacity
          style={styles.adminLink}
          onPress={() => router.push("/ksa/admin")}
        >
          <Ionicons name="shield-checkmark" size={16} color={colors.primary} />
          <Text style={styles.adminLinkText}>Admin: Manage Articles & View Tow Stats</Text>
        </TouchableOpacity>
      )}

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.secondary },

  // Alert banner
  alertBanner: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.error, padding: spacing.md,
    marginHorizontal: spacing.md, marginTop: spacing.md,
    borderRadius: borderRadius.md,
  },
  alertTitle: { color: "#fff", fontWeight: "800", fontSize: fontSize.base },
  alertSubtitle: { color: "#ffffffcc", fontSize: fontSize.sm, marginTop: 2 },
  alertAction: { color: "#fff", fontWeight: "700", fontSize: fontSize.sm },

  // Header
  header: { padding: spacing.lg, paddingBottom: spacing.sm },
  headerTitle: { fontSize: fontSize["2xl"], fontWeight: "800", color: colors.text.primary },
  headerSubtitle: { fontSize: fontSize.base, color: colors.text.secondary, marginTop: spacing.xs },

  // Tow alert button
  towAlertButton: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: colors.error, marginHorizontal: spacing.lg,
    paddingVertical: spacing.md, borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  towAlertButtonText: { color: "#fff", fontWeight: "700", fontSize: fontSize.base, marginLeft: spacing.sm },

  // Search
  searchContainer: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.bg.card, marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.gray[200],
  },
  searchInput: { flex: 1, marginLeft: spacing.sm, fontSize: fontSize.base, color: colors.text.primary },

  // Categories
  categoryScroll: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  categoryChip: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: borderRadius.full, backgroundColor: colors.bg.card,
    borderWidth: 1, borderColor: colors.gray[200], marginRight: spacing.sm,
  },
  categoryChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  categoryChipText: { fontSize: fontSize.sm, color: colors.text.secondary },
  categoryChipTextActive: { color: "#fff", fontWeight: "600" },

  // Quick card
  quickCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.bg.card, marginHorizontal: spacing.lg,
    padding: spacing.md, borderRadius: borderRadius.md,
    borderLeftWidth: 4, borderLeftColor: colors.error, marginBottom: spacing.md,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2,
  },
  quickCardIcon: {
    width: 48, height: 48, borderRadius: borderRadius.md,
    backgroundColor: colors.error + "15", alignItems: "center", justifyContent: "center",
    marginRight: spacing.md,
  },
  quickCardTitle: { fontSize: fontSize.base, fontWeight: "700", color: colors.text.primary },
  quickCardSubtitle: { fontSize: fontSize.sm, color: colors.text.secondary, marginTop: 2 },

  // Articles
  articleCard: {
    backgroundColor: colors.bg.card, marginHorizontal: spacing.lg, marginBottom: spacing.sm,
    padding: spacing.md, borderRadius: borderRadius.md,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2,
  },
  pinnedBadge: {
    flexDirection: "row", alignItems: "center",
    marginBottom: spacing.xs,
  },
  pinnedText: { fontSize: fontSize.xs, fontWeight: "700", color: colors.primary, marginLeft: 4 },
  articleTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text.primary },
  articleSummary: { fontSize: fontSize.sm, color: colors.text.secondary, marginTop: spacing.xs, lineHeight: 20 },
  articleMeta: { flexDirection: "row", alignItems: "center", marginTop: spacing.sm, justifyContent: "space-between" },
  categoryTag: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.sm },
  categoryTagText: { fontSize: fontSize.xs, fontWeight: "600" },
  readCount: { fontSize: fontSize.xs, color: colors.text.disabled },

  // Empty
  emptyState: { alignItems: "center", paddingTop: spacing.xxl },
  emptyTitle: { fontSize: fontSize.lg, fontWeight: "600", color: colors.text.primary, marginTop: spacing.md },
  emptySubtitle: { fontSize: fontSize.base, color: colors.text.secondary, marginTop: spacing.xs, textAlign: "center", paddingHorizontal: spacing.xl },

  // Admin
  fab: {
    position: "absolute", right: spacing.lg, bottom: spacing.xl,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primary, alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4,
  },
  adminLink: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: spacing.md, marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  adminLinkText: { fontSize: fontSize.sm, color: colors.primary, fontWeight: "600", marginLeft: spacing.xs },
});
