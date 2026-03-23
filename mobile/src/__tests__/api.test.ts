import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock fetch globally
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

// Mock localStorage for web platform
const store: Record<string, string> = {};
Object.defineProperty(global, 'localStorage', {
  value: {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => { store[key] = val; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); },
  },
});

import { getToken, setTokens, clearTokens, api } from '../services/api';

describe('Token Management', () => {
  beforeEach(() => {
    localStorage.clear();
    mockFetch.mockReset();
  });

  it('setTokens stores both access and refresh', async () => {
    await setTokens('access-123', 'refresh-456');
    const token = await getToken();
    expect(token).toBe('access-123');
  });

  it('clearTokens removes all tokens', async () => {
    await setTokens('access', 'refresh');
    await clearTokens();
    const token = await getToken();
    expect(token).toBeNull();
  });

  it('getToken returns null when no token stored', async () => {
    const token = await getToken();
    expect(token).toBeNull();
  });
});

describe('API Client', () => {
  beforeEach(() => {
    localStorage.clear();
    mockFetch.mockReset();
  });

  it('throws when not authenticated', async () => {
    await expect(api('/api/v1/test')).rejects.toThrow('Not authenticated');
  });

  it('sends auth header with stored token', async () => {
    await setTokens('my-token', 'my-refresh');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: 'test' }),
    } as Response);

    await api('/api/v1/test');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/test'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer my-token',
        }),
      }),
    );
  });

  it('sends POST body as JSON', async () => {
    await setTokens('token', 'refresh');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 1 }),
    } as Response);

    await api('/api/v1/rounds', {
      method: 'POST',
      body: { layout_id: 5 },
    });

    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[1]?.method).toBe('POST');
    expect(callArgs[1]?.body).toBe(JSON.stringify({ layout_id: 5 }));
  });

  it('throws on non-OK response', async () => {
    await setTokens('token', 'refresh');
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => 'Not found',
    } as Response);

    await expect(api('/api/v1/nonexistent')).rejects.toThrow('API 404');
  });

  it('skips auth when auth=false', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ token: 'new' }),
    } as Response);

    await api('/api/v1/auth/login', {
      method: 'POST',
      body: { email: 'test@test.com', password: 'pass' },
      auth: false,
    });

    const headers = (mockFetch.mock.calls[0][1] as any).headers;
    expect(headers.Authorization).toBeUndefined();
  });

  it('attempts token refresh on 401', async () => {
    await setTokens('expired-token', 'valid-refresh');

    // First call: 401
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    } as Response);

    // Refresh call: success
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: 'new-access',
        refresh_token: 'new-refresh',
      }),
    } as Response);

    // Retry: success
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ result: 'ok' }),
    } as Response);

    const result = await api<{ result: string }>('/api/v1/test');
    expect(result.result).toBe('ok');
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});
