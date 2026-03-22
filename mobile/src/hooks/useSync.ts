import { useCallback } from "react";
import { Alert } from "react-native";
import { useOffline } from "@/context/OfflineContext";

export function useSync() {
  const {
    isSyncing,
    lastSync,
    pendingRoundsCount,
    pendingPuttsCount,
    triggerSync,
    isOnline,
  } = useOffline();

  const pendingCount = pendingRoundsCount + pendingPuttsCount;

  const sync = useCallback(async () => {
    if (!isOnline) {
      Alert.alert(
        "No Connection",
        "You're offline. Data will sync automatically when you reconnect."
      );
      return;
    }

    if (pendingCount === 0) {
      Alert.alert("All Synced", "No pending data to sync.");
      return;
    }

    const result = await triggerSync();

    if (result) {
      const synced = result.rounds_synced + result.putts_synced;
      const failed = result.rounds_failed + result.putts_failed;

      if (failed === 0) {
        Alert.alert(
          "Sync Complete",
          `Successfully synced ${synced} item${synced !== 1 ? "s" : ""}.`
        );
      } else {
        Alert.alert(
          "Sync Partially Complete",
          `Synced: ${synced}, Failed: ${failed}.\n${result.errors.join("\n")}`
        );
      }
    }
  }, [isOnline, pendingCount, triggerSync]);

  const autoSync = useCallback(async () => {
    if (!isOnline || pendingCount === 0) return;
    await triggerSync();
  }, [isOnline, pendingCount, triggerSync]);

  return {
    isSyncing,
    lastSync,
    pendingCount,
    sync,
    autoSync,
  };
}
