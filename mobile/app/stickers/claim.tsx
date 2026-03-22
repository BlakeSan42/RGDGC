/**
 * Sticker Claim Screen
 *
 * Flow: Enter code manually OR scan QR → validate → add disc details → claim
 * Uses: POST /api/v1/stickers/claim/{code}
 *       GET  /api/v1/stickers/validate/{code}
 */

import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { api } from "@/services/api";
import { colors, spacing, fontSize, borderRadius } from "@/constants/theme";

type ClaimStep = "enter_code" | "disc_details" | "success";

interface DiscDetails {
  manufacturer: string;
  mold: string;
  plastic: string;
  weight_grams: string;
  color: string;
  notes: string;
}

export default function StickerClaimScreen() {
  const [step, setStep] = useState<ClaimStep>("enter_code");
  const [code, setCode] = useState("");
  const [validating, setValidating] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [disc, setDisc] = useState<DiscDetails>({
    manufacturer: "",
    mold: "",
    plastic: "",
    weight_grams: "",
    color: "",
    notes: "",
  });

  const validateCode = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      Alert.alert("Enter Code", "Please enter the sticker code (e.g., RGDG-0001).");
      return;
    }

    setValidating(true);
    try {
      const result = await api<{ valid: boolean; status: string }>(
        `/api/v1/stickers/validate/${trimmed}`,
        { auth: false }
      );

      if (!result.valid) {
        Alert.alert("Invalid Code", "This sticker code is not valid. Check the code and try again.");
        return;
      }

      if (result.status === "claimed") {
        Alert.alert("Already Claimed", "This sticker has already been claimed by another player.");
        return;
      }

      setCode(trimmed);
      setStep("disc_details");
    } catch {
      Alert.alert("Error", "Could not validate code. Check your connection and try again.");
    } finally {
      setValidating(false);
    }
  };

  const claimSticker = async () => {
    if (!disc.mold) {
      Alert.alert("Disc Name", "Please enter the disc mold name (e.g., Buzzz, Destroyer).");
      return;
    }

    setClaiming(true);
    try {
      await api(`/api/v1/stickers/claim/${code}`, {
        method: "POST",
        body: {
          manufacturer: disc.manufacturer || undefined,
          mold: disc.mold,
          plastic: disc.plastic || undefined,
          weight_grams: disc.weight_grams ? parseInt(disc.weight_grams) : undefined,
          color: disc.color || undefined,
          notes: disc.notes || undefined,
        },
      });
      setStep("success");
    } catch {
      Alert.alert("Claim Failed", "Could not claim this sticker. It may have already been claimed.");
    } finally {
      setClaiming(false);
    }
  };

  // ── Step 1: Enter Code ──
  if (step === "enter_code") {
    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.inner}
        >
          <Ionicons
            name="qr-code-outline"
            size={80}
            color={colors.primary}
            style={styles.icon}
          />
          <Text style={styles.title}>Claim Your Sticker</Text>
          <Text style={styles.subtitle}>
            Enter the code printed on your disc sticker
          </Text>

          <TextInput
            style={styles.codeInput}
            placeholder="RGDG-0001"
            value={code}
            onChangeText={setCode}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={20}
            placeholderTextColor={colors.text.disabled}
          />

          <Button
            title="Validate Code"
            onPress={validateCode}
            loading={validating}
            size="lg"
          />

          <Text style={styles.hint}>
            The code is on the QR sticker attached to your disc.
            It looks like RGDG-XXXX.
          </Text>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Step 2: Disc Details ──
  if (step === "disc_details") {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.scroll}>
          <Text style={styles.title}>Disc Details</Text>
          <Text style={styles.subtitle}>
            Tell us about the disc for sticker {code}
          </Text>

          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Manufacturer (e.g., Discraft, Innova)"
              value={disc.manufacturer}
              onChangeText={(v) => setDisc({ ...disc, manufacturer: v })}
              placeholderTextColor={colors.text.disabled}
            />
            <TextInput
              style={styles.input}
              placeholder="Mold name (e.g., Buzzz, Destroyer) *"
              value={disc.mold}
              onChangeText={(v) => setDisc({ ...disc, mold: v })}
              placeholderTextColor={colors.text.disabled}
            />
            <TextInput
              style={styles.input}
              placeholder="Plastic (e.g., Z, Star, ESP)"
              value={disc.plastic}
              onChangeText={(v) => setDisc({ ...disc, plastic: v })}
              placeholderTextColor={colors.text.disabled}
            />
            <TextInput
              style={styles.input}
              placeholder="Weight (grams, e.g., 175)"
              value={disc.weight_grams}
              onChangeText={(v) => setDisc({ ...disc, weight_grams: v })}
              keyboardType="numeric"
              maxLength={3}
              placeholderTextColor={colors.text.disabled}
            />
            <TextInput
              style={styles.input}
              placeholder="Color (e.g., Blue, Pink swirl)"
              value={disc.color}
              onChangeText={(v) => setDisc({ ...disc, color: v })}
              placeholderTextColor={colors.text.disabled}
            />
            <TextInput
              style={[styles.input, styles.notesInput]}
              placeholder="Notes (optional)"
              value={disc.notes}
              onChangeText={(v) => setDisc({ ...disc, notes: v })}
              multiline
              numberOfLines={3}
              placeholderTextColor={colors.text.disabled}
            />

            <Button
              title="Claim This Disc"
              onPress={claimSticker}
              loading={claiming}
              size="lg"
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Step 3: Success ──
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.successContainer}>
        <Ionicons name="checkmark-circle" size={100} color={colors.success} />
        <Text style={styles.successTitle}>Disc Claimed!</Text>
        <Text style={styles.successText}>
          {disc.mold} ({code}) is now registered to your account.
        </Text>
        <Text style={styles.successHint}>
          If someone finds your disc, they can scan the QR sticker and contact
          you through the app.
        </Text>

        <View style={styles.successActions}>
          <Button
            title="View My Discs"
            onPress={() => router.replace("/discs/my-discs")}
            size="lg"
          />
          <Button
            title="Claim Another"
            onPress={() => {
              setStep("enter_code");
              setCode("");
              setDisc({ manufacturer: "", mold: "", plastic: "", weight_grams: "", color: "", notes: "" });
            }}
            variant="secondary"
            size="lg"
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  inner: { flex: 1, padding: spacing.lg, justifyContent: "center", alignItems: "center" },
  scroll: { flex: 1, padding: spacing.lg },
  icon: { marginBottom: spacing.lg },
  title: { fontSize: fontSize["2xl"], fontWeight: "700", color: colors.text.primary, textAlign: "center" },
  subtitle: { fontSize: fontSize.base, color: colors.text.secondary, textAlign: "center", marginTop: spacing.xs, marginBottom: spacing.xl },
  codeInput: {
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: fontSize["2xl"],
    fontWeight: "700",
    color: colors.text.primary,
    textAlign: "center",
    letterSpacing: 3,
    marginBottom: spacing.lg,
    width: "100%",
    minHeight: 56,
  },
  hint: { fontSize: fontSize.sm, color: colors.text.secondary, textAlign: "center", marginTop: spacing.lg, paddingHorizontal: spacing.lg },
  form: { gap: spacing.md, marginTop: spacing.md },
  input: {
    borderWidth: 1, borderColor: colors.gray[300], borderRadius: borderRadius.md,
    padding: spacing.md, fontSize: fontSize.base, color: colors.text.primary,
    backgroundColor: colors.bg.secondary, minHeight: 48,
  },
  notesInput: { minHeight: 80, textAlignVertical: "top" },
  successContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.lg },
  successTitle: { fontSize: fontSize["3xl"], fontWeight: "700", color: colors.text.primary, marginTop: spacing.md },
  successText: { fontSize: fontSize.lg, color: colors.text.secondary, textAlign: "center", marginTop: spacing.sm },
  successHint: { fontSize: fontSize.sm, color: colors.text.secondary, textAlign: "center", marginTop: spacing.md, paddingHorizontal: spacing.lg },
  successActions: { gap: spacing.md, width: "100%", marginTop: spacing.xl },
});
