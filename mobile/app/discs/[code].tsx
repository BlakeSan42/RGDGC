import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Share,
  Pressable,
  RefreshControl,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card } from "@/components/common/Card";
import { Button } from "@/components/common/Button";
import { discApi } from "@/services/api";
import { colors, spacing, fontSize, borderRadius } from "@/constants/theme";
import type { RegisteredDisc, DiscFoundReport } from "@/types";

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  active: { color: colors.success, bg: "#E8F5E9", label: "Active" },
  lost: { color: colors.error, bg: "#FFEBEE", label: "Lost" },
  found: { color: "#F9A825", bg: "#FFF8E1", label: "Found" },
  retired: { color: colors.gray[500], bg: colors.gray[100], label: "Retired" },
};

export default function DiscDetailScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const [disc, setDisc] = useState<RegisteredDisc | null>(null);
  const [foundReports, setFoundReports] = useState<DiscFoundReport[]>([]);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDisc = useCallback(async () => {
    if (!code) return;
    try {
      setError(null);
      const [discData, qrData] = await Promise.allSettled([
        discApi.getDisc(code),
        discApi.getQR(code),
      ]);

      if (discData.status === "fulfilled") {
        setDisc(discData.value);

        // Fetch found reports if disc is lost
        if (discData.value.status === "lost") {
          try {
            const reports = await discApi.foundReports(code);
            setFoundReports(reports);
          } catch {
            // Non-critical
          }
        }
      } else {
        setError("Failed to load disc details.");
      }

      if (qrData.status === "fulfilled") {
        setQrSvg(qrData.value.qr_svg);
      }
    } catch {
      setError("Failed to load disc details.");
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    loadDisc();
  }, [loadDisc]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDisc();
    setRefreshing(false);
  };

  const handleReportLost = () => {
    Alert.alert(
      "Report Lost",
      "Mark this disc as lost? Anyone who scans the QR code will be able to contact you.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Report Lost",
          style: "destructive",
          onPress: async () => {
            if (!code) return;
            setActionLoading(true);
            try {
              const updated = await discApi.reportLost(code);
              setDisc(updated);
            } catch {
              Alert.alert("Error", "Failed to report disc as lost.");
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleConfirmReturned = async () => {
    if (!code) return;
    setActionLoading(true);
    try {
      const updated = await discApi.confirmReturned(code);
      setDisc(updated);
      setFoundReports([]);
      Alert.alert("Welcome Back!", "Your disc has been marked as returned.");
    } catch {
      Alert.alert("Error", "Failed to confirm disc return.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleShare = async () => {
    if (!disc) return;
    try {
      await Share.share({
        message: `Check out my ${disc.manufacturer} ${disc.mold}! Disc code: ${disc.disc_code}\n\nRegistered with RGDGC`,
      });
    } catch {
      // User cancelled or share failed
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading disc details...</Text>
      </View>
    );
  }

  if (error || !disc) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Disc Not Found</Text>
          <Text style={styles.errorMessage}>
            {error || "Could not find a disc with that code."}
          </Text>
          <Button title="Go Back" onPress={() => router.back()} variant="secondary" />
        </View>
      </SafeAreaView>
    );
  }

  const status = STATUS_CONFIG[disc.status] || STATUS_CONFIG.active;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Back Button */}
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>

        {/* Disc Info Card */}
        <Card elevated style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <View style={styles.infoTitleArea}>
              <Text style={styles.moldName}>{disc.mold}</Text>
              <Text style={styles.manufacturerName}>{disc.manufacturer}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
              <Text style={[styles.statusText, { color: status.color }]}>
                {status.label}
              </Text>
            </View>
          </View>

          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Plastic</Text>
              <Text style={styles.infoValue}>{disc.plastic || "N/A"}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Weight</Text>
              <Text style={styles.infoValue}>
                {disc.weight_grams ? `${disc.weight_grams}g` : "N/A"}
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Color</Text>
              <View style={styles.colorDisplay}>
                <View
                  style={[
                    styles.colorDot,
                    { backgroundColor: disc.color || colors.gray[400] },
                  ]}
                />
                <Text style={styles.infoValue}>{disc.color || "N/A"}</Text>
              </View>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Registered</Text>
              <Text style={styles.infoValue}>
                {new Date(disc.registered_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </Text>
            </View>
          </View>

          {disc.notes ? (
            <View style={styles.notesSection}>
              <Text style={styles.infoLabel}>Notes</Text>
              <Text style={styles.notesText}>{disc.notes}</Text>
            </View>
          ) : null}
        </Card>

        {/* Disc Code */}
        <View style={styles.codeSection}>
          <Text style={styles.codeSectionLabel}>Disc Code</Text>
          <Text style={styles.discCodeLarge}>{disc.disc_code}</Text>
        </View>

        {/* QR Code Display */}
        <Card elevated style={styles.qrCard}>
          <Text style={styles.qrTitle}>QR Code</Text>
          <View style={styles.qrPlaceholder}>
            <Text style={styles.qrPlaceholderIcon}>QR</Text>
            <Text style={styles.qrPlaceholderCode}>{disc.disc_code}</Text>
          </View>
          <Text style={styles.qrHint}>
            Apply this QR code to your disc for easy identification
          </Text>
        </Card>

        {/* Status Actions */}
        <View style={styles.actionsSection}>
          {disc.status === "active" && (
            <Button
              title="Report Lost"
              onPress={handleReportLost}
              loading={actionLoading}
              variant="secondary"
              size="lg"
              style={styles.lostButton}
            />
          )}

          {disc.status === "lost" && (
            <>
              {/* Found Reports */}
              {foundReports.length > 0 && (
                <View style={styles.reportsSection}>
                  <Text style={styles.reportsTitle}>
                    Found Reports ({foundReports.length})
                  </Text>
                  {foundReports.map((report) => (
                    <Card key={report.id} style={styles.reportCard}>
                      <Text style={styles.reportFinder}>
                        Found by: {report.finder_name}
                      </Text>
                      <Text style={styles.reportLocation}>
                        Location: {report.found_location}
                      </Text>
                      {report.message ? (
                        <Text style={styles.reportMessage}>
                          "{report.message}"
                        </Text>
                      ) : null}
                      <Text style={styles.reportDate}>
                        {new Date(report.found_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </Text>
                    </Card>
                  ))}
                </View>
              )}

              {foundReports.length === 0 && (
                <Card style={styles.noReportsCard}>
                  <Text style={styles.noReportsText}>
                    No one has reported finding this disc yet. The QR code on
                    your disc will help finders return it to you.
                  </Text>
                </Card>
              )}

              <Button
                title="Mark as Returned"
                onPress={handleConfirmReturned}
                loading={actionLoading}
                size="lg"
              />
            </>
          )}

          {disc.status === "found" && (
            <Button
              title="Confirm Return"
              onPress={handleConfirmReturned}
              loading={actionLoading}
              size="lg"
            />
          )}
        </View>

        {/* Share */}
        <Button
          title="Share Disc"
          onPress={handleShare}
          variant="ghost"
          style={styles.shareButton}
        />

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.secondary,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.bg.secondary,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: fontSize.base,
    color: colors.text.secondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
    gap: spacing.md,
  },
  errorTitle: {
    fontSize: fontSize.xl,
    fontWeight: "700",
    color: colors.text.primary,
  },
  errorMessage: {
    fontSize: fontSize.base,
    color: colors.text.secondary,
    textAlign: "center",
  },
  backButton: {
    marginBottom: spacing.md,
    minHeight: 44,
    justifyContent: "center",
  },
  backText: {
    fontSize: fontSize.base,
    color: colors.primary,
    fontWeight: "500",
  },
  infoCard: {
    marginBottom: spacing.md,
  },
  infoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.md,
  },
  infoTitleArea: {
    flex: 1,
  },
  moldName: {
    fontSize: fontSize["2xl"],
    fontWeight: "700",
    color: colors.text.primary,
  },
  manufacturerName: {
    fontSize: fontSize.base,
    color: colors.text.secondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
  },
  statusText: {
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  infoItem: {
    minWidth: "40%",
    gap: 2,
  },
  infoLabel: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontWeight: "500",
  },
  infoValue: {
    fontSize: fontSize.base,
    fontWeight: "500",
    color: colors.text.primary,
  },
  colorDisplay: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: colors.gray[300],
  },
  notesSection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
    gap: spacing.xs,
  },
  notesText: {
    fontSize: fontSize.base,
    color: colors.text.primary,
    lineHeight: 22,
  },
  codeSection: {
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  codeSectionLabel: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  discCodeLarge: {
    fontSize: fontSize["3xl"],
    fontFamily: "JetBrainsMono",
    fontWeight: "700",
    color: colors.primary,
    letterSpacing: 2,
  },
  qrCard: {
    alignItems: "center",
    marginBottom: spacing.md,
  },
  qrTitle: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  qrPlaceholder: {
    width: 200,
    height: 200,
    backgroundColor: colors.gray[50],
    borderWidth: 1,
    borderColor: colors.gray[300],
    borderRadius: borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  qrPlaceholderIcon: {
    fontSize: fontSize["2xl"],
    fontWeight: "700",
    color: colors.gray[400],
  },
  qrPlaceholderCode: {
    fontSize: fontSize.sm,
    fontFamily: "JetBrainsMono",
    color: colors.gray[500],
    marginTop: spacing.xs,
  },
  qrHint: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    textAlign: "center",
  },
  actionsSection: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  lostButton: {
    borderColor: colors.error,
  },
  reportsSection: {
    gap: spacing.sm,
  },
  reportsTitle: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  reportCard: {
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
  },
  reportFinder: {
    fontSize: fontSize.base,
    fontWeight: "600",
    color: colors.text.primary,
  },
  reportLocation: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  reportMessage: {
    fontSize: fontSize.sm,
    color: colors.text.primary,
    fontStyle: "italic",
    marginTop: spacing.xs,
  },
  reportDate: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  noReportsCard: {
    backgroundColor: colors.gray[50],
  },
  noReportsText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    textAlign: "center",
    lineHeight: 20,
  },
  shareButton: {
    marginTop: spacing.sm,
  },
  bottomSpacer: {
    height: spacing.xxl,
  },
});
