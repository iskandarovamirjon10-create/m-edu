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

    /** A subtle click/tick for feedback */
    playTick: useCallback(() => {
      playTone(900, 'sine', 0.04, 0.08);
    }, [playTone]),

    /** Authentic Apple Face ID Unlock Match Chime (G5 -> C6 harmonic lift) */
    playFaceIdMatch: useCallback(() => {
      const ctx = getContext();
      if (!ctx) return;
      playTone(784, 'sine', 0.16, 0.14);
      setTimeout(() => playTone(1046.5, 'sine', 0.35, 0.16), 90);
    }, [playTone, getContext]),

    /** Biometric Access Denied / Spoof Warning Tone */
    playFaceIdDenied: useCallback(() => {
      const ctx = getContext();
      if (!ctx) return;
      playTone(220, 'sawtooth', 0.15, 0.12);
      setTimeout(() => playTone(164.8, 'sawtooth', 0.28, 0.14), 110);
    }, [playTone, getContext]),

    /** Polite Mellow Double Chime for Duplicate Attendance Already Recorded */
    playFaceIdDuplicate: useCallback(() => {
      const ctx = getContext();
      if (!ctx) return;
      playTone(523.25, 'sine', 0.12, 0.1);
      setTimeout(() => playTone(659.25, 'sine', 0.2, 0.1), 80);
    }, [playTone, getContext]),

    /** High-tech sweep frequency tick for frame sampling radar */
    playLaserScan: useCallback(() => {
      playTone(1200, 'sine', 0.03, 0.05);
    }, [playTone]),
  };
}

