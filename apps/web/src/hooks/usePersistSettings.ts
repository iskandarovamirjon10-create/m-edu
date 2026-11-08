import { useCallback } from 'react';
import { useOptionalAuthState } from '@/auth/AuthContext';
import { usersApi } from '@/lib/api';

export interface PersistableSettings {
  language?: string;
  theme?: string;
  timezone?: string;
}

/**
 * Publish a preference change to the server so it survives this browser.
 *
 * Preferences are SERVER data (`UserSettings`), not device cache: without this
 * the same Google account would come back from another browser/device with the
 * default language and theme, which is exactly the "state lives in
 * localStorage" failure the persistence audit looks for.
 *
 * Best-effort by design: a failed preference write must never break the UI
 * interaction that triggered it. The local value is already applied; the next
 * successful write (or the Settings page save) reconciles the server row.
 */
export function usePersistSettings() {
  const auth = useOptionalAuthState();
  const userId = auth?.user?.id;

  return useCallback(
    (prefs: PersistableSettings) => {
      if (!userId || !prefs) return;
      if (prefs.language === undefined && prefs.theme === undefined && prefs.timezone === undefined) {
        return;
      }
      void usersApi.updateSettings(userId, prefs).catch(() => {
        // Preference sync is non-critical; the local value stays authoritative
        // for this session and the next successful save reconciles it.
      });
    },
    [userId],
  );
}
