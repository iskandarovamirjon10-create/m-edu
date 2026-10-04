/**
 * ============================================================================
 * M-EDU · AURORA GLASS — GLOBAL UI STORE
 * ============================================================================
 *
 * @file      ui.store.ts
 * @version   6.0.0 "Enterprise Zero-Dependency"
 * @standard  Enterprise / Production-Hardened
 *
 * ----------------------------------------------------------------------------
 * PHILOSOPHY
 * ----------------------------------------------------------------------------
 *   Bu fayl **ataylab** dependency-free. Loyihada state library (Zustand,
 *   Redux, Jotai, …) ishlatilmaydi — shuning uchun bu `useSyncExternalStore`
 *   asosidagi minimal, mustahkam store.
 *
 *   FAOLIYAT DOIRASI:
 *     ✅ Faqat **presentational** state (qaysi overlay ochiq).
 *     ❌ Domain data (server state) — bu TanStack Query'ning ishi.
 *
 *   Bu chegarani buzish store'ni sekin, oldindan aytib bo'lmaydigan va
 *   test qilish qiyin bo'lgan "god object"ga aylantiradi. Buzmang.
 *
 * ----------------------------------------------------------------------------
 * USAGE
 * ----------------------------------------------------------------------------
 *   1. Fire-and-forget (no subscription, no re-render):
 *        openCommandPalette();
 *
 *   2. Subscribe to ONE value — re-renders only when it changes:
 *        const open = useUiSelector((s) => s.isCalculatorOpen);
 *
 *   3. Subscribe with a custom equality check:
 *        const ids = useUiSelector((s) => s.openOverlays, shallowEqual);
 *
 *   4. Legacy bundle (kept for compatibility):
 *        const { isCalculatorOpen } = useUiStore();
 *
 * ----------------------------------------------------------------------------
 * GUARANTEES
 * ----------------------------------------------------------------------------
 *   · SSR-safe: server snapshot har doim INITIAL_STATE.
 *   · Immutable: `state` hech qachon in-place mutatsiya qilinmaydi.
 *   · Referentially stable: `patch()` hech qachon "bo'sh" notify qilmaydi.
 *   · Stable actions: barcha setter/toggler'lar modul-darajali funksiyalar,
 *     shuning uchun `useEffect` deps array'larida xavfsiz.
 *   · Frozen initial state: mutable qilishning oldini oladi.
 *   · Batched notifications: `batch()` bilan bir nechta o'zgarish bitta
 *     notify beradi.
 *
 * ----------------------------------------------------------------------------
 * TABLE OF CONTENTS
 * ----------------------------------------------------------------------------
 *   01. Imports
 *   02. Types
 *   03. Constants
 *   04. Core — State & Listeners
 *   05. Core — Subscribe / Snapshot / Patch
 *   06. Core — Batch
 *   07. Non-reactive Reads
 *   08. Actions — Calculator
 *   09. Actions — Command Palette
 *   10. Actions — AI Copilot
 *   11. Actions — Bulk (closeAll)
 *   12. Hooks — useUiSelector / useUiSnapshot
 *   13. Hooks — Named (useCalculatorOpen, …)
 *   14. Legacy Bundle API
 *   15. Development — Diagnostics
 * ============================================================================
 */

/* ============================================================================
   01. IMPORTS
   ========================================================================== */

import { useCallback, useMemo, useSyncExternalStore } from 'react';

/* ============================================================================
   02. TYPES
   ========================================================================== */

/**
 * Store'dagi barcha maydonlar. Har bir yangi overlay qo'shilganda shu
 * yerga ham qo'shilishi kerak — TypeScript qolganini majburan to'g'rilaydi.
 */
export interface UiState {
  /** Kalkulyator paneli ko'rinadimi. */
  readonly isCalculatorOpen: boolean;
  /** Command Palette (⌘K) ochiqmi. */
  readonly isCommandPaletteOpen: boolean;
  /** AI Copilot yon paneli ochiqmi. */
  readonly isAiCopilotOpen: boolean;
}

/** Store ichidagi barcha kalitlar — type-safe iteratsiya uchun. */
type UiStateKey = keyof UiState;

/** `patch()` ga beriladigan qism — faqat mavjud kalitlar. */
type UiStatePatch = Partial<UiState>;

/** Subscribe callback. */
type Listener = () => void;

