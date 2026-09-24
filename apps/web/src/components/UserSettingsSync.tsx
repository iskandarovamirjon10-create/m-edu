import { useEffect, useRef} from'react';
import { useAuthState} from'@/auth/AuthContext';
import { useI18n, isLocale} from'@/i18n/I18nProvider';

type Theme ='light' |'dark' |'system';

function isTheme(value: unknown): value is Theme {
 return value ==='light' || value ==='dark' || value ==='system';
}

/** Apply a theme to <html> (class + data-theme), matching Settings' logic. */
function applyTheme(theme: Theme) {
 const root = document.documentElement;
 if (theme ==='dark') {
 root.classList.add('dark');
 root.setAttribute('data-theme','dark');
} else if (theme ==='light') {
 root.classList.remove('dark');
 root.setAttribute('data-theme','light');
} else {
 const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
 if (prefersDark) {
 root.classList.add('dark');
 root.setAttribute('data-theme','dark');
} else {
 root.classList.remove('dark');
 root.setAttribute('data-theme','light');
}
}
}

function readStorage(key: string): string | null {
 try {
 return localStorage.getItem(key);
} catch {
 return null;
}
}

/**
 * Syncs the authenticated user's persisted preferences (theme + language)
 * into the browser.
 *
 * IMPORTANT — "local preference wins"rule:
 * The server row always contains a value (the column defaults are
 * `theme ='light'`, `language ='en'`), so a default cannot be distinguished
 * from a deliberate choice. Applying it unconditionally overwrote the
 * browser-persisted preference on every login/mount and made the interface
 * snap back to English / light. We therefore only adopt the server value when
 * the browser has no explicit preference yet (fresh device / cleared storage).
 * Once the user picks a value locally, local storage is authoritative for this
 * browser and is never clobbered by the server default.
 */
export function UserSettingsSync() {
 const { user} = useAuthState();
 const { setLocale, locale} = useI18n();
 const prevUserTheme = useRef<string | null>(null);
 const prevUserLanguage = useRef<string | null>(null);

 useEffect(() => {
 if (!user?.settings) return;

 // ── Theme ────────────────────────────────────────────────────────────
 const userTheme = user.settings.theme;
 const storedTheme = readStorage('medu-theme');
 if (
 userTheme &&
 userTheme !== prevUserTheme.current &&
 !storedTheme &&
 isTheme(userTheme)
 ) {
 prevUserTheme.current = userTheme;
 try {
 localStorage.setItem('medu-theme', userTheme);
} catch {
 /* storage unavailable — in-memory only */
}
 applyTheme(userTheme);
}

 // ── Language ─────────────────────────────────────────────────────────
 const userLanguage = user.settings.language;
 const storedLocale = readStorage('medu-lang');
 if (
 userLanguage &&
 userLanguage !== prevUserLanguage.current &&
 !storedLocale &&
 userLanguage !== locale &&
 isLocale(userLanguage)
 ) {
 prevUserLanguage.current = userLanguage;
 setLocale(userLanguage);
}
}, [user?.settings, setLocale, locale]);

 return null;
}
