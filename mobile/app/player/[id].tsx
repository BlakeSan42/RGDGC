import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  FlatList,
  Alert,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "@/components/common/Card";
import { colors, spacing, fontSize, borderRadius } from "@/constants/theme";
import type { Achievement, PlayerProfile } from "@/types";

// ── Mock Data ──

const MOCK_PROFILE: PlayerProfile = {
  id: "42",
  display_name: "Marcus Chen",
  username: "mchen_throws",
  avatar_url: null,
  handicap: 3.2,
  member_since: "2024-09-15T00:00:00Z",
  total_rounds: 67,
  average_score: -1.4,
  best_round: -8,
  c1x_percentage: 78,
  achievements_count: 9,
  recent_achievements: [
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
      id: "s2",
      type: "eagle_eye",
      title: "Eagle Eye",
      description: "Score your first eagle on any hole.",
      icon: "eye",
      earned_at: "2026-01-22T10:00:00Z",
      category: "scoring",
    },
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
      id: "m4",
      type: "register_5_discs",
      title: "Disc Collector",
      description: "Register 5 discs in your bag.",
      icon: "albums",
      earned_at: "2026-01-05T14:00:00Z",
      category: "milestone",
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
  ],
};

interface RecentRound {
  id: number;
  course_name: string;
  layout_name: string;
  total_score: number;
  total_strokes: number;
  date: string;
}

const MOCK_ROUNDS: RecentRound[] = [
  { id: 1, course_name: "River Grove DGC", layout_name: "White", total_score: -3, total_strokes: 51, date: "2026-03-20" },
  { id: 2, course_name: "River Grove DGC", layout_name: "Red", total_score: 1, total_strokes: 55, date: "2026-03-15" },
  { id: 3, course_name: "River Grove DGC", layout_name: "White", total_score: -1, total_strokes: 53, date: "2026-03-10" },
  { id: 4, course_name: "River Grove DGC", layout_name: "Blue", total_score: 4, total_strokes: 58, date: "2026-03-05" },
  { id: 5, course_name: "River Grove DGC", layout_name: "White", total_score: -2, total_strokes: 52, date: "2026-02-28" },
];

function getScoreDisplay(score: number): string {
  if (score === 0) return "E";
  if (score > 0) return `+${score}`;
  return `${score}`;
}

function getScoreColor(score: number): string {
  if (score < 0) return colors.score.birdie;
  if (score === 0) return colors.score.par;
  if (score <= 2) return colors.score.bogey;
  return colors.score.double;
}

