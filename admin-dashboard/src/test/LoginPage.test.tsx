import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders, userEvent } from './test-utils';
import LoginPage from '../pages/LoginPage';

// Mock useAuth
const mockLogin = vi.fn();
const mockLoginWithGoogle = vi.fn();
const mockLogout = vi.fn();

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    isLoading: false,
    isAuthenticated: false,
    isAdmin: false,
    isSuperAdmin: false,
    login: mockLogin,
    loginWithGoogle: mockLoginWithGoogle,
    logout: mockLogout,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the login form', () => {
    renderWithProviders(<LoginPage />);
    expect(screen.getByText('RGDGC Admin')).toBeInTheDocument();
    expect(screen.getByText('Sign in to dashboard')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
  });

  it('submits login with email and password', async () => {
    mockLogin.mockResolvedValueOnce(undefined);
    renderWithProviders(<LoginPage />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Email'), 'admin@rgdgc.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('admin@rgdgc.com', 'password123');
    });
  });

  it('displays error on failed login', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Invalid email or password.'));
    renderWithProviders(<LoginPage />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Email'), 'bad@test.com');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(screen.getByText('Invalid email or password.')).toBeInTheDocument();
    });
  });

  it('toggles password visibility', async () => {
    renderWithProviders(<LoginPage />);

    const passwordInput = screen.getByLabelText('Password');
    expect(passwordInput).toHaveAttribute('type', 'password');

    const user = userEvent.setup();
    // The toggle button is the only button besides Sign In
    const toggleButtons = screen.getAllByRole('button');
    const toggleBtn = toggleButtons.find(b => b.textContent !== 'Sign In' && b.getAttribute('type') === 'button');
    if (toggleBtn) {
      await user.click(toggleBtn);
      expect(passwordInput).toHaveAttribute('type', 'text');
    }
  });

  it('shows contact info for access', () => {
    renderWithProviders(<LoginPage />);
    expect(screen.getByText('Contact a super admin if you need access.')).toBeInTheDocument();
  });
});
