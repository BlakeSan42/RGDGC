import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";

const API_URL =
  Constants.expoConfig?.extra?.apiUrl ||
  process.env.EXPO_PUBLIC_API_URL ||
  "http://localhost:8001";

const TOKEN_KEY = "rgdgc_access_token";
const REFRESH_KEY = "rgdgc_refresh_token";

// ── Token Management ──

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setTokens(access: string, refresh: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, access);
  await SecureStore.setItemAsync(REFRESH_KEY, refresh);
}

export async function clearTokens() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
}

// ── API Client ──

interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
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
  PuttAttempt,
  PuttingStats,
  PuttProbability,
} from "@/types";

export const authApi = {
  register: (data: { email: string; username: string; password: string; display_name?: string }) =>
    api<AuthTokens>("/api/v1/auth/register", { method: "POST", body: data, auth: false }),

  login: (email: string, password: string) =>
    api<AuthTokens>("/api/v1/auth/login", { method: "POST", body: { email, password }, auth: false }),

  me: () => api<AuthTokens["user"]>("/api/v1/auth/me"),
};

export const courseApi = {
  list: () => api<Course[]>("/api/v1/courses"),
  get: (id: number) => api<CourseDetail>(`/api/v1/courses/${id}`),
  getLayout: (courseId: number, layoutId: number) =>
    api<LayoutDetail>(`/api/v1/courses/${courseId}/layouts/${layoutId}`),
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

  submitScore: (roundId: number, data: { hole_number: number; strokes: number; putts?: number; ob_strokes?: number }) =>
    api(`/api/v1/rounds/${roundId}/scores`, { method: "POST", body: data }),

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
  get: (id: number) => api<LeagueEvent>(`/api/v1/events/${id}`),
  results: (id: number) => api<EventResult[]>(`/api/v1/events/${id}/results`),
  checkin: (id: number) =>
    api(`/api/v1/events/${id}/checkin`, { method: "POST" }),
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
