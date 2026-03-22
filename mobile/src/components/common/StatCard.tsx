import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, fontSize } from "@/constants/theme";

interface StatCardProps {
  label: string;
  value: string | number;
  trend?: "up" | "down" | "neutral";
  sublabel?: string;
}

const TREND_CONFIG = {
  up: { icon: "arrow-up" as const, color: colors.success },
  down: { icon: "arrow-down" as const, color: colors.error },
  neutral: { icon: "remove" as const, color: colors.gray[500] },
};

export function StatCard({ label, value, trend, sublabel }: StatCardProps) {
  return (
    <View style={styles.container}>
      <View style={styles.valueRow}>
        <Text style={styles.value}>{value}</Text>
        {trend && (
          <Ionicons
            name={TREND_CONFIG[trend].icon}
            size={18}
            color={TREND_CONFIG[trend].color}
            style={styles.trendIcon}
          />
        )}
      </View>
      <Text style={styles.label}>{label}</Text>
      {sublabel && <Text style={styles.sublabel}>{sublabel}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  value: {
    fontSize: fontSize["3xl"],
    fontWeight: "700",
    color: colors.text.primary,
    fontFamily: "JetBrains Mono",
  },
  trendIcon: {
    marginLeft: spacing.xs,
  },
  label: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    fontWeight: "500",
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sublabel: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },
});
