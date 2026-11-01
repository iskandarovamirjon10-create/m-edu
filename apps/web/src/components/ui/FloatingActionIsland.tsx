/**
 * ============================================================================
 *  FloatingActionIsland — Apple macOS Sequoia & Linear Caliber Batch Island
 * ============================================================================
 *
 *  Appears with physics-accurate spring motion when multiple items are selected.
 *  Features:
 *   • Specular 0.5px hairline highlights & high-index backdrop-blur
 *   • Live item counter with clear action (Esc shortcut indicator)
 *   • Action buttons with tactile hover/press states
 *   • Full dark mode & high-contrast accessibility
 * ============================================================================
 */

import React, { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SPRING } from '@/layouts/core/tokens';
import { usePremiumSound } from '@/hooks/usePremiumSound';

export interface FloatingActionItem {
  id?: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void | Promise<void>;
  variant?: 'default' | 'primary' | 'danger' | 'destructive';
  shortcut?: string;
  shortcutBadge?: string;
  disabled?: boolean;
}

export interface FloatingActionIslandProps {
  selectedCount: number;
  onClear?: () => void;
  onClearSelection?: () => void;
  actions: FloatingActionItem[];
  itemLabel?: string; // e.g. "talaba", "to'lov", "yozuv"
  entityName?: string;
  preview?: React.ReactNode;
}

export const FloatingActionIsland = memo(function FloatingActionIsland({
  selectedCount,
  onClear,
  onClearSelection,
  actions,
  itemLabel,
  entityName,
  preview,
}: FloatingActionIslandProps) {
  const { playPop } = usePremiumSound();
  const handleClear = onClear ?? onClearSelection ?? (() => {});
  const displayLabel = entityName ?? itemLabel ?? 'ta element';

  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div
          role="toolbar"
          aria-label="Ommaviy amallar paneli"
          initial={{ y: 60, opacity: 0, scale: 0.92, filter: 'blur(8px)' }}
          animate={{ y: 0, opacity: 1, scale: 1, filter: 'blur(0px)' }}
          exit={{ y: 50, opacity: 0, scale: 0.94, filter: 'blur(6px)' }}
          transition={SPRING.snappy}
          className="fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))] md:bottom-7 left-1/2 z-50 -translate-x-1/2 w-[calc(100vw-1.25rem)] sm:w-auto max-w-[32rem] sm:max-w-none"
        >
          {/* Glass Shell */}
          <div
            className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2 rounded-2xl border border-slate-300/80 bg-white/95 p-2 sm:p-1.5 shadow-[0_0_0_1px_rgba(255,255,255,0.8)_inset,0_16px_45px_-10px_rgba(15,23,42,0.22)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#0B0F19]/95 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08)_inset,0_20px_50px_-10px_rgba(0,0,0,0.7)]"
            style={{
              WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            }}
          >
            {/* Counter Badge & Clear trigger */}
            <div className="flex shrink-0 items-center justify-between sm:justify-start gap-1.5 sm:gap-2 border-b sm:border-b-0 sm:border-r border-slate-200/80 pb-1.5 sm:pb-0 px-2 sm:px-3 sm:py-1.5 dark:border-white/10">
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-600 px-1.5 text-[11px] font-bold tabular-nums text-white shadow-sm dark:bg-blue-500">
                  {selectedCount}
                </span>
                <span className="truncate text-[12px] sm:text-[12.5px] font-semibold text-slate-800 dark:text-slate-200">
                  {displayLabel} tanlandi
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  playPop();
                  handleClear();
                }}
                title="Tanlovni bekor qilish (Esc)"
                aria-label="Tanlovni bekor qilish"
                className="ml-1 flex h-7 w-7 sm:h-5 sm:w-5 min-h-[36px] min-w-[36px] sm:min-h-[20px] sm:min-w-[20px] items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-200/60 hover:text-slate-700 active:scale-95 dark:hover:bg-white/10 dark:hover:text-slate-200"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Preview Strip (if provided) */}
            {preview && (
              <div className="hidden sm:flex shrink-0 items-center border-r border-slate-200/80 px-2 py-0.5 dark:border-white/10">
                {preview}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex w-full sm:w-auto items-center gap-1.5 sm:gap-1.5 pl-0 sm:pl-1 overflow-x-auto scrollbar-none">
              {actions.map((act, index) => {
                const actId = act.id ?? `island-act-${index}-${act.label}`;
                const isPrimary = act.variant === 'primary';
                const isDanger = act.variant === 'danger' || act.variant === 'destructive';

                return (
                  <motion.button
                    key={actId}
                    type="button"
                    disabled={act.disabled}
                    onClick={() => {
                      playPop();
                      void act.onClick();
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.96 }}
                    transition={SPRING.snappy}
                    className={`flex min-h-[40px] sm:min-h-[34px] flex-1 sm:flex-initial items-center justify-center gap-1.5 rounded-xl px-3 sm:px-3 py-1.5 text-[12px] sm:text-[12.5px] font-semibold whitespace-nowrap transition-all disabled:opacity-40 ${
                      isPrimary
                        ? 'bg-blue-600 text-white shadow-[0_2px_8px_-1px_rgba(37,99,235,0.4)] hover:bg-blue-700 active:bg-blue-800 dark:bg-blue-500 dark:hover:bg-blue-600'
                        : isDanger
                        ? 'bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 active:bg-rose-500/25 dark:bg-rose-500/15 dark:text-rose-400'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80 active:bg-slate-300 dark:bg-white/[0.08] dark:text-slate-200 dark:hover:bg-white/[0.14]'
                    }`}
                  >
                    {act.icon && <span className="shrink-0">{act.icon}</span>}
                    <span className="truncate">{act.label}</span>
                    {(act.shortcut || act.shortcutBadge) && (
                      <kbd className="hidden sm:inline-block ml-1 rounded border border-current/20 bg-black/5 px-1 py-0.2 text-[9px] font-mono uppercase dark:bg-white/10">
                        {act.shortcut || act.shortcutBadge}
                      </kbd>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
