import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';

// Mock axios before importing api module
vi.mock('axios', async () => {
  const mockAxios: any = {
    create: vi.fn(() => mockAxios),
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
    defaults: { headers: { common: {} } },
  };
  return { default: mockAxios };
});

describe('API client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('stores tokens on login', async () => {
    const mockResponse = {
      data: {
        access_token: 'test-access',
        refresh_token: 'test-refresh',
        user: { id: 1, username: 'admin', role: 'admin' },
      },
    };

    const mockedAxios = vi.mocked(axios);
    const instance = mockedAxios.create();
    vi.mocked(instance.post).mockResolvedValueOnce(mockResponse);

    // Import after mocking
    const { login } = await import('../lib/api');
    await login('admin@rgdgc.com', 'password');

    expect(localStorage.getItem('rgdgc_access_token')).toBe('test-access');
    expect(localStorage.getItem('rgdgc_refresh_token')).toBe('test-refresh');
    expect(localStorage.getItem('rgdgc_user')).toContain('"admin"');
  });

  it('clearTokens removes all stored data', async () => {
    localStorage.setItem('rgdgc_access_token', 'token');
    localStorage.setItem('rgdgc_refresh_token', 'refresh');
    localStorage.setItem('rgdgc_user', '{}');

    const { clearTokens } = await import('../lib/api');
    clearTokens();

    expect(localStorage.getItem('rgdgc_access_token')).toBeNull();
    expect(localStorage.getItem('rgdgc_refresh_token')).toBeNull();
    expect(localStorage.getItem('rgdgc_user')).toBeNull();
  });
});
