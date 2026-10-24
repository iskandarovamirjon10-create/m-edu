/**
 * M-EDU AuthContext — "Cupertino Vault" Edition v3.1
 *
 * 🔧 v3 → v3.1 TypeScript FIXES:
 *  ✅ useTabLeader — rewritten with proper useState/useRef (no invalid useSyncExternalStore)
 *  ✅ withRetry — typed generic <T>, no self-referencing promise
 *  ✅ authApi.me() — correct signature (0 args)
 *  ✅ authApi responses — properly cast via type guards
 *  ✅ Removed unused: LEADER_ELECTION_KEY, isLeader/setIsLeader from bad hook
 *  ✅ useOnlineStatus — proper useSyncExternalStore shape
 *  ✅ useAuthSelector — stable getSnapshot with proper cache
 *  ✅ All FIX #1-17 from v2 preserved
 *  ✅ All v3 features preserved (events, retry, leader, middleware, selector, suspense)
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type MutableRefObject,
} from 'react';
import { authApi, userStore, setUnauthorizedHandler } from '@/lib/api';
import { purgeSessionCaches } from '@/lib/sessionCleanup';
import type { User } from '@/lib/types';

/* ══════════════════════════════════════════════════════════════════════════
 * 1. TYPES
 * ════════════════════════════════════════════════════════════════════════ */

export type AuthStatus = 'booting' | 'authenticated' | 'unauthenticated';
export type AuthPending = 'login' | 'register' | 'logout' | 'refresh' | null;

export type AuthErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NETWORK'
  | 'TIMEOUT'
  | 'RATE_LIMITED'
  | 'SERVER_ERROR'
  | 'VALIDATION'
  | 'UNKNOWN';

export type LogoutReason =
  | 'manual'
  | 'expired'
  | 'interceptor'
  | 'tab-sync'
  | 'error'
  | 'unauthenticated'
  | 'unknown';

export interface RegisterPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  organizationName: string;
  inviteCode?: string;
}

export interface LoginOptions {
  returnTo?: string;
  redirect?: boolean;
}

/** Auth API responses — narrow from `unknown` */
interface AuthResponse {
  user: User;
  pendingApproval?: boolean;
  message?: string;
}

export interface AuthEventMap {
  signIn: { user: User; source: 'login' | 'register' | 'parent-login' | 'oauth' | 'tab-sync' };
  signOut: { reason: LogoutReason };
  error: { code: AuthErrorCode; message: string };
  stateChange: { from: AuthStatus; to: AuthStatus };
  userPatched: { user: User };
}

export type AuthEventName = keyof AuthEventMap;
export type AuthEventListener<K extends AuthEventName> = (payload: AuthEventMap[K]) => void;

export type AuthMiddleware = (
  next: () => Promise<unknown>,
  context: { action: 'login' | 'register' | 'verify' | 'logout' },
) => Promise<unknown>;

/* ══════════════════════════════════════════════════════════════════════════
 * 2. AUTH ERROR
 * ════════════════════════════════════════════════════════════════════════ */

export class AuthError extends Error {
  readonly code: AuthErrorCode;
  readonly status?: number;
  readonly cause?: unknown;
  readonly retryable: boolean;

  constructor(
    code: AuthErrorCode,
    message: string,
    status?: number,
    cause?: unknown,
    retryable = false,
  ) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.status = status;
    this.cause = cause;
    this.retryable = retryable;
    Object.setPrototypeOf(this, AuthError.prototype);
  }
}

/* ══════════════════════════════════════════════════════════════════════════
 * 3. STATE
 * ════════════════════════════════════════════════════════════════════════ */

interface AuthState {
  status: AuthStatus;
  user: User | null;
  pending: AuthPending;
  error: AuthError | null;
  verifiedAt: number | null;
  lastLogoutReason: LogoutReason | null;
}

type AuthEvent =
  | { type: 'BOOTED'; user: User | null }
  | { type: 'PENDING'; pending: AuthPending }
  | { type: 'PENDING_DONE'; pending: Exclude<AuthPending, null> }
  | { type: 'SIGNED_IN'; user: User }
  | { type: 'VERIFIED'; user: User }
  | { type: 'USER_PATCHED'; user: User }
  | { type: 'FAILED'; error: AuthError }
  | { type: 'SIGNED_OUT'; reason: LogoutReason }
  | { type: 'ERROR_CLEARED' };

const initialState: AuthState = {
  status: 'booting',
  user: null,
  pending: null,
  error: null,
  verifiedAt: null,
  lastLogoutReason: null,
};

