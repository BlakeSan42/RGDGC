import { useState, useEffect } from "react";
import { View, Text, TextInput, StyleSheet, Alert, KeyboardAvoidingView, Platform, TouchableOpacity, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Google from "expo-auth-session/providers/google";
import * as AppleAuthentication from "expo-apple-authentication";
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

export default function RegisterScreen() {
  const { register, loginWithGoogle, loginWithApple } = useAuth();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: GOOGLE_EXPO_CLIENT_ID,
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
      Alert.alert("Sign-Up Failed", "Could not sign up with Google. Please try again or use email.");
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

  const handleApplePress = async () => {
    setAppleLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      const idToken = credential.identityToken;
      if (!idToken) {
        Alert.alert("Apple Sign-In Failed", "Could not retrieve authentication token. Please try again.");
        return;
      }
      const fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
        .filter(Boolean)
        .join(" ") || undefined;
      await loginWithApple(idToken, fullName);
      router.replace("/(tabs)");
    } catch (err: any) {
      if (err.code !== "ERR_REQUEST_CANCELED") {
        Alert.alert("Apple Sign-In Failed", "Could not sign up with Apple. Please try again.");
      }
    } finally {
      setAppleLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!email || !username || !password) {
      Alert.alert("Missing fields", "Please fill in all required fields.");
      return;
    }

    setLoading(true);
    try {
      await register({ email, username, password, display_name: name || undefined });
      router.replace("/(tabs)");
    } catch (err) {
      Alert.alert("Registration failed", "Email or username may already be taken.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.inner}
      >
        <Text style={styles.title}>Join RGDGC</Text>
        <Text style={styles.subtitle}>Create your account in 30 seconds</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Name"
            value={name}
            onChangeText={setName}
            textContentType="name"
            placeholderTextColor={colors.text.disabled}
          />
          <TextInput
            style={styles.input}
            placeholder="Username"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            textContentType="username"
            placeholderTextColor={colors.text.disabled}
          />
          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            textContentType="emailAddress"
            placeholderTextColor={colors.text.disabled}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="newPassword"
            placeholderTextColor={colors.text.disabled}
          />

          <Button title="Create Account" onPress={handleRegister} loading={loading} size="lg" />

          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or continue with</Text>
            <View style={styles.dividerLine} />
          </View>

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

          {Platform.OS === "ios" && (
            <TouchableOpacity
              style={[styles.appleButton, appleLoading && styles.appleButtonDisabled]}
              onPress={handleApplePress}
              disabled={appleLoading}
              activeOpacity={0.7}
            >
              {appleLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="logo-apple" size={20} color="#FFFFFF" style={styles.appleIcon} />
                  <Text style={styles.appleButtonText}>Continue with Apple</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  inner: { flex: 1, padding: spacing.lg, justifyContent: "center" },
  title: { fontSize: fontSize["3xl"], fontWeight: "700", color: colors.text.primary, marginBottom: spacing.xs },
  subtitle: { fontSize: fontSize.base, color: colors.text.secondary, marginBottom: spacing.xl },
  form: { gap: spacing.md },
  input: {
    borderWidth: 1, borderColor: colors.gray[300], borderRadius: borderRadius.md,
    padding: spacing.md, fontSize: fontSize.base, color: colors.text.primary,
    backgroundColor: colors.bg.secondary, minHeight: 48,
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: spacing.sm,
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
  appleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000000",
    borderRadius: borderRadius.md,
    minHeight: 48,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  appleButtonDisabled: {
    opacity: 0.6,
  },
  appleIcon: {
    marginRight: spacing.sm,
  },
  appleButtonText: {
    fontSize: fontSize.base,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
