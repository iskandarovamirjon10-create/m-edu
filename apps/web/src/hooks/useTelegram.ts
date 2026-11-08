import { useCallback, useSyncExternalStore } from 'react';
import type { TelegramUser, TelegramWebApp } from '@/types/telegram';

// ============================================================================
// 1. CONSTANTS & TYPES
// ============================================================================

export type HapticStyle =
  | 'light'
  | 'medium'
  | 'heavy'
  | 'rigid'
  | 'soft'
  | 'success'
  | 'warning'
  | 'error'
  | 'selection'
  | (string & {});

export const TG_SDK_SRC = 'https://telegram.org/js/telegram-web-app.js';
export const SUPPORT_TG = 'https://t.me/medu_admin';

const SDK_LOAD_TIMEOUT_MS = 3000;
const LIGHT_MEDIA_QUERY = '(prefers-color-scheme: light)';

// Kengaytirilgan TelegramWebApp interfeysi (TMA 7.7+ / 8.0 metodlari bilan)
type ExtendedTelegramWebApp = TelegramWebApp & {
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  setBottomBarColor?: (color: string) => void;
  openLink?: (url: string, options?: { try_instant_view?: boolean }) => void;
};

interface TelegramWindow {
  Telegram?: {
    WebApp?: ExtendedTelegramWebApp;
  };
}

export interface TelegramStateSnapshot {
  readonly tg: ExtendedTelegramWebApp | null;
  readonly user: TelegramUser | null;
  readonly inTelegram: boolean;
  readonly isReady: boolean;
  readonly colorScheme: 'light' | 'dark';
  readonly platform: string;
}

// ============================================================================
// 2. SINGLETON TELEGRAM MINI APP ENGINE (Zero Polling, Zero Duplicate Init)
// ============================================================================

const listeners = new Set<() => void>();
let isEngineBootstrapped = false;
let sdkLoadPromise: Promise<ExtendedTelegramWebApp | null> | null = null;

function getSystemColorScheme(): 'light' | 'dark' {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'dark';
  }
  return window.matchMedia(LIGHT_MEDIA_QUERY).matches ? 'light' : 'dark';
}

const SERVER_SNAPSHOT: TelegramStateSnapshot = Object.freeze({
  tg: null,
  user: null,
  inTelegram: false,
  isReady: false,
  colorScheme: 'dark',
  platform: 'unknown',
});

let currentSnapshot: TelegramStateSnapshot = SERVER_SNAPSHOT;

function emitChange(): void {
  listeners.forEach((listener) => listener());
}

function updateSnapshot(partial: Partial<TelegramStateSnapshot>): void {
  const next: TelegramStateSnapshot = Object.freeze({
    ...currentSnapshot,
    ...partial,
  });

  // Faqat haqiqiy o'zgarish bo'lgandagina React komponentlarini uyg'otamiz
  if (
    next.tg !== currentSnapshot.tg ||
    next.user !== currentSnapshot.user ||
    next.inTelegram !== currentSnapshot.inTelegram ||
    next.isReady !== currentSnapshot.isReady ||
    next.colorScheme !== currentSnapshot.colorScheme ||
    next.platform !== currentSnapshot.platform
  ) {
    currentSnapshot = next;
    emitChange();
  }
}

/**
 * Telegram WebApp haqiqatan ham Telegram ichida ochilganini tekshiradi.
 * (Oddiy brauzerda ham window.Telegram.WebApp obyekti bo'ladi, lekin initData bo'sh bo'ladi)
 */
function detectIsRealTelegram(sdk: ExtendedTelegramWebApp): boolean {
  if (sdk.initData && sdk.initData.length > 0) return true;
  if (sdk.initDataUnsafe?.user?.id) return true;
  if (sdk.platform && sdk.platform !== 'unknown') return true;
  if (typeof window !== 'undefined' && window.location.hash.includes('tgWebAppData')) {
    return true;
  }
  return false;
}

/**
 * Telegram Native UI ranglarini ilova temasi bilan uyg'unlashtirish
 */
