/**
 * ============================================================================
 * Liquid Glass Studio — Apple visionOS & macOS Sequoia Optics Engine
 * ============================================================================
 *
 * Provides real-time customization of:
 *  - Shaffoflik / Opacity (35% - 98%)
 *  - Xiralik / Blur (6px - 40px)
 *  - Optik Saturatsiya / Saturation (120% - 220%)
 *  - Nur Qirrasi / Specular Rim Highlight (10% - 70%)
 *  - Refraction Index (0px - 3px)
 *
 * Updates CSS variables dynamically on :root:
 *  --liquid-glass-opacity
 *  --liquid-glass-blur
 *  --liquid-glass-saturate
 *  --liquid-glass-specular
 *  --liquid-glass-refraction
 *
 * Persists in localStorage ('m-edu.liquid-glass-optics').
 * ============================================================================
 */

import { memo, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { SPRING } from '@/layouts/core/tokens';

export interface LiquidGlassOptics {
  opacity: number;      // 0.35 - 0.98
  blur: number;         // 6 - 40 (px)
  saturate: number;     // 120 - 220 (%)
  specular: number;     // 0.10 - 0.70
  refraction: number;   // 0.0 - 3.0 (px)
}

export const DEFAULT_OPTICS: LiquidGlassOptics = {
  opacity: 0.82,
  blur: 20,
  saturate: 160,
  specular: 0.35,
  refraction: 1.2,
};

export const GLASS_PRESETS: {
  id: string;
  name: string;
  nameUz: string;
  description: string;
  icon: string;
  optics: LiquidGlassOptics;
}[] = [
  {
    id: 'crystal',
    name: 'Crystal Frosted',
    nameUz: 'Yupqa Kristal',
    description: 'Engil shaffof va ochiq nurli shisha qatlami',
    icon: '🫧',
    optics: {
      opacity: 0.52,
      blur: 14,
      saturate: 175,
      specular: 0.55,
      refraction: 1.5,
    },
  },
  {
    id: 'apple-default',
    name: 'Liquid Glass (Apple)',
    nameUz: 'Liquid Shisha',
    description: 'macOS Sequoia & iOS 18 mezonidagi ideal balans',
    icon: '💧',
    optics: DEFAULT_OPTICS,
  },
  {
    id: 'visionos',
    name: 'VisionOS Immersion',
    nameUz: 'VisionOS Immersiya',
    description: 'Chuqur diffuziya va boyitilgan rang saturatsiyasi',
    icon: '🌌',
    optics: {
      opacity: 0.74,
      blur: 32,
      saturate: 200,
      specular: 0.45,
      refraction: 2.0,
    },
  },
  {
    id: 'solid-pro',
    name: 'Studio Solid',
    nameUz: 'Studio Mat Kontrast',
    description: 'Yuqori kontrastli qattiq studio yuzasi',
    icon: '🧊',
    optics: {
      opacity: 0.96,
      blur: 36,
      saturate: 130,
      specular: 0.20,
      refraction: 0.8,
    },
  },
];

const STORAGE_KEY = 'm-edu.liquid-glass-optics';

export function applyOpticsToDOM(optics: LiquidGlassOptics) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.setProperty('--liquid-glass-opacity', String(optics.opacity));
  root.style.setProperty('--liquid-glass-blur', `${optics.blur}px`);
  root.style.setProperty('--liquid-glass-saturate', `${optics.saturate}%`);
  root.style.setProperty('--liquid-glass-specular', String(optics.specular));
  root.style.setProperty('--liquid-glass-refraction', `${optics.refraction}px`);
}

export function loadSavedOptics(): LiquidGlassOptics {
  if (typeof window === 'undefined') return DEFAULT_OPTICS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_OPTICS, ...parsed };
    }
  } catch {
    // fallback
  }
  return DEFAULT_OPTICS;
}

export function openLiquidGlassStudio() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('open-liquid-glass-studio'));
  }
}

