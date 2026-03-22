import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "@/context/AuthContext";
import { OfflineProvider } from "@/context/OfflineContext";

export default function RootLayout() {
  return (
    <AuthProvider>
      <OfflineProvider>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="round/[id]"
          options={{ headerShown: true, title: "Round Detail", presentation: "modal" }}
        />
        <Stack.Screen
          name="scoring/select-course"
          options={{ headerShown: true, title: "Select Course" }}
        />
        <Stack.Screen
          name="scoring/select-layout"
          options={{ headerShown: true, title: "Select Layout" }}
        />
        <Stack.Screen
          name="scoring/scorecard"
          options={{ headerShown: false, gestureEnabled: false }}
        />
        <Stack.Screen
          name="settings/index"
          options={{ headerShown: true, title: "Settings" }}
        />
        <Stack.Screen
          name="settings/edit-profile"
          options={{ headerShown: true, title: "Edit Profile" }}
        />
        <Stack.Screen
          name="event/[id]"
          options={{ headerShown: true, title: "Event" }}
        />
        <Stack.Screen
          name="course/[id]"
          options={{ headerShown: true, title: "Course" }}
        />
        <Stack.Screen
          name="rounds/history"
          options={{ headerShown: true, title: "Round History" }}
        />
        <Stack.Screen
          name="discs/my-discs"
          options={{ headerShown: true, title: "My Discs" }}
        />
        <Stack.Screen
          name="discs/register"
          options={{ headerShown: true, title: "Register Disc" }}
        />
        <Stack.Screen
          name="discs/[code]"
          options={{ headerShown: true, title: "Disc Detail" }}
        />
        <Stack.Screen
          name="notifications"
          options={{ headerShown: true, title: "Notifications" }}
        />
        <Stack.Screen
          name="onboarding"
          options={{ headerShown: false, gestureEnabled: false }}
        />
        <Stack.Screen
          name="practice/putting"
          options={{ headerShown: true, title: "Putting Practice" }}
        />
        <Stack.Screen
          name="achievements"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="player/[id]"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="courses/index"
          options={{ headerShown: true, title: "Discover Courses" }}
        />
        <Stack.Screen
          name="leagues/index"
          options={{ headerShown: true, title: "Browse Leagues" }}
        />
        <Stack.Screen
          name="leagues/[id]"
          options={{ headerShown: true, title: "League" }}
        />
        <Stack.Screen
          name="leaderboard/index"
          options={{ headerShown: true, title: "Leaderboard" }}
        />
        <Stack.Screen
          name="compare"
          options={{ headerShown: true, title: "Compare Players" }}
        />
        <Stack.Screen
          name="stickers/claim"
          options={{ headerShown: true, title: "Claim Sticker" }}
        />
        <Stack.Screen
          name="course/map"
          options={{ headerShown: true, title: "Course Map" }}
        />
        <Stack.Screen
          name="sync"
          options={{ headerShown: true, title: "Sync & Offline" }}
        />
      </Stack>
      </OfflineProvider>
    </AuthProvider>
  );
}
