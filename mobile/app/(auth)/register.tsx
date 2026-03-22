import { useState } from "react";
import { View, Text, TextInput, StyleSheet, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/common/Button";
import { colors, spacing, fontSize, borderRadius } from "@/constants/theme";

export default function RegisterScreen() {
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

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
});
