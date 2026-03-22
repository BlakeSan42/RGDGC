import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { getScoreColor, getScoreLabel } from "@/types";

interface ScoreBadgeProps {
  strokes: number;
  par: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

export function ScoreBadge({ strokes, par, size = "md", showLabel = false }: ScoreBadgeProps) {
  const relative = strokes - par;
  const color = getScoreColor(relative);
  const label = getScoreLabel(relative);

  const dimensions = {
    sm: { width: 32, height: 32, fontSize: 14 },
    md: { width: 44, height: 44, fontSize: 18 },
    lg: { width: 56, height: 56, fontSize: 24 },
  }[size];

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.badge,
          {
            width: dimensions.width,
            height: dimensions.height,
            backgroundColor: color,
            borderRadius: dimensions.width / 2,
          },
        ]}
      >
        <Text style={[styles.strokes, { fontSize: dimensions.fontSize }]}>
          {strokes}
        </Text>
      </View>
      {showLabel && (
        <Text style={[styles.label, { color }]}>{label}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: 2,
  },
  badge: {
    justifyContent: "center",
    alignItems: "center",
  },
  strokes: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  label: {
    fontSize: 10,
    fontWeight: "600",
  },
});
