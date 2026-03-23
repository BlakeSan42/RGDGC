import { Platform } from "react-native";
import Constants from "expo-constants";

const API_URL =
  Constants.expoConfig?.extra?.apiUrl ||
  process.env.EXPO_PUBLIC_API_URL ||
  "http://localhost:8001";

const TOKEN_KEY = "rgdgc_access_token";
const REFRESH_KEY = "rgdgc_refresh_token";

// ── Platform-aware Token Storage ──
// Native: expo-secure-store (encrypted keychain/keystore)
// Web: localStorage (acceptable for dev/testing — no secrets at rest)

const tokenStore = {
  get: async (key: string): Promise<string | null> => {
    if (Platform.OS === "web") {
      return localStorage.getItem(key);
    }
    const SecureStore = await import("expo-secure-store");
    return SecureStore.getItemAsync(key);
  },
  set: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === "web") {
      localStorage.setItem(key, value);
      return;
    }
    const SecureStore = await import("expo-secure-store");
    await SecureStore.setItemAsync(key, value);
  },
  delete: async (key: string): Promise<void> => {
    if (Platform.OS === "web") {
      localStorage.removeItem(key);
      return;
    }
    const SecureStore = await import("expo-secure-store");
    await SecureStore.deleteItemAsync(key);
  },
};

// ── Token Management ──

export async function getToken(): Promise<string | null> {
  return tokenStore.get(TOKEN_KEY);
}

export async function setTokens(access: string, refresh: string) {
  await tokenStore.set(TOKEN_KEY, access);
  await tokenStore.set(REFRESH_KEY, refresh);
}

export async function clearTokens() {
  await tokenStore.delete(TOKEN_KEY);
  await tokenStore.delete(REFRESH_KEY);
}

// ── API Client ──

interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
}

// Mutex to prevent concurrent refresh attempts
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  // If a refresh is already in flight, wait for it instead of firing another
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = await tokenStore.get(REFRESH_KEY);
    if (!refreshToken) return null;

    try {
      const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!res.ok) {
        await clearTokens();
        return null;
      }

      const data = await res.json();
      await setTokens(data.access_token, data.refresh_token);
      return data.access_token;
    } catch {
      await clearTokens();
      return null;
    }
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

