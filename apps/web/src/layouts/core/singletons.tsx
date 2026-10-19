/**
 * M-EDU Layout Singletons & Utilities
 *
 *  · SSR-safe singleton stores built on `useSyncExternalStore` (no leaks)
 *  · Deduplicated MediaQuery registry — one listener per query app-wide
 *  · Reference-counted scroll lock (safe for nested modals & drawers)
 *  · Cross-tab and same-tab synchronized persisted state
 *  · Reactive network / battery / hardware device profiling
 *  · Cursor spotlight, haptics, focus trap, roving keyboard nav, hotkeys
 *
 * Every exported name, hook and signature is preserved — other modules and
 * tests import them unchanged. Helpers may delegate to shared utilities, but
 * the public surface never moves.
 */
import {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  createContext,
  useContext,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  useMotionValue,
  useSpring,
  type MotionValue,
} from 'framer-motion';

const IS_BROWSER = typeof window !== 'undefined' && typeof document !== 'undefined';

type Listener = () => void;

/* ══════════════════════════════════════════════════════════════
 * 1 · SINGLETON STORES
 * ══════════════════════════════════════════════════════════════ */

/* ── 1.1 Clock — re-syncs on wake / visibility change ── */
const nowSubscribers = new Set<Listener>();
let nowTimestamp = Date.now();
let nowDate = new Date(nowTimestamp);
let nowIntervalId: ReturnType<typeof setInterval> | null = null;
let nowTimeoutId: ReturnType<typeof setTimeout> | null = null;
let nowVisibilityHandler: Listener | null = null;

function syncNow() {
  const current = Date.now();
  // Only publish a new Date (and re-render) once the second actually changed.
  if (Math.abs(current - nowTimestamp) < 1000) return;
  nowTimestamp = current;
  nowDate = new Date(current);
  for (const cb of nowSubscribers) cb();
}

function startClock() {
  if (!IS_BROWSER || nowIntervalId || nowTimeoutId) return;
  syncNow();
  nowVisibilityHandler = () => {
    if (!document.hidden) syncNow();
  };
  document.addEventListener('visibilitychange', nowVisibilityHandler);
  nowTimeoutId = setTimeout(
    () => {
      nowTimeoutId = null;
      syncNow();
      nowIntervalId = setInterval(syncNow, 30_000);
    },
    60_000 - (Date.now() % 60_000),
  );
}

function stopClock() {
  if (nowTimeoutId) {
    clearTimeout(nowTimeoutId);
    nowTimeoutId = null;
  }
  if (nowIntervalId) {
    clearInterval(nowIntervalId);
    nowIntervalId = null;
  }
  if (IS_BROWSER && nowVisibilityHandler) {
    document.removeEventListener('visibilitychange', nowVisibilityHandler);
    nowVisibilityHandler = null;
  }
}

function subscribeNow(cb: Listener): () => void {
  nowSubscribers.add(cb);
  if (nowSubscribers.size === 1) startClock();
  return () => {
    nowSubscribers.delete(cb);
    if (nowSubscribers.size === 0) stopClock();
  };
}

export function useNow(): Date {
  return useSyncExternalStore(subscribeNow, () => nowDate, () => nowDate);
}

/* ── 1.2 Online status ── */
function subscribeOnline(cb: Listener): () => void {
  if (!IS_BROWSER) return () => {};
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => (typeof navigator === 'undefined' ? true : navigator.onLine),
    () => true,
  );
}

/* ── 1.3 Deduplicated media-query registry (one listener per query) ── */
interface MediaEntry {
  mql: MediaQueryList;
  listeners: Set<Listener>;
  handler: Listener;
}

const mediaRegistry = new Map<string, MediaEntry>();

function getMediaEntry(query: string): MediaEntry | null {
  if (!IS_BROWSER || typeof window.matchMedia !== 'function') return null;
  let entry = mediaRegistry.get(query);
  if (!entry) {
    const mql = window.matchMedia(query);
    const listeners = new Set<Listener>();
    const handler: Listener = () => {
      for (const l of listeners) l();
    };
    entry = { mql, listeners, handler };
    mediaRegistry.set(query, entry);
  }
  return entry;
}

