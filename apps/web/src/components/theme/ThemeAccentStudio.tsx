/**
 * M-EDU V2 — Spatial Appearance & Accent Studio (`ThemeAccentStudio.tsx`)
 * Visual personalization: Light / Dark / OLED Midnight (#000000), 6 corporate accent palettes,
 * and adjustable liquid glass optical blur densities with zero-delay live preview.
 */

import { useState, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { useToasts } from '@/components/ui';
import { cn } from '@/lib/design';

export type AccentColor = 'blue' | 'emerald' | 'indigo' | 'rose' | 'amber' | 'violet';
export type DisplayTheme = 'light' | 'dark' | 'midnight';
export type GlassDensity = 'ultra' | 'balanced' | 'solid';

const ACCENT_PALETTES: Array<{
  id: AccentColor;
  name: string;
  colorHex: string;
  gradient: string;
}> = [
  { id: 'blue', name: 'Electric Blue', colorHex: '#0071e3', gradient: 'from-[#0071e3] to-[#409cff]' },
  { id: 'emerald', name: 'Cyber Emerald', colorHex: '#10b981', gradient: 'from-[#10b981] to-[#34d399]' },
  { id: 'indigo', name: 'Royal Indigo', colorHex: '#6366f1', gradient: 'from-[#6366f1] to-[#818cf8]' },
  { id: 'rose', name: 'Sunset Rose', colorHex: '#f43f5e', gradient: 'from-[#f43f5e] to-[#fb7185]' },
  { id: 'amber', name: 'Amber Gold', colorHex: '#f59e0b', gradient: 'from-[#f59e0b] to-[#fbbf24]' },
  { id: 'violet', name: 'Neo Violet', colorHex: '#8b5cf6', gradient: 'from-[#8b5cf6] to-[#a78bfa]' },
];

interface ThemeAccentStudioProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ThemeAccentStudio = memo(function ThemeAccentStudio({
  isOpen,
  onClose,
}: ThemeAccentStudioProps) {
  const { push } = useToasts();
  const { playTick, playSuccess } = usePremiumSound();

  const [activeAccent, setActiveAccent] = useState<AccentColor>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('m_edu_accent') as AccentColor) || 'blue';
    }
    return 'blue';
  });

  const [activeTheme, setActiveTheme] = useState<DisplayTheme>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('m_edu_display_theme') as DisplayTheme) || 'dark';
    }
    return 'dark';
  });

  const [glassDensity, setGlassDensity] = useState<GlassDensity>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('m_edu_glass_level') as GlassDensity) || 'ultra';
    }
    return 'ultra';
  });

  const handleSelectAccent = useCallback((accent: AccentColor) => {
    playTick();
    setActiveAccent(accent);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('m_edu_accent', accent);
      } catch {
        // quota safety
      }
      document.documentElement.setAttribute('data-accent', accent);
    }
  }, [playTick]);

  const handleSelectTheme = useCallback((theme: DisplayTheme) => {
    playTick();
    setActiveTheme(theme);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('m_edu_display_theme', theme);
      } catch {
        // quota safety
      }
      if (theme === 'light') {
        document.documentElement.classList.remove('dark', 'oled-midnight');
      } else if (theme === 'dark') {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('oled-midnight');
      } else if (theme === 'midnight') {
        document.documentElement.classList.add('dark', 'oled-midnight');
      }
    }
  }, [playTick]);

  const handleSelectGlass = useCallback((density: GlassDensity) => {
    playTick();
    setGlassDensity(density);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('m_edu_glass_level', density);
      } catch {
        // quota safety
      }
      document.documentElement.setAttribute('data-glass', density);
    }
  }, [playTick]);

  const handleSaveAndClose = useCallback(() => {
    playSuccess();
    push('success', "Tizim ko'rinishi va ranglar palitrasi saqlandi!");
    onClose();
  }, [playSuccess, push, onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
          onClick={onClose}
        >
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.94 }}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'w-full max-w-md max-h-[92dvh] overflow-y-auto rounded-3xl sm:rounded-[2.5rem] border border-white/40 bg-white/85 p-4 sm:p-6 shadow-2xl backdrop-blur-3xl',
            'dark:border-white/15 dark:bg-[#18181b]/95 dark:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85)]',
          )}
          role="dialog"
          aria-modal="true"
          aria-label="Vizual Ko'rinish va Palitra Studiyasi"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-black/[0.06] dark:border-white/[0.08] pb-3.5 mb-5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 text-white text-lg">
                🎨
              </span>
              <div>
                <h3 className="text-base font-extrabold tracking-tight text-[var(--text-primary,#1d1d1f)] dark:text-white">
                  Vizual Ko'rinish & Spatial Palitra
                </h3>
                <p className="text-xs text-[var(--text-secondary,#86868b)]">
                  Apple VisionOS shisha qatlamlari va ranglar gammasi
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1.5 text-neutral-400 hover:bg-black/5 dark:hover:bg-white/10"
            >
              ✕
            </button>
          </div>

          {/* 1. Theme Mode Switcher */}
          <div className="mb-5">
            <span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider block mb-2">
              1. Asosiy Mavzu Rejimi
            </span>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'light', label: 'Yorug\'', icon: '☀️' },
                { id: 'dark', label: 'Qorong\'u', icon: '🌙' },
                { id: 'midnight', label: 'OLED Qora', icon: '🖤' },
              ].map((item) => {
                const isSelected = activeTheme === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectTheme(item.id as DisplayTheme)}
                    className={cn(
                      'flex flex-col items-center justify-center py-2.5 rounded-2xl border text-xs font-bold transition-all',
                      isSelected
                        ? 'border-brand-500/40 bg-brand-500/15 text-brand-600 dark:text-brand-300 shadow-sm'
                        : 'border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] text-[var(--text-secondary)] hover:bg-black/[0.05] dark:hover:bg-white/[0.06]',
                    )}
                  >
                    <span className="text-lg mb-1">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Accent Color Palette */}
          <div className="mb-5">
            <span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider block mb-2">
              2. Korporativ Urg'u Rangi (Accent)
            </span>
            <div className="grid grid-cols-3 gap-2">
              {ACCENT_PALETTES.map((acc) => {
                const isSelected = activeAccent === acc.id;
                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => handleSelectAccent(acc.id)}
                    className={cn(
                      'flex items-center gap-2 p-2 rounded-xl border text-left transition-all',
                      isSelected
                        ? 'border-brand-500 shadow-md bg-black/[0.04] dark:bg-white/[0.08]'
                        : 'border-black/5 dark:border-white/10 bg-transparent hover:bg-black/[0.03] dark:hover:bg-white/[0.04]',
                    )}
                  >
                    <span
                      style={{ backgroundColor: acc.colorHex }}
                      className="h-4 w-4 rounded-full shrink-0 shadow-sm"
                    />
                    <span className="text-xs font-bold truncate text-[var(--text-primary)] dark:text-white">
                      {acc.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Glass Density */}
          <div className="mb-6">
            <span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider block mb-2">
              3. Shisha Qatlami Shaffofligi
            </span>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'ultra', label: 'Muzdek Shisha', desc: 'Yuqori blur' },
                { id: 'balanced', label: 'Muvozanatli', desc: 'Standart' },
                { id: 'solid', label: 'Yuqori Kontrast', desc: 'Minimal blur' },
              ].map((g) => {
                const isSelected = glassDensity === g.id;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => handleSelectGlass(g.id as GlassDensity)}
                    className={cn(
                      'p-2 rounded-xl border text-center transition-all',
                      isSelected
                        ? 'border-brand-500/40 bg-brand-500/15 text-brand-600 dark:text-brand-300 font-bold'
                        : 'border-black/5 dark:border-white/10 text-[var(--text-secondary)]',
                    )}
                  >
                    <span className="text-[11px] block">{g.label}</span>
                    <span className="text-[9px] text-[var(--text-tertiary)]">{g.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Save Action */}
          <button
            type="button"
            onClick={handleSaveAndClose}
            className="w-full min-h-[44px] flex items-center justify-center rounded-2xl bg-brand-600 hover:bg-brand-500 py-3 text-sm font-semibold text-white shadow-lg transition-all active:scale-[0.98]"
          >
            ✓ Sozlamalarni Saqlash
          </button>
        </motion.div>
      </div>
      )}
    </AnimatePresence>,
    document.body
  );
});
