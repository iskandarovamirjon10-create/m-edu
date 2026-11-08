import { useCallback, useMemo } from 'react';

/**
 * Premium Haptic Engine
 * Provides Apple-like haptic feedback for web interactions on supported devices (Android).
 * iOS Safari does not support navigator.vibrate, so this degrades gracefully.
 */
export function useHaptics() {
  const vibrate = useCallback((pattern: number | number[]) => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Ignore failures
      }
    }
  }, []);

  return useMemo(
    () => ({
      /** Very light tap for minor interactions (button clicks, keypresses) */
      light: () => vibrate(10),

      /** Medium tap for standard actions (opening menus, completing typing) */
      medium: () => vibrate(20),

      /** Heavy tap for destructive actions or major state changes */
      heavy: () => vibrate(30),

      /** Success sequence (double tap, rising) */
      success: () => vibrate([10, 40, 20]),

      /** Error sequence (rapid triple tap) */
      error: () => vibrate([20, 30, 20, 30, 20]),
    }),
    [vibrate],
  );
}
