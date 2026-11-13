/**
 * ============================================================================
 * M-EDU · LIQUID GLASS — GLOBAL UI STORE
 * ============================================================================
 *
 * @file      ui.store.ts
 * @version   18.0.0 "Enterprise Zero-Dependency · Concurrent Safe"
 * @standard  React 18 Concurrent Mode / SSR-Hardened
 *
 * ----------------------------------------------------------------------------
 * 🎯 v6.0 → v18.0 ARCHITECTURE & CONCURRENCY FIXES:
 *  ✅ True Ref-Stabilized `useUiSelector` — Eliminates `useCallback(selector, [selector])`
 *     re-creation churn and prevents infinite render loops with inline selectors.
 *  ✅ Fast-Path State Short-Circuit — If `state` reference hasn't changed and
 *     selector is stable, skips re-evaluating selector & equality check entirely.
 *  ✅ Cached Server Snapshot — Prevents React 18 Hydration crash when selectors
 *     return derived objects/arrays with `shallowEqual`.
 *  ✅ Implemented & Exported `shallowEqual` — Was documented in header comments
 *     in v6.0 but completely missing from the implementation.
 *  ✅ Complete Overlay Registry — Added `isShortcutsOpen`, `isQuickPaymentOpen`,
 *     and `isQuickAttendanceOpen` (backward-compatible with all v6 APIs).
 *  ✅ Working Dev Diagnostics — Fixed dead `loggedPatch` code; logs real state
 *     diffs in `DEV` and exposes `window.__M_EDU_UI_STORE__` for live debugging.
 * ============================================================================
 */

import { useRef, useCallback, useMemo, useSyncExternalStore } from 'react';

/* ============================================================================
 * 01. TYPES & CONTRACTS
 * ========================================================================== */

export interface QuickLookData {
  id?: string;
  type?: 'student' | 'lead' | 'group' | 'payment' | 'teacher' | 'user' | 'general' | string;
  title: string;
  subtitle?: string;
  badge?:
    | {
        text: string;
        tone?: 'blue' | 'emerald' | 'amber' | 'rose' | 'purple' | 'slate';
      }
    | string;
  status?: {
    label: string;
    tone?: string;
  };
  avatar?: {
    text?: string;
    color?: string;
  };
  metrics?: Array<{
    label: string;
    value: string | number;
    subtext?: string;
    trend?: 'up' | 'down' | 'neutral';
  }>;
  details?: Array<{
    label: string;
    value: string;
    copyable?: boolean;
  }>;
  tags?: string[];
  primaryAction?: {
    label: string;
    onExecute: () => void;
  };
  secondaryAction?: {
    label: string;
    onExecute: () => void;
  };
  actions?: Array<{
    label: string;
    variant?: string;
    onClick: () => void;
  }>;
}

/**
 * Global presentational overlay state.
 * Strictly reserved for client UI surfaces (never store server/domain data here).
 */
export interface UiState {
  /** Kalkulyator paneli ko'rinadimi. */
  readonly isCalculatorOpen: boolean;
  /** Command Palette (⌘K) ochiqmi. */
  readonly isCommandPaletteOpen: boolean;
  /** AI Copilot yon paneli ochiqmi. */
  readonly isAiCopilotOpen: boolean;
  /** Klaviatura tugmalari (⌘/) oynasi ochiqmi. */
  readonly isShortcutsOpen: boolean;
  /** Tezkor to'lov qabul qilish oynasi ochiqmi. */
  readonly isQuickPaymentOpen: boolean;
  /** Tezkor davomat belgilash oynasi ochiqmi. */
  readonly isQuickAttendanceOpen: boolean;
  /** macOS Spacebar Quick-Look modal ochiqmi. */
  readonly isQuickLookOpen: boolean;
  /** Quick-Look modal ma'lumotlari. */
  readonly quickLookData: QuickLookData | null;
  /** macOS Split-View Detail Sidecar ochiqmi. */
  readonly isSidecarOpen: boolean;
  /** Split-View Sidecar ma'lumotlari. */
  readonly sidecarData: QuickLookData | null;
  readonly openSidecar: (data: QuickLookData) => void;
  readonly closeSidecar: () => void;
  /** Floating Picture-in-Picture Live Camera ochiqmi. */
  readonly isFloatingCameraOpen: boolean;
  readonly floatingCameraMode: 'attendance' | 'monitor';
}

