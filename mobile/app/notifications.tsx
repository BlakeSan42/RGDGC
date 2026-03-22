import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, spacing, fontSize, borderRadius } from "@/constants/theme";

// --- Types ---

type NotificationType =
  | "event_reminder"
  | "league_update"
  | "disc_found"
  | "achievement"
  | "general";

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  timestamp: Date;
  read: boolean;
}

// --- Icon map ---

const NOTIFICATION_ICONS: Record<
  NotificationType,
  { name: keyof typeof Ionicons.glyphMap; color: string }
> = {
  event_reminder: { name: "calendar", color: colors.accent.blue },
  league_update: { name: "trophy", color: colors.accent.gold },
  disc_found: { name: "disc", color: colors.secondary },
  achievement: { name: "star", color: colors.accent.purple },
  general: { name: "notifications", color: colors.primary },
};

// --- Mock data ---

const now = new Date();
const today = (h: number, m: number) => {
  const d = new Date(now);
  d.setHours(h, m, 0, 0);
  return d;
};
const yesterday = (h: number, m: number) => {
  const d = new Date(now);
  d.setDate(d.getDate() - 1);
  d.setHours(h, m, 0, 0);
  return d;
};
const daysAgo = (days: number, h: number, m: number) => {
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  d.setHours(h, m, 0, 0);
  return d;
};

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: "1",
    type: "event_reminder",
    title: "Sunday Singles Tomorrow",
    body: "Sunday Singles starts at 2:00 PM at River Grove DGC - White layout. Don't forget to check in!",
    timestamp: today(9, 0),
    read: false,
  },
  {
    id: "2",
    type: "disc_found",
    title: "Someone Found Your Disc!",
    body: 'Your Innova Destroyer (blue) was found on hole 7. Tap to view finder details.',
    timestamp: today(7, 30),
    read: false,
  },
  {
    id: "3",
    type: "achievement",
    title: "Achievement Unlocked!",
    body: "You earned: First Birdie! Keep it up and unlock more achievements.",
    timestamp: yesterday(18, 15),
    read: false,
  },
  {
    id: "4",
    type: "league_update",
    title: "New Standings Posted",
    body: "Dubs League standings have been updated after last week's event. Check your position!",
    timestamp: yesterday(14, 0),
    read: true,
  },
  {
    id: "5",
    type: "general",
    title: "Course Maintenance Notice",
    body: "Holes 4-6 will be under maintenance this Wednesday. Please plan accordingly.",
    timestamp: daysAgo(3, 10, 0),
    read: true,
  },
  {
    id: "6",
    type: "event_reminder",
    title: "Dubs League This Saturday",
    body: "Dubs League kicks off at 10:00 AM. Pair up with your partner and register by Friday.",
    timestamp: daysAgo(4, 8, 0),
    read: true,
  },
  {
    id: "7",
    type: "league_update",
    title: "Season Points Updated",
    body: "Your season points have been recalculated. You moved up 2 spots in Sunday Singles!",
    timestamp: daysAgo(5, 16, 30),
    read: true,
  },
];

// --- Helpers ---

