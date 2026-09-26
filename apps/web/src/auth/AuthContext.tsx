import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import { authApi, userStore, setUnauthorizedHandler } from '@/lib/api';
import type { User } from '@/lib/types';

/* ────────────────────────────────────────────────────────────────────────── */
/*  Types                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

/** Session status — an explicit state machine, never guessed from presence. */
export type AuthStatus = 'booting' | 'authenticated' | 'unauthenticated';

/** Which auth action is currently in flight (UI spinner/disable). */
export type AuthPending = 'login' | 'register' | 'logout' | 'refresh' | null;

export type AuthErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NETWORK'
  | 'VALIDATION'
  | 'UNKNOWN';

export interface RegisterPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  organizationName: string;
}

export interface LoginOptions {
  /** Where to go after a successful auth (`?returnTo=` also works). */
  returnTo?: string;
}

/** Normalized, single shape for every auth error. */
export class AuthError extends Error {
  readonly code: AuthErrorCode;
  readonly status?: number;
  readonly cause?: unknown;

  constructor(code: AuthErrorCode, message: string, status?: number, cause?: unknown) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.status = status;
    this.cause = cause;
  }
}

interface AuthState {
  status: AuthStatus;
  user: User | null;
  pending: AuthPending;
  error: AuthError | null;
  /** Last time the session was verified with the server (ms). */
  verifiedAt: number | null;
}

type AuthEvent =
  | { type: 'BOOTED'; user: User | null }
  | { type: 'PENDING'; pending: AuthPending }
  | { type: 'SIGNED_IN'; user: User }
  | { type: 'VERIFIED'; user: User }
  | { type: 'USER_PATCHED'; user: User }
  | { type: 'FAILED'; error: AuthError }
  | { type: 'SIGNED_OUT' }
  | { type: 'ERROR_CLEARED' };

export interface AuthStateValue extends AuthState {
  /** @deprecated use `status === 'booting'` — kept for legacy callers. */
  loading: boolean;
  isAuthenticated: boolean;
  isBooting: boolean;
  roles: string[];
  hasRole: (role: string) => boolean;
  hasAnyRole: (...roles: string[]) => boolean;
}

export interface AuthActionsValue {
  login: (email: string, password: string, opts?: LoginOptions) => Promise<User>;
  parentLogin: (email: string, password: string, opts?: LoginOptions) => Promise<User>;
  register: (data: RegisterPayload, opts?: LoginOptions) => Promise<User>;
  logout: (opts?: { redirect?: boolean }) => Promise<void>;
  /** Re-verify the session with the server (deduped — N calls share one request). */
  refresh: () => Promise<User | null>;
  /** Optimistic local update: `updateUser({ firstName: 'Ali' })` or `updateUser(u => ({ ...u, ... }))`. */
  updateUser: (patch: Partial<User> | ((prev: User) => User)) => void;
  /** @deprecated use `updateUser`. */
  setUser: (u: User | null) => void;
  clearError: () => void;
}

