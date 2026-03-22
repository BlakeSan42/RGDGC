import React, { createContext, useContext, useEffect, useState } from "react";
import { authApi, setTokens, clearTokens, getToken } from "@/services/api";
import type { User } from "@/types";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  loginWithApple: (idToken: string, fullName?: string) => Promise<void>;
  register: (data: {
    email: string;
    username: string;
    password: string;
    display_name?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        if (token) {
          const me = await authApi.me();
          setUser(me);
        }
      } catch {
        await clearTokens();
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const result = await authApi.login(email, password);
    await setTokens(result.access_token, result.refresh_token);
    setUser(result.user);
  };

  const loginWithGoogle = async (idToken: string) => {
    const result = await authApi.googleAuth(idToken);
    await setTokens(result.access_token, result.refresh_token);
    setUser(result.user);
  };

  const loginWithApple = async (idToken: string, fullName?: string) => {
    const result = await authApi.appleAuth(idToken, fullName);
    await setTokens(result.access_token, result.refresh_token);
    setUser(result.user);
  };

  const register = async (data: {
    email: string;
    username: string;
    password: string;
    display_name?: string;
  }) => {
    const result = await authApi.register(data);
    await setTokens(result.access_token, result.refresh_token);
    setUser(result.user);
  };

  const logout = async () => {
    await clearTokens();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        loginWithGoogle,
        loginWithApple,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