export default function PlayerProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const profile = MOCK_PROFILE;

  const memberSince = new Date(profile.member_since).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header with Back Button */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.text.inverse} />
        </Pressable>
      </View>

      {/* Avatar + Name */}
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          {profile.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>
              {profile.display_name.charAt(0).toUpperCase()}
            </Text>
          )}
        </View>
        <Text style={styles.displayName}>{profile.display_name}</Text>
        <Text style={styles.username}>@{profile.username}</Text>
        <Text style={styles.memberSince}>Member since {memberSince}</Text>
      </View>

      {/* Stats Row */}
      <View style={styles.section}>
        <Card elevated>
          <View style={styles.statsRow}>
            <StatItem label="Rounds" value={String(profile.total_rounds)} />
            <View style={styles.statsDivider} />
            <StatItem
              label="Avg Score"
              value={profile.average_score != null ? getScoreDisplay(profile.average_score) : "--"}
              color={profile.average_score != null ? getScoreColor(profile.average_score) : undefined}
            />
            <View style={styles.statsDivider} />
            <StatItem
              label="Handicap"
              value={profile.handicap != null ? profile.handicap.toFixed(1) : "--"}
            />
            <View style={styles.statsDivider} />
            <StatItem
              label="C1X%"
              value={profile.c1x_percentage != null ? `${profile.c1x_percentage}%` : "--"}
            />
          </View>
        </Card>
      </View>

      {/* Best Round */}
      {profile.best_round != null && (
        <View style={styles.section}>
          <Card>
            <View style={styles.bestRoundRow}>
              <Ionicons name="trophy" size={20} color={colors.accent.gold} />
              <Text style={styles.bestRoundLabel}>Best Round</Text>
              <Text style={[styles.bestRoundValue, { color: getScoreColor(profile.best_round) }]}>
                {getScoreDisplay(profile.best_round)}
              </Text>
            </View>
          </Card>
        </View>
      )}

      {/* Recent Achievements */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Achievements ({profile.achievements_count})
          </Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.achievementsScroll}
        >
          {profile.recent_achievements.map((achievement) => (
            <Pressable
              key={achievement.id}
              style={styles.achievementBadge}
              onPress={() =>
                Alert.alert(
                  achievement.title,
                  `${achievement.description}\n\nEarned ${new Date(
                    achievement.earned_at!
                  ).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}`,
                  [{ text: "Nice!" }]
                )
              }
            >
              <View style={styles.achievementIconCircle}>
                <Ionicons
                  name={achievement.icon as any}
                  size={22}
                  color={colors.accent.gold}
                />
              </View>
              <Text style={styles.achievementBadgeTitle} numberOfLines={1}>
                {achievement.title}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Recent Rounds */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Rounds</Text>
        </View>
        <Card>
          {MOCK_ROUNDS.map((round, index) => (
            <View key={round.id}>
              <View style={styles.roundRow}>
                <View style={styles.roundInfo}>
                  <Text style={styles.roundCourse}>
                    {round.course_name} - {round.layout_name}
                  </Text>
                  <Text style={styles.roundDate}>
                    {new Date(round.date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </Text>
                </View>
                <View style={styles.roundScores}>
                  <Text style={[styles.roundScore, { color: getScoreColor(round.total_score) }]}>
                    {getScoreDisplay(round.total_score)}
                  </Text>
                  <Text style={styles.roundStrokes}>{round.total_strokes} strokes</Text>
                </View>
              </View>
              {index < MOCK_ROUNDS.length - 1 && <View style={styles.roundDivider} />}
            </View>
          ))}
        </Card>
      </View>

      {/* Challenge Button */}
      <View style={styles.section}>
        <Pressable
          style={({ pressed }) => [styles.challengeButton, pressed && styles.challengePressed]}
          onPress={() => Alert.alert("Coming Soon", "Head-to-head challenges are on the way!")}
        >
          <Ionicons name="flash" size={20} color={colors.text.inverse} />
          <Text style={styles.challengeText}>Challenge</Text>
        </Pressable>
      </View>

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

function StatItem({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statValue, color ? { color } : undefined]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.secondary,
  },
  header: {
    backgroundColor: colors.primary,
    paddingTop: 56,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },

  // Profile header
  profileHeader: {
    alignItems: "center",
    backgroundColor: colors.primary,
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: borderRadius.xl,
    borderBottomRightRadius: borderRadius.xl,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.sm,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.4)",
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  avatarText: {
    color: colors.text.inverse,
    fontSize: fontSize["4xl"],
    fontWeight: "700",
  },
  displayName: {
    fontSize: fontSize["2xl"],
    fontWeight: "700",
    color: colors.text.inverse,
  },
  username: {
    fontSize: fontSize.base,
    color: "rgba(255,255,255,0.7)",
    marginTop: 2,
  },
  memberSince: {
    fontSize: fontSize.sm,
    color: "rgba(255,255,255,0.5)",
    marginTop: 4,
  },

  // Stats
  section: {
    padding: spacing.md,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statValue: {
    fontSize: fontSize["2xl"],
    fontWeight: "700",
    color: colors.text.primary,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },
  statsDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.gray[200],
  },

  // Best round
  bestRoundRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  bestRoundLabel: {
    fontSize: fontSize.base,
    color: colors.text.secondary,
    flex: 1,
  },
  bestRoundValue: {
    fontSize: fontSize.xl,
    fontWeight: "700",
  },

  // Section headers
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.text.primary,
  },

  // Achievements
  achievementsScroll: {
    gap: spacing.md,
    paddingRight: spacing.md,
  },
  achievementBadge: {
    alignItems: "center",
    width: 72,
  },
  achievementIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#FFF8E1",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.accent.gold,
    marginBottom: 4,
  },
  achievementBadgeTitle: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.text.secondary,
    textAlign: "center",
  },

  // Recent Rounds
  roundRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
    minHeight: 44,
  },
  roundInfo: {
    flex: 1,
  },
  roundCourse: {
    fontSize: fontSize.sm,
    fontWeight: "500",
    color: colors.text.primary,
  },
  roundDate: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },
  roundScores: {
    alignItems: "flex-end",
  },
  roundScore: {
    fontSize: fontSize.lg,
    fontWeight: "700",
  },
  roundStrokes: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
  },
  roundDivider: {
    height: 1,
    backgroundColor: colors.gray[100],
  },

  // Challenge button
  challengeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.secondary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    minHeight: 48,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  challengePressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  challengeText: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.text.inverse,
  },
});