export interface AuthProviderProps {
  children: ReactNode;
  /** Login route. Default: `/login` */
  loginPath?: string;
  /** Re-verify silently when the window regains focus after this staleness. Default: 5 minutes */
  staleTime?: number;
  /** Revalidate on tab focus / network recovery. Default: true */
  revalidateOnFocus?: boolean;
  /** Sync login/logout across tabs. Default: true */
  syncTabs?: boolean;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Internals                                                                */
/* ────────────────────────────────────────────────────────────────────────── */

const SYNC_CHANNEL = 'auth:sync';
const SYNC_STORAGE_KEY = '__auth_sync__';

type SyncMessage = { type: 'SIGNED_IN'; user: User } | { type: 'SIGNED_OUT' };

const initialState: AuthState = {
  status: 'booting',
  user: null,
  pending: null,
  error: null,
  verifiedAt: null,
};

function reducer(state: AuthState, event: AuthEvent): AuthState {
  switch (event.type) {
    case 'BOOTED':
      return {
        ...state,
        status: event.user ? 'authenticated' : 'unauthenticated',
        user: event.user,
        pending: null,
      };
    case 'PENDING':
      return { ...state, pending: event.pending, error: null };
    case 'SIGNED_IN':
      return {
        status: 'authenticated',
        user: event.user,
        pending: null,
        error: null,
        verifiedAt: Date.now(),
      };
    case 'VERIFIED':
      return { ...state, status: 'authenticated', user: event.user, pending: null, verifiedAt: Date.now() };
    case 'USER_PATCHED':
      return { ...state, user: event.user };
    case 'FAILED':
      return { ...state, pending: null, error: event.error };
    case 'SIGNED_OUT':
      return { ...initialState, status: 'unauthenticated' };
    case 'ERROR_CLEARED':
      return { ...state, error: null };
    default:
      return state;
  }
}

/** Har xil HTTP client'lardan keladigan xatolarni yagona AuthError'ga aylantiradi. */
function toAuthError(err: unknown, fallbackCode: AuthErrorCode = 'UNKNOWN'): AuthError {
  if (err instanceof AuthError) return err;

  const e = err as { status?: number; response?: { status?: number; data?: { message?: string } }; message?: string };
  const status = e?.status ?? e?.response?.status;
  const message = e?.response?.data?.message ?? e?.message ?? 'Unexpected error';

  if (status === 401) return new AuthError(fallbackCode === 'UNKNOWN' ? 'UNAUTHORIZED' : fallbackCode, message, status, err);
  if (status === 403) return new AuthError('FORBIDDEN', message, status, err);
  if (status === 400 || status === 422) return new AuthError('VALIDATION', message, status, err);
  if (!status && (typeof navigator === 'undefined' || !navigator.onLine || /network|fetch/i.test(message))) {
    return new AuthError('NETWORK', 'No internet connection', undefined, err);
  }
  return new AuthError(fallbackCode, message, status, err);
}

/** Works whether the user carries `role`, `roles`, or neither. */
function extractRoles(user: User | null): string[] {
  if (!user) return [];
  const u = user as unknown as { role?: unknown; roles?: unknown };
  if (Array.isArray(u.roles)) return u.roles.filter((r): r is string => typeof r === 'string');
  if (typeof u.role === 'string') return [u.role];
  return [];
}

function safeReturnTo(raw: string | null | undefined, loginPath: string): string | null {
  // Internal paths only — never allow open redirects.
  // Blocks: `//host`, `/\host` (browsers normalize `/\` → `//`), and absolute URLs.
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\') || raw.startsWith(loginPath)) {
    return null;
  }
  try {
    const u = new URL(raw, window.location.origin);
    if (u.origin !== window.location.origin) return null;
    return u.pathname + u.search + u.hash;
  } catch {
    return null;
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Contexts split (state / actions) — action consumers never re-render on user change */
/* ────────────────────────────────────────────────────────────────────────── */

const AuthStateContext = createContext<AuthStateValue | null>(null);
const AuthActionsContext = createContext<AuthActionsValue | null>(null);

/* ────────────────────────────────────────────────────────────────────────── */
/*  Provider                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

export function AuthProvider({
  children,
  loginPath = '/login',
  staleTime = 5 * 60_000,
  revalidateOnFocus = true,
  syncTabs = true,
}: AuthProviderProps) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const stateRef = useRef(state);
  stateRef.current = state;

  const inflightRef = useRef<Promise<User | null> | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);

  /* ── Persist helpers ─────────────────────────────────────────────────── */

  const persist = useCallback((user: User, _token?: string) => {
    // JWT transport is HttpOnly cookie — token never stored in JS.
    userStore.set(user);
  }, []);

  const wipe = useCallback(() => {
    userStore.clear();
  }, []);

  /* ── Cross-tab sync ──────────────────────────────────────────────────── */

  const broadcast = useCallback(
    (msg: SyncMessage) => {
      if (!syncTabs) return;
      try {
        if (channelRef.current) {
          channelRef.current.postMessage(msg);
        } else {
          // Fallback for browsers without BroadcastChannel: `storage` event
          localStorage.setItem(SYNC_STORAGE_KEY, JSON.stringify({ ...msg, t: Date.now() }));
          localStorage.removeItem(SYNC_STORAGE_KEY);
        }
      } catch {
        /* private mode etc. — swallow silently */
      }
    },
    [syncTabs],
  );

  /* ── Navigation ──────────────────────────────────────────────────────── */

  const redirectToLogin = useCallback(() => {
    if (typeof window === 'undefined') return;
    const { pathname, search } = window.location;
    if (pathname.startsWith(loginPath)) return; // avoid redirect loop
    const returnTo = encodeURIComponent(pathname + search);
    window.location.assign(`${loginPath}?returnTo=${returnTo}`);
  }, [loginPath]);

  const navigateAfterAuth = useCallback(
    (opts?: LoginOptions) => {
      if (typeof window === 'undefined') return;
      const fromQuery = new URLSearchParams(window.location.search).get('returnTo');
      const target = safeReturnTo(opts?.returnTo ?? fromQuery, loginPath);
      if (target) window.location.assign(target);
    },
    [loginPath],
  );

  /* ── Core session ops ────────────────────────────────────────────────── */

  const signOutLocally = useCallback(() => {
    wipe();
    dispatch({ type: 'SIGNED_OUT' });
  }, [wipe]);

  /**
   * Verify the session with the server.
   * - Concurrent calls are coalesced into a single request.
   * - 401/403 → session cleared.
   * - Network error → keep the cached user (offline-first).
   */
  const verify = useCallback((): Promise<User | null> => {
    if (inflightRef.current) return inflightRef.current;
    // No localStorage token check — cookie-only auth.
    const p = (async () => {
      try {
        const me = (await authApi.me()) as User;
        persist(me);
        dispatch({ type: 'VERIFIED', user: me });
        return me;
      } catch (err) {
        const e = toAuthError(err);
        if (e.code === 'UNAUTHORIZED' || e.code === 'FORBIDDEN') {
          signOutLocally();
          broadcast({ type: 'SIGNED_OUT' });
          return null;
        }
        // Offline / server down — keep the cached user
        return stateRef.current.user;
      } finally {
        inflightRef.current = null;
      }
    })();

    inflightRef.current = p;
    return p;
  }, [persist, signOutLocally, broadcast]);

  /* ── Boot: paint from cache immediately, verify in the background ───── */

  useEffect(() => {
    let alive = true;
    // Cookie-only auth: verify session with server regardless of localStorage.
    const cached = userStore.get<User>();
    if (cached) dispatch({ type: 'BOOTED', user: cached });

    verify().then((u) => {
      if (!alive) return;
      if (!cached) dispatch({ type: 'BOOTED', user: u });
    });

    return () => {
      alive = false;
    };
      }, []);

  /* ── 401 interceptor ─────────────────────────────────────────────────── */

  useEffect(() => {
    setUnauthorizedHandler(() => {
      signOutLocally();
      broadcast({ type: 'SIGNED_OUT' });
      redirectToLogin();
    });
  }, [signOutLocally, broadcast, redirectToLogin]);

  /* ── Tab sync listeners ──────────────────────────────────────────────── */

  useEffect(() => {
    if (!syncTabs || typeof window === 'undefined') return;

    const handle = (msg: SyncMessage) => {
      if (msg.type === 'SIGNED_OUT') {
        if (stateRef.current.status !== 'unauthenticated') {
          signOutLocally();
          redirectToLogin();
        }
      } else if (msg.type === 'SIGNED_IN') {
        userStore.set(msg.user);
        dispatch({ type: 'SIGNED_IN', user: msg.user });
      }
    };

    let onStorage: ((e: StorageEvent) => void) | null = null;

    if (typeof BroadcastChannel !== 'undefined') {
      const ch = new BroadcastChannel(SYNC_CHANNEL);
      ch.onmessage = (e: MessageEvent<SyncMessage>) => handle(e.data);
      channelRef.current = ch;
    } else {
      onStorage = (e) => {
        if (e.key !== SYNC_STORAGE_KEY || !e.newValue) return;
        try {
          handle(JSON.parse(e.newValue) as SyncMessage);
        } catch {
          /* noop */
        }
      };
      window.addEventListener('storage', onStorage);
    }

    return () => {
      channelRef.current?.close();
      channelRef.current = null;
      if (onStorage) window.removeEventListener('storage', onStorage);
    };
  }, [syncTabs, signOutLocally, redirectToLogin]);

  /* ── Stale-while-revalidate: focus / online ──────────────────────────── */

  useEffect(() => {
    if (!revalidateOnFocus || typeof window === 'undefined') return;

    const maybeRevalidate = () => {
      const s = stateRef.current;
      if (s.status !== 'authenticated') return;
      if (document.visibilityState === 'hidden') return;
      if (s.verifiedAt && Date.now() - s.verifiedAt < staleTime) return;
      void verify();
    };

    window.addEventListener('focus', maybeRevalidate);
    window.addEventListener('online', maybeRevalidate);
    document.addEventListener('visibilitychange', maybeRevalidate);
    return () => {
      window.removeEventListener('focus', maybeRevalidate);
      window.removeEventListener('online', maybeRevalidate);
      document.removeEventListener('visibilitychange', maybeRevalidate);
    };
  }, [revalidateOnFocus, staleTime, verify]);

  /* ── Public actions ──────────────────────────────────────────────────── */

  const login = useCallback<AuthActionsValue['login']>(
    async (email, password, opts) => {
      dispatch({ type: 'PENDING', pending: 'login' });
      try {
        const res = await authApi.login(email.trim(), password);
        const user = res.user as User;
        persist(user); // cookie handles token; user only for UI
        dispatch({ type: 'SIGNED_IN', user });
        broadcast({ type: 'SIGNED_IN', user });
        navigateAfterAuth(opts);
        return user;
      } catch (err) {
        const e = toAuthError(err, 'INVALID_CREDENTIALS');
        dispatch({ type: 'FAILED', error: e });
        throw e;
      }
    },
    [persist, broadcast, navigateAfterAuth],
  );

  const parentLogin = useCallback<AuthActionsValue['parentLogin']>(
    async (email, password, opts) => {
      dispatch({ type: 'PENDING', pending: 'login' });
      try {
        const res = await authApi.parentLogin(email.trim(), password);
        const user = res.user as User;
        persist(user);
        dispatch({ type: 'SIGNED_IN', user });
        broadcast({ type: 'SIGNED_IN', user });
        navigateAfterAuth(opts?.returnTo ? opts : { returnTo: '/parent-portal' });
        return user;
      } catch (err) {
        const e = toAuthError(err, 'INVALID_CREDENTIALS');
        dispatch({ type: 'FAILED', error: e });
        throw e;
      }
    },
    [persist, broadcast, navigateAfterAuth],
  );

  const register = useCallback<AuthActionsValue['register']>(
    async (data, opts) => {
      dispatch({ type: 'PENDING', pending: 'register' });
      try {
        const res = await authApi.register({ ...data, email: data.email.trim() });
        const user = res.user as User;
        persist(user);
        dispatch({ type: 'SIGNED_IN', user });
        broadcast({ type: 'SIGNED_IN', user });
        navigateAfterAuth(opts);
        return user;
      } catch (err) {
        const e = toAuthError(err, 'VALIDATION');
        dispatch({ type: 'FAILED', error: e });
        throw e;
      }
    },
    [persist, broadcast, navigateAfterAuth],
  );

  const logout = useCallback<AuthActionsValue['logout']>(
    async ({ redirect = true } = {}) => {
      dispatch({ type: 'PENDING', pending: 'logout' });
      try {
        await authApi.logout();
      } catch {
        /* even if the server does not answer, the local session is always cleared */
      } finally {
        signOutLocally();
        broadcast({ type: 'SIGNED_OUT' });
        if (redirect) redirectToLogin();
      }
    },
    [signOutLocally, broadcast, redirectToLogin],
  );

  const refresh = useCallback<AuthActionsValue['refresh']>(async () => {
    dispatch({ type: 'PENDING', pending: 'refresh' });
    const u = await verify();
    if (stateRef.current.pending === 'refresh') dispatch({ type: 'PENDING', pending: null });
    return u;
  }, [verify]);

  const updateUser = useCallback<AuthActionsValue['updateUser']>(
    (patch) => {
      const prev = stateRef.current.user;
      if (!prev) return;
      const next = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch };
      userStore.set(next);
      dispatch({ type: 'USER_PATCHED', user: next });
      broadcast({ type: 'SIGNED_IN', user: next });
    },
    [broadcast],
  );