export type UiStateKey = keyof UiState;
export type UiStatePatch = Partial<UiState>;
export type Listener = () => void;
export type EqualityFn<T> = (previous: T, next: T) => boolean;

/* ============================================================================
 * 02. CONSTANTS & EQUALITY COMPARATORS
 * ========================================================================== */

/**
 * Frozen initial state. Used as the canonical SSR snapshot and reset target.
 */
export const INITIAL_STATE: UiState = Object.freeze({
  isCalculatorOpen: false,
  isCommandPaletteOpen: false,
  isAiCopilotOpen: false,
  isShortcutsOpen: false,
  isQuickPaymentOpen: false,
  isQuickAttendanceOpen: false,
  isQuickLookOpen: false,
  quickLookData: null,
  isSidecarOpen: false,
  sidecarData: null,
  openSidecar,
  closeSidecar,
  isFloatingCameraOpen: false,
  floatingCameraMode: 'attendance',
});

/** Default reference/primitive equality (`Object.is`). */
export const defaultEquality: EqualityFn<unknown> = Object.is;

/**
 * Shallow equality comparator for object or array selector slices.
 *
 * @example
 *   const { calc, ai } = useUiSelector(
 *     (s) => ({ calc: s.isCalculatorOpen, ai: s.isAiCopilotOpen }),
 *     shallowEqual,
 *   );
 */
export function shallowEqual<T>(prev: T, next: T): boolean {
  if (Object.is(prev, next)) return true;

  if (
    typeof prev !== 'object' ||
    prev === null ||
    typeof next !== 'object' ||
    next === null
  ) {
    return false;
  }

  if (Array.isArray(prev) && Array.isArray(next)) {
    if (prev.length !== next.length) return false;
    for (let i = 0; i < prev.length; i += 1) {
      if (!Object.is(prev[i], next[i])) return false;
    }
    return true;
  }

  const keysPrev = Object.keys(prev) as Array<keyof T>;
  const keysNext = Object.keys(next) as Array<keyof T>;
  if (keysPrev.length !== keysNext.length) return false;

  for (let i = 0; i < keysPrev.length; i += 1) {
    const key = keysPrev[i];
    if (
      !Object.prototype.hasOwnProperty.call(next, key) ||
      !Object.is(prev[key], next[key])
    ) {
      return false;
    }
  }

  return true;
}

/* ============================================================================
 * 03. CORE ENGINE — STATE, LISTENERS & BATCHING
 * ========================================================================== */

let state: UiState = INITIAL_STATE;
const listeners = new Set<Listener>();

let batchDepth = 0;
let pendingNotify = false;

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): UiState {
  return state;
}

function getServerSnapshot(): UiState {
  return INITIAL_STATE;
}

function notify(): void {
  if (batchDepth > 0) {
    pendingNotify = true;
    return;
  }
  /* Snapshot listener array to stay safe if a listener unsubscribes mid-flush */
  const currentListeners = Array.from(listeners);
  for (let i = 0; i < currentListeners.length; i += 1) {
    currentListeners[i]();
  }
}

/**
 * Applies a partial update to `state` immutably.
 * Short-circuits with zero allocations and zero notifications if no value changed.
 */
function patch(partial: UiStatePatch): void {
  const keys = Object.keys(partial) as UiStateKey[];
  let changed = false;

  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    const nextVal = partial[key];
    if (nextVal !== undefined && !Object.is(state[key], nextVal)) {
      changed = true;
      break;
    }
  }

  if (!changed) return;

  const previousState = state;
  state = Object.freeze({ ...state, ...partial });

  if (import.meta.env?.DEV) {
    console.debug(
      '%c[ui.store]%c transition',
      'color:#007AFF;font-weight:700',
      'color:#94A3B8',
      { prev: previousState, next: state, patch: partial },
    );
  }

  notify();
}

/**
 * Coalesces multiple synchronous state updates into a single notification flush.
 * Supports arbitrary nesting depth.
 */
