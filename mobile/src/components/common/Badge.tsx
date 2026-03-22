import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, fontSize, borderRadius } from "@/constants/theme";

type BadgeVariant = "success" | "warning" | "error" | "info" | "neutral";

interface BadgeProps {
  label: string;
  variant: BadgeVariant;
  size?: "sm" | "md";
}

const VARIANT_STYLES: Record<BadgeVariant, { bg: string; text: string }> = {
  success: { bg: "#E8F5E9", text: colors.success },
  warning: { bg: "#FFF8E1", text: "#F57F17" },
  error: { bg: "#FFEBEE", text: colors.error },
  info: { bg: "#E1F5FE", text: colors.info },
  neutral: { bg: colors.gray[200], text: colors.gray[700] },
};

const SIZE_STYLES = {
  sm: {
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    fontSize: fontSize.xs,
  },
  md: {
    paddingVertical: 4,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.sm,
  },
};

export function Badge({ label, variant, size = "md" }: BadgeProps) {
  const variantStyle = VARIANT_STYLES[variant];
  const sizeStyle = SIZE_STYLES[size];

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: variantStyle.bg,
          paddingVertical: sizeStyle.paddingVertical,
          paddingHorizontal: sizeStyle.paddingHorizontal,
        },
      ]}
    >
      <Text
        style={[
          styles.label,
          {
            color: variantStyle.text,
            fontSize: sizeStyle.fontSize,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: borderRadius.full,
    alignSelf: "flex-start",
  },
  label: {
    fontWeight: "600",
  },
});