function formatTimestamp(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h % 12 || 12;
  return `${hr}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function getDateGroup(date: Date): string {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  const yesterdayStart = new Date(start);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  if (date >= start) return "Today";
  if (date >= yesterdayStart) return "Yesterday";
  return "Earlier";
}

type Section = { title: string; data: Notification[] };

function groupByDate(notifications: Notification[]): Section[] {
  const groups: Record<string, Notification[]> = {};
  const order = ["Today", "Yesterday", "Earlier"];

  for (const n of notifications) {
    const group = getDateGroup(n.timestamp);
    if (!groups[group]) groups[group] = [];
    groups[group].push(n);
  }

  return order
    .filter((key) => groups[key])
    .map((key) => ({ title: key, data: groups[key] }));
}

// --- Components ---

function NotificationItem({
  item,
  onPress,
}: {
  item: Notification;
  onPress: (id: string) => void;
}) {
  const icon = NOTIFICATION_ICONS[item.type];

  return (
    <Pressable
      onPress={() => onPress(item.id)}
      style={({ pressed }) => [
        styles.notificationItem,
        !item.read && styles.unreadItem,
        pressed && styles.pressedItem,
      ]}
    >
      <View style={[styles.iconCircle, { backgroundColor: icon.color + "18" }]}>
        <Ionicons name={icon.name} size={22} color={icon.color} />
      </View>

      <View style={styles.notificationContent}>
        <View style={styles.notificationHeader}>
          <Text
            style={[styles.notificationTitle, !item.read && styles.unreadTitle]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          {!item.read && <View style={styles.unreadDot} />}
        </View>
        <Text style={styles.notificationBody} numberOfLines={2}>
          {item.body}
        </Text>
        <Text style={styles.timestamp}>{formatTimestamp(item.timestamp)}</Text>
      </View>
    </Pressable>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );
}

function EmptyState() {
  return (
    <View style={styles.emptyState}>
      <Ionicons
        name="checkmark-circle-outline"
        size={64}
        color={colors.gray[300]}
      />
      <Text style={styles.emptyTitle}>You're all caught up!</Text>
      <Text style={styles.emptySubtitle}>No new notifications.</Text>
    </View>
  );
}

// --- Screen ---

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);

  const sections = groupByDate(notifications);
  const unreadCount = notifications.filter((n) => !n.read).length;

  // Flatten sections into a list with headers for FlatList
  const flatData: (Notification | { _sectionHeader: string })[] = [];
  for (const section of sections) {
    flatData.push({ _sectionHeader: section.title });
    flatData.push(...section.data);
  }

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const markRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const renderItem = ({
    item,
  }: {
    item: Notification | { _sectionHeader: string };
  }) => {
    if ("_sectionHeader" in item) {
      return <SectionHeader title={item._sectionHeader} />;
    }
    return <NotificationItem item={item} onPress={markRead} />;
  };

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      {/* Header bar */}
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unreadCount > 0 && (
          <Pressable onPress={markAllRead} hitSlop={8}>
            <Text style={styles.markAllRead}>Mark All Read</Text>
          </Pressable>
        )}
      </View>

      {notifications.length === 0 ? (
        <EmptyState />
      ) : (
        <FlatList
          data={flatData}
          renderItem={renderItem}
          keyExtractor={(item, index) =>
            "_sectionHeader" in item ? `header-${index}` : item.id
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

// --- Styles ---

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.secondary,
  },
  headerBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.bg.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  headerTitle: {
    fontSize: fontSize["2xl"],
    fontWeight: "700",
    color: colors.text.primary,
  },
  markAllRead: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.primary,
  },
  listContent: {
    paddingBottom: spacing.xxl,
  },
  sectionHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
  sectionHeaderText: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.text.secondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  notificationItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.bg.primary,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    borderRadius: borderRadius.md,
    borderLeftWidth: 3,
    borderLeftColor: "transparent",
  },
  unreadItem: {
    borderLeftColor: colors.primary,
    backgroundColor: colors.bg.primary,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  pressedItem: {
    opacity: 0.85,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
    marginTop: 2,
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  notificationTitle: {
    fontSize: fontSize.base,
    fontWeight: "500",
    color: colors.text.primary,
    flex: 1,
    marginRight: spacing.sm,
  },
  unreadTitle: {
    fontWeight: "700",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  notificationBody: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
    marginTop: 4,
  },
  timestamp: {
    fontSize: fontSize.xs,
    color: colors.text.disabled,
    marginTop: 6,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    fontSize: fontSize.xl,
    fontWeight: "600",
    color: colors.text.primary,
    marginTop: spacing.md,
  },
  emptySubtitle: {
    fontSize: fontSize.base,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
});
