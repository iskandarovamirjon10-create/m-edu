import { useState, useEffect, useCallback, useRef } from 'react';
import { useOnlineStatus } from './useOnlineStatus';

export interface OfflineAttempt {
  id: string;
  sessionId: string;
  imageBase64: string;
  timestamp: number;
  retryCount: number;
}

const STORAGE_KEY = 'medu_offline_face_queue';
const IDB_DB_NAME = 'medu_face_offline_store';
const IDB_STORE_NAME = 'face_attempts';
const IDB_VERSION = 1;
const MAX_QUEUE_SIZE = 50;

/**
 * Safe IndexedDB helper with error containment for private browsing & quota exhaustion.
 */
let isIdbAvailable = typeof window !== 'undefined' && 'indexedDB' in window;
let idbInstance: IDBDatabase | null = null;

async function getIdb(): Promise<IDBDatabase | null> {
  if (!isIdbAvailable || typeof indexedDB === 'undefined') return null;
  if (idbInstance) return idbInstance;

  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(IDB_DB_NAME, IDB_VERSION);

      request.onupgradeneeded = (event) => {
        try {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
            db.createObjectStore(IDB_STORE_NAME, { keyPath: 'id' });
          }
        } catch {
          // Quota or permission error during upgrade
        }
      };

      request.onsuccess = () => {
        idbInstance = request.result;
        idbInstance.onversionchange = () => {
          idbInstance?.close();
          idbInstance = null;
        };
        idbInstance.onclose = () => {
          idbInstance = null;
        };
        resolve(idbInstance);
      };

      request.onerror = () => {
        // Private browsing mode, SecurityError, or disabled IndexedDB
        isIdbAvailable = false;
        resolve(null);
      };

      request.onblocked = () => {
        resolve(null);
      };
    } catch {
      // In private browsing mode, indexedDB.open can throw synchronously
      isIdbAvailable = false;
      resolve(null);
    }
  });
}

async function persistToIdb(items: OfflineAttempt[]): Promise<void> {
  const db = await getIdb();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
      const store = tx.objectStore(IDB_STORE_NAME);
      const clearReq = store.clear();

      clearReq.onsuccess = () => {
        for (const item of items) {
          try {
            store.put(item);
          } catch {
            // Quota exceeded
          }
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      // Transaction failed or quota exceeded
      resolve();
    }
  });
}

async function loadFromIdb(): Promise<OfflineAttempt[]> {
  const db = await getIdb();
  if (!db) return [];

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE_NAME, 'readonly');
      const store = tx.objectStore(IDB_STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => resolve((req.result as OfflineAttempt[]) || []);
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

function safeReadLocalStorage(): OfflineAttempt[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) return parsed;
    // Corrupted non-array payload — preserve backup before resetting to prevent silent data loss
    try {
      localStorage.setItem(STORAGE_KEY + '_corrupted_backup', stored);
    } catch {
      // quota or blocked
    }
    return [];
  } catch {
    // JSON parse error — preserve backup before wiping
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        localStorage.setItem(STORAGE_KEY + '_corrupted_backup', stored);
      }
    } catch {
      // quota or blocked
    }
    return [];
  }
}

function safeWriteLocalStorage(items: OfflineAttempt[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // QuotaExceededError or SecurityError in private browsing
    // Evict older items to recover space if quota exceeded
    try {
      if (items.length > 5) {
        const pruned = items.slice(-5);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
      }
    } catch {
      // Storage completely blocked; in-memory state remains resilient
    }
  }
}

export function useOfflineFaceQueue() {
  const isOnline = useOnlineStatus();

  // Initialize synchronously with localStorage for instant hydration and test compatibility
  const [queue, setQueue] = useState<OfflineAttempt[]>(() => safeReadLocalStorage());
  const [isSyncing, setIsSyncing] = useState(false);
  const isSyncingRef = useRef(false);
  const hasHydratedIdbRef = useRef(false);

  // Hydrate from IndexedDB on initial mount if localStorage had fewer items
  useEffect(() => {
    if (hasHydratedIdbRef.current) return;
    hasHydratedIdbRef.current = true;

    void loadFromIdb().then((idbItems) => {
      if (idbItems && idbItems.length > 0) {
        setQueue((prev) => {
          // Merge by ID avoiding duplicates
          const existingIds = new Set(prev.map((i) => i.id));
          const newItems = idbItems.filter((i) => !existingIds.has(i.id));
          if (newItems.length === 0) return prev;
          const merged = [...prev, ...newItems].slice(-MAX_QUEUE_SIZE);
          safeWriteLocalStorage(merged);
          return merged;
        });
      }
    });
  }, []);

  // Keep localStorage immediately in sync and debounce heavy IndexedDB persistence
  useEffect(() => {
    safeWriteLocalStorage(queue);
    const timer = setTimeout(() => {
      void persistToIdb(queue);
    }, 120);
    return () => clearTimeout(timer);
  }, [queue]);

  const enqueue = useCallback((item: { sessionId: string; imageBase64: string }): boolean => {
    if (!item.sessionId || !item.imageBase64) return false;

    setQueue((prev) => {
      let next = prev;
      if (prev.length >= MAX_QUEUE_SIZE) {
        // Evict oldest if bounded limit reached
        next = prev.slice(1);
      }
      const attempt: OfflineAttempt = {
        id: `off_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        sessionId: item.sessionId,
        imageBase64: item.imageBase64,
        timestamp: Date.now(),
        retryCount: 0,
      };
      return [...next, attempt];
    });

    return true;
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
    void persistToIdb([]);
  }, []);

  const syncQueue = useCallback(
    async (
      submitFn: (sessionId: string, imageBase64: string) => Promise<any>,
    ): Promise<{ synced: number; failed: number }> => {
      if (isSyncingRef.current || queue.length === 0 || !navigator.onLine) {
        return { synced: 0, failed: 0 };
      }

      isSyncingRef.current = true;
      setIsSyncing(true);

      let synced = 0;
      let failed = 0;
      const remaining: OfflineAttempt[] = [];

      try {
        for (const item of queue) {
          try {
            await submitFn(item.sessionId, item.imageBase64);
            synced++;
          } catch {
            failed++;
            if (item.retryCount < 3) {
              remaining.push({ ...item, retryCount: item.retryCount + 1 });
            }
          }
        }
      } finally {
        setQueue((currentQueue) => {
          // Identify any items that were enqueued while sync was in flight
          const processedIds = new Set(queue.map((i) => i.id));
          const newlyAdded = currentQueue.filter((i) => !processedIds.has(i.id));
          return [...remaining, ...newlyAdded].slice(-MAX_QUEUE_SIZE);
        });
        isSyncingRef.current = false;
        setIsSyncing(false);
      }

      return { synced, failed };
    },
    [queue],
  );

  return {
    queue,
    queueCount: queue.length,
    isOnline,
    isSyncing,
    enqueue,
    syncQueue,
    clearQueue,
  };
}
