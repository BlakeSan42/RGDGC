import React, { useState } from "react";
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
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/common/Button";
import { colors, spacing, fontSize, borderRadius } from "@/constants/theme";

export default function EditProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [displayName, setDisplayName] = useState(user?.display_name ?? "");
  const [username, setUsername] = useState(user?.username ?? "");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!displayName.trim()) {
      newErrors.displayName = "Display name is required";
    }

    if (!username.trim()) {
      newErrors.username = "Username is required";
    } else if (username.length < 3) {
      newErrors.username = "Username must be at least 3 characters";
    } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      newErrors.username = "Letters, numbers, and underscores only";
    }

    if (bio.length > 200) {
      newErrors.bio = "Bio must be 200 characters or fewer";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setIsSaving(true);
    try {
      // TODO: Call API to update profile
      // await api.patch("/api/v1/users/me", { display_name: displayName, username, phone, bio });
      Alert.alert("Profile Updated", "Your changes have been saved.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert("Error", "Failed to save changes. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const avatarInitial = (displayName || username || "?").charAt(0).toUpperCase();

  if (!user) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Not logged in</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{avatarInitial}</Text>
            </View>
            <Pressable style={styles.changePhotoOverlay} onPress={() => {}}>
              <Text style={styles.changePhotoText}>Change Photo</Text>
            </Pressable>
          </View>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <FormField
            label="Display Name"
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your display name"
            error={errors.displayName}
            autoCapitalize="words"
          />

          <View>
            <Text style={styles.label}>Username</Text>
            <View style={styles.usernameInputWrapper}>
              <Text style={styles.atPrefix}>@</Text>
              <TextInput
                style={[styles.usernameInput, errors.username ? styles.inputError : undefined]}
                value={username}
                onChangeText={(text) => setUsername(text.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                placeholder="username"
                placeholderTextColor={colors.text.disabled}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            {errors.username ? <Text style={styles.errorMsg}>{errors.username}</Text> : null}
          </View>

          <FormField
            label="Email"
            value={user.email}
            onChangeText={() => {}}
            editable={false}
            placeholder="email@example.com"
            keyboardType="email-address"
          />

          <FormField
            label="Phone (optional)"
            value={phone}
            onChangeText={setPhone}
            placeholder="(555) 123-4567"
            keyboardType="phone-pad"
          />

          <View>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Bio</Text>
              <Text style={[styles.charCount, bio.length > 200 && styles.charCountOver]}>
                {bio.length}/200
              </Text>
            </View>
            <TextInput
              style={[styles.input, styles.bioInput, errors.bio ? styles.inputError : undefined]}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell others about yourself..."
              placeholderTextColor={colors.text.disabled}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={220}
            />
            {errors.bio ? <Text style={styles.errorMsg}>{errors.bio}</Text> : null}
          </View>
        </View>

        {/* Save Button */}
        <View style={styles.saveSection}>
          <Button
            title={isSaving ? "Saving..." : "Save Changes"}
            onPress={handleSave}
            loading={isSaving}
            disabled={isSaving}
            variant="primary"
            size="lg"
          />
        </View>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Form Field Component ──

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  editable = true,
  autoCapitalize,
  autoCorrect,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
  editable?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoCorrect?: boolean;
  keyboardType?: "default" | "email-address" | "phone-pad";
}) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[
          styles.input,
          !editable && styles.inputDisabled,
          error ? styles.inputError : undefined,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.text.disabled}
        editable={editable}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        keyboardType={keyboardType}
      />
      {error ? <Text style={styles.errorMsg}>{error}</Text> : null}
    </View>
  );
}

// ── Styles ──

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: colors.bg.secondary,
  },
  content: {
    paddingBottom: spacing.xxl,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  errorText: {
    fontSize: fontSize.lg,
    color: colors.text.secondary,
  },

  // Avatar
  avatarSection: {
    alignItems: "center",
    paddingVertical: spacing.xl,
    backgroundColor: colors.bg.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  avatarContainer: {
    alignItems: "center",
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: colors.text.inverse,
    fontSize: fontSize["4xl"],
    fontWeight: "700",
  },
  changePhotoOverlay: {
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  changePhotoText: {
    fontSize: fontSize.base,
    color: colors.secondary,
    fontWeight: "600",
  },

  // Form
  form: {
    padding: spacing.md,
    gap: spacing.md,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  charCount: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
  },
  charCountOver: {
    color: colors.error,
  },
  input: {
    backgroundColor: colors.bg.primary,
    borderWidth: 1,
    borderColor: colors.gray[300],
    borderRadius: borderRadius.md,
    paddingVertical: Platform.OS === "ios" ? spacing.sm + 2 : spacing.sm,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.base,
    color: colors.text.primary,
    minHeight: 44,
  },
  inputDisabled: {
    backgroundColor: colors.gray[100],
    color: colors.text.disabled,
  },
  inputError: {
    borderColor: colors.error,
  },
  bioInput: {
    minHeight: 100,
    paddingTop: spacing.sm + 2,
  },
  usernameInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bg.primary,
    borderWidth: 1,
    borderColor: colors.gray[300],
    borderRadius: borderRadius.md,
    minHeight: 44,
  },
  atPrefix: {
    fontSize: fontSize.base,
    color: colors.text.secondary,
    paddingLeft: spacing.md,
    fontWeight: "500",
  },
  usernameInput: {
    flex: 1,
    paddingVertical: Platform.OS === "ios" ? spacing.sm + 2 : spacing.sm,
    paddingHorizontal: spacing.xs,
    paddingRight: spacing.md,
    fontSize: fontSize.base,
    color: colors.text.primary,
    borderWidth: 0,
  },
  errorMsg: {
    fontSize: fontSize.xs,
    color: colors.error,
    marginTop: spacing.xs,
  },

  // Save
  saveSection: {
    padding: spacing.md,
    paddingTop: spacing.lg,
  },
});