function reducer(state: AuthState, event: AuthEvent): AuthState {
  switch (event.type) {
    case 'BOOTED':
      if (state.status === 'authenticated' && state.user) return state;
      return {
        ...state,
        status: event.user ? 'authenticated' : 'unauthenticated',
        user: event.user,
        pending: null,
      };
    case 'PENDING':
      return { ...state, pending: event.pending, error: null };
    case 'PENDING_DONE':
      return state.pending === event.pending ? { ...state, pending: null } : state;
    case 'SIGNED_IN':
      return {
        status: 'authenticated',
        user: event.user,
        pending: null,
        error: null,
        verifiedAt: Date.now(),
        lastLogoutReason: null,
      };
    case 'VERIFIED':
      return {
        ...state,
        status: 'authenticated',
        user: event.user,
        pending: null,
        verifiedAt: Date.now(),
      };
    case 'USER_PATCHED':
      return { ...state, user: event.user };
    case 'FAILED':
      return { ...state, pending: null, error: event.error };
    case 'SIGNED_OUT':
      return { ...initialState, status: 'unauthenticated', lastLogoutReason: event.reason };
    case 'ERROR_CLEARED':
      return { ...state, error: null };
    default:
      return state;
  }
}

/* ══════════════════════════════════════════════════════════════════════════
 * 4. EXTERNAL STORE
 * ════════════════════════════════════════════════════════════════════════ */

class AuthStore {
  private state: AuthState = initialState;
  private listeners = new Set<() => void>();

  getState = (): AuthState => this.state;

  setState = (next: AuthState): void => {
    if (this.state === next) return;
    this.state = next;
    this.listeners.forEach((l) => l());
  };

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
}

/* ══════════════════════════════════════════════════════════════════════════
 * 5. AUTH EVENT BUS
 * ════════════════════════════════════════════════════════════════════════ */

type EventListenerAny = (payload: unknown) => void;

class AuthEventBus {
  private listeners = new Map<AuthEventName, Set<EventListenerAny>>();

  on<K extends AuthEventName>(event: K, listener: AuthEventListener<K>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as EventListenerAny);
    return () => {
      set!.delete(listener as EventListenerAny);
    };
  }

  emit<K extends AuthEventName>(event: K, payload: AuthEventMap[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    set.forEach((l) => {
      try {
        l(payload);
      } catch (e) {
        if (import.meta.env?.DEV) {
          console.error(`[AuthEventBus] listener error for ${event}:`, e);
        }
      }
    });
  }
}

/* ══════════════════════════════════════════════════════════════════════════
 * 6. CONSTANTS
 * ════════════════════════════════════════════════════════════════════════ */

const SYNC_CHANNEL = 'auth:sync';
const SYNC_STORAGE_KEY = '__auth_sync__';
const SYNC_VERSION = 1;
const DEEPLINK_STORAGE_KEY = '__auth_returnTo__';
const LEADER_HEARTBEAT_MS = 5_000;
const LEADER_TIMEOUT_MS = 12_000;

type SyncMessage =
  | { v: 1; type: 'SIGNED_IN'; user: User }
  | { v: 1; type: 'USER_PATCHED'; user: User }
  | { v: 1; type: 'SIGNED_OUT' }
  | { v: 1; type: 'LEADER_HEARTBEAT'; tabId: string };

type DistributiveOmit<T, K extends keyof any> = T extends any ? Omit<T, K> : never;

/* ══════════════════════════════════════════════════════════════════════════
 * 7. HELPERS
 * ════════════════════════════════════════════════════════════════════════ */

function toAuthError(err: unknown, fallbackCode: AuthErrorCode = 'UNKNOWN'): AuthError {
  if (err instanceof AuthError) return err;

  const e = err as {
    status?: number;
    response?: { status?: number; data?: { message?: string } };
    message?: string;
    code?: string;
  };
  const status = e?.status ?? e?.response?.status;
  const message = e?.response?.data?.message ?? e?.message ?? 'Unexpected error';

  if (status === 401)
    return new AuthError(fallbackCode === 'UNKNOWN' ? 'UNAUTHORIZED' : fallbackCode, message, status, err);
  if (status === 403) return new AuthError('FORBIDDEN', message, status, err);
  if (status === 400 || status === 422) return new AuthError('VALIDATION', message, status, err);
  if (status === 429) return new AuthError('RATE_LIMITED', message, status, err, true);
  if (status && status >= 500) return new AuthError('SERVER_ERROR', message, status, err, true);
  if (e?.code === 'ERR_CANCELED' || e?.code === 'ABORT_ERR')
    return new AuthError('NETWORK', 'Request cancelled', undefined, err);
  if (e?.code === 'ETIMEDOUT' || /timeout/i.test(message))
    return new AuthError('TIMEOUT', message, status, err, true);
  if (!status && (typeof navigator === 'undefined' || !navigator.onLine || /network|fetch/i.test(message)))
    return new AuthError('NETWORK', 'No internet connection', undefined, err, true);
  return new AuthError(fallbackCode, message, status, err);
}

