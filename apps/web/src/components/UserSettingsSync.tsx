import { useEffect, useRef } from 'react';
import { useAuthState } from '@/auth/AuthContext';
import { useI18n, isLocale } from '@/i18n/I18nProvider';
import { useTheme } from '@/hooks/useTheme';
import { usePersistSettings } from '@/hooks/usePersistSettings';
import { useDeviceSyncSocket } from '@/hooks/useDeviceSyncSocket';

type Theme = 'light' | 'dark' | 'system';

function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark' || value === 'system';
}

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Reconciles the authenticated user's server-side preferences
 * (`UserSettings.theme` / `.language`) with this browser.
 *
 * Source of truth: the SERVER. `localStorage` is only a device cache so the
 * first paint does not flash the wrong language.
 *
 * Rules
 * -----
 *  1. First time this user is seen on this device:
 *       - no local choice yet  -> adopt the server value,
 *       - a local choice exists-> keep it and PUBLISH it to the server, so the
 *                                  server (and every other device) converges on
 *                                  what the user actually picked here.
 *  2. Afterwards: whenever the server value changes (the user changed it from
 *     another browser/device, or an admin changed it), adopt it here.
 *  3. Changes made in THIS browser are pushed by the control that made them
 *     (`usePersistSettings`), never by an effect watching `locale` — that
 *     avoids mount-order races where an effect pushes a stale default.
 *
 * The component must be mounted once, inside `AuthProvider` (which itself sits
 * inside `ThemeProvider` + `I18nProvider`).
 */
export function UserSettingsSync() {
  useDeviceSyncSocket();
  const { user } = useAuthState();
  const { setLocale, locale } = useI18n();
  const { setTheme, theme } = useTheme();
  const persist = usePersistSettings();

  const userId = user?.id ?? null;
  const serverLanguage = user?.settings?.language ?? null;
  const serverTheme = user?.settings?.theme ?? null;

  const hydratedFor = useRef<string | null>(null);
  const lastServer = useRef<{ language: string | null; theme: string | null }>({
    language: null,
    theme: null,
  });

  useEffect(() => {
    if (!userId) {
      // Signed out (or another user is about to sign in): reset so the next
      // account goes through rule 1 again instead of inheriting this state.
      hydratedFor.current = null;
      lastServer.current = { language: null, theme: null };
      return;
    }

    const first = hydratedFor.current !== userId;
    const previous = lastServer.current;
    const changed = previous.language !== serverLanguage || previous.theme !== serverTheme;
    lastServer.current = { language: serverLanguage, theme: serverTheme };
    if (!first && !changed) return;
    hydratedFor.current = userId;

    const localLanguage = readStorage('medu-lang');
    const localTheme = readStorage('medu-theme');

    if (first) {
      const publish: { language?: string; theme?: string } = {};

      if (localLanguage) {
        if (localLanguage !== serverLanguage) publish.language = localLanguage;
      } else if (serverLanguage && isLocale(serverLanguage) && serverLanguage !== locale) {
        setLocale(serverLanguage);
      }

      if (localTheme) {
        if (localTheme !== serverTheme) publish.theme = localTheme;
      } else if (serverTheme && isTheme(serverTheme) && serverTheme !== theme) {
        setTheme(serverTheme);
      }

      if (publish.language !== undefined || publish.theme !== undefined) {
        lastServer.current = {
          language: publish.language ?? serverLanguage,
          theme: publish.theme ?? serverTheme,
        };
        persist(publish);
      }
      return;
    }

    // The server value moved (another device, or an explicit save): adopt it.
    if (serverLanguage && isLocale(serverLanguage) && serverLanguage !== locale) {
      setLocale(serverLanguage);
    }
    if (serverTheme && isTheme(serverTheme) && serverTheme !== theme) {
      setTheme(serverTheme);
    }
    // `locale`, `theme` and `persist` are deliberately NOT dependencies: this
    // effect must only react to the user/server values, never to the local
    // state it itself writes (that would re-enter and loop).
  }, [userId, serverLanguage, serverTheme]);

  return null;
}
