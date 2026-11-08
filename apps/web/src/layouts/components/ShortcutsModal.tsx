/**
 * M-EDU Keyboard Shortcuts Modal — Apple-premium rewrite.
 *
 * One calm dialog: opaque card, hairline border, grouped shortcut rows and
 * `kbd` chips. Live key feedback, focus trap, scroll lock, focus restore and
 * Escape handling are unchanged — only the liquid-glass chrome is gone.
 */

import {
  useState,
  useRef,
  useEffect,
  useMemo,
  useId,
  memo,
  useCallback,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { cn, usePrefersReducedMotion, SPRING, EASE_APPLE } from '@/lib/design';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { useAuth } from '@/auth/AuthContext';
import { ADMIN_ROLES, STAFF_ROLES } from '@/lib/roles';
import { useFocusTrap } from '../core/singletons';
import { StaticIcon, PremiumIcon, I } from './Icons';

/* ══════════════════════════════════════════════════════════════════════
 * PUBLIC API (unchanged)
 * ════════════════════════════════════════════════════════════════════ */

export type ShortcutCategory = 'command' | 'navigation';

export interface ShortcutRow {
  keys: readonly string[];
  labelKey: string;
  fallback: string;
  category?: ShortcutCategory;
  /**
   * If `true`, the keys are pressed together (⌘ + K).
   * If `false` (default for two arrow keys), they are alternatives (↑ / ↓).
   */
  combination?: boolean;
  roles?: readonly string[];
}

export const SHORTCUTS: readonly ShortcutRow[] = [
  { keys: ['⌘', 'K'], labelKey: 'shortcuts.commandPalette', fallback: 'Open command palette', category: 'command', combination: true },
  { keys: ['⌘', 'B'], labelKey: 'shortcuts.toggleSidebar', fallback: 'Toggle sidebar', category: 'command', combination: true },
  { keys: ['⌘', 'E'], labelKey: 'shortcuts.executiveDashboard', fallback: 'Executive Suite', category: 'command', combination: true, roles: ADMIN_ROLES },
  { keys: ['⌘', 'R'], labelKey: 'shortcuts.refreshData', fallback: 'Refresh live data', category: 'command', combination: true },
  { keys: ['⌘', '/'], labelKey: 'shortcuts.showShortcuts', fallback: 'Show keyboard shortcuts', category: 'command', combination: true },
  { keys: ['?'], labelKey: 'shortcuts.quickHelp', fallback: 'Show keyboard shortcuts cheat sheet', category: 'command', combination: false },
  { keys: ['G', 'S'], labelKey: 'shortcuts.goStudents', fallback: 'Go to Students (O\'quvchilar)', category: 'navigation', combination: false, roles: STAFF_ROLES },
  { keys: ['G', 'F'], labelKey: 'shortcuts.goFinance', fallback: 'Go to Finance & Payments (Moliya)', category: 'navigation', combination: false, roles: ADMIN_ROLES },
  { keys: ['G', 'A'], labelKey: 'shortcuts.goAttendance', fallback: 'Go to Attendance (Davomat)', category: 'navigation', combination: false, roles: STAFF_ROLES },
  { keys: ['G', 'D'], labelKey: 'shortcuts.goDashboard', fallback: 'Go to Dashboard (Bosh sahifa)', category: 'navigation', combination: false, roles: ADMIN_ROLES },
  { keys: ['G', 'G'], labelKey: 'shortcuts.goGroups', fallback: 'Go to Groups (Guruhlar)', category: 'navigation', combination: false, roles: STAFF_ROLES },
  { keys: ['N', 'P'], labelKey: 'shortcuts.quickPayment', fallback: 'Quick Payment modal (Tezkor to\'lov)', category: 'command', combination: false, roles: ADMIN_ROLES },
  { keys: ['N', 'A'], labelKey: 'shortcuts.quickAttendance', fallback: 'Quick Attendance modal (Tezkor davomat)', category: 'command', combination: false, roles: STAFF_ROLES },
  { keys: ['Space'], labelKey: 'shortcuts.quickLook', fallback: 'Quick-Look preview (macOS)', category: 'navigation', combination: false },
  { keys: ['/'], labelKey: 'shortcuts.focusSearch', fallback: 'Focus search', category: 'navigation', combination: false },
  { keys: ['↑', '↓'], labelKey: 'shortcuts.navMenu', fallback: 'Navigate sidebar menu', category: 'navigation', combination: false },
  { keys: ['Enter'], labelKey: 'shortcuts.openItem', fallback: 'Open selected item', category: 'navigation', combination: false },
  { keys: ['Esc'], labelKey: 'shortcuts.closeOverlay', fallback: 'Close overlay', category: 'navigation', combination: false },
];

/* ══════════════════════════════════════════════════════════════════════
 * UTILITIES
 * ════════════════════════════════════════════════════════════════════ */

const FOCUS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--border-focus)]';

