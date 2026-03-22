import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  FlatList,
  Alert,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, fontSize, borderRadius } from "@/constants/theme";
import type { Achievement } from "@/types";

// ── Mock Achievements ──

const ALL_ACHIEVEMENTS: Achievement[] = [
  // Scoring
  {
    id: "s1",
    type: "first_birdie",
    title: "First Birdie",
    description: "Score your first birdie on any hole.",
    icon: "star",
    earned_at: "2025-11-15T14:30:00Z",
    category: "scoring",
  },
  {
    id: "s2",
    type: "eagle_eye",
    title: "Eagle Eye",
    description: "Score your first eagle on any hole.",
    icon: "eye",
    earned_at: "2026-01-22T10:00:00Z",
    category: "scoring",
  },
  {
    id: "s3",
    type: "under_par",
    title: "Under Par",
    description: "Complete a round under par.",
    icon: "trending-down",
    earned_at: null,
    progress: 0.7,
    category: "scoring",
  },
  {
    id: "s4",
    type: "ace",
    title: "Ace!",
    description: "Score a hole-in-one. The ultimate throw.",
    icon: "flash",
    earned_at: null,
    category: "scoring",
  },
  {
    id: "s5",
    type: "perfect_round",
    title: "Perfect Round",
    description: "Complete a round with all pars or better.",
    icon: "ribbon",
    earned_at: null,
    category: "scoring",
  },

  // Putting
  {
    id: "p1",
    type: "c1_master",
    title: "Circle 1 Master",
    description: "Achieve 90% putting from Circle 1.",
    icon: "disc",
    earned_at: null,
    progress: 0.82,
    category: "putting",
  },
  {
    id: "p2",
    type: "long_range",
    title: "Long Range",
    description: "Make a putt from 15 meters or further.",
    icon: "locate",
    earned_at: "2026-02-10T16:00:00Z",
    category: "putting",
  },
  {
    id: "p3",
    type: "putting_streak",
    title: "Putting Streak",
    description: "Make 10 putts in a row during practice.",
    icon: "flame",
    earned_at: null,
    progress: 0.6,
    category: "putting",
  },
  {
    id: "p4",
    type: "21_champion",
    title: "21 Champion",
    description: "Win a game of 21 in putting practice.",
    icon: "trophy",
    earned_at: null,
    category: "putting",
  },

  // League
  {
    id: "l1",
    type: "first_event",
    title: "First Event",
    description: "Attend your first league event.",
    icon: "calendar",
    earned_at: "2025-10-05T09:00:00Z",
    category: "league",
  },
  {
    id: "l2",
    type: "podium_finish",
    title: "Podium Finish",
    description: "Finish in the top 3 at a league event.",
    icon: "podium",
    earned_at: "2026-03-08T12:00:00Z",
    category: "league",
  },
  {
    id: "l3",
    type: "season_champion",
    title: "Season Champion",
    description: "Win a full season league championship.",
    icon: "medal",
    earned_at: null,
    category: "league",
  },
  {
    id: "l4",
    type: "iron_player",
    title: "Iron Player",
    description: "Attend every event in a league season.",
    icon: "shield-checkmark",
    earned_at: null,
    progress: 0.45,
    category: "league",
  },

  // Social
  {
    id: "so1",
    type: "disc_samaritan",
    title: "Disc Samaritan",
    description: "Return a found disc to its owner.",
    icon: "heart",
    earned_at: "2026-02-28T11:00:00Z",
    category: "social",
  },
  {
    id: "so2",
    type: "recruiter",
    title: "Recruiter",
    description: "Invite 3 friends who join the club.",
    icon: "people",
    earned_at: null,
    progress: 0.33,
    category: "social",
  },
  {
    id: "so3",
    type: "chat_regular",
    title: "Chat Regular",
    description: "Send 50 messages in club chat.",
    icon: "chatbubbles",
    earned_at: null,
    progress: 0.4,
    category: "social",
  },

  // Milestone
  {
    id: "m1",
    type: "10_rounds",
    title: "10 Rounds",
    description: "Complete 10 scored rounds.",
    icon: "golf",
    earned_at: "2025-12-20T08:00:00Z",
    category: "milestone",
  },
  {
    id: "m2",
    type: "50_rounds",
    title: "50 Rounds",
    description: "Complete 50 scored rounds.",
    icon: "golf",
    earned_at: null,
    progress: 0.54,
    category: "milestone",
  },
  {
    id: "m3",
    type: "100_rounds",
    title: "100 Rounds",
    description: "Complete 100 scored rounds. Dedication!",
    icon: "golf",
    earned_at: null,
    category: "milestone",
  },
  {
    id: "m4",
    type: "register_5_discs",
    title: "Disc Collector",
    description: "Register 5 discs in your bag.",
    icon: "albums",
    earned_at: "2026-01-05T14:00:00Z",
    category: "milestone",
  },
  {
    id: "m5",
    type: "1_year_member",
    title: "1 Year Member",
    description: "Be a club member for one full year.",
    icon: "time",
    earned_at: null,
    progress: 0.42,
    category: "milestone",
  },
];