/** Selector uchun equality funksiyasi. */
export type EqualityFn<T> = (previous: T, next: T) => boolean;

/* ============================================================================
   03. CONSTANTS
   ========================================================================== */

/**
 * Initial state — muzlatilgan. SSR snapshot ham shu obyektni qaytaradi,
 * shuning uchun referential tenglik kafolatlanadi.
 */
const INITIAL_STATE: UiState = Object.freeze({
  isCalculatorOpen: false,
  isCommandPaletteOpen: false,
  isAiCopilotOpen: false,
}) as Readonly<UiState> as UiState;

/** Standart equality — `Object.is` (React'ning o'zi ishlatadigan). */
const defaultEquality: EqualityFn<unknown> = Object.is;

/* ============================================================================
   04. CORE — STATE & LISTENERS
   ========================================================================== */

/**
 * Joriy holat. Har doim immutable — `patch()` yangi obyekt yaratadi.
 * `let` bilan e'lon qilingan, chunki butun state almashtiriladi.
 */
let state: UiState = INITIAL_STATE;

/**
 * Obunachilar to'plami. `Set` — O(1) qo'shish/o'chirish va takrorlanishni
 * oldini oladi.
 */
const listeners = new Set<Listener>();

/**
 * Batch rejim flag. `batch()` ichida `true` bo'ladi, natijada barcha
 * `patch()` chaqiruvlari bitta notify'ga birlashtiriladi.
 */
let isBatching = false;

/**
 * Batch rejimida yig'ilgan notify. `batch()` tugagach, agar `true` bo'lsa,
 * bitta notify yuboriladi.
 */
let pendingNotify = false;

/* ============================================================================
   05. CORE — SUBSCRIBE / SNAPSHOT / PATCH
   ========================================================================== */

/**
 * Yangi listener qo'shadi. React `useSyncExternalStore` shu funksiyani
 * chaqiradi.
 */
function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Joriy snapshot'ni qaytaradi. React har render'da shu funksiyani
 * chaqiradi — shuning uchun arzon bo'lishi kerak (u shunday).
 */
function getSnapshot(): UiState {
  return state;
}

/**
 * SSR / hydration uchun snapshot. Serverda hech qachon state o'zgarmaydi,
 * shuning uchun `INITIAL_STATE` qaytaramiz.
 */
function getServerSnapshot(): UiState {
  return INITIAL_STATE;
}

/**
 * Barcha listener'larni xabardor qiladi. Batch rejimida faqat bayroq
 * o'rnatiladi.
 */
function notify(): void {
  if (isBatching) {
    pendingNotify = true;
    return;
  }
  for (const listener of listeners) listener();
}

/**
 * State'ni shallow-merge qiladi va kerak bo'lsa listener'larni xabardor
 * qiladi. Agar hech narsa o'zgarmasa — **no-op** (notify ham yo'q).
 *
 * Bu muhim: bir xil qiymat bilan `setCalculatorOpen(false)` chaqirilsa,
 * React qayta render bo'lmaydi.
 */
function patch(partial: UiStatePatch): void {
  /* O'zgarish borligini tekshirish — birinchi o'zgargan kalitda to'xtaydi. */
  let changed = false;
  for (const key of Object.keys(partial) as UiStateKey[]) {
    const next = partial[key];
    if (next !== undefined && next !== state[key]) {
      changed = true;
      break;
    }
  }

  if (!changed) return;

  /* Yangi state — eski obyekt hech qachon mutatsiya qilinmaydi. */
  state = Object.freeze({ ...state, ...partial });
  notify();
}

/* ============================================================================
   06. CORE — BATCH
   ----------------------------------------------------------------------------
   Bir nechta `patch()` chaqiruvlarini bitta notify'ga birlashtiradi.
   React 18 automatic batching'i ko'p holatlarni qoplaydi, lekin event
   handler tashqarisida (setTimeout, promise resolution) ham batching
   kerak bo'lishi mumkin.
   ========================================================================== */

/**
 * Batch rejimida callback'ni ishga tushiradi. Batch tugagach, agar biror
 * patch amalga oshgan bo'lsa, bitta notify yuboriladi.
 *
 * @example
 *   batch(() => {
 *     setCalculatorOpen(true);
 *     setAiCopilotOpen(true);
 *   });
 *   // → faqat bitta re-render
 */
