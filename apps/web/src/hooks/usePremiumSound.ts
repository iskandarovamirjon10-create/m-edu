import { useCallback, useRef } from 'react';

/**
 * Premium Sound Engine using Web Audio API.
 * Generates Apple-like premium UI sound effects programmatically without requiring audio files.
 */
export function usePremiumSound() {
  const audioCtxRef = useRef<AudioContext | null>(null);

  const getContext = useCallback(() => {
    if (typeof window === 'undefined') return null;
    if (!audioCtxRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioCtxRef.current = new AudioContextClass();
      }
    }
    return audioCtxRef.current;
  }, []);

  const playTone = useCallback(
    (frequency: number, type: OscillatorType, duration: number, vol = 0.1) => {
      const ctx = getContext();
      if (!ctx) return;

      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);

      // Envelope: instant attack, exponential release
      gainNode.gain.setValueAtTime(vol, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    },
    [getContext]
  );

  return {
    /** A satisfying 'pop' for opening elements, toggles, or sending messages */
    playPop: useCallback(() => {
      playTone(400, 'sine', 0.1, 0.15);
    }, [playTone]),

    /** A gentle ascending chime for success or task completion */
    playSuccess: useCallback(() => {
      const ctx = getContext();
      if (!ctx) return;
      playTone(600, 'sine', 0.15, 0.1);
      setTimeout(() => playTone(800, 'sine', 0.3, 0.1), 100);
    }, [playTone, getContext]),

    /** A soft, low 'thud' for errors */
    playError: useCallback(() => {
      const ctx = getContext();
      if (!ctx) return;
      playTone(300, 'triangle', 0.2, 0.2);
      setTimeout(() => playTone(250, 'triangle', 0.3, 0.2), 150);
    }, [playTone, getContext]),
  };
}
