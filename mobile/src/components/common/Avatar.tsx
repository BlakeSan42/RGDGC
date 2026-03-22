import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { colors } from "@/constants/theme";

const AVATAR_PALETTE = [
  "#1B5E20", "#FF6B35", "#7B1FA2", "#2196F3",
  "#E65100", "#00897B", "#C62828", "#5C6BC0",
] as const;

const SIZE_MAP = {
  sm: 32,
  md: 44,
  lg: 64,
  xl: 96,
} as const;

const FONT_SIZE_MAP = {
  sm: 12,
  md: 16,
  lg: 24,
  xl: 36,
} as const;

interface AvatarProps {
  uri?: string;
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "?";
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function Avatar({ uri, name, size = "md" }: AvatarProps) {
  const dimension = SIZE_MAP[size];
  const fontSize = FONT_SIZE_MAP[size];
  const borderRadiusValue = dimension / 2;

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[
          styles.image,
          {
            width: dimension,
            height: dimension,
            borderRadius: borderRadiusValue,
          },
        ]}
      />
    );
  }

  const bgColor = AVATAR_PALETTE[hashName(name) % AVATAR_PALETTE.length];
  const initials = getInitials(name);

  return (
    <View
      style={[
        styles.initialsContainer,
        {
          width: dimension,
          height: dimension,
          borderRadius: borderRadiusValue,
          backgroundColor: bgColor,
        },
      ]}
    >
      <Text style={[styles.initials, { fontSize }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  initialsContainer: {
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  initials: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
});
