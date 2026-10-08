/**
 * M-EDU Layout Singletons & Utilities — v11 "Titanium"
 * Leak-free, SSR-safe listeners and device profile management.
 */

import {
  useState, useCallback, useEffect, useMemo,
  useSyncExternalStore, createContext, useContext,
  type ReactNode, type RefObject,
} from 'react';
import {
  useMotionValue, useSpring,
  type MotionValue,
} from 'framer-motion';

/* ══════════════════════════════════════════════════════════════════════
 * 1. SINGLETON STORES — useSyncExternalStore (0 leaks, SSR-safe)
 * ════════════════════════════════════════════════════════════════════ */

/* ── NOW CLOCK ── */
type NowListener = () => void;
const nowSubscribers = new Set<NowListener>();
let nowValue = new Date();
let nowIntervalId: ReturnType<typeof setInterval> | null = null;
let nowTimeoutId: ReturnType<typeof setTimeout> | null = null;

function syncNow() {
  nowValue = new Date();
  for (const cb of nowSubscribers) cb();
}

function startClock() {
  if (nowIntervalId || nowTimeoutId) return;
  const ms = 60_000 - (Date.now() % 60_000);
  nowTimeoutId = setTimeout(() => {
    nowTimeoutId = null;
    syncNow();
    nowIntervalId = setInterval(syncNow, 30_000);
  }, ms);
}

function stopClock() {
  if (nowTimeoutId) { clearTimeout(nowTimeoutId); nowTimeoutId = null; }
  if (nowIntervalId) { clearInterval(nowIntervalId); nowIntervalId = null; }
}

function subscribeNow(cb: NowListener): () => void {
  nowSubscribers.add(cb);
  if (nowSubscribers.size === 1) startClock();
  return () => {
    nowSubscribers.delete(cb);
    if (nowSubscribers.size === 0) stopClock();
  };
}

export function useNow(): Date {
  return useSyncExternalStore(subscribeNow, () => nowValue, () => nowValue);
}

/* ── ONLINE STATUS ── */
function subscribeOnline(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
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

/* ── MEDIA QUERIES ── */
function subscribeMedia(query: string) {
  return (cb: () => void): (() => void) => {
    if (typeof window === 'undefined' || !window.matchMedia) return () => {};
    const mq = window.matchMedia(query);
    mq.addEventListener('change', cb);
    return () => mq.removeEventListener('change', cb);
  };
}

export function useMediaQuery(query: string, ssrFallback = false): boolean {
  const subscribe = useMemo(() => subscribeMedia(query), [query]);
  const getSnapshot = useCallback(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return ssrFallback;
    return window.matchMedia(query).matches;
  }, [query, ssrFallback]);
  const getServerSnapshot = useCallback(() => ssrFallback, [ssrFallback]);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

/* ── PAGE VISIBILITY ── */
function subscribeVisibility(cb: () => void): () => void {
  if (typeof document === 'undefined') return () => {};
  document.addEventListener('visibilitychange', cb);
  return () => document.removeEventListener('visibilitychange', cb);
}

export function usePageVisible(): boolean {
  return useSyncExternalStore(
    subscribeVisibility,
    () => (typeof document === 'undefined' ? true : !document.hidden),
    () => true,
  );
}

/* ══════════════════════════════════════════════════════════════════════
 * 2. DEVICE PROFILE
 * ════════════════════════════════════════════════════════════════════ */

export interface DeviceProfile {
  reduced: boolean;
  isLowEnd: boolean;
  batterySaver: boolean;
  saveData: boolean;
  allowAmbient: boolean;
  allowCursorFx: boolean;
  hoverCapable: boolean;
}

const DeviceProfileContext = createContext<DeviceProfile | null>(null);

function useDeviceProfileValue(): DeviceProfile {
  const reduced = usePrefersReducedMotion();
  const isNarrow = useMediaQuery('(max-width: 480px)');
  const hoverCapable = useMediaQuery('(hover: hover) and (pointer: fine)');
  const isLowEnd = isNarrow || (
    typeof navigator !== 'undefined' &&
    typeof navigator.hardwareConcurrency === 'number' &&
    navigator.hardwareConcurrency <= 4
  );
  const saveData = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    return Boolean(
      (navigator as Navigator & { connection?: { saveData?: boolean } })
        .connection?.saveData,
    );
  }, []);
  const [batterySaver, setBatterySaver] = useState(false);

  useEffect(() => {
    type BatteryManager = {
      charging: boolean;
      level: number;
      addEventListener: (t: string, cb: () => void) => void;
      removeEventListener: (t: string, cb: () => void) => void;
    };
    const nav = navigator as Navigator & {
      getBattery?: () => Promise<BatteryManager>;
    };
    if (!nav.getBattery) return;

    let cancelled = false;
    let battery: BatteryManager | null = null;
    const evaluate = () => {
      if (!battery || cancelled) return;
      setBatterySaver(!battery.charging && battery.level <= 0.2);
    };

    nav.getBattery().then((b) => {
      if (cancelled) return;
      battery = b;
      evaluate();
      b.addEventListener('levelchange', evaluate);
      b.addEventListener('chargingchange', evaluate);
    }).catch(() => {});

    return () => {
      cancelled = true;
      if (battery) {
        battery.removeEventListener('levelchange', evaluate);
        battery.removeEventListener('chargingchange', evaluate);
      }
    };
  }, []);

  return useMemo<DeviceProfile>(() => ({
    reduced,
    isLowEnd,
    batterySaver,
    saveData,
    allowAmbient: !reduced && !batterySaver && !saveData && !isLowEnd,
    allowCursorFx: !reduced && !isLowEnd && hoverCapable,
    hoverCapable,
  }), [reduced, isLowEnd, batterySaver, saveData, hoverCapable]);
}

