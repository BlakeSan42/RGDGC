/**
 * Google Auth hook — web stub.
 * expo-auth-session has ESM resolution issues on Node 22+/web bundler.
 * On web, Google Sign-In should use Google Identity Services (GSI) redirect flow.
 * For now, this returns a disabled state so the app renders without crashing.
 */

import { useCallback } from "react";

export interface GoogleAuthConfig {
  clientId?: string;
  iosClientId?: string;
  androidClientId?: string;
  webClientId?: string;
}

export interface GoogleAuthResult {
  request: null;
  idToken: string | null;
  error: string | null;
  loading: boolean;
  promptAsync: () => Promise<void>;
}

export function useGoogleAuth(_config: GoogleAuthConfig): GoogleAuthResult {
  const promptAsync = useCallback(async () => {
    // TODO: Implement Google Identity Services redirect flow for web
    console.warn("Google Sign-In is not yet available on web. Use email login.");
  }, []);

  return {
    request: null,
    idToken: null,
    error: null,
    loading: false,
    promptAsync,
  };
}