export const LiquidGlassStudio = memo(function LiquidGlassStudio() {
  const [isOpen, setIsOpen] = useState(false);
  const [optics, setOptics] = useState<LiquidGlassOptics>(loadSavedOptics);
  const { playTick, playPop, playSuccess } = usePremiumSound();

  // Initialize on mount
  useEffect(() => {
    const initial = loadSavedOptics();
    applyOpticsToDOM(initial);

    const handleOpen = () => {
      setIsOpen(true);
      playPop();
    };

    window.addEventListener('open-liquid-glass-studio', handleOpen);
    return () => window.removeEventListener('open-liquid-glass-studio', handleOpen);
  }, [playPop]);

  const updateOptic = useCallback(
    <K extends keyof LiquidGlassOptics>(key: K, value: LiquidGlassOptics[K]) => {
      setOptics((prev) => {
        const next = { ...prev, [key]: value };
        applyOpticsToDOM(next);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
      playTick();
    },
    [playTick]
  );

  const handleApplyPreset = useCallback(
    (preset: LiquidGlassOptics) => {
      setOptics(preset);
      applyOpticsToDOM(preset);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(preset));
      } catch {
        // ignore
      }
      playSuccess();
    },
    [playSuccess]
  );

  const handleReset = useCallback(() => {
    setOptics(DEFAULT_OPTICS);
    applyOpticsToDOM(DEFAULT_OPTICS);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    playPop();
  }, [playPop]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setIsOpen(false);
              playPop();
            }}
            className="fixed inset-0 bg-black/45 backdrop-blur-md"
          />

          {/* Modal Panel */}
          <motion.div
            layout
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={SPRING.smooth}
            className="relative z-10 w-full max-w-lg overflow-hidden rounded-[2rem] border border-white/20 bg-white/90 p-6 shadow-2xl backdrop-blur-3xl dark:border-white/10 dark:bg-zinc-900/90 dark:text-white"
            style={{
              WebkitBackdropFilter: 'blur(36px) saturate(180%)',
            }}
          >
            {/* Top specular hairline */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent"
            />

            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-black/5 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-lg shadow-sm text-white">
                  💧
                </span>
                <div>
                  <h3 className="text-base font-bold tracking-tight">
                    Liquid Glass Optics Engine
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Apple visionOS & Sequoia shisha optikasini moslashtirish
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  playPop();
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-200/60 text-neutral-600 transition-colors hover:bg-neutral-300 dark:bg-white/10 dark:text-white/80 dark:hover:bg-white/20"
                aria-label="Yopish"
              >
                ✕
              </button>
            </div>

            {/* Interactive Live Preview Box */}
            <div className="relative my-4 overflow-hidden rounded-2xl border border-black/10 p-4 dark:border-white/10">
              {/* Colorful preview background pattern */}
              <div className="absolute inset-0 bg-gradient-to-tr from-blue-500 via-purple-500 to-amber-400 opacity-80" />
              <div className="absolute -bottom-8 -right-8 h-32 w-32 rounded-full bg-pink-500 blur-xl opacity-70" />

              {/* Foreground Liquid Glass Sample */}
              <div
                className="relative z-10 flex items-center justify-between rounded-xl border border-white/30 p-3.5 shadow-lg"
                style={{
                  background: `rgba(255, 255, 255, ${optics.opacity * 0.85})`,
                  backdropFilter: `blur(${optics.blur}px) saturate(${optics.saturate}%)`,
                  WebkitBackdropFilter: `blur(${optics.blur}px) saturate(${optics.saturate}%)`,
                  boxShadow: `0 8px 32px 0 rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, ${optics.specular})`,
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white font-bold shadow-md">
                    M
                  </div>
                  <div>
                    <div className="text-xs font-bold text-neutral-900">
                      Jonli Shisha Namunasi
                    </div>
                    <div className="text-[11px] font-medium text-neutral-700">
                      Shaffoflik: {Math.round(optics.opacity * 100)}% · Xiralik: {optics.blur}px · Rang: {optics.saturate}%
                    </div>
                  </div>
                </div>
                <span className="rounded-full bg-black/10 px-2.5 py-1 text-[10px] font-bold text-neutral-900">
                  Real-vaqt
                </span>
              </div>
            </div>

            {/* Preset Selector */}
            <div className="mb-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Optik Rejimlar (Presets)
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {GLASS_PRESETS.map((p) => {
                  const isActive =
                    optics.opacity === p.optics.opacity &&
                    optics.blur === p.optics.blur &&
                    optics.saturate === p.optics.saturate;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleApplyPreset(p.optics)}
                      className={`flex flex-col items-center justify-center gap-1 rounded-2xl border p-2.5 text-center transition-all ${
                        isActive
                          ? 'border-blue-500 bg-blue-500/15 shadow-sm dark:bg-blue-500/25'
                          : 'border-black/5 bg-neutral-100/60 hover:bg-neutral-200/60 dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]'
                      }`}
                    >
                      <span className="text-lg">{p.icon}</span>
                      <span className="text-[11px] font-bold leading-tight">
                        {p.nameUz}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sliders Area */}
            <div className="space-y-3.5 rounded-2xl border border-black/5 bg-neutral-50/70 p-3.5 dark:border-white/5 dark:bg-white/[0.02]">
              {/* Opacity Slider */}
              <div>
                <div className="flex items-center justify-between text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  <span>Shaffoflik (Opacity)</span>
                  <span className="font-mono text-[11px] font-bold text-blue-500">
                    {Math.round(optics.opacity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.35"
                  max="0.98"
                  step="0.01"
                  value={optics.opacity}
                  onChange={(e) => updateOptic('opacity', parseFloat(e.target.value))}
                  className="w-full accent-blue-600"
                />
              </div>

              {/* Blur Radius Slider */}
              <div>
                <div className="flex items-center justify-between text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  <span>Diffuziya / Xiralik (Blur)</span>
                  <span className="font-mono text-[11px] font-bold text-blue-500">
                    {optics.blur}px
                  </span>
                </div>
                <input
                  type="range"
                  min="6"
                  max="40"
                  step="1"
                  value={optics.blur}
                  onChange={(e) => updateOptic('blur', parseInt(e.target.value, 10))}
                  className="w-full accent-blue-600"
                />
              </div>

              {/* Saturation Slider */}
              <div>
                <div className="flex items-center justify-between text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  <span>Rang Boyligi (Saturate)</span>
                  <span className="font-mono text-[11px] font-bold text-blue-500">
                    {optics.saturate}%
                  </span>
                </div>
                <input
                  type="range"
                  min="120"
                  max="220"
                  step="5"
                  value={optics.saturate}
                  onChange={(e) => updateOptic('saturate', parseInt(e.target.value, 10))}
                  className="w-full accent-blue-600"
                />
              </div>

              {/* Specular Rim Slider */}
              <div>
                <div className="flex items-center justify-between text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  <span>Nur Qirrasi (Specular Rim)</span>
                  <span className="font-mono text-[11px] font-bold text-blue-500">
                    {Math.round(optics.specular * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.10"
                  max="0.70"
                  step="0.05"
                  value={optics.specular}
                  onChange={(e) => updateOptic('specular', parseFloat(e.target.value))}
                  className="w-full accent-blue-600"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="mt-4 flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handleReset}
                className="text-xs font-medium text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-white"
              >
                ↺ Standart holatga qaytarish
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  playSuccess();
                }}
                className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md transition-all hover:bg-blue-700 active:scale-95"
              >
                Tayyor
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
});
