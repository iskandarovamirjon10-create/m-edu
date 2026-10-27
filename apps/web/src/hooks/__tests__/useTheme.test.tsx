/**
 * @vitest-environment jsdom
 *
 * Unit tests for M-EDU Theme Engine (useTheme)
 * Tests multi-theme support: light, dark, oled, sepia, and system auto-sync.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme } from '../useTheme';

describe('useTheme hook', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.colorScheme = '';

    // Mock matchMedia for system theme
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    localStorage.clear();
  });

  it('initializes with fallback theme when localStorage is empty', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBeDefined();
    expect(['light', 'dark', 'oled', 'sepia', 'system']).toContain(result.current.theme);
  });

  it('updates theme to light and sets DOM attributes accordingly', () => {
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setTheme('light');
    });

    expect(result.current.theme).toBe('light');
    expect(result.current.resolvedTheme).toBe('light');
    expect(result.current.isDark).toBe(false);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('medu-theme')).toBe('light');
  });

  it('updates theme to dark and sets DOM attributes accordingly', () => {
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setTheme('dark');
    });

    expect(result.current.theme).toBe('dark');
    expect(result.current.resolvedTheme).toBe('dark');
    expect(result.current.isDark).toBe(true);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('medu-theme')).toBe('dark');
  });

  it('supports OLED pure black mode with dark active and oled class', () => {
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setTheme('oled');
    });

    expect(result.current.theme).toBe('oled');
    expect(result.current.resolvedTheme).toBe('oled');
    expect(result.current.isDark).toBe(true);
    expect(document.documentElement.getAttribute('data-theme')).toBe('oled');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('oled')).toBe(true);
    expect(localStorage.getItem('medu-theme')).toBe('oled');
  });

  it('supports Apple Books Warm Sepia mode with sepia class and data-theme', () => {
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setTheme('sepia');
    });

    expect(result.current.theme).toBe('sepia');
    expect(result.current.resolvedTheme).toBe('sepia');
    expect(result.current.isDark).toBe(false);
    expect(document.documentElement.getAttribute('data-theme')).toBe('sepia');
    expect(document.documentElement.classList.contains('sepia')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('medu-theme')).toBe('sepia');
  });

  it('supports quick toggleTheme between light and dark', () => {
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setTheme('light');
    });
    expect(result.current.resolvedTheme).toBe('light');

    act(() => {
      result.current.toggleTheme();
    });
    expect(result.current.resolvedTheme).toBe('dark');
    expect(result.current.isDark).toBe(true);

    act(() => {
      result.current.toggleTheme();
    });
    expect(result.current.resolvedTheme).toBe('light');
    expect(result.current.isDark).toBe(false);
  });
});