function extractRoles(user: User | null): string[] {
  if (!user) return [];
  const u = user as unknown as { role?: unknown; roles?: unknown };
  if (Array.isArray(u.roles)) return u.roles.filter((r): r is string => typeof r === 'string');
  if (typeof u.role === 'string') return [u.role];
  return [];
}

function safeReturnTo(raw: string | null | undefined, loginPath: string): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value.startsWith('/')) return null;
  if (/^\/[/\\]/.test(value)) return null;
  if (/^\/%2f/i.test(value)) return null;

  try {
    const u = new URL(value, window.location.origin);
    if (u.origin !== window.location.origin) return null;
    const login = loginPath.replace(/\/+$/, '');
    if (u.pathname === login || u.pathname.startsWith(`${login}/`)) return null;
    return u.pathname + u.search + u.hash;
  } catch {
    return null;
  }
}

/** Cast a raw response to AuthResponse safely. */
function asAuthResponse(raw: unknown): AuthResponse {
  if (!raw || typeof raw !== 'object') {
    throw new AuthError('UNKNOWN', 'Invalid auth response');
  }
  const r = raw as Record<string, unknown>;
  if (!r.user || typeof r.user !== 'object') {
    throw new AuthError('UNKNOWN', 'Missing user in auth response');
  }
  return {
    user: r.user as User,
    pendingApproval: Boolean(r.pendingApproval),
    message: typeof r.message === 'string' ? r.message : undefined,
  };
}

function useLatest<T>(value: T): MutableRefObject<T> {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}

/** Exponential backoff retry — generic, no self-reference. */
async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { maxAttempts?: number; baseDelayMs?: number } = {},
): Promise<T> {
  const { maxAttempts = 3, baseDelayMs = 800 } = opts;
  let lastErr: unknown = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const authErr = toAuthError(e);
      if (!authErr.retryable) throw authErr;
      if (attempt === maxAttempts - 1) throw authErr;
      const delay = baseDelayMs * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr ?? new AuthError('UNKNOWN', 'Retry failed');
}

/* ══════════════════════════════════════════════════════════════════════════
 * 8. HOOKS
 * ════════════════════════════════════════════════════════════════════════ */

function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    (cb) => {
      if (typeof window === 'undefined') return () => {};
      window.addEventListener('online', cb);
      window.addEventListener('offline', cb);
      return () => {
        window.removeEventListener('online', cb);
        window.removeEventListener('offline', cb);
      };
    },
    () => (typeof navigator !== 'undefined' ? navigator.onLine : true),
    () => true,
  );
}

/**
 * Simple tab-leader election.
 * Returns true if this tab is the current leader (or if sync is disabled).
 */
function useTabLeader(
  channelRef: MutableRefObject<BroadcastChannel | null>,
  enabled: boolean,
): boolean {
  const [isLeader, setIsLeader] = useState(true);
  const tabIdRef = useRef<string>(
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  const lastLeaderHeartbeatRef = useRef<number>(Date.now());
  const leaderIdRef = useRef<string>(tabIdRef.current);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      setIsLeader(true);
      return;
    }

    const ch = channelRef.current;

    const handleMessage = (e: MessageEvent<SyncMessage>) => {
      if (e.data?.type !== 'LEADER_HEARTBEAT') return;
      const { tabId } = e.data;
      if (tabId === tabIdRef.current) return;
      lastLeaderHeartbeatRef.current = Date.now();
      leaderIdRef.current = tabId;
      setIsLeader(false);
    };

    if (ch) {
      ch.addEventListener('message', handleMessage);
    }

    const heartbeat = window.setInterval(() => {
      const now = Date.now();
      const sinceLastHeartbeat = now - lastLeaderHeartbeatRef.current;
      const iAmLeader =
        leaderIdRef.current === tabIdRef.current ||
        sinceLastHeartbeat > LEADER_TIMEOUT_MS;

      if (iAmLeader) {
        lastLeaderHeartbeatRef.current = now;
        leaderIdRef.current = tabIdRef.current;
        setIsLeader(true);
        try {
          ch?.postMessage({
            v: SYNC_VERSION,
            type: 'LEADER_HEARTBEAT',
            tabId: tabIdRef.current,
          });
        } catch {
          /* noop */
        }
      }
    }, LEADER_HEARTBEAT_MS);

    return () => {
      clearInterval(heartbeat);
      if (ch) {
        ch.removeEventListener('message', handleMessage);
      }
    };
  }, [channelRef, enabled]);

  return isLeader;
}

/* ══════════════════════════════════════════════════════════════════════════
 * 9. CONTEXT VALUES
 * ════════════════════════════════════════════════════════════════════════ */