const KEYCAP =
  'inline-flex min-w-[1.85rem] items-center justify-center rounded-lg border border-subtle bg-surface/80 px-2 py-0.5 font-mono text-[11px] font-semibold text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(0,0,0,0.06)] backdrop-blur-md dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_1px_2px_rgba(0,0,0,0.4)]';

const KEYCAP_PRESSED =
  'translate-y-px border-brand-500/60 bg-brand-500/10 text-brand-600 dark:bg-brand-500/20 dark:text-brand-400';

function useIsApplePlatform(): boolean {
  return useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    return /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);
  }, []);
}

/**
 * Normalizes an event key OR a display glyph to a canonical token so pressed
 * state comparison stays symmetric across ⌘/Ctrl, arrows and named keys.
 */
function normalizeGlyph(input: string, isApple: boolean): string {
  switch (input) {
    case 'Meta':
    case '⌘':
    case 'Cmd':
      return isApple ? '⌘' : 'Ctrl';
    case 'Control':
    case 'Ctrl':
      return 'Ctrl';
    case 'ArrowUp':
    case '↑':
      return '↑';
    case 'ArrowDown':
    case '↓':
      return '↓';
    case 'ArrowLeft':
    case '←':
      return '←';
    case 'ArrowRight':
    case '→':
      return '→';
    case 'Escape':
    case 'Esc':
      return 'Esc';
    case 'Enter':
    case 'Return':
      return 'Enter';
    case 'Shift':
      return 'Shift';
    case 'Alt':
    case 'Option':
      return isApple ? '⌥' : 'Alt';
    case ' ':
      return 'Space';
    default:
      return input.length === 1 ? input.toUpperCase() : input;
  }
}

function Keycap({ glyph, pressed }: { glyph: string; pressed: boolean }) {
  return (
    <kbd
      data-pressed={pressed ? 'true' : 'false'}
      className={cn(
        KEYCAP,
        'transition-all duration-150 ease-apple-spring motion-reduce:transition-none',
        pressed && KEYCAP_PRESSED,
      )}
    >
      {glyph}
    </kbd>
  );
}

/* ══════════════════════════════════════════════════════════════════════
 * ShortcutsModal
 * ════════════════════════════════════════════════════════════════════ */

