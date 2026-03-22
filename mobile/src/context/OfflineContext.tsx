import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { AppState, AppStateStatus } from "react-native";
import type { PuttAttempt } from "@/types";
import {
  getPendingRounds,
  getPendingPutts,
  getLastSync,
  saveOfflineRound,
  saveOfflinePutts,
  syncAll,
  type OfflineRound,
  type SyncResult,
} from "@/services/offline";

const CONNECTIVITY_CHECK_URL = "https://api.rgdgc.com/health";
const CONNECTIVITY_INTERVAL_MS = 15_000;

// ── Types ──

interface OfflineState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingRoundsCount: number;
  pendingPuttsCount: number;
  lastSync: string | null;
  saveRound: (round: OfflineRound) => Promise<void>;
  savePutts: (putts: PuttAttempt[]) => Promise<void>;
  triggerSync: () => Promise<SyncResult | null>;
}

const OfflineContext = createContext<OfflineState | undefined>(undefined);

// ── Connectivity Check ──

async function checkConnectivity(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);
    const response = await fetch(CONNECTIVITY_CHECK_URL, {
      method: "HEAD",
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}

// ── Provider ──

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingRoundsCount, setPendingRoundsCount] = useState(0);
  const [pendingPuttsCount, setPendingPuttsCount] = useState(0);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const wasOffline = useRef(false);

  // ── Refresh pending counts ──

  const refreshCounts = useCallback(async () => {
    const [rounds, putts, sync] = await Promise.all([
      getPendingRounds(),
      getPendingPutts(),
      getLastSync(),
    ]);
    setPendingRoundsCount(rounds.length);
    setPendingPuttsCount(putts.length);
    setLastSync(sync);
  }, []);

  // ── Initial load ──

  useEffect(() => {
    refreshCounts();
  }, [refreshCounts]);

  // ── Periodic connectivity check ──

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      const online = await checkConnectivity();
      if (mounted) setIsOnline(online);
    };

    check();
    const interval = setInterval(check, CONNECTIVITY_INTERVAL_MS);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // ── Auto-sync on offline -> online transition ──

  useEffect(() => {
    if (!isOnline) {
      wasOffline.current = true;
      return;
    }

    if (wasOffline.current) {
      wasOffline.current = false;
      // Just came back online - auto-sync
      triggerSync();
    }
  }, [isOnline]);

  // ── Auto-sync on app foreground ──

  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === "active" && isOnline) {
        refreshCounts().then(() => {
          // Only sync if there's pending data
          getPendingRounds().then((rounds) => {
            getPendingPutts().then((putts) => {
              if (rounds.length > 0 || putts.length > 0) {
                triggerSync();
              }
            });
          });
        });
      }
    };

    const subscription = AppState.addEventListener("change", handleAppState);
    return () => subscription.remove();
  }, [isOnline]);

  // ── Sync ──

  const triggerSync = useCallback(async (): Promise<SyncResult | null> => {
    if (isSyncing || !isOnline) return null;

    setIsSyncing(true);
    try {
      const result = await syncAll();
      await refreshCounts();
      return result;
    } catch {
      return null;
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, isOnline, refreshCounts]);

  // ── Save methods ──

  const saveRound = useCallback(
    async (round: OfflineRound) => {
      await saveOfflineRound(round);
      await refreshCounts();
    },
    [refreshCounts]
  );

  const savePutts = useCallback(
    async (putts: PuttAttempt[]) => {
      await saveOfflinePutts(putts);
      await refreshCounts();
    },
    [refreshCounts]
  );

  return (
    <OfflineContext.Provider
      value={{
        isOnline,
        isSyncing,
        pendingRoundsCount,
        pendingPuttsCount,
        lastSync,
        saveRound,
        savePutts,
        triggerSync,
      }}
    >
      {children}
    </OfflineContext.Provider>
  );
}

// ── Hook ──

export function useOffline() {
  const context = useContext(OfflineContext);
  if (!context)
    throw new Error("useOffline must be used within OfflineProvider");
  return context;
}
