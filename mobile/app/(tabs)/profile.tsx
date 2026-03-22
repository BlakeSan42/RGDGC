import { View, Text, StyleSheet, ScrollView } from "react-native";
import { Card } from "@/components/common/Card";
import { Button } from "@/components/common/Button";
import { useAuth } from "@/context/AuthContext";
import { colors, spacing, fontSize, borderRadius } from "@/constants/theme";

export default function ProfileScreen() {
  const { user, logout, isAuthenticated } = useAuth();

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
        {user.handicap && (
          <Text style={styles.handicap}>Handicap: {user.handicap}</Text>
        )}
      </View>

      {/* Info Cards */}
      <View style={styles.section}>
        <Card>
          <InfoRow label="Email" value={user.email} />
          <InfoRow label="Role" value={user.role} />
          <InfoRow label="Member since" value={new Date(user.created_at).toLocaleDateString()} />
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
  infoRow: {
    flexDirection: "row", justifyContent: "space-between",
    paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.gray[100],
  },
  infoLabel: { fontSize: fontSize.base, color: colors.text.secondary },
  infoValue: { fontSize: fontSize.base, fontWeight: "500", color: colors.text.primary },
  emptyTitle: { fontSize: fontSize.lg, fontWeight: "600", color: colors.text.primary, marginBottom: 4 },
  emptyText: { fontSize: fontSize.base, color: colors.text.secondary, textAlign: "center" },
});