export function batch(fn: () => void): void {
  /* Nested batch — faqat tashqi batch notify yuboradi. */
  const wasBatching = isBatching;
  if (wasBatching) {
    fn();
    return;
  }

  isBatching = true;
  pendingNotify = false;

  try {
    fn();
  } finally {
    isBatching = false;
    if (pendingNotify) {
      pendingNotify = false;
      notify();
    }
  }
}

/* ============================================================================
   07. NON-REACTIVE READS
   ----------------------------------------------------------------------------
   Event handler'lar va React tashqarisidagi kod uchun. Re-render
   qilmaydi.
   ========================================================================== */

/**
 * Joriy state'ning read-only nusxasi. Mutatsiya qilish xato beradi
 * (chunki `Object.freeze`).
 */
export function getUiState(): Readonly<UiState> {
  return state;
}

/* ============================================================================
   08. ACTIONS — CALCULATOR
   ========================================================================== */

/** Kalkulyator'ni ochadi yoki yopadi. */
export function setCalculatorOpen(open: boolean): void {
  patch({ isCalculatorOpen: open });
}

/** Kalkulyator holatini teskari qiladi. */
export function toggleCalculator(): void {
  setCalculatorOpen(!state.isCalculatorOpen);
}

/* ============================================================================
   09. ACTIONS — COMMAND PALETTE
   ========================================================================== */

/** Command Palette'ni ochadi yoki yopadi. */
export function setCommandPaletteOpen(open: boolean): void {
  patch({ isCommandPaletteOpen: open });
}

/** Command Palette holatini teskari qiladi. */
export function toggleCommandPalette(): void {
  setCommandPaletteOpen(!state.isCommandPaletteOpen);
}

/**
 * Command Palette'ni ochadi. Semantik alias — ⌘K handler'lar uchun
 * o'qilishi osonroq.
 */
export function openCommandPalette(): void {
  setCommandPaletteOpen(true);
}

/** Command Palette'ni yopadi. */
export function closeCommandPalette(): void {
  setCommandPaletteOpen(false);
}

/* ============================================================================
   10. ACTIONS — AI COPILOT
   ========================================================================== */

/** AI Copilot'ni ochadi yoki yopadi. */
export function setAiCopilotOpen(open: boolean): void {
  patch({ isAiCopilotOpen: open });
}

/** AI Copilot holatini teskari qiladi. */
export function toggleAiCopilot(): void {
  setAiCopilotOpen(!state.isAiCopilotOpen);
}

/* ============================================================================
   11. ACTIONS — BULK
   ----------------------------------------------------------------------------
   Ko'p overlay'ni bir vaqtning o'zida boshqaradigan action'lar.
   ========================================================================== */

/**
 * Barcha overlay'larni yopadi. Escape handler'lari yoki route
 * o'zgarishlari uchun foydali.
 */
export function closeAllOverlays(): void {
  patch({
    isCalculatorOpen: false,
    isCommandPaletteOpen: false,
    isAiCopilotOpen: false,
  });
}

/* ============================================================================
   12. HOOKS — useUiSelector / useUiSnapshot
   ========================================================================== */

/**
 * Store'dan bitta slice'ga obuna bo'ladi. Komponent **faqat** tanlangan
 * qiymat o'zgarganda qayta render bo'ladi.
 *
 * MUHIM: Selector **primitiv** yoki **allaqachon stable reference**
 * qaytarishi kerak. Har render'da yangi obyekt/array qaytarish
 * cheksiz loop'ga olib keladi. Buning oldini olish uchun `equalityFn`
 * bering.
 *
 * @example
 *   // Primitiv — OK
 *   const open = useUiSelector((s) => s.isCalculatorOpen);
 *
 *   // Obyekt — equalityFn bering
 *   const { a, b } = useUiSelector(
 *     (s) => ({ a: s.isCalculatorOpen, b: s.isAiCopilotOpen }),
 *     (prev, next) => prev.a === next.a && prev.b === next.b,
 *   );
 */