export function DeviceProfileProvider({ children }: { children: ReactNode }) {
  const profile = useDeviceProfileValue();
  return (
    <DeviceProfileContext.Provider value={profile}>
      {children}
    </DeviceProfileContext.Provider>
  );
}

export function useDeviceProfile(): DeviceProfile {
  const ctx = useContext(DeviceProfileContext);
  if (!ctx) throw new Error('useDeviceProfile must be used within <DeviceProfileProvider>');
  return ctx;
}

/* ── GLOBAL CURSOR ── */
export function useGlobalCursor(enabled: boolean): { x: MotionValue<number>; y: MotionValue<number> } {
  const mx = useMotionValue(-1000);
  const my = useMotionValue(-1000);
  const sx = useSpring(mx, { stiffness: 300, damping: 26, mass: 0.5 });
  const sy = useSpring(my, { stiffness: 300, damping: 26, mass: 0.5 });
  const visible = usePageVisible();

  useEffect(() => {
    if (!enabled || !visible) return;
    const onMove = (e: MouseEvent) => {
      mx.set(e.clientX);
      my.set(e.clientY);
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, [mx, my, enabled, visible]);

  return { x: sx, y: sy };
}

/* ── FOCUS TRAP (with scroll lock) ── */
export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  initialFocus?: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!active) return;
    const root = ref.current;
    if (!root) return;

    // Scroll lock
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    const scrollbarW = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbarW > 0) document.body.style.paddingRight = `${scrollbarW}px`;

    const selector =
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const getFocusable = () =>
      Array.from(root.querySelectorAll<HTMLElement>(selector))
        .filter((el) => el.offsetParent !== null || el === document.activeElement);

    const target = initialFocus?.current ?? getFocusable()[0];
    requestAnimationFrame(() => target?.focus({ preventScroll: true }));

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const list = getFocusable();
      if (!list.length) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [active, ref, initialFocus]);
}

/* ── KEYBOARD NAV (roving tabindex) ── */
export function useKeyboardNav(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
) {
  useEffect(() => {
    if (!active) return;
    const root = containerRef.current;
    if (!root) return;

    const onKey = (e: KeyboardEvent) => {
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
      const target = e.target as HTMLElement;
      if (!root.contains(target)) return;

      const items = Array.from(
        root.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'),
      ).filter((el) => el.offsetParent !== null);
      if (!items.length) return;

      const i = items.indexOf(target);
      if (i === -1) return;

      e.preventDefault();
      let next = i;
      if (e.key === 'ArrowDown') next = (i + 1) % items.length;
      else if (e.key === 'ArrowUp') next = (i - 1 + items.length) % items.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = items.length - 1;
      items[next]?.focus();
    };

    root.addEventListener('keydown', onKey);
    return () => root.removeEventListener('keydown', onKey);
  }, [containerRef, active]);
}

/* ── PERSISTED STATE ── */
export type SetState<T> = (next: T | ((prev: T) => T)) => void;

export function usePersistedState<T>(key: string, initial: T): [T, SetState<T>] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initial;
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch { return initial; }
  });

  useEffect(() => {
    try { window.localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }, [key, value]);

  return [value, setValue as SetState<T>];
}
