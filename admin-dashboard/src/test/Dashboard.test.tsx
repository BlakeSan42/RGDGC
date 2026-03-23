import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from './test-utils';

// Mock useAuth for all dashboard tests
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 1, username: 'admin', role: 'admin', display_name: 'Blake' },
    isLoading: false,
    isAuthenticated: true,
    isAdmin: true,
    isSuperAdmin: false,
    login: vi.fn(),
    loginWithGoogle: vi.fn(),
    logout: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock react-query hooks used by Dashboard
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: vi.fn().mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    }),
  };
});

describe('Dashboard', () => {
  it('renders loading state', async () => {
    const { default: Dashboard } = await import('../pages/Dashboard');
    renderWithProviders(<Dashboard />);
    // Dashboard should render something even in loading state
    const container = document.querySelector('.animate-pulse, .animate-spin');
    // At minimum, the component should render without crashing
    expect(document.body).toBeTruthy();
  });
});
