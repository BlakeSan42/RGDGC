import { useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useAuth } from "@/context/AuthContext";
import { useGoogleAuth } from "@/hooks/useGoogleAuth";
import { colors, spacing, fontSize, borderRadius } from "@/constants/theme";

const GOOGLE_EXPO_CLIENT_ID = Constants.expoConfig?.extra?.googleExpoClientId ?? process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID ?? "";
const GOOGLE_IOS_CLIENT_ID = Constants.expoConfig?.extra?.googleIosClientId ?? process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "";
const GOOGLE_ANDROID_CLIENT_ID = Constants.expoConfig?.extra?.googleAndroidClientId ?? process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? "";
const GOOGLE_WEB_CLIENT_ID = Constants.expoConfig?.extra?.googleWebClientId ?? process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";

export default function WelcomeScreen() {
  const { loginWithGoogle } = useAuth();

  const google = useGoogleAuth({
    clientId: GOOGLE_EXPO_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
    webClientId: GOOGLE_WEB_CLIENT_ID,
  });

  useEffect(() => {
    if (google.idToken) {
      handleGoogleAuth(google.idToken);
    } else if (google.error) {
      Alert.alert("Sign-In Failed", google.error);
    }
  }, [google.idToken, google.error]);

  const handleGoogleAuth = async (idToken: string) => {
    try {
      await loginWithGoogle(idToken);
      router.replace("/(tabs)");
    } catch (err) {
      Alert.alert("Sign-In Failed", "Could not sign in with Google. Please try again.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.emoji}>🥏</Text>
        <Text style={styles.title}>RGDGC</Text>
        <Text style={styles.subtitle}>River Grove Disc Golf Club</Text>
        <Text style={styles.tagline}>
          Track rounds • Compete in leagues • Improve your game
        </Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.googleButton, (!google.request || google.loading) && styles.googleButtonDisabled]}
          onPress={google.promptAsync}
          disabled={!google.request || google.loading}
          activeOpacity={0.7}
        >
          {google.loading ? (
            <ActivityIndicator size="small" color={colors.text.primary} />
          ) : (
            <>
              <Ionicons name="logo-google" size={20} color="#4285F4" style={styles.googleIcon} />
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.hint}>
          New players and existing members — just sign in with Google.{"\n"}
          We'll find your account or create one automatically.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    justifyContent: "space-between",
    padding: spacing.lg,
  },
  hero: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.sm,
  },
  emoji: {
    fontSize: 80,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSize["4xl"],
    fontWeight: "800",
    color: colors.primary,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: fontSize.lg,
    color: colors.text.secondary,
    fontWeight: "500",
  },
  tagline: {
    fontSize: fontSize.base,
    color: colors.text.secondary,
    textAlign: "center",
    marginTop: spacing.md,
  },
  actions: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg.primary,
    borderWidth: 1,
    borderColor: colors.gray[300],
    borderRadius: borderRadius.md,
    minHeight: 52,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  googleButtonDisabled: {
    opacity: 0.6,
  },
  googleIcon: {
    marginRight: spacing.sm,
  },
  googleButtonText: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    color: colors.text.primary,
  },
  hint: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    textAlign: "center",
    lineHeight: 20,
  },
});
