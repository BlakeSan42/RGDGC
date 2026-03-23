import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

// Mock the api module
vi.mock('../lib/api', () => ({
  login: vi.fn(),
  googleAuth: vi.fn(),
  logout: vi.fn(),
  clearTokens: vi.fn(),
}));

import { AuthProvider, useAuth } from '../hooks/useAuth';
import * as api from '../lib/api';

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <BrowserRouter>
      <AuthProvider>{children}</AuthProvider>
    </BrowserRouter>
  );
}

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('starts as unauthenticated', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('restores user from localStorage', () => {
    const user = { id: 1, username: 'blake', role: 'super_admin' };
    localStorage.setItem('rgdgc_user', JSON.stringify(user));
    localStorage.setItem('rgdgc_access_token', 'valid-token');

    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.username).toBe('blake');
    expect(result.current.isSuperAdmin).toBe(true);
  });

  it('rejects non-admin login', async () => {
    vi.mocked(api.login).mockResolvedValueOnce({
      access_token: 'tok',
      refresh_token: 'ref',
      token_type: 'bearer',
      user: { id: 2, username: 'player', role: 'player' } as any,
    });

    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

    await expect(
      act(() => result.current.login('player@test.com', 'pass'))
    ).rejects.toThrow('Admin privileges required');
  });

  it('sets user on successful admin login', async () => {
    const adminUser = { id: 1, username: 'admin', role: 'admin', email: 'admin@rgdgc.com' };
    vi.mocked(api.login).mockResolvedValueOnce({
      access_token: 'tok',
      refresh_token: 'ref',
      token_type: 'bearer',
      user: adminUser as any,
    });

    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

    await act(() => result.current.login('admin@rgdgc.com', 'pass'));

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.isAdmin).toBe(true);
  });

  it('clears user on logout', async () => {
    const user = { id: 1, username: 'admin', role: 'admin' };
    localStorage.setItem('rgdgc_user', JSON.stringify(user));
    localStorage.setItem('rgdgc_access_token', 'token');

    vi.mocked(api.logout).mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });
    expect(result.current.isAuthenticated).toBe(true);

    await act(() => result.current.logout());
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });
});
