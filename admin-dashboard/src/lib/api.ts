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

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8001/api/v1';

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

// --- Stickers ---
export async function getStickerStats() {
  const { data } = await api.get('/stickers/stats');
  return data;
}

export async function generateStickerBatch(quantity: number, name: string) {
  const { data } = await api.post('/stickers/generate-batch', {
    quantity,
    batch_name: name,
  });
  return data;
}

export async function getBatchCsv(batchId: string): Promise<Blob> {
  const { data } = await api.get(`/stickers/batch/${batchId}/csv`, {
    responseType: 'blob',
  });
  return data;
}

export async function getBatchInventory(batchId: string) {
  const { data } = await api.get(`/stickers/batch/${batchId}/inventory`);
  return data;
}

export async function validateStickerCode(code: string) {
  const { data } = await api.get(`/stickers/validate/${code}`);
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

// --- Club Leader Analytics ---

export const analyticsApi = {
  // Financial
  financialSummary: (months = 12) =>
    api.get(`/admin/analytics/financial/summary?months=${months}`).then(r => r.data),
  cashFlow: (months = 12) =>
    api.get(`/admin/analytics/financial/cashflow?months=${months}`).then(r => r.data),
  eventBreakdown: (leagueId?: number) =>
    api.get(`/admin/analytics/financial/event-breakdown${leagueId ? `?league_id=${leagueId}` : ''}`).then(r => r.data),
  unpaidFees: () =>
    api.get('/admin/analytics/financial/unpaid').then(r => r.data),

  // Membership
  segments: () =>
    api.get('/admin/analytics/membership/segments').then(r => r.data),
  retention: (months = 6) =>
    api.get(`/admin/analytics/membership/retention?cohort_months=${months}`).then(r => r.data),
  churnRisk: () =>
    api.get('/admin/analytics/membership/churn-risk').then(r => r.data),

  // Performance
  courseDifficulty: () =>
    api.get('/admin/analytics/performance/course-difficulty').then(r => r.data),
  puttingSummary: () =>
    api.get('/admin/analytics/performance/putting-summary').then(r => r.data),
  scoringTrends: (weeks = 12) =>
    api.get(`/admin/analytics/performance/scoring-trends?weeks=${weeks}`).then(r => r.data),

  // Operations
  eventCalendar: (months = 3) =>
    api.get(`/admin/analytics/operations/event-calendar?months_ahead=${months}`).then(r => r.data),
  usageHeatmap: () =>
    api.get('/admin/analytics/operations/usage-heatmap').then(r => r.data),

  // Strategic
  growthDrivers: () =>
    api.get('/admin/analytics/strategic/growth-drivers').then(r => r.data),
  revenueForecast: (months = 6) =>
    api.get(`/admin/analytics/strategic/revenue-forecast?months_ahead=${months}`).then(r => r.data),
  communityHealth: () =>
    api.get('/admin/analytics/strategic/community-health').then(r => r.data),
};

// --- Cash Treasury (Real Accounting) ---

export const cashTreasuryApi = {
  getBalance: () =>
    api.get('/treasury/balance').then(r => r.data),

  getLedger: (params?: { limit?: number; offset?: number; entry_type?: string; event_id?: number }) =>
    api.get('/treasury/ledger', { params }).then(r => r.data),

  collectFee: (data: { event_id: number; player_id: number; amount: number; payment_method: string; notes?: string }) =>
    api.post('/treasury/collect-fee', data).then(r => r.data),

  collectBulk: (data: { event_id: number; player_ids: number[]; amount: number; payment_method: string }) =>
    api.post('/treasury/collect-bulk', data).then(r => r.data),

  payoutPrize: (data: { event_id: number; player_id: number; amount: number; payment_method: string; position?: number }) =>
    api.post('/treasury/payout-prize', data).then(r => r.data),

  recordExpense: (data: { amount: number; description: string; payment_method: string; category?: string; notes?: string }) =>
    api.post('/treasury/record-expense', data).then(r => r.data),

  getEventSummary: (eventId: number) =>
    api.get(`/treasury/event/${eventId}/summary`).then(r => r.data),

  getSeasonSummary: (season: string) =>
    api.get(`/treasury/season/${season}`).then(r => r.data),

  getUnpaid: (eventId: number) =>
    api.get(`/treasury/unpaid/${eventId}`).then(r => r.data),

  voidEntry: (entryId: number, reason: string) =>
    api.post(`/treasury/${entryId}/void`, { reason }).then(r => r.data),

  // New treasurer workflow endpoints (when backend adds them)
  getExpensesByCategory: () =>
    api.get('/treasury/expenses/by-category').then(r => r.data),

  getBudgetVsActual: (season = '2026') =>
    api.get(`/treasury/budget/vs-actual?season=${season}`).then(r => r.data),

  setBudget: (data: { league_id: number; season: string; category: string; budgeted_amount: number }) =>
    api.post('/treasury/budget', data).then(r => r.data),

  getPlayerBalances: () =>
    api.get('/treasury/player-balances').then(r => r.data),

  exportCsv: (startDate: string, endDate: string) =>
    api.get(`/treasury/export?format=csv&start_date=${startDate}&end_date=${endDate}`, {
      responseType: 'blob',
    }).then(r => {
      const url = window.URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rgdgc-ledger-${startDate}-to-${endDate}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    }),

  validatePrizes: (eventId: number) =>
    api.get(`/treasury/validate-prizes/${eventId}`).then(r => r.data),
};

export default api;