type CategoryFilter = "all" | Achievement["category"];

const CATEGORIES: { key: CategoryFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "scoring", label: "Scoring" },
  { key: "putting", label: "Putting" },
  { key: "league", label: "League" },
  { key: "social", label: "Social" },
  { key: "milestone", label: "Milestone" },
];

const SCREEN_WIDTH = Dimensions.get("window").width;
const CARD_GAP = spacing.sm;
const CARD_WIDTH = (SCREEN_WIDTH - spacing.md * 2 - CARD_GAP) / 2;

export default function AchievementsScreen() {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");

  const earnedCount = ALL_ACHIEVEMENTS.filter((a) => a.earned_at !== null).length;
  const totalCount = ALL_ACHIEVEMENTS.length;

  const filtered =
    activeCategory === "all"
      ? ALL_ACHIEVEMENTS
      : ALL_ACHIEVEMENTS.filter((a) => a.category === activeCategory);

  // Sort: earned first (most recent), then in-progress, then locked
  const sorted = [...filtered].sort((a, b) => {
    if (a.earned_at && !b.earned_at) return -1;
    if (!a.earned_at && b.earned_at) return 1;
    if (a.earned_at && b.earned_at) {
      return new Date(b.earned_at).getTime() - new Date(a.earned_at).getTime();
    }
    if (a.progress && !b.progress) return -1;
    if (!a.progress && b.progress) return 1;
    return 0;
  });

  function handleAchievementPress(achievement: Achievement) {
    if (achievement.earned_at) {
      const date = new Date(achievement.earned_at).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
      Alert.alert(
        achievement.title,
        `${achievement.description}\n\nEarned on ${date}`,
        [{ text: "Nice!", style: "default" }]
      );
    }
  }

  function renderAchievementCard({ item }: { item: Achievement }) {
    const isEarned = item.earned_at !== null;
    const isInProgress = !isEarned && item.progress != null && item.progress > 0;
    const isLocked = !isEarned && !isInProgress;

    // Check if earned within last 7 days for "recent" shimmer
    const isRecent =
      isEarned &&
      Date.now() - new Date(item.earned_at!).getTime() < 7 * 24 * 60 * 60 * 1000;

    return (
      <Pressable
        onPress={() => handleAchievementPress(item)}
        style={({ pressed }) => [
          styles.achievementCard,
          isEarned && styles.achievementEarned,
          isRecent && styles.achievementRecent,
          isLocked && styles.achievementLocked,
          pressed && isEarned && styles.cardPressed,
        ]}
      >
        {/* Icon */}
        <View
          style={[
            styles.iconContainer,
            isEarned && styles.iconEarned,
            isInProgress && styles.iconInProgress,
            isLocked && styles.iconLocked,
          ]}
        >
          <Ionicons
            name={item.icon as any}
            size={28}
            color={
              isEarned
                ? colors.accent.gold
                : isInProgress
                ? colors.primaryLight
                : colors.gray[400]
            }
          />
          {isLocked && (
            <View style={styles.lockOverlay}>
              <Ionicons name="lock-closed" size={14} color={colors.gray[500]} />
            </View>
          )}
        </View>

        {/* Title */}
        <Text
          style={[styles.achievementTitle, isLocked && styles.textLocked]}
          numberOfLines={1}
        >
          {item.title}
        </Text>

        {/* Description or Lock text */}
        <Text
          style={[styles.achievementDesc, isLocked && styles.textLocked]}
          numberOfLines={2}
        >
          {isLocked ? "Keep playing to unlock!" : item.description}
        </Text>

        {/* Progress bar for in-progress */}
        {isInProgress && (
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <View
                style={[styles.progressFill, { width: `${Math.round(item.progress! * 100)}%` as any }]}
              />
            </View>
            <Text style={styles.progressText}>{Math.round(item.progress! * 100)}%</Text>
          </View>
        )}

        {/* Earned date */}
        {isEarned && (
          <Text style={styles.earnedDate}>
            {new Date(item.earned_at!).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </Text>
        )}
      </Pressable>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Achievements</Text>
          <Text style={styles.headerCount}>
            {earnedCount}/{totalCount} Unlocked
          </Text>
        </View>
        <View style={styles.backButton} />
      </View>

      {/* Category Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsContainer}
        style={styles.tabsScroll}
      >
        {CATEGORIES.map((cat) => (
          <Pressable
            key={cat.key}
            onPress={() => setActiveCategory(cat.key)}
            style={[
              styles.tab,
              activeCategory === cat.key && styles.tabActive,
            ]}
          >
            <Text
              style={[
                styles.tabText,
                activeCategory === cat.key && styles.tabTextActive,
              ]}
            >
              {cat.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Achievement Grid */}
      <FlatList
        data={sorted}
        renderItem={renderAchievementCard}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.gridContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.secondary,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 56,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bg.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerCenter: {
    alignItems: "center",
    flex: 1,
  },
  headerTitle: {
    fontSize: fontSize.xl,
    fontWeight: "700",
    color: colors.text.primary,
  },
  headerCount: {
    fontSize: fontSize.sm,
    color: colors.accent.gold,
    fontWeight: "600",
    marginTop: 2,
  },

  // Category Tabs
  tabsScroll: {
    backgroundColor: colors.bg.primary,
    flexGrow: 0,
  },
  tabsContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.gray[100],
    minHeight: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: fontSize.sm,
    fontWeight: "500",
    color: colors.text.secondary,
  },
  tabTextActive: {
    color: colors.text.inverse,
    fontWeight: "600",
  },

  // Grid
  gridContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  gridRow: {
    gap: CARD_GAP,
    marginBottom: CARD_GAP,
  },

  // Achievement Card
  achievementCard: {
    width: CARD_WIDTH,
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.gray[200],
    minHeight: 170,
  },
  achievementEarned: {
    borderColor: colors.accent.gold,
    borderWidth: 2,
    shadowColor: colors.accent.gold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  achievementRecent: {
    borderColor: colors.accent.gold,
    borderWidth: 2,
    backgroundColor: "#FFFEF5",
    shadowColor: colors.accent.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 5,
  },
  achievementLocked: {
    opacity: 0.5,
  },
  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.97 }],
  },

  // Icon
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  iconEarned: {
    backgroundColor: "#FFF8E1",
  },
  iconInProgress: {
    backgroundColor: "#E8F5E9",
  },
  iconLocked: {
    backgroundColor: colors.gray[100],
  },
  lockOverlay: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.bg.card,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.gray[200],
  },

  // Text
  achievementTitle: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.text.primary,
    textAlign: "center",
    marginBottom: 4,
  },
  achievementDesc: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    textAlign: "center",
    lineHeight: 16,
  },
  textLocked: {
    color: colors.gray[500],
  },

  // Progress
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.sm,
    width: "100%",
  },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.gray[200],
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  progressText: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.primary,
    minWidth: 30,
    textAlign: "right",
  },

  // Earned date
  earnedDate: {
    fontSize: 10,
    color: colors.accent.gold,
    fontWeight: "600",
    marginTop: spacing.sm,
  },
});