function subscribeMedia(query: string) {
  return (cb: Listener): (() => void) => {
    const entry = getMediaEntry(query);
    if (!entry) return () => {};

    if (entry.listeners.size === 0) {
      if (typeof entry.mql.addEventListener === 'function') {
        entry.mql.addEventListener('change', entry.handler);
      } else {
        entry.mql.addListener(entry.handler); // legacy Safari / WebView
      }
    }
    entry.listeners.add(cb);

    return () => {
      entry.listeners.delete(cb);
      if (entry.listeners.size === 0) {
        if (typeof entry.mql.removeEventListener === 'function') {
          entry.mql.removeEventListener('change', entry.handler);
        } else {
          entry.mql.removeListener(entry.handler);
        }
        mediaRegistry.delete(query);
      }
    };
  };
}

export function useMediaQuery(query: string, ssrFallback = false): boolean {
  const subscribe = useMemo(() => subscribeMedia(query), [query]);
  const getSnapshot = useCallback(() => {
    const entry = getMediaEntry(query);
    return entry ? entry.mql.matches : ssrFallback;
  }, [query, ssrFallback]);
  const getServerSnapshot = useCallback(() => ssrFallback, [ssrFallback]);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

export function usePrefersHighContrast(): boolean {
  return useMediaQuery('(prefers-contrast: more)');
}

/* ── 1.4 Page visibility ── */
function subscribeVisibility(cb: Listener): () => void {
  if (!IS_BROWSER) return () => {};
  document.addEventListener('visibilitychange', cb);
  return () => document.removeEventListener('visibilitychange', cb);
}

export function usePageVisible(): boolean {
  return useSyncExternalStore(
    subscribeVisibility,
    () => (!IS_BROWSER ? true : document.visibilityState !== 'hidden'),
    () => true,
  );
}

/* ── 1.5 Visual viewport & keyboard metrics (mobile / Telegram WebApp) ── */
export interface ViewportMetrics {
  width: number;
  height: number;
  keyboardOpen: boolean;
  keyboardHeight: number;
}

const DEFAULT_VIEWPORT: ViewportMetrics = {
  width: 1024,
  height: 768,
  keyboardOpen: false,
  keyboardHeight: 0,
};

let cachedViewport: ViewportMetrics = DEFAULT_VIEWPORT;
const viewportListeners = new Set<Listener>();

function updateViewportSnapshot() {
  if (!IS_BROWSER) return;
  const vv = window.visualViewport;
  const width = Math.round(vv ? vv.width : window.innerWidth);
  const height = Math.round(vv ? vv.height : window.innerHeight);
  const keyboardHeight = Math.max(0, Math.round(window.innerHeight - height));
  const keyboardOpen = keyboardHeight > 140;
  const next: ViewportMetrics = {
    width,
    height,
    keyboardOpen,
    keyboardHeight: keyboardOpen ? keyboardHeight : 0,
  };
  if (
    cachedViewport.width === next.width &&
    cachedViewport.height === next.height &&
    cachedViewport.keyboardOpen === next.keyboardOpen &&
    cachedViewport.keyboardHeight === next.keyboardHeight
  ) {
    return;
  }
  cachedViewport = next;
  for (const cb of viewportListeners) cb();
}

function subscribeViewport(cb: Listener): () => void {
  if (!IS_BROWSER) return () => {};
  if (viewportListeners.size === 0) {
    updateViewportSnapshot();
    window.addEventListener('resize', updateViewportSnapshot, { passive: true });
    window.visualViewport?.addEventListener('resize', updateViewportSnapshot);
  }
  viewportListeners.add(cb);
  return () => {
    viewportListeners.delete(cb);
    if (viewportListeners.size === 0) {
      window.removeEventListener('resize', updateViewportSnapshot);
      window.visualViewport?.removeEventListener('resize', updateViewportSnapshot);
    }
  };
}

export function useViewportMetrics(): ViewportMetrics {
  return useSyncExternalStore(
    subscribeViewport,
    () => cachedViewport,
    () => DEFAULT_VIEWPORT,
  );
}

/* ══════════════════════════════════════════════════════════════
 * 2 · DEVICE PROFILE & SURFACE QUALITY TIER
 * ══════════════════════════════════════════════════════════════ */

export type GlassQualityTier = 'ultra' | 'balanced' | 'minimal';

export interface DeviceProfile {
  reduced: boolean;
  highContrast: boolean;
  isLowEnd: boolean;
  batterySaver: boolean;
  saveData: boolean;
  slowNetwork: boolean;
  allowAmbient: boolean;
  allowCursorFx: boolean;
  hoverCapable: boolean;
  isMobile: boolean;
  isTablet: boolean;
  lowPowerMode: boolean;
  glassTier: GlassQualityTier;
}

const DEFAULT_DEVICE_PROFILE: DeviceProfile = {
  reduced: false,
  highContrast: false,
  isLowEnd: false,
  batterySaver: false,
  saveData: false,
  slowNetwork: false,
  allowAmbient: true,
  allowCursorFx: true,
  hoverCapable: true,
  isMobile: false,
  isTablet: false,
  lowPowerMode: false,
  glassTier: 'ultra',
};

const DeviceProfileContext = createContext<DeviceProfile | null>(null);

interface NetworkInformation extends EventTarget {
  saveData?: boolean;
  effectiveType?: 'slow-2g' | '2g' | '3g' | '4g';
}

function readNetworkState(): { saveData: boolean; slowNetwork: boolean } {
  if (typeof navigator === 'undefined') return { saveData: false, slowNetwork: false };
  const conn = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  return {
    saveData: Boolean(conn?.saveData),
    slowNetwork: conn?.effectiveType === 'slow-2g' || conn?.effectiveType === '2g',
  };
}

function useDeviceProfileValue(): DeviceProfile {
  const reduced = usePrefersReducedMotion();
  const highContrast = usePrefersHighContrast();
  const isMobile = useMediaQuery('(max-width: 640px)');
  const isTablet = useMediaQuery('(min-width: 641px) and (max-width: 1024px)');
  const hoverCapable = useMediaQuery('(hover: hover) and (pointer: fine)');

  const isLowEnd = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    const cores = navigator.hardwareConcurrency ?? 8;
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
    return cores <= 4 || memory <= 4;
  }, []);

  const [netState, setNetState] = useState(readNetworkState);

  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    const conn = (navigator as Navigator & { connection?: NetworkInformation }).connection;
    if (!conn || typeof conn.addEventListener !== 'function') return;
    const onChange = () => setNetState(readNetworkState());
    conn.addEventListener('change', onChange);
    return () => conn.removeEventListener('change', onChange);
  }, []);

  const [batterySaver, setBatterySaver] = useState(false);

  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    type BatteryManager = {
      charging: boolean;
      level: number;
      addEventListener: (t: string, cb: () => void) => void;
      removeEventListener: (t: string, cb: () => void) => void;
    };
    const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryManager> };
    if (typeof nav.getBattery !== 'function') return;

    let cancelled = false;
    let battery: BatteryManager | null = null;
    const evaluate = () => {
      if (!battery || cancelled) return;
      setBatterySaver(!battery.charging && battery.level <= 0.2);
    };

    nav
      .getBattery()
      .then((b) => {
        if (cancelled) return;
        battery = b;
        evaluate();
        b.addEventListener('levelchange', evaluate);
        b.addEventListener('chargingchange', evaluate);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (battery) {
        battery.removeEventListener('levelchange', evaluate);
        battery.removeEventListener('chargingchange', evaluate);
      }
    };
  }, []);

  return useMemo<DeviceProfile>(() => {
    const { saveData, slowNetwork } = netState;
    const lowPowerMode = batterySaver || isLowEnd || saveData || slowNetwork;
    const glassTier: GlassQualityTier =
      reduced || highContrast || batterySaver
        ? 'minimal'
        : isLowEnd || isMobile
          ? 'balanced'
          : 'ultra';

    return {
      reduced,
      highContrast,
      isLowEnd,
      batterySaver,
      saveData,
      slowNetwork,
      allowAmbient: !reduced && !lowPowerMode,
      allowCursorFx: !reduced && !lowPowerMode && hoverCapable,
      hoverCapable,
      isMobile,
      isTablet,
      lowPowerMode,
      glassTier,
    };
  }, [reduced, highContrast, isLowEnd, batterySaver, netState, hoverCapable, isMobile, isTablet]);
}