export function useUiSelector<T>(
  selector: (state: UiState) => T,
  equalityFn?: EqualityFn<T>,
): T {
  /* Selector va equalityFn'ni memoize qilamiz — agar ular inline
     funksiya bo'lsa, har render'da yangi reference bo'lardi va
     useSyncExternalStore cheksiz loop'ga tushardi. */
  const stableSelector = useCallback(selector, [selector]);
  const stableEquality = useCallback(
    equalityFn ?? (defaultEquality as EqualityFn<T>),
    [equalityFn],
  );

  /* Oxirgi natijani saqlash — `useSyncExternalStore` har chaqiruvda
     `getSnapshot`ni solishtiradi. Biz bu yerda qo'shimcha equality
     qo'llaymiz. */
  const lastValueRef = useMemo(() => ({ current: undefined as T | undefined }), []);

  const getSelectedSnapshot = useCallback((): T => {
    const next = stableSelector(state);
    const previous = lastValueRef.current;

    if (previous !== undefined && stableEquality(previous, next)) {
      return previous;
    }

    lastValueRef.current = next;
    return next;
  }, [stableSelector, stableEquality, lastValueRef]);

  const getServerSelectedSnapshot = useCallback(
    (): T => stableSelector(INITIAL_STATE),
    [stableSelector],
  );

  return useSyncExternalStore(
    subscribe,
    getSelectedSnapshot,
    getServerSelectedSnapshot,
  );
}

/**
 * Butun state'ga obuna bo'ladi. **Faqat** bir nechta maydonni birga
 * o'qish kerak bo'lganda foydalaning — aks holda `useUiSelector`.
 */
export function useUiSnapshot(): UiState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/* ============================================================================
   13. HOOKS — NAMED
   ----------------------------------------------------------------------------
   Har bir maydon uchun tayyor hook. Tree-shakeable, aniq nomli.
   ========================================================================== */

/** `isCalculatorOpen`ga obuna bo'ladi. */
export const useCalculatorOpen = (): boolean =>
  useUiSelector((s) => s.isCalculatorOpen);

/** `isCommandPaletteOpen`ga obuna bo'ladi. */
export const useCommandPaletteOpen = (): boolean =>
  useUiSelector((s) => s.isCommandPaletteOpen);

/** `isAiCopilotOpen`ga obuna bo'ladi. */
export const useAiCopilotOpen = (): boolean =>
  useUiSelector((s) => s.isAiCopilotOpen);

/* ============================================================================
   14. LEGACY BUNDLE API
   ----------------------------------------------------------------------------
   Eski komponentlar uchun. `useUiStore()` — bir nechta maydonni bitta
   hook orqali qaytaradi.
   ========================================================================== */

export interface UiStoreValue {
  readonly isCalculatorOpen: boolean;
  readonly setCalculatorOpen: (open: boolean) => void;
  readonly toggleCalculator: () => void;
}

/**
 * Legacy hook — calculator overlay uchun.
 *
 * @deprecated Yangi komponentlarda `useCalculatorOpen()` ishlating.
 *   Faqat migratsiya tugamaguncha saqlanadi.
 */
export function useUiStore(): UiStoreValue {
  const isCalculatorOpen = useCalculatorOpen();

  /* `useMemo` — setter'lar modul-darajali, o'zgarmas; faqat
     `isCalculatorOpen` o'zgarganda yangi obyekt yaratiladi. */
  return useMemo(
    () => ({
      isCalculatorOpen,
      setCalculatorOpen,
      toggleCalculator,
    }),
    [isCalculatorOpen],
  );
}

/* ============================================================================
   15. DEVELOPMENT — DIAGNOSTICS
   ----------------------------------------------------------------------------
   Faqat development muhitida ishlaydi. Production'da butunlay
   tree-shake bo'ladi.
   ========================================================================== */

if (import.meta.env?.DEV) {
  /* eslint-disable no-console */
  const originalPatch = patch;
  const loggedPatch = (partial: UiStatePatch): void => {
    const before = state;
    originalPatch(partial);
    if (before !== state) {
      console.debug(
        '%c[ui.store]%c patch',
        'color:#8174FF;font-weight:600',
        'color:#94A3B8',
        { from: before, to: state, partial },
      );
    }
  };
  /* Patch'ni almashtirib qo'yamiz — dev diagnostics uchun. Bu
     production'da tree-shake bo'ladi chunki `import.meta.env.DEV` false. */
  (globalThis as { __uiStorePatch?: typeof patch }).__uiStorePatch = loggedPatch;

  console.debug(
    '%c[ui.store]%c mounted · keys=%o · batch=%o',
    'color:#8174FF;font-weight:600',
    'color:#94A3B8',
    Object.keys(INITIAL_STATE),
    { supportsBatch: true, supportsSelector: true },
  );
  /* eslint-enable no-console */
}

/* ============================================================================
   END OF FILE
   ============================================================================ */