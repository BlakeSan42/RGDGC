import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "@/components/common/Card";
import { Button } from "@/components/common/Button";
import { useAuth } from "@/context/AuthContext";
import { colors, spacing, fontSize, borderRadius } from "@/constants/theme";

export default function ProfileScreen() {
  const { user, logout, isAuthenticated } = useAuth();
  const router = useRouter();

  if (!isAuthenticated || !user) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>Not logged in</Text>
        <Text style={styles.emptyText}>Create an account to save rounds and join leagues.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Avatar + Name */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(user.display_name || user.username).charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.name}>{user.display_name || user.username}</Text>
        <Text style={styles.username}>@{user.username}</Text>
        {user.handicap != null && (
          <Text style={styles.handicap}>Handicap: {user.handicap}</Text>
        )}
      </View>

      {/* Stats Summary */}
      <View style={styles.section}>
        <Card>
          <View style={styles.statsRow}>
            <StatItem label="Rounds" value="--" />
            <View style={styles.statsDivider} />
            <StatItem label="Avg Score" value="--" />
            <View style={styles.statsDivider} />
            <StatItem label="C1X %" value="--" />
          </View>
        </Card>
      </View>

      {/* Info Cards */}
      <View style={styles.section}>
        <Card>
          <InfoRow label="Email" value={user.email} />
          <InfoRow label="Role" value={user.role} />
          <InfoRow label="Member since" value={new Date(user.created_at).toLocaleDateString()} />
        </Card>
      </View>

      {/* Navigation Links */}
      <View style={styles.section}>
        <Card>
          <NavRow label="My Discs" onPress={() => router.push("/discs/my-discs")} />
          <View style={styles.navDivider} />
          <Pressable
            style={({ pressed }) => [styles.navRow, pressed && { backgroundColor: colors.gray[50] }]}
            onPress={() => router.push("/achievements")}
          >
            <View style={styles.achievementNavRow}>
              <Ionicons name="trophy" size={18} color={colors.accent.gold} />
              <Text style={styles.navLabel}>Achievements</Text>
            </View>
            <View style={styles.achievementNavRight}>
              <View style={styles.achievementBadge}>
                <Text style={styles.achievementBadgeText}>9</Text>
              </View>
              <Text style={styles.navChevron}>{">"}</Text>
            </View>
          </Pressable>
          <View style={styles.navDivider} />
          <NavRow label="Sync & Offline" onPress={() => router.push("/sync")} />
          <View style={styles.navDivider} />
          <NavRow label="Settings" onPress={() => router.push("/settings")} />
        </Card>
      </View>

      {/* Actions */}
      <View style={styles.section}>
        <Button title="Log Out" onPress={logout} variant="ghost" />
      </View>

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function NavRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.navRow, pressed && { backgroundColor: colors.gray[50] }]}
      onPress={onPress}
    >
      <Text style={styles.navLabel}>{label}</Text>
      <Text style={styles.navChevron}>{">"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.secondary },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.lg },
  header: { alignItems: "center", paddingVertical: spacing.xl, backgroundColor: colors.bg.primary },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.primary, justifyContent: "center", alignItems: "center",
    marginBottom: spacing.sm,
  },
  avatarText: { color: colors.text.inverse, fontSize: fontSize["3xl"], fontWeight: "700" },
  name: { fontSize: fontSize.xl, fontWeight: "700", color: colors.text.primary },
  username: { fontSize: fontSize.base, color: colors.text.secondary },
  handicap: { fontSize: fontSize.sm, color: colors.accent.blue, marginTop: 4 },
  section: { padding: spacing.md, gap: spacing.sm },

  // Stats
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

  // Info rows
  infoRow: {
    flexDirection: "row", justifyContent: "space-between",
    paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.gray[100],
  },
  infoLabel: { fontSize: fontSize.base, color: colors.text.secondary },
  infoValue: { fontSize: fontSize.base, fontWeight: "500", color: colors.text.primary },

  // Nav rows
  navRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm + 2,
    minHeight: 44,
  },
  navDivider: {
    height: 1,
    backgroundColor: colors.gray[100],
  },
  navLabel: {
    fontSize: fontSize.base,
    color: colors.text.primary,
    fontWeight: "500",
  },
  navChevron: {
    fontSize: fontSize.base,
    color: colors.gray[400],
  },

  // Achievement nav
  achievementNavRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  achievementNavRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  achievementBadge: {
    backgroundColor: colors.accent.gold,
    borderRadius: borderRadius.full,
    minWidth: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  achievementBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  // Empty state
  emptyTitle: { fontSize: fontSize.lg, fontWeight: "600", color: colors.text.primary, marginBottom: 4 },
  emptyText: { fontSize: fontSize.base, color: colors.text.secondary, textAlign: "center" },
});
