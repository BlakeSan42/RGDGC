/**
 * AR Stance Guide — camera overlay showing putting form reference.
 *
 * Shows:
 * - Foot placement zones (staggered or straddle)
 * - Body alignment reference line (target line)
 * - Grip angle guide based on putt style
 * - Nose angle / release reference
 * - Timer for practice reps
 *
 * Uses accelerometer to detect device tilt for stance feedback.
 */

import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import CameraBackground from "./CameraBackground";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

type PuttStyle = "spin" | "push" | "spush" | "turbo";
type StanceType = "staggered" | "straddle";

interface ARStanceGuideProps {
  onClose: () => void;
  initialStyle?: PuttStyle;
}

interface TiltState {
  pitch: number; // forward/back tilt (degrees)
  roll: number; // left/right tilt (degrees)
}

const STYLE_INFO: Record<
  PuttStyle,
  { label: string; description: string; icon: string; tips: string[] }
> = {
  spin: {
    label: "Spin Putt",
    description: "Wrist snap, flat release, most common",
    icon: "sync",
    tips: [
      "Weight on lead foot (60/40)",
      "Flat wrist through release",
      "Follow through at target",
      "Nose angle slightly down",
    ],
  },
  push: {
    label: "Push Putt",
    description: "Full body push, lofted release",
    icon: "push",
    tips: [
      "Weight starts on back foot",
      "Push through with legs",
      "Higher release point",
      "Aim above the basket",
    ],
  },
  spush: {
    label: "Spush Putt",
    description: "Hybrid spin/push, balanced",
    icon: "git-merge",
    tips: [
      "50/50 weight distribution",
      "Moderate wrist action",
      "Level release height",
      "Smooth weight transfer",
    ],
  },
  turbo: {
    label: "Turbo Putt",
    description: "Overhead, for obstacles and headwinds",
    icon: "flash",
    tips: [
      "Grip disc on top (like a ball)",
      "Throw overhead at basket",
      "Quick wrist flick",
      "Use for obstacles/wind only",
    ],
  },
};