export async function api<T = unknown>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = "GET", body, auth = true } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (auth) {
    let token = await getToken();
    if (!token) throw new Error("Not authenticated");
    headers["Authorization"] = `Bearer ${token}`;
  }

  let res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // Auto-refresh on 401
  if (res.status === 401 && auth) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers["Authorization"] = `Bearer ${newToken}`;
      res = await fetch(`${API_URL}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
    }
  }

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`API ${res.status}: ${errorBody}`);
  }

  return res.json() as Promise<T>;
}

// ── Typed API Methods ──

import type {
  AuthTokens,
  Course,
  CourseDetail,
  LayoutDetail,
  Round,
  RoundDetail,
  League,
  LeagueEvent,
  LeaderboardEntry,
  EventResult,
  EventCheckin,
  EventDetail,
  PuttAttempt,
  PuttingStats,
  PuttProbability,
  RegisteredDisc,
  DiscFoundReport,
  DiscRegistrationData,
  SeasonStanding,
  PuttingLeader,
  CourseRecord,
  PlayerComparison,
  HeadToHeadResult,
  PlayerProfile,
} from "@/types";

export const authApi = {
  register: (data: { email: string; username: string; password: string; display_name?: string }) =>
    api<AuthTokens>("/api/v1/auth/register", { method: "POST", body: data, auth: false }),

  login: (email: string, password: string) =>
    api<AuthTokens>("/api/v1/auth/login", { method: "POST", body: { email, password }, auth: false }),

  googleAuth: (idToken: string) =>
    api<AuthTokens>("/api/v1/auth/google", { method: "POST", body: { id_token: idToken }, auth: false }),

  appleAuth: (idToken: string, fullName?: string) =>
    api<AuthTokens>("/api/v1/auth/apple", {
      method: "POST",
      body: { id_token: idToken, full_name: fullName },
      auth: false,
    }),

  me: () => api<AuthTokens["user"]>("/api/v1/auth/me"),

  logout: () =>
    api("/api/v1/auth/logout", { method: "POST" }),
};

export const courseApi = {
  list: () => api<Course[]>("/api/v1/courses"),
  get: (id: number) => api<CourseDetail>(`/api/v1/courses/${id}`),
  getLayout: (courseId: number, layoutId: number) =>
    api<LayoutDetail>(`/api/v1/courses/${courseId}/layouts/${layoutId}`),
  getLayoutById: (layoutId: number) =>
    api<LayoutDetail>(`/api/v1/courses/layouts/${layoutId}`),
};

export const roundApi = {
  start: (layoutId: number, isPractice = false) =>
    api<Round>("/api/v1/rounds", { method: "POST", body: { layout_id: layoutId, is_practice: isPractice } }),

  get: (id: number) => api<RoundDetail>(`/api/v1/rounds/${id}`),

  list: (limit = 20, layoutId?: number) => {
    let path = `/api/v1/rounds?limit=${limit}`;
    if (layoutId) path += `&layout_id=${layoutId}`;
    return api<Round[]>(path);
  },

  submitScore: (roundId: number, data: { hole_number: number; strokes: number; putts?: number; ob_strokes?: number; disc_used?: string; is_dnf?: boolean }) =>
    api(`/api/v1/rounds/${roundId}/scores`, { method: "POST", body: data }),

  updateScore: (roundId: number, holeNumber: number, data: { strokes: number; putts?: number; ob_strokes?: number; disc_used?: string; is_dnf?: boolean }) =>
    api(`/api/v1/rounds/${roundId}/scores/${holeNumber}`, { method: "PUT", body: data }),

  complete: (roundId: number) =>
    api<RoundDetail>(`/api/v1/rounds/${roundId}/complete`, { method: "PUT" }),
};

export const leagueApi = {
  list: () => api<League[]>("/api/v1/leagues"),
  get: (id: number) => api<League>(`/api/v1/leagues/${id}`),
  leaderboard: (id: number, limit = 10) =>
    api<LeaderboardEntry[]>(`/api/v1/leagues/${id}/leaderboard?limit=${limit}`),
};

export const eventApi = {
  list: (status?: string, limit = 20) => {
    let path = `/api/v1/events?limit=${limit}`;
    if (status) path += `&status=${status}`;
    return api<LeagueEvent[]>(path);
  },
  get: (id: number) => api<EventDetail>(`/api/v1/events/${id}`),
  results: (id: number) => api<EventResult[]>(`/api/v1/events/${id}/results`),
  checkin: (id: number) =>
    api(`/api/v1/events/${id}/checkin`, { method: "POST" }),
  checkins: (id: number) =>
    api<EventCheckin[]>(`/api/v1/events/${id}/checkins`),
};

export const discApi = {
  register: (data: DiscRegistrationData) =>
    api<RegisteredDisc>("/api/v1/discs/register", { method: "POST", body: data }),

  myDiscs: () =>
    api<RegisteredDisc[]>("/api/v1/discs/my-discs"),

  getDisc: (code: string) =>
    api<RegisteredDisc>(`/api/v1/discs/${code}`),

  getQR: (code: string) =>
    api<{ qr_svg: string }>(`/api/v1/discs/${code}/qr`),

  reportLost: (code: string, details?: { last_known_location?: string; notes?: string }) =>
    api<RegisteredDisc>(`/api/v1/discs/${code}/lost`, { method: "POST", body: details }),

  confirmReturned: (code: string) =>
    api<RegisteredDisc>(`/api/v1/discs/${code}/returned`, { method: "POST" }),

  foundReports: (code: string) =>
    api<DiscFoundReport[]>(`/api/v1/discs/${code}/found-reports`),
};

export const playerApi = {
  profile: (id: number) => api<PlayerProfile>(`/api/v1/players/${id}`),
  search: (query: string) => api<PlayerProfile[]>(`/api/v1/players/search?q=${encodeURIComponent(query)}`),
  compare: (id1: number, id2: number) =>
    api<{ player1: PlayerComparison; player2: PlayerComparison }>(`/api/v1/players/compare?player1=${id1}&player2=${id2}`),
  headToHead: (id1: number, id2: number) =>
    api<HeadToHeadResult[]>(`/api/v1/players/head-to-head?player1=${id1}&player2=${id2}`),
};

export const leaderboardApi = {
  seasonStandings: (leagueId: number, limit = 50) =>
    api<SeasonStanding[]>(`/api/v1/leagues/${leagueId}/leaderboard?limit=${limit}&extended=true`),
  puttingLeaders: (limit = 50) =>
    api<PuttingLeader[]>(`/api/v1/putting/leaders?limit=${limit}`),
  courseRecords: () =>
    api<CourseRecord[]>(`/api/v1/courses/records`),
};

export const geoApi = {
  courseGeoJSON: (courseId: number, layoutId?: number) => {
    let path = `/api/v1/geo/courses/${courseId}/geojson`;
    if (layoutId) path += `?layout_id=${layoutId}`;
    return api<GeoJSON.FeatureCollection>(path, { auth: false });
  },

  holeElevation: (courseId: number, holeNumber: number, layoutId?: number) => {
    let path = `/api/v1/geo/courses/${courseId}/holes/${holeNumber}/elevation`;
    if (layoutId) path += `?layout_id=${layoutId}`;
    return api<{
      hole_number: number;
      par: number;
      distance_ft: number | null;
      tee_elevation_ft: number | null;
      basket_elevation_ft: number | null;
      elevation_change_ft: number | null;
      profile: Array<{ distance_ft: number; elevation_ft: number }> | null;
    }>(path, { auth: false });
  },

  nearestHole: (lat: number, lng: number, courseId?: number) => {
    let path = `/api/v1/geo/nearest-hole?lat=${lat}&lng=${lng}`;
    if (courseId) path += `&course_id=${courseId}`;
    return api<{
      found: boolean;
      hole_number?: number;
      distance_m?: number;
      distance_ft?: number;
      par?: number;
      hole_distance_ft?: number;
      tee_position?: [number, number];
    }>(path, { auth: false });
  },
};

export const userApi = {
  registerPushToken: (token: string, platform: string) =>
    api("/api/v1/users/me/push-token", { method: "POST", body: { token, platform } }),
};

export const blockchainApi = {
  getNonce: (walletAddress: string) =>
    api<{ nonce: string; message: string }>("/api/v1/auth/web3/nonce", {
      method: "POST",
      body: { wallet_address: walletAddress },
      auth: false,
    }),

  verifyWallet: (walletAddress: string, signature: string) =>
    api<AuthTokens>("/api/v1/auth/web3/verify", {
      method: "POST",
      body: { wallet_address: walletAddress, signature },
      auth: false,
    }),

  linkWallet: (walletAddress: string, signature: string) =>
    api<{ wallet_address: string }>("/api/v1/users/me/wallet", {
      method: "POST",
      body: { wallet_address: walletAddress, signature },
    }),

  getBalance: () =>
    api<{ balance: number; wallet_address: string }>("/api/v1/blockchain/balance"),

  getTreasury: () =>
    api<{ balance: number; event_fee: number }>("/api/v1/blockchain/treasury"),
};

export const puttingApi = {
  logAttempt: (data: PuttAttempt) =>
    api("/api/v1/putting/attempt", { method: "POST", body: data }),

  batchSync: (attempts: PuttAttempt[]) =>
    api("/api/v1/putting/batch", { method: "POST", body: { attempts } }),

  stats: () => api<PuttingStats>("/api/v1/putting/stats"),

  probability: (distanceMeters: number, windSpeed = 0, windDirection = 0, elevationChange = 0) =>
    api<PuttProbability>(
      `/api/v1/putting/probability?distance_meters=${distanceMeters}&wind_speed=${windSpeed}&wind_direction=${windDirection}&elevation_change=${elevationChange}`
    ),
};

// ── Chat ──

export interface ChatResponse {
  response: string;
  suggestions: string[];
  blocked: boolean;
  model: string | null;
  cost_usd: number | null;
}

export const chatApi = {
  send: (message: string) =>
    api<ChatResponse>("/api/v1/chat", {
      method: "POST",
      body: { message },
    }),

  feedback: (messageText: string, rating: "up" | "down", correction?: string) =>
    api<{ status: string; learning_id: number | null }>("/api/v1/chat/feedback", {
      method: "POST",
      body: { message_text: messageText, rating, correction },
    }),
};