export function DeviceProfileProvider({ children }: { children: ReactNode }) {
  const profile = useDeviceProfileValue();

  // Expose the tier on <html> so CSS can adapt without extra selectors.
  useEffect(() => {
    if (!IS_BROWSER) return;
    document.documentElement.dataset.glassTier = profile.glassTier;
  }, [profile.glassTier]);

  return <DeviceProfileContext.Provider value={profile}>{children}</DeviceProfileContext.Provider>;
}

/** Never throws when rendered outside the provider — returns safe defaults. */
export function useDeviceProfile(): DeviceProfile {
  return useContext(DeviceProfileContext) ?? DEFAULT_DEVICE_PROFILE;
}

/* ══════════════════════════════════════════════════════════════
 * 3 · MOTION, SPOTLIGHT & HAPTICS
 * ══════════════════════════════════════════════════════════════ */

/* ── 3.1 Global cursor (spring-following motion values) ── */
export function useGlobalCursor(enabled: boolean): {
  x: MotionValue<number>;
  y: MotionValue<number>;
} {
  const mx = useMotionValue(-1000);
  const my = useMotionValue(-1000);
  const sx = useSpring(mx, { stiffness: 320, damping: 28, mass: 0.45 });
  const sy = useSpring(my, { stiffness: 320, damping: 28, mass: 0.45 });
  const visible = usePageVisible();

  useEffect(() => {
    if (!IS_BROWSER || !enabled || !visible) return;
    const onMove = (e: PointerEvent) => {
      mx.set(e.clientX);
      my.set(e.clientY);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [mx, my, enabled, visible]);

  return { x: sx, y: sy };
}

/* ── 3.2 Specular spotlight — writes CSS vars, zero re-renders ── */
export function useLiquidSpotlight<T extends HTMLElement = HTMLElement>(
  ref: RefObject<T | null>,
  enabled = true,
) {
  const { allowCursorFx } = useDeviceProfile();

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled || !allowCursorFx) return;

    let rafId = 0;
    const onPointerMove = (e: PointerEvent) => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        el.style.setProperty('--spot-x', `${Math.round(e.clientX - rect.left)}px`);
        el.style.setProperty('--spot-y', `${Math.round(e.clientY - rect.top)}px`);
        el.style.setProperty('--spot-opacity', '1');
      });
    };
    const onPointerLeave = () => {
      if (rafId) cancelAnimationFrame(rafId);
      el.style.setProperty('--spot-opacity', '0');
    };

    el.addEventListener('pointermove', onPointerMove, { passive: true });
    el.addEventListener('pointerleave', onPointerLeave, { passive: true });
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerleave', onPointerLeave);
    };
  }, [ref, enabled, allowCursorFx]);
}

