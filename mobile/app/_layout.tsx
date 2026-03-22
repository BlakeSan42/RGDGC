import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "@/context/AuthContext";

export default function RootLayout() {
  return (
    <AuthProvider>
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
      </Stack>
    </AuthProvider>
  );
}
