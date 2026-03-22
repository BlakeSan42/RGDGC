import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { blockchainApi } from "@/services/api";
import { colors, spacing, fontSize, borderRadius } from "@/constants/theme";
import Constants from "expo-constants";

type PuttingStyle = "spin" | "push" | "spush";

export default function SettingsScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();

  // Wallet state
  const [walletAddress, setWalletAddress] = useState<string | null>(
    user?.wallet_address ?? null
  );
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [connectingWallet, setConnectingWallet] = useState(false);

  const connectWallet = async () => {
    if (Platform.OS !== "web") {
      Alert.alert("Wallet Connect", "Wallet connection is available in the web browser. Use MetaMask on desktop.");
      return;
    }
    try {
      setConnectingWallet(true);
      const ethereum = (window as any).ethereum;
      if (!ethereum) {
        Alert.alert("MetaMask Required", "Install MetaMask browser extension to connect your wallet.");
        return;
      }
      const accounts = await ethereum.request({ method: "eth_requestAccounts" });
      const address = accounts[0];

      // Get nonce from backend
      const { message } = await blockchainApi.getNonce(address);

      // Sign with MetaMask
      const signature = await ethereum.request({
        method: "personal_sign",
        params: [message, address],
      });

      // Link wallet to account
      await blockchainApi.linkWallet(address, signature);
      setWalletAddress(address);

      // Get balance
      try {
        const { balance } = await blockchainApi.getBalance();
        setWalletBalance(balance);
      } catch {
        // Balance fetch is optional
      }

      Alert.alert("Wallet Connected", `Connected: ${address.slice(0, 6)}...${address.slice(-4)}`);
    } catch (err: any) {
      Alert.alert("Connection Failed", err.message || "Could not connect wallet");
    } finally {
      setConnectingWallet(false);
    }
  };

  // Preference state (would persist via AsyncStorage in production)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [useMeters, setUseMeters] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [showHandicap, setShowHandicap] = useState(true);
  const [puttingStyle, setPuttingStyle] = useState<PuttingStyle>("spin");

  const appVersion =
    Constants.expoConfig?.version ?? Constants.manifest?.version ?? "1.0.0";

  const cyclePuttingStyle = () => {
    const order: PuttingStyle[] = ["spin", "push", "spush"];
    const next = order[(order.indexOf(puttingStyle) + 1) % order.length];
    setPuttingStyle(next);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to permanently delete your account? This action cannot be undone. All rounds, stats, and league history will be lost.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            // TODO: Call API to delete account
            logout();
          },
        },
      ]
    );
  };

  const handleChangePassword = () => {
    Alert.alert("Change Password", "A password reset link will be sent to your email.", [
      { text: "Cancel", style: "cancel" },
      { text: "Send Link", onPress: () => {} },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Account */}
      <Text style={styles.sectionHeader}>ACCOUNT</Text>
      <View style={styles.section}>
        <SettingsRow
          label="Edit Profile"
          chevron
          onPress={() => router.push("/settings/edit-profile")}
        />
        <Divider />
        <SettingsRow label="Change Password" chevron onPress={handleChangePassword} />
        <Divider />
        <SettingsRow label="Linked Accounts" value="Apple, Google" chevron onPress={() => {}} />
      </View>

      {/* Wallet */}
      <Text style={styles.sectionHeader}>WALLET</Text>
      <View style={styles.section}>
        {walletAddress ? (
          <>
            <SettingsRow
              label="Address"
              value={`${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`}
            />
            <Divider />
            <SettingsRow
              label="$RGDG Balance"
              value={walletBalance !== null ? `${walletBalance.toLocaleString()} RGDG` : "—"}
            />
          </>
        ) : (
          <Pressable
            style={[styles.row, { justifyContent: "center" }]}
            onPress={connectWallet}
            disabled={connectingWallet}
          >
            {connectingWallet ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={[styles.rowLabel, { color: colors.primary, textAlign: "center", fontWeight: "600" }]}>
                Connect Wallet (MetaMask)
              </Text>
            )}
          </Pressable>
        )}
      </View>

      {/* Preferences */}
      <Text style={styles.sectionHeader}>PREFERENCES</Text>
      <View style={styles.section}>
        <SettingsRow label="Notifications">
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            trackColor={{ false: colors.gray[300], true: colors.primaryLight }}
            thumbColor={Platform.OS === "android" ? colors.bg.primary : undefined}
          />
        </SettingsRow>
        <Divider />
        <SettingsRow label="Distance Units">
          <Pressable style={styles.togglePill} onPress={() => setUseMeters(!useMeters)}>
            <View style={[styles.pillOption, useMeters && styles.pillOptionActive]}>
              <Text style={[styles.pillText, useMeters && styles.pillTextActive]}>Meters</Text>
            </View>
            <View style={[styles.pillOption, !useMeters && styles.pillOptionActive]}>
              <Text style={[styles.pillText, !useMeters && styles.pillTextActive]}>Feet</Text>
            </View>
          </Pressable>
        </SettingsRow>
        <Divider />
        <SettingsRow label="Dark Mode">
          <Switch
            value={darkMode}
            onValueChange={setDarkMode}
            trackColor={{ false: colors.gray[300], true: colors.primaryLight }}
            thumbColor={Platform.OS === "android" ? colors.bg.primary : undefined}
          />
        </SettingsRow>
      </View>

      {/* Disc Golf */}
      <Text style={styles.sectionHeader}>DISC GOLF</Text>
      <View style={styles.section}>
        <SettingsRow
          label="Default Course"
          value="River Grove DGC"
          chevron
          onPress={() => {}}
        />
        <Divider />
        <SettingsRow label="Putting Style" value={puttingStyle} onPress={cyclePuttingStyle} />
        <Divider />
        <SettingsRow label="Show Handicap">
          <Switch
            value={showHandicap}
            onValueChange={setShowHandicap}
            trackColor={{ false: colors.gray[300], true: colors.primaryLight }}
            thumbColor={Platform.OS === "android" ? colors.bg.primary : undefined}
          />
        </SettingsRow>
      </View>

      {/* Data */}
      <Text style={styles.sectionHeader}>DATA</Text>
      <View style={styles.section}>
        <SettingsRow
          label="Sync & Offline"
          value=""
          chevron
          onPress={() => router.push("/sync")}
        />
      </View>

      {/* About */}
      <Text style={styles.sectionHeader}>ABOUT</Text>
      <View style={styles.section}>
        <SettingsRow label="App Version" value={`v${appVersion}`} />
        <Divider />
        <SettingsRow label="Terms of Service" chevron onPress={() => {}} />
        <Divider />
        <SettingsRow label="Privacy Policy" chevron onPress={() => {}} />
        <Divider />
        <SettingsRow label="Contact Support" chevron onPress={() => {}} />
      </View>

      {/* Delete Account */}
      <Pressable style={styles.deleteButton} onPress={handleDeleteAccount}>
        <Text style={styles.deleteText}>Delete Account</Text>
      </Pressable>

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

// ── Subcomponents ──

function SettingsRow({
  label,
  value,
  chevron,
  onPress,
  children,
}: {
  label: string;
  value?: string;
  chevron?: boolean;
  onPress?: () => void;
  children?: React.ReactNode;
}) {
  const Wrapper = onPress ? Pressable : View;

  return (
    <Wrapper
      style={({ pressed }: { pressed?: boolean }) => [
        styles.row,
        pressed ? { backgroundColor: colors.gray[50] } : undefined,
      ]}
      onPress={onPress}
    >
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>
        {children ?? (
          <>
            {value ? <Text style={styles.rowValue}>{value}</Text> : null}
            {chevron ? <Text style={styles.chevron}>{">"}</Text> : null}
          </>
        )}
      </View>
    </Wrapper>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

// ── Styles ──

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.secondary,
  },
  content: {
    paddingBottom: spacing.xxl,
  },
  sectionHeader: {
    fontSize: fontSize.xs,
    fontWeight: "600",
    color: colors.text.secondary,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
    letterSpacing: 0.5,
  },
  section: {
    backgroundColor: colors.bg.primary,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.gray[200],
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    minHeight: 44,
  },
  rowLabel: {
    fontSize: fontSize.base,
    color: colors.text.primary,
    flex: 1,
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  rowValue: {
    fontSize: fontSize.base,
    color: colors.text.secondary,
  },
  chevron: {
    fontSize: fontSize.base,
    color: colors.gray[400],
    marginLeft: spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: colors.gray[100],
    marginLeft: spacing.md,
  },
  togglePill: {
    flexDirection: "row",
    backgroundColor: colors.gray[100],
    borderRadius: borderRadius.sm,
    overflow: "hidden",
  },
  pillOption: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm + 2,
  },
  pillOptionActive: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
  },
  pillText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    fontWeight: "500",
  },
  pillTextActive: {
    color: colors.text.inverse,
  },
  deleteButton: {
    marginTop: spacing.xl,
    marginHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    alignItems: "center",
    borderRadius: borderRadius.md,
    backgroundColor: colors.bg.primary,
    borderWidth: 1,
    borderColor: colors.error,
  },
  deleteText: {
    fontSize: fontSize.base,
    fontWeight: "600",
    color: colors.error,
  },
});