/* ── 3.3 Cross-platform haptics (Telegram WebApp → Vibration API) ── */
export type HapticPattern = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

const VIBRATIONS: Record<HapticPattern, number | number[]> = {
  light: 8,
  medium: 15,
  heavy: 25,
  success: [10, 30, 15],
  warning: [15, 40, 15],
  error: [25, 40, 25, 40, 25],
};

export function useHaptics() {
  const reduced = usePrefersReducedMotion();

  return useCallback(
    (pattern: HapticPattern = 'light') => {
      if (!IS_BROWSER || reduced) return;

      const tgHaptic = (
        window as unknown as {
          Telegram?: {
            WebApp?: {
              HapticFeedback?: {
                impactOccurred?: (s: 'light' | 'medium' | 'heavy') => void;
                notificationOccurred?: (t: 'success' | 'warning' | 'error') => void;
              };
            };
          };
        }
      ).Telegram?.WebApp?.HapticFeedback;

      if (tgHaptic) {
        try {
          if (pattern === 'success' || pattern === 'warning' || pattern === 'error') {
            tgHaptic.notificationOccurred?.(pattern);
          } else {
            tgHaptic.impactOccurred?.(pattern);
          }
          return;
        } catch {
          // fall through to the Vibration API
        }
      }

      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        try {
          navigator.vibrate(VIBRATIONS[pattern]);
        } catch {
          // Ignore vibration permission errors
        }
      }
    },
    [reduced],
  );
}

/* ══════════════════════════════════════════════════════════════
 * 4 · ACCESSIBILITY, SCROLL LOCK & KEYBOARD MANAGEMENT
 * ══════════════════════════════════════════════════════════════ */

/* ── 4.1 Reference-counted scroll lock (safe for nested modals) ── */
let scrollLockCount = 0;
let savedBodyOverflow = '';
let savedBodyPaddingRight = '';

