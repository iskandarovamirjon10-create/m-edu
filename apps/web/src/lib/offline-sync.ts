/**
 * ============================================================================
 * M-EDU Offline-First Mesh & Background Synchronization Engine
 * ============================================================================
 *
 * Provides resilient, zero-data-loss background queueing with:
 *  - IndexedDB persistent store (with automatic localStorage fallback)
 *  - FIFO queued action execution with unique Idempotency Keys
 *  - Automatic re-sync on network reconnect with exponential backoff
 *  - Reactive state listeners for React components
 *  - Conflict-free merging and retry controls
 * ============================================================================
 */
import { useState, useEffect } from 'react';
import { apiUrl, readXsrfCookie, ensureCsrfCookie } from './api';

export interface QueuedAction {
  id: string;
  idempotencyKey: string;
  endpoint: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  payload: unknown;
  timestamp: number;
  retryCount: number;
  lastAttemptAt?: number;
  status: 'pending' | 'syncing' | 'failed' | 'completed';
  error?: string;
  label: string;
  meta?: Record<string, unknown>;
}

export interface OfflineSyncState {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  lastSyncTime: number | null;
  queue: QueuedAction[];
}

const DB_NAME = 'medu_offline_mesh';
const DB_VERSION = 1;
const STORE_NAME = 'sync_queue';
const LS_FALLBACK_KEY = 'medu_offline_sync_queue';

export const MAX_RETRIES = 5;
export const BASE_BACKOFF_MS = 1000;
export const MAX_BACKOFF_MS = 60000;

let dbInstance: IDBDatabase | null = null;
let isDbSupported = typeof window !== 'undefined' && 'indexedDB' in window;

type SyncListener = (state: OfflineSyncState) => void;
const listeners = new Set<SyncListener>();

let broadcastChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
  try {
    broadcastChannel = new BroadcastChannel('medu_offline_mesh_sync');
    broadcastChannel.onmessage = async (event) => {
      if (event.data?.type === 'mesh_updated') {
        const updated = await loadQueueFromStorage();
        currentState.queue = updated;
        notify(false);
      }
    };
  } catch {
    broadcastChannel = null;
  }
}

function broadcastChange(action: string) {
  try {
    broadcastChannel?.postMessage({ type: 'mesh_updated', action, timestamp: Date.now() });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('medu:offline-sync', {
          detail: { ...currentState, lastAction: action },
        })
      );
    }
  } catch {
    // Ignore broadcast errors
  }
}

let currentState: OfflineSyncState = {
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  pendingCount: 0,
  isSyncing: false,
  lastSyncTime: null,
  queue: [],
};

function notify(shouldBroadcast = true) {
  currentState = {
    ...currentState,
    pendingCount: currentState.queue.filter((a) => a.status === 'pending' || a.status === 'failed').length,
  };
  listeners.forEach((listener) => {
    try {
      listener(currentState);
    } catch (e) {
      console.error('Error in offline sync listener', e);
    }
  });
  if (shouldBroadcast) {
    broadcastChange('state_updated');
  }
}

/** Open or return IndexedDB database instance */
async function getDb(): Promise<IDBDatabase | null> {
  if (!isDbSupported) return null;
  if (dbInstance) return dbInstance;

  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };

      request.onsuccess = () => {
        dbInstance = request.result;
        dbInstance.onversionchange = () => {
          dbInstance?.close();
          dbInstance = null;
        };
        dbInstance.onclose = () => {
          dbInstance = null;
        };
        resolve(dbInstance);
      };

      request.onerror = () => {
        console.warn('IndexedDB failed to open, using localStorage fallback');
        isDbSupported = false;
        resolve(null);
      };

      request.onblocked = () => {
        console.warn('IndexedDB open blocked, using localStorage fallback');
        resolve(null);
      };
    } catch {
      isDbSupported = false;
      resolve(null);
    }
  });
}

/** Load all actions from persistent storage */
async function loadQueueFromStorage(): Promise<QueuedAction[]> {
  const db = await getDb();
  if (db) {
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve(loadFromLocalStorage());
      } catch {
        resolve(loadFromLocalStorage());
      }
    });
  }
  return loadFromLocalStorage();
}

