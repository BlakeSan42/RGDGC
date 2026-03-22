import { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { Link, router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import Constants from "expo-constants";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/common/Button";
import { colors, spacing, fontSize, borderRadius } from "@/constants/theme";

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_EXPO_CLIENT_ID = Constants.expoConfig?.extra?.googleExpoClientId ?? process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID ?? "";
const GOOGLE_IOS_CLIENT_ID = Constants.expoConfig?.extra?.googleIosClientId ?? process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "";
const GOOGLE_ANDROID_CLIENT_ID = Constants.expoConfig?.extra?.googleAndroidClientId ?? process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? "";
const GOOGLE_WEB_CLIENT_ID = Constants.expoConfig?.extra?.googleWebClientId ?? process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";

export default function WelcomeScreen() {
  const { loginWithGoogle } = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);

  const [request, response, promptAsync] = Google.useAuthRequest({
    expoClientId: GOOGLE_EXPO_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
    webClientId: GOOGLE_WEB_CLIENT_ID,
  });

  useEffect(() => {
    if (response?.type === "success") {
      const idToken = response.authentication?.idToken;
      if (idToken) {
        handleGoogleAuth(idToken);
      } else {
        setGoogleLoading(false);
        Alert.alert("Google Sign-In Failed", "Could not retrieve authentication token. Please try again.");
      }
    } else if (response?.type === "error") {
      setGoogleLoading(false);
      Alert.alert("Google Sign-In Failed", response.error?.message || "An unexpected error occurred. Please try again.");
    } else if (response?.type === "dismiss") {
      setGoogleLoading(false);
    }
  }, [response]);

  const handleGoogleAuth = async (idToken: string) => {
    try {
      await loginWithGoogle(idToken);
      router.replace("/(tabs)");
    } catch (err) {
      Alert.alert("Sign-In Failed", "Could not sign in with Google. Please try again.");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGooglePress = async () => {
    setGoogleLoading(true);
    try {
      await promptAsync();
    } catch (err) {
      setGoogleLoading(false);
      Alert.alert("Google Sign-In Failed", "Could not start Google sign-in. Please try again.");
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
          style={[styles.googleButton, (!request || googleLoading) && styles.googleButtonDisabled]}
          onPress={handleGooglePress}
          disabled={!request || googleLoading}
          activeOpacity={0.7}
        >
          {googleLoading ? (
            <ActivityIndicator size="small" color={colors.text.primary} />
          ) : (
            <>
              <Ionicons name="logo-google" size={20} color="#4285F4" style={styles.googleIcon} />
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.dividerContainer}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <Link href="/(tabs)" asChild>
          <Button title="Start Scoring a Round" variant="primary" size="lg" onPress={() => {}} />
        </Link>

        <Link href="/(auth)/register" asChild>
          <Button title="Create Account" variant="secondary" size="lg" onPress={() => {}} />
        </Link>

        <Link href="/(auth)/login" asChild>
          <Button title="Already have an account? Log in" variant="ghost" onPress={() => {}} />
        </Link>
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
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: spacing.xs,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.gray[300],
  },
  dividerText: {
    paddingHorizontal: spacing.md,
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg.primary,
    borderWidth: 1,
    borderColor: colors.gray[300],
    borderRadius: borderRadius.md,
    minHeight: 48,
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
    fontSize: fontSize.base,
    fontWeight: "600",
    color: colors.text.primary,
  },
});