export function acquireScrollLock(): () => void {
  if (!IS_BROWSER) return () => {};

  if (scrollLockCount === 0) {
    savedBodyOverflow = document.body.style.overflow;
    savedBodyPaddingRight = document.body.style.paddingRight;
    const scrollbarW = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbarW > 0) {
      const currentPad =
        parseInt(window.getComputedStyle(document.body).paddingRight, 10) || 0;
      document.body.style.paddingRight = `${currentPad + scrollbarW}px`;
    }
  }
  scrollLockCount += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    scrollLockCount = Math.max(0, scrollLockCount - 1);
    if (scrollLockCount === 0) {
      document.body.style.overflow = savedBodyOverflow;
      document.body.style.paddingRight = savedBodyPaddingRight;
    }
  };
}

/** True when the element is actually painted (`offsetParent` lies for fixed). */
function isElementVisible(el: HTMLElement): boolean {
  if (el.hidden || el.getAttribute('aria-hidden') === 'true') return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  return el.getClientRects().length > 0;
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/* ── 4.2 Focus trap (scroll lock + Escape + focus restore) ── */
export interface FocusTrapOptions {
  initialFocus?: RefObject<HTMLElement | null>;
  lockScroll?: boolean;
  onEscape?: () => void;
}

export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  optionsOrInitialFocus?: RefObject<HTMLElement | null> | FocusTrapOptions,
) {
  // Keeps the legacy 3-argument API (`initialFocus` passed directly) working.
  const opts: FocusTrapOptions =
    optionsOrInitialFocus && 'current' in optionsOrInitialFocus
      ? { initialFocus: optionsOrInitialFocus, lockScroll: true }
      : { lockScroll: true, ...(optionsOrInitialFocus as FocusTrapOptions | undefined) };

  const onEscapeRef = useRef(opts.onEscape);
  onEscapeRef.current = opts.onEscape;

  useEffect(() => {
    if (!IS_BROWSER || !active) return;
    const root = ref.current;
    if (!root) return;

    const releaseScroll = opts.lockScroll !== false ? acquireScrollLock() : () => {};
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const getFocusable = () =>
      Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => isElementVisible(el) || el === document.activeElement,
      );

    const rafId = requestAnimationFrame(() => {
      const target = opts.initialFocus?.current ?? getFocusable()[0] ?? root;
      target?.focus?.({ preventScroll: true });
    });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onEscapeRef.current) {
        e.stopPropagation();
        onEscapeRef.current();
        return;
      }
      if (e.key !== 'Tab') return;

      const list = getFocusable();
      if (list.length === 0) {
        e.preventDefault();
        return;
      }

      const first = list[0];
      const last = list[list.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (activeEl === first || !root.contains(activeEl)) {
          e.preventDefault();
          last.focus();
        }
      } else if (activeEl === last || !root.contains(activeEl)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener('keydown', onKeyDown);
      releaseScroll();
      if (previouslyFocused && document.contains(previouslyFocused)) {
        try {
          previouslyFocused.focus({ preventScroll: true });
        } catch {
          // Ignore focus restore errors
        }
      }
    };
  }, [active, ref, opts.initialFocus, opts.lockScroll]);
}

/* ── 4.3 Roving keyboard navigation (2D / 1D) ── */
export function useKeyboardNav(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
  orientation: 'vertical' | 'horizontal' | 'both' = 'both',
) {
  useEffect(() => {
    if (!IS_BROWSER || !active) return;
    const root = containerRef.current;
    if (!root) return;

    const nextKeys =
      orientation === 'horizontal'
        ? ['ArrowRight']
        : orientation === 'vertical'
          ? ['ArrowDown']
          : ['ArrowDown', 'ArrowRight'];
    const prevKeys =
      orientation === 'horizontal'
        ? ['ArrowLeft']
        : orientation === 'vertical'
          ? ['ArrowUp']
          : ['ArrowUp', 'ArrowLeft'];

    const onKey = (e: KeyboardEvent) => {
      const isNext = nextKeys.includes(e.key);
      const isPrev = prevKeys.includes(e.key);
      const isHome = e.key === 'Home';
      const isEnd = e.key === 'End';
      if (!isNext && !isPrev && !isHome && !isEnd) return;

      const target = e.target as HTMLElement | null;
      if (!target || !root.contains(target)) return;

      const items = Array.from(
        root.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [role="tab"]:not([disabled]), [role="menuitem"]:not([disabled])',
        ),
      ).filter(isElementVisible);
      if (items.length === 0) return;

      const i = items.indexOf(target);
      if (i === -1) return;

      e.preventDefault();
      const nextIdx = isNext
        ? (i + 1) % items.length
        : isPrev
          ? (i - 1 + items.length) % items.length
          : isHome
            ? 0
            : items.length - 1;
      items[nextIdx]?.focus();
    };

    root.addEventListener('keydown', onKey);
    return () => root.removeEventListener('keydown', onKey);
  }, [containerRef, active, orientation]);
}

