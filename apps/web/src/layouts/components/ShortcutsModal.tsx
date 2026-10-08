/**
 * M-EDU Keyboard Shortcuts Modal — v11 "Titanium"
 */

import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '@/i18n/I18nProvider';
import { SPRING, DUR, EASE_APPLE, backdropVariants } from '../core/tokens';
import { useFocusTrap } from '../core/singletons';
import { GlassSurface } from './GlassSurface';
import { StaticIcon, I } from './Icons';

export interface ShortcutRow {
  keys: string[];
  labelKey: string;
  fallback: string;
}

export const SHORTCUTS: ShortcutRow[] = [
  { keys: ['⌘', 'K'], labelKey: 'shortcuts.commandPalette', fallback: 'Open command palette' },
  { keys: ['⌘', 'B'], labelKey: 'shortcuts.toggleSidebar', fallback: 'Toggle sidebar' },
  { keys: ['⌘', '/'], labelKey: 'shortcuts.showShortcuts', fallback: 'Show keyboard shortcuts' },
  { keys: ['/'], labelKey: 'shortcuts.focusSearch', fallback: 'Focus search' },
  { keys: ['↑', '↓'], labelKey: 'shortcuts.navMenu', fallback: 'Navigate sidebar menu' },
  { keys: ['Enter'], labelKey: 'shortcuts.openItem', fallback: 'Open selected item' },
  { keys: ['Esc'], labelKey: 'shortcuts.closeOverlay', fallback: 'Close overlay' },
];

export function ShortcutsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement | null>(null);

  useFocusTrap(containerRef, open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="shortcuts"
          className="fixed inset-0 z-[80] flex items-center justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: DUR.base, ease: EASE_APPLE }}
        >
          <motion.div
            className="absolute inset-0 bg-black/50"
            onClick={onClose}
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            aria-hidden
          />
          <motion.div
            ref={containerRef}
            role="dialog"
            aria-modal="true"
            aria-label={t('nav.shortcuts') || 'Keyboard shortcuts'}
            initial={{ y: 20, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.96 }}
            transition={SPRING.smooth}
            className="relative w-full max-w-lg"
          >
            <GlassSurface
              tone="modal"
              className="border border-[#ffffff60] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.4)] dark:border-[#ffffff15]"
              radius="1.5rem"
            >
              <div className="flex items-center justify-between border-b border-[#00000010] px-6 py-4 dark:border-[#ffffff10]">
                <div className="flex items-center gap-3">
                  <StaticIcon paths={I.keyboard} className="h-5 w-5 text-[#007AFF]" />
                  <h2 className="text-[15px] font-bold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                    {t('nav.shortcuts') || 'Keyboard shortcuts'}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full p-2 text-[#636366] hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-[#007AFF]/50 dark:text-[#98989D] dark:hover:bg-white/10"
                  aria-label={t('common.close') || 'Close'}
                >
                  <StaticIcon paths={I.close} className="h-4 w-4" />
                </button>
              </div>
              <div className="p-3">
                {SHORTCUTS.map((row) => (
                  <div
                    key={row.labelKey}
                    className="flex items-center justify-between gap-4 rounded-[0.875rem] px-3 py-2.5 transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                  >
                    <span className="text-[13px] font-medium tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                      {t(row.labelKey) || row.fallback}
                    </span>
                    <span className="flex items-center gap-1">
                      {row.keys.map((k, i) => (
                        <kbd
                          key={i}
                          className="min-w-[1.5rem] rounded-md border border-[#00000015] bg-[#00000006] px-1.5 py-1 text-center text-[11px] font-bold text-[#1D1D1F] dark:border-[#ffffff20] dark:bg-[#ffffff10] dark:text-[#F5F5F7]"
                        >
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </GlassSurface>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