function syncTelegramNativeColors(sdk: ExtendedTelegramWebApp, scheme: 'light' | 'dark'): void {
  try {
    if ( typeof sdk.isVersionAtLeast === 'function' && !sdk.isVersionAtLeast('6.1')) {
      return;
    }
    const bgHex = scheme === 'dark' ? '#090d16' : '#f8fafc';
    sdk.setHeaderColor?.(bgHex);
    sdk.setBackgroundColor?.(bgHex);
    sdk.setBottomBarColor?.(bgHex);
  } catch {
    // Ignore on older clients
  }
}

/**
 * SDK obyektini 1 marta sozlash (Deadlock va Duplicate Listener'siz)
 */
function configureTelegramSDK(sdk: ExtendedTelegramWebApp): void {
  const isRealTg = detectIsRealTelegram(sdk);

  if (isRealTg) {
    try {
      sdk.ready?.();
      sdk.expand?.();

      // TMA 7.7+: Pastga surib yopib yuborishni (accidental swipe close) bloklash
      if (typeof sdk.isVersionAtLeast === 'function' && sdk.isVersionAtLeast('7.7')) {
        sdk.disableVerticalSwipes?.();
      }
    } catch {
      // Ignore legacy WebApp errors
    }
  }

  const activeScheme: 'light' | 'dark' = isRealTg && sdk.colorScheme
    ? sdk.colorScheme
    : getSystemColorScheme();

  if (isRealTg) {
    syncTelegramNativeColors(sdk, activeScheme);

    const handleThemeChanged = () => {
      const nextScheme: 'light' | 'dark' = sdk.colorScheme || getSystemColorScheme();
      syncTelegramNativeColors(sdk, nextScheme);
      updateSnapshot({ colorScheme: nextScheme });
    };

    sdk.onEvent?.('themeChanged', handleThemeChanged);
  }

  updateSnapshot({
    tg: sdk,
    user: sdk.initDataUnsafe?.user ?? null,
    inTelegram: isRealTg,
    isReady: true,
    colorScheme: activeScheme,
    platform: sdk.platform ?? 'unknown',
  });
}

/**
 * Skriptni setInterval polling'siz, toza Event-Driven Promise orqali yuklash
 */
function loadTelegramScriptOnce(): Promise<ExtendedTelegramWebApp | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);

  const win = window as unknown as TelegramWindow;
  if (win.Telegram?.WebApp) {
    return Promise.resolve(win.Telegram.WebApp);
  }

  if (sdkLoadPromise) return sdkLoadPromise;

  sdkLoadPromise = new Promise<ExtendedTelegramWebApp | null>((resolve) => {
    let settled = false;
    const finish = (sdk: ExtendedTelegramWebApp | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(sdk);
    };

    const timer = window.setTimeout(() => {
      finish((window as unknown as TelegramWindow).Telegram?.WebApp ?? null);
    }, SDK_LOAD_TIMEOUT_MS);

    let script = document.querySelector<HTMLScriptElement>(`script[src="${TG_SDK_SRC}"]`);

    const onLoad = () => {
      finish((window as unknown as TelegramWindow).Telegram?.WebApp ?? null);
    };

    const onError = () => {
      finish(null);
    };

    if (!script) {
      script = document.createElement('script');
      script.src = TG_SDK_SRC;
      script.async = true;
      script.addEventListener('load', onLoad, { once: true });
      script.addEventListener('error', onError, { once: true });
      document.head.appendChild(script);
    } else {
      script.addEventListener('load', onLoad, { once: true });
      script.addEventListener('error', onError, { once: true });
    }
  });

  return sdkLoadPromise;
}

