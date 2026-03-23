import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
  Course,
  Layout,
  Hole,
  LeaderboardEntry,
  PuttAttempt,
} from "@/types";
import { roundApi, puttingApi } from "./api";

// ── Storage Keys ──

const KEYS = {
  PENDING_ROUNDS: "rgdgc:pending_rounds",
  PENDING_PUTTS: "rgdgc:pending_putts",
  CACHED_COURSES: "rgdgc:cached_courses",
  CACHED_LAYOUTS: "rgdgc:cached_layouts",
  CACHED_LEADERBOARD: "rgdgc:cached_leaderboard",
  LAST_SYNC: "rgdgc:last_sync",
};

// ── Types ──

export interface OfflineRound {
  id: string; // local UUID
  layout_id: number;
  started_at: string;
  scores: {
    hole_id?: number;
    hole_number: number;
    strokes: number;
    putts?: number;
    ob_strokes?: number;
  }[];
  completed_at: string;
  total_score: number;
  total_strokes: number;
  is_practice: boolean;
}

export interface SyncResult {
  rounds_synced: number;
  rounds_failed: number;
  putts_synced: number;
  putts_failed: number;
  errors: string[];
}

// ── Pending Rounds ──

export async function saveOfflineRound(round: OfflineRound): Promise<void> {
  const rounds = await getPendingRounds();
  rounds.push(round);
  await AsyncStorage.setItem(KEYS.PENDING_ROUNDS, JSON.stringify(rounds));
}

export async function getPendingRounds(): Promise<OfflineRound[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.PENDING_ROUNDS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function removePendingRound(id: string): Promise<void> {
  const rounds = await getPendingRounds();
  const filtered = rounds.filter((r) => r.id !== id);
  await AsyncStorage.setItem(KEYS.PENDING_ROUNDS, JSON.stringify(filtered));
}

// ── Pending Putts ──

export async function saveOfflinePutts(putts: PuttAttempt[]): Promise<void> {
  const existing = await getPendingPutts();
  const combined = [...existing, ...putts];
  await AsyncStorage.setItem(KEYS.PENDING_PUTTS, JSON.stringify(combined));
}

export async function getPendingPutts(): Promise<PuttAttempt[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.PENDING_PUTTS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// ── Course & Layout Caching ──

export async function cacheCourseData(courses: Course[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.CACHED_COURSES, JSON.stringify(courses));
}

export async function getCachedCourses(): Promise<Course[] | null> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.CACHED_COURSES);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function cacheLayoutData(
  layoutId: string,
  layout: Layout & { holes: Hole[] }
): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.CACHED_LAYOUTS);
    const all: Record<string, Layout & { holes: Hole[] }> = raw
      ? JSON.parse(raw)
      : {};
    all[layoutId] = layout;
    await AsyncStorage.setItem(KEYS.CACHED_LAYOUTS, JSON.stringify(all));
  } catch {
    // Best-effort caching
  }
}

export async function getCachedLayout(
  layoutId: string
): Promise<(Layout & { holes: Hole[] }) | null> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.CACHED_LAYOUTS);
    if (!raw) return null;
    const all: Record<string, Layout & { holes: Hole[] }> = JSON.parse(raw);
    return all[layoutId] ?? null;
  } catch {
    return null;
  }
}

// ── Leaderboard Caching ──

export async function cacheLeaderboard(
  leagueId: string,
  data: LeaderboardEntry[]
): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.CACHED_LEADERBOARD);
    const all: Record<string, LeaderboardEntry[]> = raw ? JSON.parse(raw) : {};
    all[leagueId] = data;
    await AsyncStorage.setItem(KEYS.CACHED_LEADERBOARD, JSON.stringify(all));
  } catch {
    // Best-effort caching
  }
}

export async function getCachedLeaderboard(
  leagueId: string
): Promise<LeaderboardEntry[] | null> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.CACHED_LEADERBOARD);
    if (!raw) return null;
    const all: Record<string, LeaderboardEntry[]> = JSON.parse(raw);
    return all[leagueId] ?? null;
  } catch {
    return null;
  }
}

// ── Sync All Pending Data ──

export async function syncAll(): Promise<SyncResult> {
  const result: SyncResult = {
    rounds_synced: 0,
    rounds_failed: 0,
    putts_synced: 0,
    putts_failed: 0,
    errors: [],
  };

  // Sync pending rounds
  const rounds = await getPendingRounds();
  for (const round of rounds) {
    try {
      // Start a new round on the server
      const serverRound = await roundApi.start(round.layout_id, round.is_practice);

      // Submit each hole score
      for (const score of round.scores) {
        await roundApi.submitScore(serverRound.id, {
          hole_number: score.hole_number,
          strokes: score.strokes,
          putts: score.putts,
          ob_strokes: score.ob_strokes,
        });
      }

      // Complete the round
      await roundApi.complete(serverRound.id);

      // Remove from pending
      await removePendingRound(round.id);
      result.rounds_synced++;
    } catch (err) {
      result.rounds_failed++;
      result.errors.push(
        `Round ${round.id.slice(0, 8)}: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }
  }

  // Sync pending putts
  const putts = await getPendingPutts();
  if (putts.length > 0) {
    try {
      // Batch sync in chunks of 50
      const BATCH_SIZE = 50;
      for (let i = 0; i < putts.length; i += BATCH_SIZE) {
        const batch = putts.slice(i, i + BATCH_SIZE);
        await puttingApi.batchSync(batch);
        result.putts_synced += batch.length;
      }

      // Clear all pending putts on success
      await AsyncStorage.setItem(KEYS.PENDING_PUTTS, JSON.stringify([]));
    } catch (err) {
      result.putts_failed += putts.length - result.putts_synced;
      result.errors.push(
        `Putts: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }
  }

  // Update last sync timestamp
  if (result.rounds_synced > 0 || result.putts_synced > 0) {
    await AsyncStorage.setItem(KEYS.LAST_SYNC, new Date().toISOString());
  }

  return result;
}

// ── Clear Pending Data ──

export async function clearPending(): Promise<void> {
  await AsyncStorage.multiRemove([KEYS.PENDING_ROUNDS, KEYS.PENDING_PUTTS]);
}

// ── Last Sync Timestamp ──

export async function getLastSync(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(KEYS.LAST_SYNC);
  } catch {
    return null;
  }
}