  const setUser = useCallback<AuthActionsValue['setUser']>(
    (u) => {
      if (u) {
        userStore.set(u);
        // OAuth callback sets the user while status is still 'booting' —
        // USER_PATCHED alone would leave status unauthenticated and let a
        // concurrent /auth/me 401 wipe the fresh session. Transition to
        // SIGNED_IN whenever we are not already authenticated.
        if (stateRef.current.status === 'authenticated') {
          dispatch({ type: 'USER_PATCHED', user: u });
        } else {
          dispatch({ type: 'SIGNED_IN', user: u });
          broadcast({ type: 'SIGNED_IN', user: u });
        }
      } else {
        signOutLocally();
      }
    },
    [signOutLocally, broadcast],
  );

  const clearError = useCallback(() => dispatch({ type: 'ERROR_CLEARED' }), []);

  /* ── Memoized context values ─────────────────────────────────────────── */

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
    }),
    [state, roles],
  );

  const actionsValue = useMemo<AuthActionsValue>(
    () => ({ login, parentLogin, register, logout, refresh, updateUser, setUser, clearError }),
    [login, parentLogin, register, logout, refresh, updateUser, setUser, clearError],
  );

  return (
    <AuthActionsContext.Provider value={actionsValue}>
      <AuthStateContext.Provider value={stateValue}>{children}</AuthStateContext.Provider>
    </AuthActionsContext.Provider>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Hooks                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

function assertCtx<T>(ctx: T | null, hook: string): T {
  if (!ctx) throw new Error(`${hook} must be used within <AuthProvider>`);
  return ctx;
}

/** State only — for components that do not call login/logout (fewer re-renders). */
export function useAuthState(): AuthStateValue {
  return assertCtx(useContext(AuthStateContext), 'useAuthState');
}

/** Actions only — never re-renders when the user object changes. */
export function useAuthActions(): AuthActionsValue {
  return assertCtx(useContext(AuthActionsContext), 'useAuthActions');
}

/** 100% compatible with the legacy API: `const { user, loading, login, logout } = useAuth()` */
export function useAuth(): AuthStateValue & AuthActionsValue {
  const s = useAuthState();
  const a = useAuthActions();
  return useMemo(() => ({ ...s, ...a }), [s, a]);
}

/** On protected pages: guarantees a user is present (throws otherwise). */
export function useCurrentUser(): User {
  const { user } = useAuthState();
  if (!user) throw new Error('useCurrentUser: user is not authenticated');
  return user;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Declarative gate                                                         */
/* ────────────────────────────────────────────────────────────────────────── */

interface AuthGateProps {
  children: ReactNode;
  /** Rendered while booting (skeleton/splash). */
  loading?: ReactNode;
  /** For unauthenticated users. Falls back to redirecting to the login page. */
  fallback?: ReactNode;
  /** At least one of the required roles. */
  roles?: string[];
  /** Rendered when the role check fails. */
  forbidden?: ReactNode;
}

/**
 * <AuthGate roles={['admin']} loading={<Splash/>} forbidden={<NoAccess/>}>
 *   <AdminPanel/>
 * </AuthGate>
 */
export function AuthGate({ children, loading = null, fallback, roles, forbidden = null }: AuthGateProps) {
  const { status, hasAnyRole } = useAuthState();
  const { logout } = useAuthActions();

  useEffect(() => {
    if (status === 'unauthenticated' && fallback === undefined) {
      void logout({ redirect: true }); // clear locally and go to login with ?returnTo
    }
  }, [status, fallback, logout]);

  if (status === 'booting') return <>{loading}</>;
  if (status === 'unauthenticated') return <>{fallback ?? null}</>;
  if (roles?.length && !hasAnyRole(...roles)) return <>{forbidden}</>;
  return <>{children}</>;
}