function bootstrapTelegramEngine(): void {
  if (isEngineBootstrapped || typeof window === 'undefined') return;
  isEngineBootstrapped = true;

  // Ilk OS colorScheme holatini o'rnatamiz
  currentSnapshot = Object.freeze({
    ...currentSnapshot,
    colorScheme: getSystemColorScheme(),
  });

  // Oddiy brauzerda OS temasi o'zgarsa (Telegramdan tashqarida bo'lganda) kuzatib boramiz
  if (typeof window.matchMedia === 'function') {
    const mq = window.matchMedia(LIGHT_MEDIA_QUERY);
    const onSystemThemeChange = (e: MediaQueryListEvent) => {
      if (!currentSnapshot.inTelegram) {
        updateSnapshot({ colorScheme: e.matches ? 'light' : 'dark' });
      }
    };
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', onSystemThemeChange);
    }
  }

  const existingSdk = (window as unknown as TelegramWindow).Telegram?.WebApp;
  if (existingSdk) {
    configureTelegramSDK(existingSdk);
    return;
  }

  void loadTelegramScriptOnce().then((sdk) => {
    if (sdk) {
      configureTelegramSDK(sdk);
    } else {
      updateSnapshot({ isReady: true });
    }
  });
}

function subscribeTelegramStore(listener: () => void): () => void {
  bootstrapTelegramEngine();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getClientSnapshot(): TelegramStateSnapshot {
  bootstrapTelegramEngine();
  return currentSnapshot;
}

function getServerSnapshot(): TelegramStateSnapshot {
  return SERVER_SNAPSHOT;
}

// ============================================================================
// 3. REACT HOOK (Zero Cascade Renders, Full Taptic & Web Fallback)
// ============================================================================

export function useTelegram() {
  const state = useSyncExternalStore(
    subscribeTelegramStore,
    getClientSnapshot,
    getServerSnapshot,
  );

  /**
   * Apple Taptic Engine + Web Vibration Fallback.
   * Telegram ichida native HapticFeedback, oddiy mobil brauzerda navigator.vibrate ishlaydi.
   */
  const haptic = useCallback((style: HapticStyle = 'light') => {
    try {
      const s = String(style);
      const sdk = currentSnapshot.tg;
      const hf = sdk?.HapticFeedback;

      if (currentSnapshot.inTelegram && hf) {
        if (s === 'selection') {
          hf.selectionChanged?.();
          return;
        }
        if (s === 'success' || s === 'celebration') {
          hf.notificationOccurred?.('success');
          return;
        }
        if (s === 'warning' || s === 'notificationWarning') {
          hf.notificationOccurred?.('warning');
          return;
        }
        if (s === 'error' || s === 'notificationError') {
          hf.notificationOccurred?.('error');
          return;
        }
        const impact =
          s === 'heavy' || s === 'rigid' ? 'heavy'
          : s === 'medium' || s === 'impactMedium' ? 'medium'
          : s === 'soft' ? 'soft'
          : 'light';
        hf.impactOccurred?.(impact);
        return;
      }

      // Web Browser Fallback (Android Chrome / PWA)
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        const pattern =
          s === 'selection' ? 5
          : s === 'light' || s === 'soft' || s === 'impactLight' ? 10
          : s === 'medium' || s === 'impactMedium' ? 18
          : s === 'heavy' || s === 'rigid' ? 28
          : s === 'success' || s === 'celebration' ? [12, 50, 18]
          : s === 'warning' || s === 'notificationWarning' ? [20, 60, 20]
          : [30, 50, 30, 50, 40]; // error
        navigator.vibrate(pattern);
      }
    } catch {
      // Safe fallback
    }
  }, []);

  /**
   * Telegram linklarni xavfsiz ochish (`t.me/...`).
   * Faqat haqiqiy Telegram ichida `openTelegramLink` ishlatiladi, aks holda yangi tab ochadi.
   */
  const openTelegramLink = useCallback((url: string) => {
    const sdk = currentSnapshot.tg;
    if (currentSnapshot.inTelegram && sdk?.openTelegramLink && url.startsWith('https://t.me/')) {
      try {
        sdk.openTelegramLink(url);
        return;
      } catch {
        // Fallback to window.open
      }
    }
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }, []);

  const contactAdmin = useCallback(() => {
    openTelegramLink(SUPPORT_TG);
  }, [openTelegramLink]);

  return {
    tg: state.tg,
    user: state.user,
    inTelegram: state.inTelegram,
    isReady: state.isReady,
    colorScheme: state.colorScheme,
    platform: state.platform,
    haptic,
    contactAdmin,
    openTelegramLink,
  };
}