export const ShortcutsModal = memo(function ShortcutsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useSafeI18n();
  const { user } = useAuth();
  const userRole = user?.role;
  const reduced = usePrefersReducedMotion();
  const isApple = useIsApplePlatform();
  const sound = usePremiumSound();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descId = useId();

  const [pressedKeys, setPressedKeys] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  useFocusTrap(containerRef, open);

  /* 1 · Focus restoration + body scroll lock + open chime */
  useEffect(() => {
    if (!open) return;
    sound.playPop();
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    const scrollbar =
      typeof window !== 'undefined'
        ? window.innerWidth - document.documentElement.clientWidth
        : 0;

    document.body.style.overflow = 'hidden';
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;

    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
      setPressedKeys(new Set());
      const toRestore = previousFocusRef.current;
      if (toRestore && typeof toRestore.focus === 'function' && toRestore.isConnected) {
        requestAnimationFrame(() => {
          try {
            toRestore.focus({ preventScroll: true });
          } catch {
            toRestore.focus();
          }
        });
      }
    };
  }, [open, sound]);

  /* 2 · Capture-phase Escape + live keycap highlight + tactile tick */
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      const norm = normalizeGlyph(e.key, isApple);
      setPressedKeys((prev) => {
        if (prev.has(norm)) return prev;
        sound.playTick();
        const next = new Set(prev);
        next.add(norm);
        return next;
      });
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const norm = normalizeGlyph(e.key, isApple);
      setPressedKeys((prev) => {
        if (!prev.has(norm)) return prev;
        const next = new Set(prev);
        next.delete(norm);
        return next;
      });
    };

    const onBlur = () => setPressedKeys(new Set());
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') setPressedKeys(new Set());
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    window.addEventListener('keyup', onKeyUp, { capture: true });
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true });
      window.removeEventListener('keyup', onKeyUp, { capture: true });
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [open, onClose, isApple, sound]);

  /* 3 · Group rows + resolve the OS modifier glyph */
  const { commandRows, navRows } = useMemo(() => {
    const adaptKey = (k: string) => (k === '⌘' && !isApple ? 'Ctrl' : k);
    const mapped = SHORTCUTS
      .filter((row) => !row.roles || (userRole && (row.roles as readonly string[]).includes(userRole)))
      .map((row) => ({
        ...row,
        resolvedKeys: row.keys.map(adaptKey),
        isCombination:
          row.combination ??
          (row.keys.length === 2 && !row.keys.every((k) => k === '↑' || k === '↓')),
      }));
    return {
      commandRows: mapped.filter((r) => (r.category ?? 'command') === 'command'),
      navRows: mapped.filter((r) => r.category === 'navigation'),
    };
  }, [isApple, userRole]);

  const isPressed = useCallback(
    (glyph: string) => pressedKeys.has(normalizeGlyph(glyph, isApple)),
    [pressedKeys, isApple],
  );

  const renderRow = (row: {
    labelKey: string;
    fallback: string;
    resolvedKeys: string[];
    isCombination: boolean;
  }) => (
    <div
      key={row.labelKey}
      className="flex items-center justify-between gap-4 rounded-xl px-3 py-2 transition-colors duration-150 hover:bg-surface/50"
    >
      <span className="text-sm font-medium text-primary">
        {t(row.labelKey, row.fallback)}
      </span>

      <span className="flex shrink-0 items-center gap-1.5">
        {row.resolvedKeys.map((k, i) => (
          <span key={`${k}-${i}`} className="inline-flex items-center gap-1">
            {i > 0 && (
              <span className="text-[11px] font-medium text-tertiary" aria-hidden="true">
                {row.isCombination ? '+' : '/'}
              </span>
            )}
            <Keycap glyph={k} pressed={isPressed(k)} />
          </span>
        ))}
      </span>
    </div>
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="shortcuts-modal"
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6"
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.18, ease: EASE_APPLE }}
            aria-hidden="true"
          />

          {/* Dialog */}
          <motion.div
            ref={containerRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descId}
            initial={reduced ? { opacity: 0 } : { y: 16, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { y: 10, opacity: 0, scale: 0.98 }}
            transition={reduced ? { duration: 0.1 } : SPRING.smooth}
            className="glass-modal relative z-10 w-full max-w-[520px] overflow-hidden rounded-3xl p-0 shadow-glass-floating"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 border-b border-subtle px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                  <PremiumIcon paths={I.keyboard} isActive size={18} />
                </span>
                <div>
                  <h2
                    id={titleId}
                    className="text-[15px] font-semibold tracking-tight text-primary"
                  >
                    {t('nav.shortcuts', 'Keyboard shortcuts')}
                  </h2>
                  <p id={descId} className="text-xs text-secondary">
                    {isApple
                      ? 'macOS Command Suite'
                      : t('shortcuts.subtitle', 'Quick control keys')}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label={t('common.close', 'Close')}
                title={`${t('common.close', 'Close')} (Esc)`}
                className={cn(
                  'flex h-8 w-8 min-h-[32px] min-w-[32px] items-center justify-center rounded-full border border-subtle bg-surface/60',
                  'text-secondary transition-colors duration-150',
                  'hover:bg-surface hover:text-primary',
                  FOCUS,
                )}
              >
                <StaticIcon paths={I.close} size={15} strokeWidth={2} />
              </button>
            </div>

            {/* Body */}
            <div className="max-h-[68vh] overflow-y-auto overscroll-contain px-3 py-3">
              <div>
                <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-tertiary">
                  {t('shortcuts.sectionCommands', 'Quick commands')}
                </p>
                <div className="space-y-0.5">{commandRows.map(renderRow)}</div>
              </div>

              <div className="my-3 border-t border-subtle" role="separator" aria-hidden="true" />

              <div>
                <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-tertiary">
                  {t('shortcuts.sectionNavigation', 'Navigation & window')}
                </p>
                <div className="space-y-0.5">{navRows.map(renderRow)}</div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 border-t border-subtle bg-surface/40 px-6 py-3 text-[11px] font-medium text-tertiary">
              <span>{t('shortcuts.footerTip', 'Open anywhere:')}</span>
              <span className="inline-flex items-center gap-1">
                <Keycap glyph={isApple ? '⌘' : 'Ctrl'} pressed={isPressed(isApple ? '⌘' : 'Ctrl')} />
                <span className="text-tertiary" aria-hidden="true">
                  +
                </span>
                <Keycap glyph="/" pressed={isPressed('/')} />
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

export default ShortcutsModal;