export default function ARStanceGuide({
  onClose,
  initialStyle = "spin",
}: ARStanceGuideProps) {
  const [puttStyle, setPuttStyle] = useState<PuttStyle>(initialStyle);
  const [stanceType, setStanceType] = useState<StanceType>("staggered");
  const [tilt, setTilt] = useState<TiltState>({ pitch: 0, roll: 0 });
  const [showTips, setShowTips] = useState(true);

  const styleInfo = STYLE_INFO[puttStyle];

  // Accelerometer for tilt detection
  useEffect(() => {
    if (Platform.OS === "web") return;
    let sub: { remove: () => void } | null = null;
    (async () => {
      try {
        const { Accelerometer } = await import("expo-sensors");
        Accelerometer.setUpdateInterval(100);
        sub = Accelerometer.addListener(({ x, y, z }: { x: number; y: number; z: number }) => {
          // Convert to degrees of tilt
          const pitch = Math.atan2(y, z) * (180 / Math.PI);
          const roll = Math.atan2(x, z) * (180 / Math.PI);
          setTilt({ pitch: Math.round(pitch), roll: Math.round(roll) });
        });
      } catch {}
    })();
    return () => { sub?.remove(); };
  }, []);

  // Stance balance feedback
  const isLevel = Math.abs(tilt.roll) < 5;
  const isGoodPosture = Math.abs(tilt.pitch) > 60 && Math.abs(tilt.pitch) < 120;

  return (
    <CameraBackground facing="front">
      <View style={styles.overlay} />

      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.closeBtn} onPress={onClose}>
          <Ionicons name="close" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>STANCE GUIDE</Text>
        <Pressable
          style={styles.tipsBtn}
          onPress={() => setShowTips(!showTips)}
        >
          <Ionicons
            name={showTips ? "eye-off" : "eye"}
            size={24}
            color="#fff"
          />
        </Pressable>
      </View>

      {/* Stance overlay — foot placement zones */}
      <View style={styles.stanceOverlay}>
        {/* Target line */}
        <View style={styles.targetLine} />
        <Text style={styles.targetLineLabel}>Target Line →</Text>

        {/* Foot zones */}
        {stanceType === "staggered" ? (
          <>
            {/* Lead foot (closer to target) */}
            <View style={[styles.footZone, styles.leadFoot]}>
              <Text style={styles.footLabel}>Lead</Text>
            </View>
            {/* Trail foot */}
            <View style={[styles.footZone, styles.trailFoot]}>
              <Text style={styles.footLabel}>Trail</Text>
            </View>
          </>
        ) : (
          <>
            {/* Straddle — feet side by side */}
            <View style={[styles.footZone, styles.leftFoot]}>
              <Text style={styles.footLabel}>L</Text>
            </View>
            <View style={[styles.footZone, styles.rightFoot]}>
              <Text style={styles.footLabel}>R</Text>
            </View>
          </>
        )}

        {/* Center of gravity marker */}
        <View style={styles.cogMarker}>
          <View
            style={[
              styles.cogDot,
              isLevel ? styles.cogBalanced : styles.cogUnbalanced,
            ]}
          />
          <Text style={styles.cogLabel}>
            {isLevel ? "Balanced" : `Tilt: ${tilt.roll}°`}
          </Text>
        </View>
      </View>

      {/* Tilt feedback */}
      <View style={styles.tiltBar}>
        <View style={styles.tiltIndicator}>
          <View
            style={[
              styles.tiltDot,
              {
                left: `${Math.max(10, Math.min(90, 50 + tilt.roll))}%`,
                backgroundColor: isLevel ? "#4CAF50" : "#FFC107",
              },
            ]}
          />
          <View style={styles.tiltCenter} />
        </View>
        <Text style={styles.tiltLabel}>
          {isLevel ? "Level" : tilt.roll > 0 ? "Leaning Right" : "Leaning Left"}
        </Text>
      </View>

      {/* Style selector */}
      <View style={styles.styleSelector}>
        {(Object.keys(STYLE_INFO) as PuttStyle[]).map((style) => (
          <Pressable
            key={style}
            style={[
              styles.styleBtn,
              puttStyle === style && styles.styleBtnActive,
            ]}
            onPress={() => setPuttStyle(style)}
          >
            <Text
              style={[
                styles.styleBtnText,
                puttStyle === style && styles.styleBtnTextActive,
              ]}
            >
              {STYLE_INFO[style].label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Stance type toggle */}
      <View style={styles.stanceToggle}>
        <Pressable
          style={[
            styles.stanceBtn,
            stanceType === "staggered" && styles.stanceBtnActive,
          ]}
          onPress={() => setStanceType("staggered")}
        >
          <Text style={styles.stanceBtnText}>Staggered</Text>
        </Pressable>
        <Pressable
          style={[
            styles.stanceBtn,
            stanceType === "straddle" && styles.stanceBtnActive,
          ]}
          onPress={() => setStanceType("straddle")}
        >
          <Text style={styles.stanceBtnText}>Straddle</Text>
        </Pressable>
      </View>

      {/* Tips panel */}
      {showTips && (
        <View style={styles.tipsPanel}>
          <Text style={styles.tipsPanelTitle}>{styleInfo.label}</Text>
          <Text style={styles.tipsPanelDesc}>{styleInfo.description}</Text>
          {styleInfo.tips.map((tip, i) => (
            <View key={i} style={styles.tipRow}>
              <Ionicons name="checkmark" size={14} color="#4CAF50" />
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </View>
      )}
    </CameraBackground>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.2)" },

  header: {
    position: "absolute",
    top: 50,
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 20,
  },
  closeBtn: {
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 22,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 2,
  },
  tipsBtn: {
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 22,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  stanceOverlay: {
    position: "absolute",
    bottom: SCREEN_H * 0.35,
    left: 0,
    right: 0,
    height: 200,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
  },
  targetLine: {
    position: "absolute",
    top: "50%",
    left: 20,
    right: 20,
    height: 2,
    backgroundColor: "rgba(255,107,53,0.5)",
    borderStyle: "dashed",
  },
  targetLineLabel: {
    position: "absolute",
    top: "42%",
    right: 24,
    color: "rgba(255,107,53,0.7)",
    fontSize: 11,
    fontWeight: "600",
  },
  footZone: {
    position: "absolute",
    width: 60,
    height: 90,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.4)",
    borderRadius: 30,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  leadFoot: {
    left: SCREEN_W * 0.35,
    top: 30,
  },
  trailFoot: {
    left: SCREEN_W * 0.35,
    top: 100,
  },
  leftFoot: {
    left: SCREEN_W * 0.3,
    top: 55,
  },
  rightFoot: {
    left: SCREEN_W * 0.55,
    top: 55,
  },
  footLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    fontWeight: "600",
  },
  cogMarker: {
    position: "absolute",
    bottom: 10,
    alignItems: "center",
  },
  cogDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#fff",
  },
  cogBalanced: { backgroundColor: "rgba(76,175,80,0.8)" },
  cogUnbalanced: { backgroundColor: "rgba(255,193,7,0.8)" },
  cogLabel: {
    color: "#ccc",
    fontSize: 10,
    fontWeight: "600",
    marginTop: 2,
  },

  tiltBar: {
    position: "absolute",
    bottom: SCREEN_H * 0.30,
    left: 40,
    right: 40,
    alignItems: "center",
    zIndex: 10,
  },
  tiltIndicator: {
    width: "100%",
    height: 8,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 4,
    position: "relative",
  },
  tiltDot: {
    position: "absolute",
    top: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    marginLeft: -8,
  },
  tiltCenter: {
    position: "absolute",
    left: "50%",
    top: -2,
    width: 2,
    height: 12,
    backgroundColor: "rgba(255,255,255,0.3)",
    marginLeft: -1,
  },
  tiltLabel: {
    color: "#ccc",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 6,
  },

  styleSelector: {
    position: "absolute",
    bottom: 110,
    left: 12,
    right: 12,
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    zIndex: 10,
  },
  styleBtn: {
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  styleBtnActive: {
    backgroundColor: "rgba(27,94,32,0.9)",
    borderColor: "#4CAF50",
  },
  styleBtnText: {
    color: "#aaa",
    fontSize: 12,
    fontWeight: "600",
  },
  styleBtnTextActive: {
    color: "#fff",
  },

  stanceToggle: {
    position: "absolute",
    bottom: 60,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    zIndex: 10,
  },
  stanceBtn: {
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  stanceBtnActive: {
    backgroundColor: "rgba(255,107,53,0.8)",
    borderColor: "#FF6B35",
  },
  stanceBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },

  tipsPanel: {
    position: "absolute",
    top: 110,
    left: 16,
    right: 16,
    backgroundColor: "rgba(0,0,0,0.85)",
    borderRadius: 16,
    padding: 16,
    zIndex: 15,
  },
  tipsPanelTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 2,
  },
  tipsPanelDesc: {
    color: "#aaa",
    fontSize: 13,
    marginBottom: 10,
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  tipText: {
    color: "#ddd",
    fontSize: 13,
  },
});
