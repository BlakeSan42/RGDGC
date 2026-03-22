/**
 * Report Tow Truck — Emergency Alert Screen
 *
 * Security: Requires logged-in player (get_current_user).
 * Creates a tow alert → backend pushes notification to ALL players.
 *
 * UX: Designed for SPEED. Two taps to alert:
 * 1. Select alert type (big buttons)
 * 2. Confirm (GPS auto-captured)
 *
 * The difference between this screen and $272.
 */

import React, { useState, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { colors, spacing, fontSize, borderRadius } from "@/constants/theme";
import { api } from "@/services/api";

const ALERT_TYPES = [
  {
    key: "tow_truck_spotted",
    label: "Tow Truck Spotted",
    description: "Tow truck is in the parking lot",
    icon: "eye" as const,
    color: colors.warning,
  },
  {
    key: "car_being_towed",
    label: "Car Being Towed!",
    description: "A car is actively being hooked up",
    icon: "alert-circle" as const,
    color: colors.error,
  },
  {
    key: "enforcement_patrol",
    label: "Enforcement Patrol",
    description: "Someone checking K-stickers",
    icon: "search" as const,
    color: colors.secondary,
  },
  {
    key: "boot_applied",
    label: "Boot on Vehicle",
    description: "A vehicle has been booted",
    icon: "lock-closed" as const,
    color: colors.accent.purple,
  },
];

export default function ReportTowScreen() {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationDesc, setLocationDesc] = useState("");
  const [description, setDescription] = useState("");
  const [sending, setSending] = useState(false);
  const [locationLoading, setLocationLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Location Required", "We need your location to tag the alert. Please enable location services.");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      setLocationLoading(false);
    })();
  }, []);

  const submitAlert = async () => {
    if (!selectedType || !location) return;

    setSending(true);
    try {
      await api.post("/tow-alerts", {
        alert_type: selectedType,
        park_name: "River Grove Park",
        latitude: location.latitude,
        longitude: location.longitude,
        location_description: locationDesc || null,
        description: description || null,
      });

      Alert.alert(
        "Alert Sent!",
        "All players with the app have been notified. If someone is parked there, they're heading to their car now.",
        [{ text: "OK", onPress: () => router.back() }],
      );
    } catch (error: any) {
      Alert.alert("Error", error.response?.data?.detail || "Failed to send alert");
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="close" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Report Tow Activity</Text>
      </View>

      {/* GPS Status */}
      <View style={styles.gpsBar}>
        {locationLoading ? (
          <>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.gpsText}>Getting your location...</Text>
          </>
        ) : location ? (
          <>
            <Ionicons name="location" size={16} color={colors.success} />
            <Text style={styles.gpsText}>Location captured — alert will be GPS-tagged</Text>
          </>
        ) : (
          <>
            <Ionicons name="location-outline" size={16} color={colors.error} />
            <Text style={[styles.gpsText, { color: colors.error }]}>Location unavailable</Text>
          </>
        )}
      </View>

      {/* Alert Type Selection */}
      <Text style={styles.sectionTitle}>What did you see?</Text>
      {ALERT_TYPES.map(type => (
        <TouchableOpacity
          key={type.key}
          style={[
            styles.typeButton,
            selectedType === type.key && { borderColor: type.color, borderWidth: 2, backgroundColor: type.color + "10" },
          ]}
          onPress={() => setSelectedType(type.key)}
        >
          <View style={[styles.typeIcon, { backgroundColor: type.color + "20" }]}>
            <Ionicons name={type.icon} size={24} color={type.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.typeLabel}>{type.label}</Text>
            <Text style={styles.typeDesc}>{type.description}</Text>
          </View>
          {selectedType === type.key && (
            <Ionicons name="checkmark-circle" size={24} color={type.color} />
          )}
        </TouchableOpacity>
      ))}

      {/* Optional Details */}
      {selectedType && (
        <>
          <TextInput
            style={styles.input}
            placeholder="Where in the lot? (e.g., near boat ramp)"
            placeholderTextColor={colors.text.disabled}
            value={locationDesc}
            onChangeText={setLocationDesc}
          />
          <TextInput
            style={[styles.input, { height: 60 }]}
            placeholder="Any details? (e.g., white flatbed, checking stickers)"
            placeholderTextColor={colors.text.disabled}
            value={description}
            onChangeText={setDescription}
            multiline
          />
        </>
      )}

      {/* Submit */}
      <TouchableOpacity
        style={[styles.submitButton, (!selectedType || !location) && styles.submitDisabled]}
        onPress={submitAlert}
        disabled={!selectedType || !location || sending}
      >
        {sending ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Ionicons name="megaphone" size={20} color="#fff" />
            <Text style={styles.submitText}>Alert All Players</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Info */}
      <Text style={styles.infoText}>
        This will send a push notification to every player with the app.
        Only use for real tow activity — false reports will be reviewed.
      </Text>

      {/* Texas Law Quick Reference */}
      <View style={styles.lawCard}>
        <Text style={styles.lawTitle}>Texas Drop Fee Law</Text>
        <Text style={styles.lawText}>
          If you reach your car before the tow truck leaves the lot,
          the max drop fee is <Text style={{ fontWeight: "800" }}>$135</Text> (TX Occ. Code §2308).
          If the truck hasn't fully hooked up, they must release your car for <Text style={{ fontWeight: "800" }}>free</Text>.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.secondary },
  header: {
    flexDirection: "row", alignItems: "center", padding: spacing.lg,
    paddingTop: spacing.xl, backgroundColor: colors.bg.card,
    borderBottomWidth: 1, borderBottomColor: colors.gray[200],
  },
  backButton: { marginRight: spacing.md },
  headerTitle: { fontSize: fontSize.xl, fontWeight: "800", color: colors.text.primary },

  gpsBar: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    backgroundColor: colors.gray[100],
  },
  gpsText: { fontSize: fontSize.sm, color: colors.text.secondary, marginLeft: spacing.sm },

  sectionTitle: {
    fontSize: fontSize.lg, fontWeight: "700", color: colors.text.primary,
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm,
  },

  typeButton: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.bg.card, marginHorizontal: spacing.lg, marginBottom: spacing.sm,
    padding: spacing.md, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.gray[200],
  },
  typeIcon: {
    width: 48, height: 48, borderRadius: borderRadius.md,
    alignItems: "center", justifyContent: "center", marginRight: spacing.md,
  },
  typeLabel: { fontSize: fontSize.base, fontWeight: "700", color: colors.text.primary },
  typeDesc: { fontSize: fontSize.sm, color: colors.text.secondary, marginTop: 2 },

  input: {
    backgroundColor: colors.bg.card, marginHorizontal: spacing.lg, marginBottom: spacing.sm,
    padding: spacing.md, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.gray[200],
    fontSize: fontSize.base, color: colors.text.primary,
  },

  submitButton: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: colors.error, marginHorizontal: spacing.lg, marginTop: spacing.md,
    paddingVertical: spacing.md, borderRadius: borderRadius.md,
  },
  submitDisabled: { backgroundColor: colors.gray[400] },
  submitText: { color: "#fff", fontWeight: "800", fontSize: fontSize.lg, marginLeft: spacing.sm },

  infoText: {
    fontSize: fontSize.xs, color: colors.text.disabled, textAlign: "center",
    paddingHorizontal: spacing.xl, marginTop: spacing.sm,
  },

  lawCard: {
    backgroundColor: colors.accent.blue + "10", marginHorizontal: spacing.lg,
    marginTop: spacing.md, padding: spacing.md, borderRadius: borderRadius.md,
    borderLeftWidth: 4, borderLeftColor: colors.accent.blue,
  },
  lawTitle: { fontSize: fontSize.sm, fontWeight: "700", color: colors.accent.blue },
  lawText: { fontSize: fontSize.sm, color: colors.text.secondary, marginTop: spacing.xs, lineHeight: 20 },
});