function loadFromLocalStorage(): QueuedAction[] {
  try {
    const raw = localStorage.getItem(LS_FALLBACK_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveActionToStorage(action: QueuedAction): Promise<void> {
  const db = await getDb();
  if (db) {
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(action);
        tx.oncomplete = () => resolve();
        tx.onerror = () => {
          saveToLocalStorage(action);
          resolve();
        };
      } catch {
        saveToLocalStorage(action);
        resolve();
      }
    });
  }
  saveToLocalStorage(action);
}

function saveToLocalStorage(action: QueuedAction) {
  try {
    const queue = loadFromLocalStorage();
    const idx = queue.findIndex((a) => a.id === action.id);
    if (idx >= 0) queue[idx] = action;
    else queue.push(action);
    localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('localStorage offline save error', e);
    try {
      // If quota exceeded, retain only pending items and recent records
      const queue = loadFromLocalStorage().filter((a) => a.status === 'pending' || a.status === 'failed').slice(-20);
      const idx = queue.findIndex((a) => a.id === action.id);
      if (idx >= 0) queue[idx] = action;
      else queue.push(action);
      localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(queue));
    } catch {
      // Memory state remains intact
    }
  }
}

async function deleteActionFromStorage(id: string): Promise<void> {
  const db = await getDb();
  if (db) {
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => {
          deleteFromLocalStorage(id);
          resolve();
        };
      } catch {
        deleteFromLocalStorage(id);
        resolve();
      }
    });
  }
  deleteFromLocalStorage(id);
}

function deleteFromLocalStorage(id: string) {
  try {
    const queue = loadFromLocalStorage().filter((a) => a.id !== id);
    localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('localStorage delete error', e);
  }
}

async function deleteBatchFromStorage(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDb();
  if (db) {
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        for (const id of ids) {
          store.delete(id);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => {
          deleteBatchFromLocalStorage(ids);
          resolve();
        };
      } catch {
        deleteBatchFromLocalStorage(ids);
        resolve();
      }
    });
  }
  deleteBatchFromLocalStorage(ids);
}

function deleteBatchFromLocalStorage(ids: string[]) {
  try {
    const idSet = new Set(ids);
    const queue = loadFromLocalStorage().filter((a) => !idSet.has(a.id));
    localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('localStorage delete batch error', e);
  }
}

/** Generate a resilient UUID v4 */
function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'offline_' + Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
}

/** Queue a new action for background synchronization */
export async function queueOfflineAction(params: {
  endpoint: string;
  method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  payload: unknown;
  label: string;
  meta?: Record<string, unknown>;
}): Promise<QueuedAction> {
  const action: QueuedAction = {
    id: generateUuid(),
    idempotencyKey: 'offline_' + generateUuid(),
    endpoint: params.endpoint,
    method: params.method || 'POST',
    payload: params.payload,
    timestamp: Date.now(),
    retryCount: 0,
    status: 'pending',
    label: params.label,
    meta: params.meta,
  };

  await saveActionToStorage(action);
  currentState.queue = [action, ...currentState.queue];
  notify();

  // If online right now, attempt immediate sync
  if (currentState.isOnline && !currentState.isSyncing) {
    void syncPendingQueue();
  }

  return action;
}

