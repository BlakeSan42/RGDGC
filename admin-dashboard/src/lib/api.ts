import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import type {
  AuthResponse,
  User,
  Event,
  League,
  Result,
  Disc,
  Transaction,
  DashboardStats,
  ActivityItem,
  WeeklyRounds,
  TreasuryStats,
  PaginatedResponse,
  LeaderboardEntry,
  EventCheckin,
  Prize,
} from './types';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

function getAccessToken(): string | null {
  return localStorage.getItem('rgdgc_access_token');
}

function getRefreshToken(): string | null {
  return localStorage.getItem('rgdgc_refresh_token');
}

function setTokens(access: string, refresh: string) {
  localStorage.setItem('rgdgc_access_token', access);
  localStorage.setItem('rgdgc_refresh_token', refresh);
}

export function clearTokens() {
  localStorage.removeItem('rgdgc_access_token');
  localStorage.removeItem('rgdgc_refresh_token');
  localStorage.removeItem('rgdgc_user');
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach((p) => {
    if (error) {
      p.reject(error);
    } else if (token) {
      p.resolve(token);
    }
  });
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${token}`;
              }
              resolve(api(originalRequest));
            },
            reject,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        clearTokens();
        window.location.href = '/login';
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post<AuthResponse>(`${API_BASE}/auth/refresh`, {
          refresh_token: refreshToken,
        });
        setTokens(data.access_token, data.refresh_token);
        processQueue(null, data.access_token);
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
        }
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError);
        clearTokens();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// --- Auth ---
export async function login(email: string, password: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/login', { email, password });
  setTokens(data.access_token, data.refresh_token);
  localStorage.setItem('rgdgc_user', JSON.stringify(data.user));
  return data;
}

export async function googleAuth(idToken: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/google', { id_token: idToken });
  setTokens(data.access_token, data.refresh_token);
  localStorage.setItem('rgdgc_user', JSON.stringify(data.user));
  return data;
}

export async function logout(): Promise<void> {
  try {
    await api.post('/auth/logout');
  } finally {
    clearTokens();
  }
}

export async function getCurrentUser(): Promise<User> {
  const { data } = await api.get<User>('/auth/me');
  return data;
}

// --- Dashboard ---
export async function getDashboardStats(): Promise<DashboardStats> {
  const { data } = await api.get<DashboardStats>('/admin/analytics/dashboard');
  return data;
}

export async function getRecentActivity(): Promise<ActivityItem[]> {
  const { data } = await api.get<ActivityItem[]>('/admin/activity');
  return data;
}

export async function getWeeklyRounds(): Promise<WeeklyRounds[]> {
  const { data } = await api.get<WeeklyRounds[]>('/admin/analytics/weekly-rounds');
  return data;
}

// --- Events ---
export async function getEvents(params?: {
  league_id?: number;
  status?: string;
  page?: number;
  per_page?: number;
}): Promise<PaginatedResponse<Event>> {
  const { data } = await api.get<PaginatedResponse<Event>>('/events', { params });
  return data;
}

export async function getEvent(id: number): Promise<Event> {
  const { data } = await api.get<Event>(`/events/${id}`);
  return data;
}

export async function createEvent(event: Partial<Event>): Promise<Event> {
  const { data } = await api.post<Event>('/events', event);
  return data;
}

export async function updateEvent(id: number, event: Partial<Event>): Promise<Event> {
  const { data } = await api.put<Event>(`/events/${id}`, event);
  return data;
}

export async function cancelEvent(id: number): Promise<Event> {
  const { data } = await api.put<Event>(`/events/${id}/cancel`);
  return data;
}

export async function getEventCheckins(eventId: number): Promise<EventCheckin[]> {
  const { data } = await api.get<EventCheckin[]>(`/events/${eventId}/checkins`);
  return data;
}

export async function getEventResults(eventId: number): Promise<Result[]> {
  const { data } = await api.get<Result[]>(`/events/${eventId}/results`);
  return data;
}

export async function submitEventResults(eventId: number, results: Partial<Result>[]): Promise<Result[]> {
  const { data } = await api.post<Result[]>(`/events/${eventId}/results`, { results });
  return data;
}

export async function finalizeEvent(eventId: number): Promise<Event> {
  const { data } = await api.put<Event>(`/events/${eventId}/finalize`);
  return data;
}

// --- Leagues ---
export async function getLeagues(): Promise<League[]> {
  const { data } = await api.get<League[]>('/leagues');
  return data;
}

export async function getLeague(id: number): Promise<League> {
  const { data } = await api.get<League>(`/leagues/${id}`);
  return data;
}

export async function createLeague(league: Partial<League>): Promise<League> {
  const { data } = await api.post<League>('/leagues', league);
  return data;
}

export async function updateLeague(id: number, league: Partial<League>): Promise<League> {
  const { data } = await api.put<League>(`/leagues/${id}`, league);
  return data;
}

export async function getLeagueLeaderboard(leagueId: number): Promise<LeaderboardEntry[]> {
  const { data } = await api.get<LeaderboardEntry[]>(`/leagues/${leagueId}/leaderboard`);
  return data;
}

export async function getLeaguePrizes(leagueId: number): Promise<Prize[]> {
  const { data } = await api.get<Prize[]>(`/leagues/${leagueId}/prizes`);
  return data;
}

export async function updateLeaguePrizes(leagueId: number, prizes: Partial<Prize>[]): Promise<Prize[]> {
  const { data } = await api.put<Prize[]>(`/leagues/${leagueId}/prizes`, { prizes });
  return data;
}

// --- Players ---
export async function getPlayers(params?: {
  search?: string;
  role?: string;
  page?: number;
  per_page?: number;
}): Promise<PaginatedResponse<User>> {
  const { data } = await api.get<PaginatedResponse<User>>('/admin/users', { params });
  return data;
}

export async function getPlayer(id: number): Promise<User> {
  const { data } = await api.get<User>(`/admin/users/${id}`);
  return data;
}

export async function updatePlayerRole(userId: number, role: string): Promise<User> {
  const { data } = await api.post<User>(`/admin/users/${userId}/role`, { role });
  return data;
}

export async function togglePlayerActive(userId: number, isActive: boolean): Promise<User> {
  const { data } = await api.put<User>(`/admin/users/${userId}`, { is_active: isActive });
  return data;
}

// --- Discs ---
export async function getDiscs(params?: {
  status?: string;
  search?: string;
  page?: number;
  per_page?: number;
}): Promise<PaginatedResponse<Disc>> {
  const { data } = await api.get<PaginatedResponse<Disc>>('/admin/discs', { params });
  return data;
}

export async function updateDiscStatus(discId: number, status: string): Promise<Disc> {
  const { data } = await api.put<Disc>(`/admin/discs/${discId}`, { status });
  return data;
}

export async function resolveFoundDisc(discId: number, returnToOwner: boolean): Promise<Disc> {
  const { data } = await api.post<Disc>(`/admin/discs/${discId}/resolve`, { return_to_owner: returnToOwner });
  return data;
}

// --- Treasury ---
export async function getTreasuryStats(): Promise<TreasuryStats> {
  const { data } = await api.get<TreasuryStats>('/blockchain/treasury');
  return data;
}

export async function getTransactions(params?: {
  tx_type?: string;
  page?: number;
  per_page?: number;
}): Promise<PaginatedResponse<Transaction>> {
  const { data } = await api.get<PaginatedResponse<Transaction>>('/blockchain/transactions', { params });
  return data;
}

export async function mintTokens(amount: number, reason: string): Promise<Transaction> {
  const { data } = await api.post<Transaction>('/blockchain/mint', { amount, reason });
  return data;
}

export async function distributePrizes(leagueId: number): Promise<Transaction[]> {
  const { data } = await api.post<Transaction[]>(`/blockchain/distribute/${leagueId}`);
  return data;
}

// --- Settings ---
export async function clearCache(): Promise<{ message: string }> {
  const { data } = await api.post<{ message: string }>('/admin/cache/clear');
  return data;
}

export async function createAnnouncement(title: string, body: string): Promise<{ id: number }> {
  const { data } = await api.post<{ id: number }>('/admin/announcements', { title, body });
  return data;
}

export default api;
