import { useState, useEffect, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const QUEUE_KEY = "@rgdgc/offline_queue";
const CONNECTIVITY_CHECK_URL = "https://api.rgdgc.com/health";
const CONNECTIVITY_INTERVAL_MS = 15_000;

interface QueuedCall {
  id: string;
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
  createdAt: number;
}

async function checkConnectivity(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(CONNECTIVITY_CHECK_URL, {
      method: "HEAD",
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}

async function loadQueue(): Promise<QueuedCall[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveQueue(queue: QueuedCall[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function useOfflineQueue() {
  const [isOffline, setIsOffline] = useState(false);
  const [queueSize, setQueueSize] = useState(0);
  const isFlushing = useRef(false);

  // Periodically check connectivity
  useEffect(() => {
    let mounted = true;

    const check = async () => {
      const online = await checkConnectivity();
      if (mounted) setIsOffline(!online);
    };

    check();
    const interval = setInterval(check, CONNECTIVITY_INTERVAL_MS);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // Load initial queue size
  useEffect(() => {
    loadQueue().then((q) => setQueueSize(q.length));
  }, []);

  // Auto-flush when coming back online
  useEffect(() => {
    if (!isOffline && queueSize > 0) {
      flush();
    }
  }, [isOffline]);

  const enqueue = useCallback(
    async (url: string, init: RequestInit): Promise<void> => {
      const entry: QueuedCall = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        url,
        method: init.method ?? "POST",
        headers: init.headers as Record<string, string> | undefined,
        body: typeof init.body === "string" ? init.body : undefined,
        createdAt: Date.now(),
      };

      const queue = await loadQueue();
      queue.push(entry);
      await saveQueue(queue);
      setQueueSize(queue.length);
    },
    [],
  );

  const flush = useCallback(async (): Promise<void> => {
    if (isFlushing.current) return;
    isFlushing.current = true;

    try {
      const queue = await loadQueue();
      const failed: QueuedCall[] = [];

      for (const call of queue) {
        try {
          await fetch(call.url, {
            method: call.method,
            headers: call.headers,
            body: call.body,
          });
        } catch {
          failed.push(call);
        }
      }

      await saveQueue(failed);
      setQueueSize(failed.length);
    } finally {
      isFlushing.current = false;
    }
  }, []);

  return { isOffline, queueSize, enqueue, flush };
}
