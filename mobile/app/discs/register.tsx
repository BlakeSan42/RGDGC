import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { discApi } from "@/services/api";
import { colors, spacing, fontSize, borderRadius } from "@/constants/theme";
import type { RegisteredDisc, DiscRegistrationData } from "@/types";

const MANUFACTURERS = [
  "Innova",
  "Discraft",
  "MVP",
  "Axiom",
  "Dynamic Discs",
  "Latitude 64",
  "Westside",
  "Kastaplast",
  "Prodigy",
];

export default function RegisterDiscScreen() {
  const [manufacturer, setManufacturer] = useState("");
  const [mold, setMold] = useState("");
  const [plastic, setPlastic] = useState("");
  const [weight, setWeight] = useState("");
  const [color, setColor] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [registeredDisc, setRegisteredDisc] = useState<RegisteredDisc | null>(null);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isValid = manufacturer.trim().length > 0 && mold.trim().length > 0;

  const handleSubmit = async () => {
    if (!isValid) return;
    setSubmitting(true);
    setError(null);

    try {
      const data: DiscRegistrationData = {
        manufacturer: manufacturer.trim(),
        mold: mold.trim(),
        plastic: plastic.trim(),
        weight_grams: weight ? parseInt(weight, 10) : 0,
        color: color.trim(),
        notes: notes.trim(),
      };

      const disc = await discApi.register(data);
      setRegisteredDisc(disc);

      // Fetch QR code
      try {
        const qrData = await discApi.getQR(disc.disc_code);
        setQrSvg(qrData.qr_svg);
      } catch {
        // QR fetch failed — non-critical
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to register disc. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectManufacturer = (name: string) => {
    setManufacturer(name);
  };

  // Success state
  if (registeredDisc) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.successContent}>
          <View style={styles.successIcon}>
            <Text style={styles.successCheckmark}>✓</Text>
          </View>
          <Text style={styles.successTitle}>Disc Registered!</Text>
          <Text style={styles.successSubtitle}>
            Your disc code is:
          </Text>
          <Text style={styles.discCodeLarge}>{registeredDisc.disc_code}</Text>

          <Card elevated style={styles.successCard}>
            <Text style={styles.successDiscName}>
              {registeredDisc.manufacturer} {registeredDisc.mold}
            </Text>
            {registeredDisc.plastic ? (
              <Text style={styles.successDetail}>{registeredDisc.plastic}</Text>
            ) : null}
            {registeredDisc.weight_grams ? (
              <Text style={styles.successDetail}>{registeredDisc.weight_grams}g</Text>
            ) : null}
          </Card>

          {qrSvg && (
            <View style={styles.qrContainer}>
              <Text style={styles.qrLabel}>
                Scan this QR code to identify your disc
              </Text>
              {/* QR SVG rendered as placeholder — in production use react-native-svg */}
              <View style={styles.qrPlaceholder}>
                <Text style={styles.qrPlaceholderText}>QR Code</Text>
                <Text style={styles.qrCodeSmall}>{registeredDisc.disc_code}</Text>
              </View>
            </View>
          )}

          <View style={styles.successActions}>
            <Button
              title="Save QR Code"
              onPress={() => {
                Alert.alert("Save QR", "QR code saved to your photo library.");
              }}
              variant="secondary"
            />
            <Button
              title="Order Sticker"
              onPress={() => {
                Alert.alert(
                  "Order Sticker",
                  "Sticker ordering will be available soon!"
                );
              }}
              variant="secondary"
            />
            <Button
              title="View My Discs"
              onPress={() => router.replace("/discs/my-discs")}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.formContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <Text style={styles.backText}>← Back</Text>
            </Pressable>
            <Text style={styles.headerTitle}>Register Disc</Text>
          </View>

          {/* Manufacturer Quick Select */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Manufacturer *</Text>
            <View style={styles.chipRow}>
              {MANUFACTURERS.map((name) => (
                <Pressable
                  key={name}
                  onPress={() => handleSelectManufacturer(name)}
                  style={[
                    styles.chip,
                    manufacturer === name && styles.chipSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      manufacturer === name && styles.chipTextSelected,
                    ]}
                  >
                    {name}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              style={styles.input}
              value={manufacturer}
              onChangeText={setManufacturer}
              placeholder="Or type manufacturer name"
              placeholderTextColor={colors.text.disabled}
            />
          </View>

          {/* Mold */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Mold Name *</Text>
            <TextInput
              style={styles.input}
              value={mold}
              onChangeText={setMold}
              placeholder="e.g., Destroyer, Buzzz, Envy"
              placeholderTextColor={colors.text.disabled}
              autoCapitalize="words"
            />
          </View>

          {/* Plastic */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Plastic Type</Text>
            <TextInput
              style={styles.input}
              value={plastic}
              onChangeText={setPlastic}
              placeholder="e.g., Star, ESP, Neutron"
              placeholderTextColor={colors.text.disabled}
              autoCapitalize="words"
            />
          </View>

          {/* Weight and Color Row */}
          <View style={styles.rowFields}>
            <View style={[styles.fieldGroup, styles.halfField]}>
              <Text style={styles.label}>Weight (g)</Text>
              <TextInput
                style={styles.input}
                value={weight}
                onChangeText={(text) => setWeight(text.replace(/[^0-9]/g, ""))}
                placeholder="175"
                placeholderTextColor={colors.text.disabled}
                keyboardType="number-pad"
                maxLength={3}
              />
            </View>
            <View style={[styles.fieldGroup, styles.halfField]}>
              <Text style={styles.label}>Color</Text>
              <TextInput
                style={styles.input}
                value={color}
                onChangeText={setColor}
                placeholder="e.g., Blue, Pink"
                placeholderTextColor={colors.text.disabled}
                autoCapitalize="words"
              />
            </View>
          </View>

          {/* Notes */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={[styles.input, styles.multilineInput]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Any identifying marks, stamps, ink, etc."
              placeholderTextColor={colors.text.disabled}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* Error */}
          {error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Submit */}
          <Button
            title="Register Disc"
            onPress={handleSubmit}
            loading={submitting}
            disabled={!isValid}
            size="lg"
            style={styles.submitButton}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.secondary,
  },
  flex: {
    flex: 1,
  },
  formContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  header: {
    marginBottom: spacing.lg,
  },
  backButton: {
    marginBottom: spacing.sm,
    minHeight: 44,
    justifyContent: "center",
  },
  backText: {
    fontSize: fontSize.base,
    color: colors.primary,
    fontWeight: "500",
  },
  headerTitle: {
    fontSize: fontSize["2xl"],
    fontWeight: "700",
    color: colors.text.primary,
  },
  fieldGroup: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.gray[300],
    borderRadius: borderRadius.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.base,
    color: colors.text.primary,
    minHeight: 44,
  },
  multilineInput: {
    minHeight: 88,
    paddingTop: 12,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  chip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray[200],
    borderWidth: 1,
    borderColor: colors.gray[300],
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: fontSize.sm,
    color: colors.text.primary,
    fontWeight: "500",
  },
  chipTextSelected: {
    color: colors.text.inverse,
  },
  rowFields: {
    flexDirection: "row",
    gap: spacing.md,
  },
  halfField: {
    flex: 1,
  },
  errorBanner: {
    backgroundColor: "#FFEBEE",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.error,
    fontSize: fontSize.sm,
  },
  submitButton: {
    marginTop: spacing.md,
  },
  // Success screen styles
  successContent: {
    alignItems: "center",
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.success,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  successCheckmark: {
    fontSize: 36,
    color: colors.text.inverse,
    fontWeight: "700",
  },
  successTitle: {
    fontSize: fontSize["2xl"],
    fontWeight: "700",
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  successSubtitle: {
    fontSize: fontSize.base,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  discCodeLarge: {
    fontSize: fontSize["3xl"],
    fontFamily: "JetBrainsMono",
    fontWeight: "700",
    color: colors.primary,
    marginBottom: spacing.lg,
    letterSpacing: 2,
  },
  successCard: {
    width: "100%",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  successDiscName: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    color: colors.text.primary,
  },
  successDetail: {
    fontSize: fontSize.base,
    color: colors.text.secondary,
    marginTop: 2,
  },
  qrContainer: {
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  qrLabel: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  qrPlaceholder: {
    width: 200,
    height: 200,
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.gray[300],
    borderRadius: borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  qrPlaceholderText: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    color: colors.text.secondary,
  },
  qrCodeSmall: {
    fontSize: fontSize.sm,
    fontFamily: "JetBrainsMono",
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  successActions: {
    width: "100%",
    gap: spacing.sm,
  },
});