/* ── 4.4 Global hotkeys ── */
export interface HotkeyBinding {
  /** e.g. 'k', 'Escape', '/' */
  key: string;
  /** Require Ctrl (Windows) or Cmd (Mac) */
  mod?: boolean;
  shift?: boolean;
  alt?: boolean;
  /** Skip while typing in inputs (default true) */
  ignoreInputs?: boolean;
  handler: (e: KeyboardEvent) => void;
}

export function useHotkeys(bindings: HotkeyBinding[], enabled = true) {
  const bindingsRef = useRef(bindings);
  bindingsRef.current = bindings;

  useEffect(() => {
    if (!IS_BROWSER || !enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable;

      for (const b of bindingsRef.current) {
        if ((b.ignoreInputs ?? true) && isInput) continue;
        if (e.key.toLowerCase() !== b.key.toLowerCase()) continue;
        if (Boolean(b.mod) !== (e.metaKey || e.ctrlKey)) continue;
        if (b.shift !== undefined && b.shift !== e.shiftKey) continue;
        if (b.alt !== undefined && b.alt !== e.altKey) continue;

        e.preventDefault();
        b.handler(e);
        break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}

/* ══════════════════════════════════════════════════════════════
 * 5 · CROSS-TAB & SAME-TAB SYNCHRONIZED PERSISTED STATE
 * ══════════════════════════════════════════════════════════════ */

export type SetState<T> = (next: T | ((prev: T) => T)) => void;

const STORAGE_SYNC_EVENT = 'medu:local-storage-sync';

function readStorage<T>(key: string, initial: T): T {
  if (!IS_BROWSER) return initial;
  try {
    const raw = window.localStorage.getItem(key);
    return raw !== null ? (JSON.parse(raw) as T) : initial;
  } catch {
    return initial;
  }
}

export function usePersistedState<T>(key: string, initial: T): [T, SetState<T>] {
  const initialRef = useRef(initial);
  initialRef.current = initial;

  const [value, setValue] = useState<T>(() => readStorage(key, initial));
  const prevKeyRef = useRef(key);

  // Re-read (without clobbering) when the storage key itself changes.
  useEffect(() => {
    if (prevKeyRef.current !== key) {
      prevKeyRef.current = key;
      setValue(readStorage(key, initialRef.current));
    }
  }, [key]);

  const setPersistedValue: SetState<T> = useCallback(
    (next) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
        if (IS_BROWSER) {
          try {
            const serialized = JSON.stringify(resolved);
            window.localStorage.setItem(key, serialized);
            window.dispatchEvent(
              new CustomEvent(STORAGE_SYNC_EVENT, { detail: { key, newValue: serialized } }),
            );
          } catch {
            // Quota exceeded or private mode
          }
        }
        return resolved;
      });
    },
    [key],
  );

  // Sync from other tabs (`storage`) and this tab (custom event).
  useEffect(() => {
    if (!IS_BROWSER) return;

    const onStorage = (e: StorageEvent) => {
      if (e.key !== key) return;
      if (e.newValue === null) {
        setValue(initialRef.current);
      } else {
        try {
          setValue(JSON.parse(e.newValue) as T);
        } catch {
          // Ignore malformed JSON
        }
      }
    };

    const onCustomSync = (e: Event) => {
      const detail = (e as CustomEvent<{ key: string; newValue: string }>).detail;
      if (detail?.key !== key) return;
      try {
        setValue(JSON.parse(detail.newValue) as T);
      } catch {
        // Ignore
      }
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener(STORAGE_SYNC_EVENT, onCustomSync);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(STORAGE_SYNC_EVENT, onCustomSync);
    };
  }, [key]);

  return [value, setPersistedValue];
}