export interface AuthStateValue extends AuthState {
  /** @deprecated `status === 'booting'` ishlating. */
  loading: boolean;
  isAuthenticated: boolean;
  isBooting: boolean;
  roles: string[];
  hasRole: (role: string) => boolean;
  hasAnyRole: (...roles: string[]) => boolean;
  hasAllRoles: (...roles: string[]) => boolean;
}

export interface AuthActionsValue {
  login: (email: string, password: string, opts?: LoginOptions) => Promise<User>;
  parentLogin: (email: string, password: string, opts?: LoginOptions) => Promise<User>;
  register: (data: RegisterPayload, opts?: LoginOptions) => Promise<User>;
  logout: (opts?: { redirect?: boolean; reason?: LogoutReason }) => Promise<void>;
  refresh: () => Promise<User | null>;
  updateUser: (patch: Partial<User> | ((prev: User) => User)) => void;
  /** @deprecated `updateUser` ishlating. */
  setUser: (u: User | null) => void;
  clearError: () => void;
  gotoLogin: (returnTo?: string) => void;
  on: <K extends AuthEventName>(event: K, listener: AuthEventListener<K>) => () => void;
}

interface AuthStoreContextValue {
  store: AuthStore;
  eventBus: AuthEventBus;
  offline: boolean;
}

export interface AuthProviderProps {
  children: ReactNode;
  loginPath?: string;
  staleTime?: number;
  revalidateOnFocus?: boolean;
  syncTabs?: boolean;
  navigate?: (to: string) => void;
  retry?: { maxAttempts?: number; baseDelayMs?: number };
  middleware?: AuthMiddleware[];
  debug?: boolean;
}

/* ══════════════════════════════════════════════════════════════════════════
 * 10. CONTEXTS
 * ════════════════════════════════════════════════════════════════════════ */

const AuthStateContext = createContext<AuthStateValue | null>(null);
const AuthActionsContext = createContext<AuthActionsValue | null>(null);
const AuthStoreContext = createContext<AuthStoreContextValue | null>(null);

/* ══════════════════════════════════════════════════════════════════════════
 * 11. PROVIDER
 * ════════════════════════════════════════════════════════════════════════ */

