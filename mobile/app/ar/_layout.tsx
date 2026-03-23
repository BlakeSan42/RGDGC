import { Stack } from "expo-router";

export default function ARLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "fade",
        presentation: "fullScreenModal",
        gestureEnabled: true,
      }}
    />
  );
}
