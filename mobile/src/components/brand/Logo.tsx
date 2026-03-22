import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors } from "@/constants/theme";
import { DiscIcon } from "./DiscIcon";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  color?: string;
}

const SIZE_CONFIG = {
  sm: { discSize: 24, fontSize: 16, gap: 4 },
  md: { discSize: 40, fontSize: 28, gap: 6 },
  lg: { discSize: 64, fontSize: 44, gap: 8 },
} as const;

export function Logo({ size = "md", color = colors.primary }: LogoProps) {
  const config = SIZE_CONFIG[size];

  return (
    <View style={styles.container}>
      <DiscIcon size={config.discSize} color={color} />
      <View style={{ height: config.gap }} />
      <Text
        style={[
          styles.text,
          {
            fontSize: config.fontSize,
            color,
          },
        ]}
      >
        RGDGC
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  text: {
    fontFamily: "Poppins",
    fontWeight: "700",
    letterSpacing: 2,
  },
});