export function AuthProvider({
  children,
  loginPath = '/login',
  staleTime = 5 * 60_000,
  revalidateOnFocus = true,
  syncTabs = true,
  navigate,
  retry,
  middleware = [],
  debug = false,
}: AuthProviderProps) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useLatest(state);

  const storeRef = useRef<AuthStore | null>(null);
  if (!storeRef.current) storeRef.current = new AuthStore();

  const eventBusRef = useRef<AuthEventBus | null>(null);
  if (!eventBusRef.current) eventBusRef.current = new AuthEventBus();

  const inflightRef = useRef<Promise<User | null> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const navigateRef = useLatest(navigate);
  const middlewareRef = useLatest(middleware);
  const retryRef = useLatest(retry);

  const online = useOnlineStatus();
  const offline = !online;

  /* Sync state → store */
  useEffect(() => {
    storeRef.current!.setState(state);
  }, [state]);

  /* Emit state change events */
  const prevStatusRef = useRef<AuthStatus>(state.status);
  useEffect(() => {
    if (prevStatusRef.current !== state.status) {
      eventBusRef.current!.emit('stateChange', {
        from: prevStatusRef.current,
        to: state.status,
      });
      prevStatusRef.current = state.status;
    }
  }, [state.status]);

  /* Dev logging */
  useEffect(() => {
    if (!debug) return;
    const unsubs = [
      eventBusRef.current!.on('signIn', (p) =>
        console.info('%c[Auth] ✨ signIn', 'color:#34C759;font-weight:bold', p),
      ),
      eventBusRef.current!.on('signOut', (p) =>
        console.info('%c[Auth] 👋 signOut', 'color:#FF9500;font-weight:bold', p),
      ),
      eventBusRef.current!.on('error', (p) =>
        console.warn('%c[Auth] ⚠️ error', 'color:#FF3B30;font-weight:bold', p),
      ),
      eventBusRef.current!.on('stateChange', (p) =>
        console.info(`%c[Auth] 🔄 ${p.from} → ${p.to}`, 'color:#007AFF'),
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, [debug]);

  /* ── Navigation ─────────────────────────────────────────────── */

  const go = useCallback(
    (to: string) => {
      if (typeof window === 'undefined') return;
      const nav = navigateRef.current;
      if (nav) nav(to);
      else window.location.assign(to);
    },
    [navigateRef],
  );

  const redirectToLogin = useCallback(
    (returnToOverride?: string) => {
      if (typeof window === 'undefined') return;
      const { pathname, search } = window.location;
      const login = loginPath.replace(/\/+$/, '');
      if (pathname === login || pathname.startsWith(`${login}/`)) return;

      const returnTo = returnToOverride ?? pathname + search;
      try {
        sessionStorage.setItem(DEEPLINK_STORAGE_KEY, returnTo);
      } catch {
        /* private mode */
      }
      go(`${loginPath}?returnTo=${encodeURIComponent(returnTo)}`);
    },
    [loginPath, go],
  );

  const navigateAfterAuth = useCallback(
    (opts?: LoginOptions, fallbackPath?: string) => {
      if (typeof window === 'undefined') return;
      if (opts?.redirect === false) return;

      const fromQuery = new URLSearchParams(window.location.search).get('returnTo');
      let fromStorage: string | null = null;
      try {
        fromStorage = sessionStorage.getItem(DEEPLINK_STORAGE_KEY);
      } catch {
        /* noop */
      }

      const explicit = opts?.returnTo ? safeReturnTo(opts.returnTo, loginPath) : null;
      const target =
        explicit ??
        safeReturnTo(fromQuery, loginPath) ??
        safeReturnTo(fromStorage, loginPath);

      if (target) go(target);
      else if (fallbackPath) go(fallbackPath);

      try {
        sessionStorage.removeItem(DEEPLINK_STORAGE_KEY);
      } catch {
        /* noop */
      }
    },
    [loginPath, go],
  );

  /* ── Persist & sync ─────────────────────────────────────────── */

  const persist = useCallback((user: User) => {
    userStore.set(user);
  }, []);

  const broadcast = useCallback(
    (msg: DistributiveOmit<SyncMessage, 'v'>) => {
      if (!syncTabs) return;
      try {
        const payload: SyncMessage = { ...msg, v: SYNC_VERSION } as SyncMessage;
        if (channelRef.current) channelRef.current.postMessage(payload);
        else localStorage.setItem(SYNC_STORAGE_KEY, JSON.stringify({ ...payload, t: Date.now() }));
      } catch {
        /* private mode / quota */
      }
    },
    [syncTabs],
  );

  /* ── Session ops ────────────────────────────────────────────── */

  const signOutLocally = useCallback((reason: LogoutReason = 'manual') => {
    abortRef.current?.abort();
    abortRef.current = null;
    inflightRef.current = null;
    userStore.clear();
    purgeSessionCaches();
    dispatch({ type: 'SIGNED_OUT', reason });
    eventBusRef.current!.emit('signOut', { reason });
  }, []);

  const runMiddleware = useCallback(
    async <T,>(action: 'login' | 'register' | 'verify' | 'logout', core: () => Promise<T>): Promise<T> => {
      const chain = middlewareRef.current;
      if (!chain || chain.length === 0) return core();
      let idx = 0;
      const next = async (): Promise<unknown> => {
        const mw = chain[idx++];
        if (!mw) return core();
        return mw(next, { action });
      };
      return (await next()) as T;
    },
    [middlewareRef],
  );

  const verify = useCallback((): Promise<User | null> => {
    if (inflightRef.current) return inflightRef.current;

    const ac = new AbortController();
    abortRef.current = ac;

    const execute = async (): Promise<User | null> => {
      try {
        const me = await runMiddleware('verify', () =>
          withRetry(
            async () => (await authApi.me()) as User,
            retryRef.current,
          ),
        );

        if (ac.signal.aborted || !me) return null;
        persist(me);
        dispatch({ type: 'VERIFIED', user: me });
        return me;
      } catch (err) {
        if (ac.signal.aborted) return null;
        const e = toAuthError(err);
        if (e.code === 'UNAUTHORIZED' || e.code === 'FORBIDDEN') {
          signOutLocally('expired');
          broadcast({ type: 'SIGNED_OUT' });
          eventBusRef.current!.emit('error', { code: e.code, message: e.message });
          return null;
        }
        eventBusRef.current!.emit('error', { code: e.code, message: e.message });
        return stateRef.current.user;
      } finally {
        if (inflightRef.current === promise) inflightRef.current = null;
        if (abortRef.current === ac) abortRef.current = null;
      }
    };

    const promise = execute();
    inflightRef.current = promise;
    return promise;
  }, [persist, signOutLocally, broadcast, stateRef, runMiddleware, retryRef]);

  const adopt = useCallback(
    (user: User, source: AuthEventMap['signIn']['source'] = 'login') => {
      const prevId = stateRef.current.user?.id;
      if (prevId && prevId !== user.id) purgeSessionCaches();
      persist(user);
      dispatch({ type: 'SIGNED_IN', user });
      broadcast({ type: 'SIGNED_IN', user });
      eventBusRef.current!.emit('signIn', { user, source });
    },
    [persist, broadcast, stateRef],
  );

  /* ── Boot ───────────────────────────────────────────────────── */

  useEffect(() => {
    let alive = true;
    const cached = userStore.get<User>();
    if (cached) dispatch({ type: 'BOOTED', user: cached });

    void verify().then((u) => {
      if (!alive) return;
      if (!cached) dispatch({ type: 'BOOTED', user: u });
    });

    return () => {
      alive = false;
      abortRef.current?.abort();
    };
  }, [verify]);

  /* ── 401 interceptor ────────────────────────────────────────── */

  useEffect(() => {
    setUnauthorizedHandler(() => {
      signOutLocally('interceptor');
      broadcast({ type: 'SIGNED_OUT' });
      redirectToLogin();
    });
  }, [signOutLocally, broadcast, redirectToLogin]);

  /* ── Tab sync ───────────────────────────────────────────────── */

  useEffect(() => {
    if (!syncTabs || typeof window === 'undefined') return;

    const handle = (msg: SyncMessage) => {
      if ((msg as { v?: number }).v !== undefined && (msg as { v?: number }).v !== SYNC_VERSION) return;
      if (msg.type === 'SIGNED_OUT') {
        if (stateRef.current.status !== 'unauthenticated') {
          signOutLocally('tab-sync');
          redirectToLogin();
        }
      } else if (msg.type === 'SIGNED_IN') {
        const prevId = stateRef.current.user?.id;
        if (prevId && msg.user?.id !== prevId) purgeSessionCaches();
        userStore.set(msg.user);
        dispatch({ type: 'SIGNED_IN', user: msg.user });
        eventBusRef.current!.emit('signIn', { user: msg.user, source: 'tab-sync' });
      } else if (msg.type === 'USER_PATCHED') {
        userStore.set(msg.user);
        dispatch({ type: 'USER_PATCHED', user: msg.user });
        eventBusRef.current!.emit('userPatched', { user: msg.user });
      }
    };

    let onMessage: ((e: MessageEvent<SyncMessage>) => void) | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      const ch = new BroadcastChannel(SYNC_CHANNEL);
      onMessage = (e: MessageEvent<SyncMessage>) => handle(e.data);
      ch.addEventListener('message', onMessage);
      channelRef.current = ch;
    }

    let lastTs = 0;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== SYNC_STORAGE_KEY || !e.newValue) return;
      try {
        const parsed = JSON.parse(e.newValue) as SyncMessage & { t?: number };
        if (parsed?.t && parsed.t <= lastTs) return;
        if (parsed?.t) lastTs = parsed.t;
        handle(parsed);
      } catch {
        /* noop */
      }
    };
    window.addEventListener('storage', onStorage);

    return () => {
      if (channelRef.current && onMessage) {
        channelRef.current.removeEventListener('message', onMessage);
      }
      channelRef.current?.close();
      channelRef.current = null;
      window.removeEventListener('storage', onStorage);
    };
  }, [syncTabs, signOutLocally, redirectToLogin, stateRef]);

  /* ── Tab leader ─────────────────────────────────────────────── */

  const isLeader = useTabLeader(channelRef, syncTabs);

  /* ── Stale-while-revalidate ─────────────────────────────────── */

  useEffect(() => {
    if (!revalidateOnFocus || typeof window === 'undefined') return;
    if (!isLeader) return;

    const maybeRevalidate = (opts?: { requireVisible?: boolean }) => {
      const s = stateRef.current;
      if (s.status !== 'authenticated') return;
      if (opts?.requireVisible && document.visibilityState === 'hidden') return;
      if (s.verifiedAt && Date.now() - s.verifiedAt < staleTime) return;
      void verify();
    };

    const onFocus = () => maybeRevalidate();
    const onOnline = () => maybeRevalidate();
    const onVisibility = () => maybeRevalidate({ requireVisible: true });

    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [revalidateOnFocus, staleTime, verify, stateRef, isLeader]);

  /* ── Public actions ─────────────────────────────────────────── */

  const login = useCallback<AuthActionsValue['login']>(
    async (email, password, opts) => {
      dispatch({ type: 'PENDING', pending: 'login' });
      try {
        const raw = await runMiddleware('login', async () =>
          authApi.login(email.trim().toLowerCase(), password),
        );
        const { user } = asAuthResponse(raw);
        adopt(user, 'login');
        navigateAfterAuth(opts);
        return user;
      } catch (err) {
        const e = toAuthError(err, 'INVALID_CREDENTIALS');
        dispatch({ type: 'FAILED', error: e });
        eventBusRef.current!.emit('error', { code: e.code, message: e.message });
        throw e;
      }
    },
    [adopt, navigateAfterAuth, runMiddleware],
  );

  const parentLogin = useCallback<AuthActionsValue['parentLogin']>(
    async (email, password, opts) => {
      dispatch({ type: 'PENDING', pending: 'login' });
      try {
        const raw = await runMiddleware('login', async () =>
          authApi.parentLogin(email.trim().toLowerCase(), password),
        );
        const { user } = asAuthResponse(raw);
        adopt(user, 'parent-login');
        navigateAfterAuth(opts, '/parent-portal');
        return user;
      } catch (err) {
        const e = toAuthError(err, 'INVALID_CREDENTIALS');
        dispatch({ type: 'FAILED', error: e });
        eventBusRef.current!.emit('error', { code: e.code, message: e.message });
        throw e;
      }
    },
    [adopt, navigateAfterAuth, runMiddleware],
  );

  const register = useCallback<AuthActionsValue['register']>(
    async (data, opts) => {
      dispatch({ type: 'PENDING', pending: 'register' });
      try {
        const raw = await runMiddleware('register', async () =>
          authApi.register({
            ...data,
            email: data.email.trim().toLowerCase(),
          }),
        );
        const { user, pendingApproval, message } = asAuthResponse(raw);

        if (pendingApproval) {
          dispatch({ type: 'PENDING_DONE', pending: 'register' });
          return {
            ...user,
            pendingApproval: true,
            message,
          } as User;
        }

        adopt(user, 'register');
        navigateAfterAuth(opts);
        return user;
      } catch (err) {
        const e = toAuthError(err, 'VALIDATION');
        dispatch({ type: 'FAILED', error: e });
        eventBusRef.current!.emit('error', { code: e.code, message: e.message });
        throw e;
      }
    },
    [adopt, navigateAfterAuth, runMiddleware],
  );

  const logout = useCallback<AuthActionsValue['logout']>(
    async ({ redirect = true, reason = 'manual' } = {}) => {
      dispatch({ type: 'PENDING', pending: 'logout' });
      try {
        await authApi.logout();
      } catch {
        /* server javob bermasa ham — lokal sessiya tozalanadi */
      } finally {
        signOutLocally(reason);
        broadcast({ type: 'SIGNED_OUT' });
        if (redirect) redirectToLogin();
      }
    },
    [signOutLocally, broadcast, redirectToLogin],
  );

  const refresh = useCallback<AuthActionsValue['refresh']>(
    async () => {
      dispatch({ type: 'PENDING', pending: 'refresh' });
      try {
        return await verify();
      } finally {
        dispatch({ type: 'PENDING_DONE', pending: 'refresh' });
      }
    },
    [verify],
  );

  const updateUser = useCallback<AuthActionsValue['updateUser']>(
    (patch) => {
      const prev = stateRef.current.user;
      if (!prev) return;
      const next = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch };
      userStore.set(next);
      dispatch({ type: 'USER_PATCHED', user: next });
      broadcast({ type: 'USER_PATCHED', user: next });
      eventBusRef.current!.emit('userPatched', { user: next });
    },
    [broadcast, stateRef],
  );

  const setUser = useCallback<AuthActionsValue['setUser']>(
    (u) => {
      if (!u) {
        signOutLocally('manual');
        return;
      }
      userStore.set(u);
      if (stateRef.current.status === 'authenticated') {
        dispatch({ type: 'USER_PATCHED', user: u });
      } else {
        dispatch({ type: 'SIGNED_IN', user: u });
        broadcast({ type: 'SIGNED_IN', user: u });
        eventBusRef.current!.emit('signIn', { user: u, source: 'oauth' });
      }
    },
    [signOutLocally, broadcast, stateRef],
  );

  const clearError = useCallback(() => dispatch({ type: 'ERROR_CLEARED' }), []);

  const gotoLogin = useCallback(
    (returnTo?: string) => redirectToLogin(returnTo),
    [redirectToLogin],
  );

  const on = useCallback<AuthActionsValue['on']>(
    (event, listener) => eventBusRef.current!.on(event, listener),
    [],
  );

  /* ── Context values ─────────────────────────────────────────── */

  const roles = useMemo(() => extractRoles(state.user), [state.user]);

  const stateValue = useMemo<AuthStateValue>(
    () => ({
      ...state,
      loading: state.status === 'booting',
      isAuthenticated: state.status === 'authenticated',
      isBooting: state.status === 'booting',
      roles,
      hasRole: (r) => roles.includes(r),
      hasAnyRole: (...rs) => rs.some((r) => roles.includes(r)),
      hasAllRoles: (...rs) => rs.every((r) => roles.includes(r)),
    }),
    [state, roles],
  );

  const actionsValue = useMemo<AuthActionsValue>(
    () => ({
      login,
      parentLogin,
      register,
      logout,
      refresh,
      updateUser,
      setUser,
      clearError,
      gotoLogin,
      on,
    }),
    [login, parentLogin, register, logout, refresh, updateUser, setUser, clearError, gotoLogin, on],
  );

  const storeValue = useMemo<AuthStoreContextValue>(
    () => ({
      store: storeRef.current!,
      eventBus: eventBusRef.current!,
      offline,
    }),
    [offline],
  );

  return (
    <AuthStoreContext.Provider value={storeValue}>
      <AuthActionsContext.Provider value={actionsValue}>
        <AuthStateContext.Provider value={stateValue}>{children}</AuthStateContext.Provider>
      </AuthActionsContext.Provider>
    </AuthStoreContext.Provider>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * 12. HOOKS
 * ════════════════════════════════════════════════════════════════════════ */

function assertCtx<T>(ctx: T | null, hook: string): T {
  if (!ctx) throw new Error(`${hook} must be used within <AuthProvider>`);
  return ctx;
}

export function useAuthState(): AuthStateValue {
  return assertCtx(useContext(AuthStateContext), 'useAuthState');
}

export function useOptionalAuthState(): AuthStateValue | null {
  return useContext(AuthStateContext);
}

export function useAuthActions(): AuthActionsValue {
  return assertCtx(useContext(AuthActionsContext), 'useAuthActions');
}

export function useAuth(): AuthStateValue & AuthActionsValue {
  const s = useAuthState();
  const a = useAuthActions();
  return { ...s, ...a };
}

export function useCurrentUser(): User {
  const { user } = useAuthState();
  if (!user) throw new Error('useCurrentUser: user is not authenticated');
  return user;
}

/** Selector-based subscription — only re-renders when the slice changes. */
export function useAuthSelector<T>(
  selector: (state: AuthState) => T,
  isEqual: (a: T, b: T) => boolean = Object.is,
): T {
  const ctx = assertCtx(useContext(AuthStoreContext), 'useAuthSelector');
  const cacheRef = useRef<{ value: T; state: AuthState } | null>(null);

  const getSnapshot = useCallback((): T => {
    const state = ctx.store.getState();
    const prev = cacheRef.current;
    if (prev && prev.state === state) return prev.value;

    const next = selector(state);
    if (prev && isEqual(prev.value, next)) {
      cacheRef.current = { value: prev.value, state };
      return prev.value;
    }
    cacheRef.current = { value: next, state };
    return next;
  }, [ctx.store, selector, isEqual]);

  return useSyncExternalStore(ctx.store.subscribe, getSnapshot, getSnapshot);
}

/** Event subscription. */
export function useAuthEvent<K extends AuthEventName>(
  event: K,
  listener: AuthEventListener<K>,
  deps: readonly unknown[] = [],
): void {
  const ctx = useContext(AuthStoreContext);
  const listenerRef = useLatest(listener);
  useEffect(() => {
    if (!ctx) return;
    return ctx.eventBus.on(event, (payload) => listenerRef.current(payload));
  }, [ctx, event, ...deps]);
}

/** Online/offline status. */
export function useAuthOnlineStatus(): boolean {
  const ctx = useContext(AuthStoreContext);
  const online = useOnlineStatus();
  if (ctx) return !ctx.offline;
  return online;
}

/** Session expiry countdown in ms with auto-tick (or null). */
export function useSessionExpiry(tickIntervalMs = 15_000): number | null {
  const { user, verifiedAt } = useAuthState();
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!user && !verifiedAt) return;
    const timer = setInterval(() => setTick((t) => t + 1), tickIntervalMs);
    return () => clearInterval(timer);
  }, [user, verifiedAt, tickIntervalMs]);

  const expiresAt = (user as unknown as { expiresAt?: number | string } | null)?.expiresAt;
  if (expiresAt) {
    const ts = typeof expiresAt === 'string' ? Date.parse(expiresAt) : expiresAt;
    return Number.isFinite(ts) ? Math.max(0, ts - Date.now()) : null;
  }
  if (verifiedAt) return Math.max(0, verifiedAt + 60 * 60_000 - Date.now());
  return null;
}

/* ══════════════════════════════════════════════════════════════════════════
 * 13. AUTH GATE
 * ════════════════════════════════════════════════════════════════════════ */

interface AuthGateProps {
  children: ReactNode;
  loading?: ReactNode;
  fallback?: ReactNode;
  roles?: string[];
  forbidden?: ReactNode;
}

export function AuthGate({
  children,
  loading = null,
  fallback,
  roles,
  forbidden = null,
}: AuthGateProps) {
  const { status, hasAnyRole } = useAuthState();
  const { logout, gotoLogin } = useAuthActions();

  useEffect(() => {
    if (status === 'unauthenticated' && fallback === undefined) {
      logout({ redirect: true, reason: 'unauthenticated' }).catch(() => {
        gotoLogin();
      });
    }
  }, [status, fallback, logout, gotoLogin]);

  if (status === 'booting') return <>{loading}</>;
  if (status === 'unauthenticated') return <>{fallback ?? null}</>;
  if (roles?.length && !hasAnyRole(...roles)) return <>{forbidden}</>;
  return <>{children}</>;
}

export default AuthProvider;