export function batch(fn: () => void): void {
  batchDepth += 1;
  try {
    fn();
  } finally {
    batchDepth -= 1;
    if (batchDepth === 0 && pendingNotify) {
      pendingNotify = false;
      notify();
    }
  }
}

/* ============================================================================
 * 04. NON-REACTIVE READS & QUERIES
 * ========================================================================== */

/** Returns the current frozen state snapshot without subscribing. */
export function getUiState(): Readonly<UiState> {
  return state;
}

/** Returns `true` if at least one modal/overlay surface is currently open. */
export function hasOpenOverlay(s: UiState = state): boolean {
  return (
    s.isCalculatorOpen ||
    s.isCommandPaletteOpen ||
    s.isAiCopilotOpen ||
    s.isShortcutsOpen ||
    s.isQuickPaymentOpen ||
    s.isQuickAttendanceOpen ||
    s.isQuickLookOpen
  );
}

/* ============================================================================
 * 05. ACTIONS — OVERLAY CONTROLLERS
 * ========================================================================== */

/* ── 1. Calculator ──────────────────────────────────────────────────────── */
export function setCalculatorOpen(open: boolean): void {
  patch({ isCalculatorOpen: open });
}
export function openCalculator(): void {
  patch({ isCalculatorOpen: true });
}
export function closeCalculator(): void {
  patch({ isCalculatorOpen: false });
}
export function toggleCalculator(): void {
  patch({ isCalculatorOpen: !state.isCalculatorOpen });
}

/* ── 2. Command Palette (⌘K) ────────────────────────────────────────────── */
export function setCommandPaletteOpen(open: boolean): void {
  patch({
    isCommandPaletteOpen: open,
    /* Automatically close Shortcuts modal if Command Palette opens */
    ...(open ? { isShortcutsOpen: false } : {}),
  });
}
export function openCommandPalette(): void {
  setCommandPaletteOpen(true);
}
export function closeCommandPalette(): void {
  setCommandPaletteOpen(false);
}
export function toggleCommandPalette(): void {
  setCommandPaletteOpen(!state.isCommandPaletteOpen);
}

/* ── 3. AI Copilot ──────────────────────────────────────────────────────── */
export function setAiCopilotOpen(open: boolean): void {
  patch({ isAiCopilotOpen: open });
}
export function openAiCopilot(): void {
  patch({ isAiCopilotOpen: true });
}
export function closeAiCopilot(): void {
  patch({ isAiCopilotOpen: false });
}
export function toggleAiCopilot(): void {
  patch({ isAiCopilotOpen: !state.isAiCopilotOpen });
}

/* ── 4. Keyboard Shortcuts Modal (⌘/) ───────────────────────────────────── */
export function setShortcutsOpen(open: boolean): void {
  patch({
    isShortcutsOpen: open,
    ...(open ? { isCommandPaletteOpen: false } : {}),
  });
}
export function openShortcuts(): void {
  setShortcutsOpen(true);
}
export function closeShortcuts(): void {
  setShortcutsOpen(false);
}
export function toggleShortcuts(): void {
  setShortcutsOpen(!state.isShortcutsOpen);
}

/* ── 5. Quick Payment & Quick Attendance Modals ─────────────────────────── */
export function setQuickPaymentOpen(open: boolean): void {
  patch({ isQuickPaymentOpen: open });
}
export function toggleQuickPayment(): void {
  patch({ isQuickPaymentOpen: !state.isQuickPaymentOpen });
}

export function setQuickAttendanceOpen(open: boolean): void {
  patch({ isQuickAttendanceOpen: open });
}
export function toggleQuickAttendance(): void {
  patch({ isQuickAttendanceOpen: !state.isQuickAttendanceOpen });
}

/* ── 6. macOS Spacebar Quick-Look Modal ─────────────────────────────────── */
export function openQuickLook(data: QuickLookData): void {
  patch({ isQuickLookOpen: true, quickLookData: data });
}
export function closeQuickLook(): void {
  patch({ isQuickLookOpen: false, quickLookData: null });
}
export function toggleQuickLook(): void {
  patch({ isQuickLookOpen: !state.isQuickLookOpen });
}

