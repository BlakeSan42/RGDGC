import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useOfflineQueue } from "../../hooks/useOfflineQueue";

export function OfflineBanner() {
  const { isOffline, queueSize } = useOfflineQueue();
  const slideAnim = useRef(new Animated.Value(-60)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isOffline ? 0 : -60,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isOffline]);

  // Always render so the animation can slide up/down, but keep it
  // off-screen when online via the transform.
  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateY: slideAnim }] }]}
      pointerEvents={isOffline ? "auto" : "none"}
    >
      <View style={styles.inner}>
        <Text style={styles.text}>
          You're offline. Changes will sync when reconnected.
        </Text>
        {queueSize > 0 && (
          <Text style={styles.queue}>
            {queueSize} action{queueSize !== 1 ? "s" : ""} queued
          </Text>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: "#F59E0B", // amber-500
  },
  inner: {
    paddingTop: 48, // account for status bar
    paddingBottom: 8,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  text: {
    color: "#78350F", // amber-900
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  queue: {
    color: "#92400E", // amber-800
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2,
  },
});
