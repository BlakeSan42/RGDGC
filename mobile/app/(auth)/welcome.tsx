import { View, Text, StyleSheet, Image } from "react-native";
import { Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/common/Button";
import { colors, spacing, fontSize } from "@/constants/theme";

export default function WelcomeScreen() {
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
});
