/**
 * Google Auth hook — native implementation using expo-auth-session.
 * Web version lives in useGoogleAuth.web.ts (Metro resolves automatically).
 */

import { useState, useEffect, useCallback } from "react";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";

WebBrowser.maybeCompleteAuthSession();

export interface GoogleAuthConfig {
  clientId?: string;
  iosClientId?: string;
  androidClientId?: string;
  webClientId?: string;
}

export interface GoogleAuthResult {
  request: unknown;
  idToken: string | null;
  error: string | null;
  loading: boolean;
  promptAsync: () => Promise<void>;
}

export function useGoogleAuth(config: GoogleAuthConfig): GoogleAuthResult {
  const [idToken, setIdToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [request, response, promptAsyncNative] = Google.useAuthRequest({
    clientId: config.clientId,
    iosClientId: config.iosClientId,
    androidClientId: config.androidClientId,
    webClientId: config.webClientId,
  });

  useEffect(() => {
    if (response?.type === "success") {
      const token = response.authentication?.idToken;
      if (token) {
        setIdToken(token);
      } else {
        setError("Could not retrieve authentication token.");
      }
      setLoading(false);
    } else if (response?.type === "error") {
      setError(response.error?.message || "An unexpected error occurred.");
      setLoading(false);
    } else if (response?.type === "dismiss") {
      setLoading(false);
    }
  }, [response]);

  const promptAsync = useCallback(async () => {
    setLoading(true);
    setError(null);
    setIdToken(null);
    try {
      await promptAsyncNative();
    } catch (e) {
      setLoading(false);
      setError("Could not start Google sign-in.");
    }
  }, [promptAsyncNative]);

  return {
    request,
    idToken,
    error,
    loading,
    promptAsync,
  };
}