/* ── 6.5. macOS Split-View Detail Sidecar ───────────────────────────────── */
export function openSidecar(data: QuickLookData): void {
  patch({ isSidecarOpen: true, sidecarData: data });
}
export function closeSidecar(): void {
  patch({ isSidecarOpen: false, sidecarData: null });
}
export function toggleSidecar(): void {
  patch({ isSidecarOpen: !state.isSidecarOpen });
}

/* ── 6.6. Floating Picture-in-Picture (PiP) Face Camera ─────────────────── */
export function openFloatingCamera(mode: 'attendance' | 'monitor' = 'attendance'): void {
  patch({ isFloatingCameraOpen: true, floatingCameraMode: mode });
}
export function closeFloatingCamera(): void {
  patch({ isFloatingCameraOpen: false });
}
export function toggleFloatingCamera(): void {
  patch({ isFloatingCameraOpen: !state.isFloatingCameraOpen });
}

/* ── 7. Bulk Reset / Dismiss All ────────────────────────────────────────── */
export function closeAllOverlays(): void {
  patch(INITIAL_STATE);
}

/* ============================================================================
 * 06. REACT HOOKS — CONCURRENT-SAFE SELECTOR ENGINE
 * ========================================================================== */

interface SelectorCache<T> {
  hasClientValue: boolean;
  lastState: UiState;
  lastSelector: (state: UiState) => T;
  lastValue: T;
  hasServerValue: boolean;
  lastServerSelector: (state: UiState) => T;
  lastServerValue: T;
}

/**
 * Subscribes to a derived slice of `UiState`.
 *
 * 🔧 v18 Architecture Fix:
 * Uses `useRef` stabilization instead of `useCallback(selector, [selector])`
 * so inline arrow selectors `(s) => s.isCalculatorOpen` never cause
 * `useSyncExternalStore` to re-subscribe or enter infinite render loops.
 */
export function useUiSelector<T>(
  selector: (state: UiState) => T,
  equalityFn: EqualityFn<T> = defaultEquality as EqualityFn<T>,
): T {
  const selectorRef = useRef(selector);
  const equalityRef = useRef(equalityFn);

  selectorRef.current = selector;
  equalityRef.current = equalityFn;

  const cacheRef = useRef<SelectorCache<T> | null>(null);
  if (cacheRef.current === null) {
    cacheRef.current = {
      hasClientValue: false,
      lastState: INITIAL_STATE,
      lastSelector: selector,
      lastValue: undefined as unknown as T,
      hasServerValue: false,
      lastServerSelector: selector,
      lastServerValue: undefined as unknown as T,
    };
  }

  const getSelectedSnapshot = useCallback((): T => {
    const cache = cacheRef.current!;
    const currentState = state;
    const currentSelector = selectorRef.current;
    const currentEquality = equalityRef.current;

    /* Fast path: if state & selector ref haven't changed, return cached value immediately */
    if (
      cache.hasClientValue &&
      Object.is(cache.lastState, currentState) &&
      Object.is(cache.lastSelector, currentSelector)
    ) {
      return cache.lastValue;
    }

    const nextValue = currentSelector(currentState);

    if (
      cache.hasClientValue &&
      currentEquality(cache.lastValue, nextValue)
    ) {
      cache.lastState = currentState;
      cache.lastSelector = currentSelector;
      return cache.lastValue;
    }

    cache.hasClientValue = true;
    cache.lastState = currentState;
    cache.lastSelector = currentSelector;
    cache.lastValue = nextValue;
    return nextValue;
  }, []);

  const getServerSelectedSnapshot = useCallback((): T => {
    const cache = cacheRef.current!;
    const currentSelector = selectorRef.current;

    if (
      cache.hasServerValue &&
      Object.is(cache.lastServerSelector, currentSelector)
    ) {
      return cache.lastServerValue;
    }

    const nextServerValue = currentSelector(INITIAL_STATE);
    cache.hasServerValue = true;
    cache.lastServerSelector = currentSelector;
    cache.lastServerValue = nextServerValue;
    return nextServerValue;
  }, []);

  return useSyncExternalStore(
    subscribe,
    getSelectedSnapshot,
    getServerSelectedSnapshot,
  );
}

/** Subscribes to the entire `UiState` object. */
export function useUiSnapshot(): UiState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/* ============================================================================
 * 07. NAMED HOOKS — ZERO-ALLOCATION ATOMIC SUBSCRIPTIONS
 * ========================================================================== */

