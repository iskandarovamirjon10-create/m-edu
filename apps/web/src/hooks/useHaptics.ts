import { useCallback } from 'react';

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
      } catch (e) {
        // Ignore failures
      }
    }
  }, []);

  return {
    /** Very light tap for minor interactions (button clicks, keypresses) */
    light: useCallback(() => vibrate(10), [vibrate]),
    
    /** Medium tap for standard actions (opening menus, completing typing) */
    medium: useCallback(() => vibrate(20), [vibrate]),
    
    /** Heavy tap for destructive actions or major state changes */
    heavy: useCallback(() => vibrate(30), [vibrate]),
    
    /** Success sequence (double tap, rising) */
    success: useCallback(() => vibrate([10, 40, 20]), [vibrate]),
    
    /** Error sequence (rapid triple tap) */
    error: useCallback(() => vibrate([20, 30, 20, 30, 20]), [vibrate]),
  };
}
