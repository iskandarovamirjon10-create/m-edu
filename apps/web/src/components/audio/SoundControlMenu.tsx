'use client';

/**
 * ============================================================================
 * Apple Control Center — Sound & Haptic Capsule (v1.0 VisionOS)
 * ============================================================================
 *
 * Micro popover for VisionOS Spatial SoundFX & Taptic engine controls:
 *  • One-touch Mute/Unmute with volume indicator
 *  • Fluid slider for master acoustic gain (0% - 100%)
 *  • Haptic feedback toggle (Taptic engine / navigator.vibrate)
 *  • Test acoustic click & luxury chime preview
 * ============================================================================
 */

import { useState, useRef, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAudioSettings, usePremiumSound } from '@/hooks/usePremiumSound';
import { useHaptics } from '@/hooks/useHaptics';
import { cn } from '@/lib/design';

const POPOVER_SPRING = { type: 'spring' as const, stiffness: 420, damping: 28 };

export const SoundControlMenu = memo(function SoundControlMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { isMuted, volume, haptics, setMuted, setVolume, setHaptics, toggleMute } = useAudioSettings();
  const sound = usePremiumSound();
  const hapticTrigger = useHaptics();

  // Close on outside click or Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleTestChime = () => {
    hapticTrigger.light();
    if (isMuted) {
      setMuted(false);
    }
    sound.play('payment');
  };

  const handleToggleMute = () => {
    hapticTrigger.light();
    toggleMute();
  };

  const handleVolumeStep = (delta: number) => {
    hapticTrigger.light();
    if (isMuted) {
      setMuted(false);
    }
    const next = Math.round(Math.max(0, Math.min(1, volume + delta)) * 100) / 100;
    setVolume(next);
  };

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        onClick={() => {
          hapticTrigger.light();
          setIsOpen((prev) => !prev);
        }}
        aria-label={isMuted ? 'Ovoz o‘chirilgan' : `Ovoz faol (${Math.round(volume * 100)}%)`}
        title={`Ovoz & Taptic Haptics (${isMuted ? 'O‘chirilgan' : Math.round(volume * 100) + '%'})`}
        className={cn(
          'relative flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200 select-none',
          'border border-black/[0.08] dark:border-white/[0.12]',
          isOpen
            ? 'bg-black/[0.1] dark:bg-white/[0.15] text-primary shadow-sm'
            : isMuted
            ? 'bg-black/[0.03] dark:bg-white/[0.04] text-tertiary opacity-70 hover:opacity-100 hover:bg-black/[0.06] dark:hover:bg-white/[0.08]'
            : 'bg-black/[0.04] dark:bg-white/[0.06] text-primary hover:bg-black/[0.08] dark:hover:bg-white/[0.12]'
        )}
      >
        {isMuted || volume === 0 ? (
          // Volume Muted / X Icon (Proper Speaker Mute, NOT Microphone)
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
          </svg>
        ) : volume < 0.5 ? (
          // Volume Low
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          </svg>
        ) : (
          // Volume High
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          </svg>
        )}

        {/* Small live pulse dot if playing / unmuted */}
        {!isMuted && (
          <span className="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-sm" />
        )}
      </button>

      {/* Popover */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={POPOVER_SPRING}
            style={{ transformOrigin: 'top right' }}
            role="dialog"
            aria-label="Ovoz va Haptiklar boshqaruvi"
            className="absolute right-0 top-[calc(100%+0.55rem)] z-50 w-72 rounded-2xl isolate overflow-hidden p-3.5 backdrop-blur-2xl bg-white/80 dark:bg-zinc-900/80 border border-black/[0.08] dark:border-white/[0.12] shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-2.5 border-b border-black/[0.06] dark:border-white/[0.08]">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                  </svg>
                </span>
                <div>
                  <h4 className="text-xs font-bold text-zinc-900 dark:text-white">Spatial Sound & Haptics</h4>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400">Apple VisionOS Acoustic Engine</p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleToggleMute}
                className={cn(
                  'px-2 py-1 rounded-lg text-[11px] font-semibold transition-all',
                  isMuted
                    ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 hover:bg-rose-500/25'
                    : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25'
                )}
              >
                {isMuted ? 'Yoqish' : 'O‘chirish'}
              </button>
            </div>

            {/* Volume Slider Section */}
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-medium text-zinc-700 dark:text-zinc-300">
                <span>Ovoz balandligi</span>
                <span className="font-mono text-[11px] font-bold text-sky-600 dark:text-sky-400">
                  {isMuted ? 'Muted' : `${Math.round(volume * 100)}%`}
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => handleVolumeStep(-0.05)}
                  disabled={volume <= 0 && !isMuted}
                  className="p-1 rounded-md text-zinc-500 hover:text-zinc-900 dark:hover:text-white disabled:opacity-30 transition-colors"
                  aria-label="Pasaytirish"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  </svg>
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => {
                    const next = Math.round(parseFloat(e.target.value) * 100) / 100;
                    if (isMuted) setMuted(false);
                    setVolume(next);
                  }}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-zinc-200 dark:bg-zinc-700 accent-sky-500"
                />
                <button
                  type="button"
                  onClick={() => handleVolumeStep(0.05)}
                  disabled={volume >= 1 && !isMuted}
                  className="p-1 rounded-md text-zinc-500 hover:text-zinc-900 dark:hover:text-white disabled:opacity-30 transition-colors"
                  aria-label="Ko'tarish"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Haptic Toggle Switch */}
            <div className="mt-3 flex items-center justify-between rounded-xl bg-black/[0.03] dark:bg-white/[0.04] p-2.5">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2v20M17 5v14M7 5v14M2 9v6M22 9v6" />
                  </svg>
                </span>
                <div>
                  <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Taptic Haptics</p>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400">Tugma tebranishlari</p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={haptics}
                onClick={() => {
                  hapticTrigger.light();
                  setHaptics(!haptics);
                }}
                className={cn(
                  'relative h-5 w-9 rounded-full transition-colors duration-200 focus:outline-none',
                  haptics ? 'bg-sky-500' : 'bg-zinc-300 dark:bg-zinc-700'
                )}
              >
                <span
                  className={cn(
                    'inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform duration-200 shadow-sm',
                    haptics ? 'translate-x-4' : 'translate-x-1'
                  )}
                />
              </button>
            </div>

            {/* Audio Acoustic Preview Button */}
            <div className="mt-3 pt-2.5 border-t border-black/[0.06] dark:border-white/[0.08]">
              <button
                type="button"
                onClick={handleTestChime}
                className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 py-2 text-xs font-semibold text-sky-600 dark:text-sky-400 transition-colors"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                <span>Sinov ohangi (Apple Pay Chime)</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