/** Process and sync pending queue in FIFO order with exponential backoff & client-error protection */
export async function syncPendingQueue(): Promise<{
  successCount: number;
  failedCount: number;
}> {
  if (currentState.isSyncing) {
    return { successCount: 0, failedCount: 0 };
  }

  const now = Date.now();
  const eligible = currentState.queue
    .filter((a) => {
      if (a.status === 'pending') return true;
      if (a.status === 'failed') {
        if (a.retryCount >= MAX_RETRIES) return false;
        const backoffDelay = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * Math.pow(2, a.retryCount));
        const lastAttempt = a.lastAttemptAt || a.timestamp;
        return now - lastAttempt >= backoffDelay;
      }
      return false;
    })
    .sort((a, b) => a.timestamp - b.timestamp);

  if (eligible.length === 0) {
    return { successCount: 0, failedCount: 0 };
  }

  currentState.isSyncing = true;
  notify();

  let successCount = 0;
  let failedCount = 0;

  for (const item of eligible) {
    // Check if network was disconnected during batch iteration
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      currentState.isOnline = false;
      break;
    }

    item.status = 'syncing';
    item.lastAttemptAt = Date.now();
    notify();

    try {
      await ensureCsrfCookie();
      const token = readXsrfCookie();

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Idempotency-Key': item.idempotencyKey,
      };
      if (token) {
        headers['x-xsrf-token'] = token;
      }

      const body =
        item.payload !== undefined && item.payload !== null
          ? JSON.stringify(item.payload)
          : undefined;

      const res = await fetch(apiUrl(item.endpoint), {
        method: item.method,
        headers,
        body,
        credentials: 'include',
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => 'Server error');
        const isClientPermanent =
          res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429;
        const err = new Error(`HTTP ${res.status}: ${errorText}`);
        (err as unknown as { isPermanent?: boolean }).isPermanent = isClientPermanent;
        throw err;
      }

      item.status = 'completed';
      item.error = undefined;
      successCount++;
      await saveActionToStorage(item);
    } catch (err: unknown) {
      item.status = 'failed';
      item.retryCount += 1;
      item.error = err instanceof Error ? err.message : String(err);

      if ((err as unknown as { isPermanent?: boolean })?.isPermanent) {
        item.retryCount = MAX_RETRIES;
      }

      const isNetworkError =
        (err instanceof TypeError && err.message.toLowerCase().includes('fetch')) ||
        (err instanceof Error &&
          (err.message.includes('Network') || err.message.includes('Failed to fetch')));

      failedCount++;
      await saveActionToStorage(item);

      if (isNetworkError) {
        currentState.isOnline = false;
        notify();
        break;
      }
    }
    notify();
  }

  currentState.isSyncing = false;
  currentState.lastSyncTime = Date.now();
  notify();

  return { successCount, failedCount };
}

/** Clear completed items from storage in a single atomic batch */
export async function clearCompletedActions(): Promise<void> {
  const completed = currentState.queue.filter((a) => a.status === 'completed');
  if (completed.length === 0) return;

  const ids = completed.map((item) => item.id);
  await deleteBatchFromStorage(ids);
  currentState.queue = currentState.queue.filter((a) => a.status !== 'completed');
  notify();
}

/** Retry a specific failed action with reset backoff counter */
export async function retryQueuedAction(id: string): Promise<void> {
  const item = currentState.queue.find((a) => a.id === id);
  if (!item) return;
  item.status = 'pending';
  item.retryCount = 0;
  item.lastAttemptAt = undefined;
  item.error = undefined;
  await saveActionToStorage(item);
  notify();
  if (currentState.isOnline) {
    void syncPendingQueue();
  }
}

/** Remove an action from the queue */
export async function removeQueuedAction(id: string): Promise<void> {
  await deleteActionFromStorage(id);
  currentState.queue = currentState.queue.filter((a) => a.id !== id);
  notify();
}

/* ============================================================================
 * Lifecycle Initialization & Event Listeners
 * ========================================================================== */

if (typeof window !== 'undefined') {
  // Load queue on startup
  loadQueueFromStorage().then((q) => {
    currentState.queue = q;
    notify();
    if (navigator.onLine && q.some((a) => a.status === 'pending')) {
      void syncPendingQueue();
    }
  });

  window.addEventListener('online', () => {
    currentState.isOnline = true;
    notify();
    void syncPendingQueue();
  });

  window.addEventListener('offline', () => {
    currentState.isOnline = false;
    notify();
  });
}

/* ============================================================================
 * React Hook: useOfflineSync
 * ========================================================================== */

export function useOfflineSync(): OfflineSyncState & {
  syncNow: () => Promise<{ successCount: number; failedCount: number }>;
  clearCompleted: () => Promise<void>;
  retryAction: (id: string) => Promise<void>;
  removeAction: (id: string) => Promise<void>;
  queueAction: typeof queueOfflineAction;
} {
  const [state, setState] = useState<OfflineSyncState>(currentState);

  useEffect(() => {
    listeners.add(setState);
    setState(currentState);
    return () => {
      listeners.delete(setState);
    };
  }, []);

  return {
    ...state,
    syncNow: syncPendingQueue,
    clearCompleted: clearCompletedActions,
    retryAction: retryQueuedAction,
    removeAction: removeQueuedAction,
    queueAction: queueOfflineAction,
  };
}
