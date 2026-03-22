import { useState, useEffect, useCallback } from "react";
import { Platform } from "react-native";

// Types — mirrors expo-notifications API surface
interface ExpoPushToken {
  type: "expo";
  data: string;
}

interface NotificationTrigger {
  seconds?: number;
  repeats?: boolean;
  date?: Date;
}

interface PermissionStatus {
  granted: boolean;
  canAskAgain: boolean;
}

/**
 * Hook for managing push notifications.
 *
 * Wraps expo-notifications with permission handling and token registration.
 * The actual expo-notifications calls are isolated so the rest of the app
 * can depend on this hook without importing the library directly.
 */
export function useNotifications() {
  const [permissionStatus, setPermissionStatus] =
    useState<PermissionStatus | null>(null);
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);

  // Check current permission status on mount
  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = useCallback(async () => {
    try {
      const Notifications = await import("expo-notifications");
      const { status } = await Notifications.getPermissionsAsync();
      setPermissionStatus({
        granted: status === "granted",
        canAskAgain: status !== "denied",
      });
    } catch {
      // expo-notifications not installed or unavailable
      setPermissionStatus({ granted: false, canAskAgain: false });
    }
  }, []);

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    try {
      const Notifications = await import("expo-notifications");
      const { status } = await Notifications.requestPermissionsAsync();
      const granted = status === "granted";
      setPermissionStatus({ granted, canAskAgain: status !== "denied" });
      return granted;
    } catch {
      return false;
    }
  }, []);

  const registerForPushNotifications =
    useCallback(async (): Promise<string | null> => {
      try {
        const granted = await requestPermissions();
        if (!granted) return null;

        const Notifications = await import("expo-notifications");

        // Android requires a notification channel
        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("default", {
            name: "Default",
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
          });
        }

        const tokenData = await Notifications.getExpoPushTokenAsync();
        const token = tokenData.data;
        setExpoPushToken(token);

        // TODO: send token to backend via POST /api/v1/users/me/push-token
        // await api.post('/users/me/push-token', { token, platform: Platform.OS });

        return token;
      } catch {
        return null;
      }
    }, [requestPermissions]);

  const scheduleLocalNotification = useCallback(
    async (
      title: string,
      body: string,
      trigger?: NotificationTrigger,
    ): Promise<string | null> => {
      try {
        const Notifications = await import("expo-notifications");
        const id = await Notifications.scheduleNotificationAsync({
          content: { title, body },
          trigger: trigger ?? null,
        });
        return id;
      } catch {
        return null;
      }
    },
    [],
  );

  return {
    permissionStatus,
    expoPushToken,
    requestPermissions,
    registerForPushNotifications,
    scheduleLocalNotification,
  };
}
