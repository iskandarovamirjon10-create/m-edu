/**
 * Copilot comfort preferences.
 *
 * Persisted per device so the assistant feels identical across sessions:
 *  - density: comfortable (default) or compact for dense desktop work
 *  - reduceMotion: opt-in calmer motion even when the OS allows animation
 *  - sound: micro-feedback on send / confirm
 *
 * All values are read lazily from localStorage and written back on change.
 * The hook is SSR-safe and returns a stable `setPreference` callback.
 */
import { useCallback, useEffect, useState } from 'react';

export type CopilotDensity = 'comfortable' | 'compact';

export interface CopilotPreferences {
  density: CopilotDensity;
  reduceMotion: boolean;
  sound: boolean;
}

const STORAGE_KEY = 'medu:copilot:preferences:v1';

export const DEFAULT_COPILOT_PREFERENCES: CopilotPreferences = {
  density: 'comfortable',
  reduceMotion: false,
  sound: true,
};

function read(): CopilotPreferences {
  if (typeof window === 'undefined') return DEFAULT_COPILOT_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_COPILOT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<CopilotPreferences>;
    return {
      density: parsed.density === 'compact' ? 'compact' : 'comfortable',
      reduceMotion: parsed.reduceMotion === true,
      sound: parsed.sound !== false,
    };
  } catch {
    return DEFAULT_COPILOT_PREFERENCES;
  }
}

/** Class string the Copilot root should carry so CSS can respond to prefs. */
export function copilotComfortClass(prefs: CopilotPreferences): string {
  return [
    prefs.density === 'compact' ? 'cp-density-compact' : 'cp-density-comfortable',
    prefs.reduceMotion ? 'cp-reduce-motion' : '',
  ]
    .filter(Boolean)
    .join(' ');
}

export interface UseCopilotPreferencesResult {
  preferences: CopilotPreferences;
  setPreference: <K extends keyof CopilotPreferences>(
    key: K,
    value: CopilotPreferences[K],
  ) => void;
  reset: () => void;
}

export function useCopilotPreferences(): UseCopilotPreferencesResult {
  const [preferences, setPreferences] = useState<CopilotPreferences>(read);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      /* private mode / quota — preferences stay in-memory */
    }
  }, [preferences]);

  // Keep multiple Copilot mounts (page + global sheet) in sync on this tab.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setPreferences(read());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setPreference = useCallback(
    <K extends keyof CopilotPreferences>(key: K, value: CopilotPreferences[K]) => {
      setPreferences((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  const reset = useCallback(() => setPreferences(DEFAULT_COPILOT_PREFERENCES), []);

  return { preferences, setPreference, reset };
}

export default useCopilotPreferences;
