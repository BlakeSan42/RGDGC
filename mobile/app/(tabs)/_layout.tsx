import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, View, StyleSheet } from "react-native";
import { colors } from "@/constants/theme";

// Mock unread count — replace with real notification state later
const MOCK_UNREAD_COUNT = 3;

function NotificationBell() {
  const router = useRouter();
  const hasUnread = MOCK_UNREAD_COUNT > 0;

  return (
    <Pressable
      onPress={() => router.push("/notifications")}
      hitSlop={8}
      style={bellStyles.container}
    >
      <Ionicons name="notifications-outline" size={24} color={colors.text.inverse} />
      {hasUnread && <View style={bellStyles.badge} />}
    </Pressable>
  );
}

const bellStyles = StyleSheet.create({
  container: {
    marginRight: 16,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#F44336",
    borderWidth: 2,
    borderColor: colors.primary,
  },
});

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.text.disabled,
        tabBarStyle: {
          borderTopColor: colors.gray[200],
          height: 88,
          paddingBottom: 30,
          paddingTop: 8,
        },
        headerStyle: {
          backgroundColor: colors.primary,
        },
        headerTintColor: colors.text.inverse,
        headerTitleStyle: {
          fontWeight: "600",
        },
        headerRight: () => <NotificationBell />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Play",
          headerTitle: "RGDGC",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="disc-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: "Stats",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="stats-chart-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="league"
        options={{
          title: "League",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="trophy-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "Chat",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubble-ellipses-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