const selectCalculatorOpen = (s: UiState): boolean => s.isCalculatorOpen;
const selectCommandPaletteOpen = (s: UiState): boolean => s.isCommandPaletteOpen;
const selectAiCopilotOpen = (s: UiState): boolean => s.isAiCopilotOpen;
const selectShortcutsOpen = (s: UiState): boolean => s.isShortcutsOpen;
const selectQuickPaymentOpen = (s: UiState): boolean => s.isQuickPaymentOpen;
const selectQuickAttendanceOpen = (s: UiState): boolean => s.isQuickAttendanceOpen;
const selectQuickLookOpen = (s: UiState): boolean => s.isQuickLookOpen;
const selectQuickLookData = (s: UiState): QuickLookData | null => s.quickLookData;

export const useCalculatorOpen = (): boolean =>
  useUiSelector(selectCalculatorOpen);

export const useCommandPaletteOpen = (): boolean =>
  useUiSelector(selectCommandPaletteOpen);

export const useAiCopilotOpen = (): boolean =>
  useUiSelector(selectAiCopilotOpen);

export const useShortcutsOpen = (): boolean =>
  useUiSelector(selectShortcutsOpen);

export const useQuickPaymentOpen = (): boolean =>
  useUiSelector(selectQuickPaymentOpen);

export const useQuickAttendanceOpen = (): boolean =>
  useUiSelector(selectQuickAttendanceOpen);

export const useQuickLookOpen = (): boolean =>
  useUiSelector(selectQuickLookOpen);

export const useQuickLookData = (): QuickLookData | null =>
  useUiSelector(selectQuickLookData);

const selectSidecarOpen = (s: UiState): boolean => s.isSidecarOpen;
const selectSidecarData = (s: UiState): QuickLookData | null => s.sidecarData;

export const useSidecarOpen = (): boolean =>
  useUiSelector(selectSidecarOpen);

export const useSidecarData = (): QuickLookData | null =>
  useUiSelector(selectSidecarData);

const selectFloatingCameraOpen = (s: UiState): boolean => s.isFloatingCameraOpen;
const selectFloatingCameraMode = (s: UiState): 'attendance' | 'monitor' => s.floatingCameraMode;

export const useFloatingCameraOpen = (): boolean =>
  useUiSelector(selectFloatingCameraOpen);

export const useFloatingCameraMode = (): 'attendance' | 'monitor' =>
  useUiSelector(selectFloatingCameraMode);

export const useHasOpenOverlay = (): boolean =>
  useUiSelector(hasOpenOverlay);

/* ============================================================================
 * 08. LEGACY BUNDLE API (Backward-Compatible)
 * ========================================================================== */

export interface UiStoreValue {
  readonly isCalculatorOpen: boolean;
  readonly setCalculatorOpen: (open: boolean) => void;
  readonly toggleCalculator: () => void;
}

const selectEntireState = (s: UiState): UiState => s;

/**
 * Legacy bundle hook for calculator state & selector support.
 * Maintained for 100% backward compatibility with existing components.
 */
export function useUiStore(): UiStoreValue;
export function useUiStore<T>(selector: (state: UiState) => T): T;
export function useUiStore<T>(selector?: (state: UiState) => T): T | UiStoreValue {
  const isCalculatorOpen = useCalculatorOpen();
  const selected = useUiSelector(selector ?? (selectEntireState as unknown as (state: UiState) => T));

  const legacyValue = useMemo(
    () => ({
      isCalculatorOpen,
      setCalculatorOpen,
      toggleCalculator,
    }),
    [isCalculatorOpen],
  );

  return selector !== undefined ? selected : legacyValue;
}

export const useUIStore = useUiStore;

/* ============================================================================
 * 09. DEVELOPMENT DIAGNOSTICS & LIVE INSPECTOR
 * ========================================================================== */

if (import.meta.env?.DEV && typeof globalThis !== 'undefined') {
  (globalThis as Record<string, unknown>).__M_EDU_UI_STORE__ = {
    getState: getUiState,
    patch,
    batch,
    closeAllOverlays,
    getListenerCount: () => listeners.size,
  };
}