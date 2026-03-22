import React from "react";
import { View, StyleSheet } from "react-native";
import { colors } from "@/constants/theme";

interface DiscIconProps {
  size?: number;
  color?: string;
}

export function DiscIcon({ size = 40, color = colors.primary }: DiscIconProps) {
  const outerRadius = size / 2;
  const middleSize = size * 0.65;
  const innerSize = size * 0.35;
  const coreSize = size * 0.15;

  return (
    <View
      style={[
        styles.ring,
        {
          width: size,
          height: size,
          borderRadius: outerRadius,
          borderColor: color,
          borderWidth: size * 0.06,
        },
      ]}
    >
      <View
        style={[
          styles.ring,
          {
            width: middleSize,
            height: middleSize,
            borderRadius: middleSize / 2,
            borderColor: color,
            borderWidth: size * 0.04,
          },
        ]}
      >
        <View
          style={[
            styles.ring,
            {
              width: innerSize,
              height: innerSize,
              borderRadius: innerSize / 2,
              borderColor: color,
              borderWidth: size * 0.03,
            },
          ]}
        >
          <View
            style={{
              width: coreSize,
              height: coreSize,
              borderRadius: coreSize / 2,
              backgroundColor: color,
            }}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    justifyContent: "center",
    alignItems: "center",
  },
});
