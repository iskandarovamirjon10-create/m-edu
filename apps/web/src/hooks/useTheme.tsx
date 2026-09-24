import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({
  children,
  defaultTheme = 'system',
}: {
  children: React.ReactNode;
  defaultTheme?: Theme;
}) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem('medu-theme') as Theme) || defaultTheme
  );
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const root = window.document.documentElement;

    root.classList.remove('light', 'dark');

    // The design tokens (styles/design-tokens.css) key their dark palette off
    // `.dark` and `[data-theme="dark"]`. Only the `.dark` class used to be
    // applied here, so keep BOTH in sync from this single source of truth —
    // otherwise a component that set `data-theme` on its own would disagree
    // with the rest of the app.
    const applyTheme = (mode: 'light' | 'dark') => {
      root.classList.add(mode);
      root.setAttribute('data-theme', mode);
      setIsDark(mode === 'dark');
    };

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
      applyTheme(systemTheme);
      return;
    }

    applyTheme(theme);
  }, [theme]);

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem('medu-theme', theme);
      setTheme(theme);
    },
    isDark,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

