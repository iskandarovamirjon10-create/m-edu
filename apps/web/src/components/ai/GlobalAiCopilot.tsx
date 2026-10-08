/**
 * M-EDU GlobalAiCopilot — Apple Design Award Edition v3 "Aurora Companion"
 *
 * Premium craft:
 *  - Magic orb: 3D cursor tilt + rotating conic ring + inner orb with
 *    radial highlight + streaming pulse halo + hover glow backdrop
 *  - Panel: double-layer glass (top gloss + inner ring + chromatic edge)
 *  - Session tone accent — 2px top line (primary/amber pulse when streaming)
 *  - Header: gradient AI tile + conic ring + live dot + context pill
 *  - Footer: refined keyboard hints (⌘J, Esc)
 *  - Entrance: spring physics with blur-in + staggered content
 *  - All functional behaviour preserved (focus trap, scroll lock,
 *    ⌘J toggle, Esc close, haptics, sound, clear confirm)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
  type Variants,
} from 'framer-motion';
import { useAiCopilot } from '@/hooks/useAiCopilot';
import { ROUTE_TITLES } from '@/routes';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useI18n } from '@/i18n/I18nProvider';
import { AiComposer, AiMessageList } from '.';
import { ConfirmDialog } from '@/components/ui';
import { useHaptics } from '@/hooks/useHaptics';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { useAiContextSuggestions } from '@/hooks/useAiContextSuggestions';

/* ============================================================================
 * MOTION TOKENS
 * ========================================================================== */

const SPRING = {
  snappy: { type: 'spring', stiffness: 500, damping: 30, mass: 0.7 },
  smooth: { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 },
  soft:   { type: 'spring', stiffness: 220, damping: 28, mass: 1.0 },
} as const;

const EASE_APPLE = [0.22, 1, 0.36, 1] as const;

/* ============================================================================
 * CUSTOM ICONS (SF Symbols proportions)
 * ========================================================================== */

const ICON_STROKE = 1.75;

const I = {
  sparkles: [
    'M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z',
    'M20 3v4', 'M22 5h-4', 'M4 17v2', 'M5 18H3',
  ],
  x: ['M18 6 6 18', 'M6 6l12 12'],
  trash: [
    'M3 6h18',
    'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6',
    'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
    'M10 11v6', 'M14 11v6',
  ],
  layers: [
    'M12 2 2 7l10 5 10-5-10-5z',
    'M2 17l10 5 10-5',
    'M2 12l10 5 10-5',
  ],
};

function Icon({
  paths, size = 16, className = '', strokeWidth = ICON_STROKE, ...rest
}: {
  paths: string[]; size?: number; className?: string; strokeWidth?: number;
} & React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden {...rest}
    >
      {paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

/* ============================================================================
 * MAGIC ORB — floating bubble with 3D tilt + conic ring + glow
 * ========================================================================== */

interface MagicOrbProps {
  open: boolean;
  onClick: () => void;
  orbRef: React.RefObject<HTMLButtonElement>;
  streaming?: boolean;
}

function MagicOrb({ open, onClick, orbRef, streaming }: MagicOrbProps) {
  const reduced = useReducedMotion();
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, SPRING.snappy);
  const sy = useSpring(my, SPRING.snappy);
  const rotateX = useTransform(sy, [-12, 12], [8, -8]);
  const rotateY = useTransform(sx, [-12, 12], [-8, 8]);

  const onMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (reduced) return;
    const rect = e.currentTarget.getBoundingClientRect();
    mx.set(((e.clientX - rect.left) / rect.width - 0.5) * 24);
    my.set(((e.clientY - rect.top) / rect.height - 0.5) * 24);
  };
  const onLeave = () => { mx.set(0); my.set(0); };

  return (
    <motion.button
      ref={orbRef}
      type="button"
      onClick={onClick}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      aria-label={open ? 'Close AI Copilot' : 'Open AI Copilot'}
      aria-expanded={open}
      aria-controls="ai-copilot-panel"
      whileHover={reduced ? undefined : { scale: 1.06 }}
      whileTap={{ scale: 0.94 }}
      transition={SPRING.snappy}
      className="group fixed bottom-6 right-6 z-[150] outline-none focus-visible:ring-4 focus-visible:ring-[#007AFF]/40"
      style={{
        width: 64,
        height: 64,
        borderRadius: '50%',
        padding: 2,
        perspective: 400,
        willChange: 'transform',
      }}
    >
      {/* Hover glow backdrop */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-[-8px] rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            'radial-gradient(closest-side, rgba(0,122,255,0.35), transparent 70%)',
          filter: 'blur(16px)',
        }}
      />

      {/* Rotating conic ring */}
      <motion.span
        className="absolute inset-0 rounded-full"
        style={{
          background:
            'conic-gradient(from 0deg, #94EAEF, #5474FC, #AF52DE, #FF2D55, #FF9500, #94EAEF)',
        }}
        animate={reduced ? undefined : { rotate: 360 }}
        transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
        aria-hidden
      />

      {/* Inner 3D-tilted orb */}
      <motion.span
        className="relative flex h-full w-full items-center justify-center rounded-full text-[#5474FC]"
        style={{
          rotateX: reduced ? 0 : rotateX,
          rotateY: reduced ? 0 : rotateY,
          background:
            'radial-gradient(circle at 30% 25%, #FFFFFF 0%, #F4F8FB 45%, #E8EEF5 100%)',
          boxShadow:
            'inset 0 2px 4px rgba(255,255,255,0.9), ' +
            'inset 0 -2px 4px rgba(0,0,0,0.06), ' +
            '0 8px 32px rgba(84,115,252,0.35)',
        }}
      >
        {/* Top specular */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-3 top-1 h-1/2 rounded-full"
          style={{
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.75), transparent 70%)',
          }}
        />
        {/* Sparkle */}
        <motion.span
          animate={
            reduced
              ? undefined
              : streaming
              ? { scale: [1, 1.15, 1], rotate: [0, 12, -12, 0] }
              : { scale: [1, 1.08, 1], rotate: [0, 6, 0] }
          }
          transition={{
            duration: streaming ? 1.2 : 4,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="relative"
        >
          <Icon paths={I.sparkles} size={28} strokeWidth={1.9} />
        </motion.span>
      </motion.span>

      {/* Streaming pulse halo */}
      {streaming && !reduced && (
        <motion.span
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{ border: '2px solid rgba(84,115,252,0.5)' }}
          animate={{ scale: [1, 1.5], opacity: [0.8, 0] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
          aria-hidden
        />
      )}
    </motion.button>
  );
}

/* ============================================================================
 * PANEL HEADER — gradient tile + live status + context pill
 * ========================================================================== */

interface HeaderProps {
  online: boolean;
  context: string;
  streaming: boolean;
  onClear: () => void;
  onClose: () => void;
  t: (k: string) => string;
}

function CopilotHeader({
  online, context, streaming, onClear, onClose, t,
}: HeaderProps) {
  const reduced = useReducedMotion();

  return (
    <header
      className="relative flex items-center gap-3 px-4 py-3"
      style={{ borderBottom: '1px solid var(--border-subtle)' }}
    >
      {/* Gradient AI tile with conic ring */}
      <div className="relative h-10 w-10 shrink-0">
        {/* Rotating conic ring */}
        <motion.div
          className="absolute inset-[-2px] rounded-2xl p-[2px]"
          animate={reduced ? undefined : { rotate: 360 }}
          transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
          aria-hidden
        >
          <span
            className="absolute inset-0 rounded-2xl"
            style={{
              background:
                'conic-gradient(from 0deg, #94EAEF, #5474FC, #AF52DE, #FF2D55, #FF9500, #94EAEF)',
            }}
          />
        </motion.div>
        {/* Inner tile — gradient + sheen */}
        <div
          className="relative flex h-full w-full items-center justify-center rounded-2xl text-white"
          style={{
            background: 'linear-gradient(135deg, #007AFF 0%, #32ADE6 100%)',
            boxShadow:
              'inset 0 1px 0 rgba(255,255,255,0.45), ' +
              'inset 0 -1px 0 rgba(0,0,0,0.08), ' +
              '0 4px 12px -4px rgba(0,122,255,0.4)',
          }}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-2xl"
            style={{
              background:
                'linear-gradient(180deg, rgba(255,255,255,0.4), transparent 55%)',
            }}
          />
          <Icon paths={I.sparkles} size={18} strokeWidth={2} className="relative" />
        </div>
      </div>

      {/* Title + status + context */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3
            className="text-[14px] font-semibold tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('ai.copilot') || 'AI Copilot'}
          </h3>
          {/* Streaming chip */}
          <AnimatePresence>
            {streaming && (
              <motion.span
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={SPRING.snappy}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.14em]"
                style={{
                  background: 'rgba(0,122,255,0.12)',
                  color: '#007AFF',
                  border: '1px solid rgba(0,122,255,0.22)',
                }}
              >
                <motion.span
                  animate={{ scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="h-1.5 w-1.5 rounded-full bg-[#007AFF]"
                />
                Thinking
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <div className="mt-1 flex items-center gap-1.5">
          {/* Live dot with pulse */}
          <span className="relative flex h-1.5 w-1.5">
            {online && !reduced && (
              <motion.span
                className="absolute inset-0 rounded-full"
                style={{ background: '#34C759', opacity: 0.6 }}
                animate={{ scale: [1, 2.4, 1], opacity: [0.6, 0, 0.6] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
              />
            )}
            <span
              className="relative h-1.5 w-1.5 rounded-full"
              style={{
                background: online ? '#34C759' : '#FF3B30',
                boxShadow: online
                  ? '0 0 6px rgba(52,199,89,0.6)'
                  : '0 0 6px rgba(255,59,48,0.6)',
              }}
              aria-hidden
            />
          </span>
          <span
            className="text-[11px] font-semibold"
            style={{ color: 'var(--text-muted)' }}
          >
            {online ? 'Online' : 'Offline'}
          </span>
          <span className="text-[11px] opacity-40" style={{ color: 'var(--text-muted)' }}>
            ·
          </span>
          {/* Context pill */}
          <span
            className="inline-flex max-w-[180px] items-center gap-1 truncate rounded-full px-2 py-0.5 text-[10px] font-bold tracking-tight"
            style={{
              background: 'rgba(0,122,255,0.10)',
              color: '#007AFF',
              border: '1px solid rgba(0,122,255,0.18)',
            }}
            title={context}
          >
            <Icon paths={I.layers} size={9} strokeWidth={2.5} />
            <span className="truncate">{context}</span>
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <motion.button
          type="button"
          onClick={onClear}
          whileHover={reduced ? undefined : { scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          transition={SPRING.snappy}
          className="flex h-8 w-8 items-center justify-center rounded-lg outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#007AFF]/40"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,59,48,0.08)';
            e.currentTarget.style.color = '#FF3B30';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--text-muted)';
          }}
          aria-label={t('ai.widget.clearChat')}
          title={t('ai.widget.clearChat')}
        >
          <Icon paths={I.trash} size={14} strokeWidth={2} />
        </motion.button>
        <motion.button
          type="button"
          onClick={onClose}
          whileHover={reduced ? undefined : { scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          transition={SPRING.snappy}
          className="flex h-8 w-8 items-center justify-center rounded-lg outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#007AFF]/40"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(0,0,0,0.05)';
            e.currentTarget.style.color = 'var(--text-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--text-muted)';
          }}
          aria-label={t('ai.widget.close')}
          title={t('ai.widget.closeEsc')}
        >
          <Icon paths={I.x} size={14} strokeWidth={2.2} />
        </motion.button>
      </div>
    </header>
  );
}

/* ============================================================================
 * FOCUS TRAP
 * ========================================================================== */

function useFocusTrap(ref: React.RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active || !ref.current) return;
    const root = ref.current;
    const focusableSelector =
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const getFocusable = () =>
      Array.from(root.querySelectorAll<HTMLElement>(focusableSelector));

    const timer = setTimeout(() => {
      const first = getFocusable()[0];
      first?.focus();
    }, 180);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusable = getFocusable();
      if (focusable.length === 0) return;
      const firstEl = focusable[0];
      const lastEl = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus();
    };
  }, [active, ref]);
}

/* ============================================================================
 * MAIN COMPONENT
 * ========================================================================== */

export function GlobalAiCopilot() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const { pathname } = useLocation();
  const orbRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const haptics = useHaptics();
  const sound = usePremiumSound();

  const openPanel = useCallback(() => {
    setOpen((prev) => {
      if (!prev) {
        haptics.medium();
        sound.playPop();
      }
      return true;
    });
  }, [haptics, sound]);

  const toggleOpen = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      if (next) {
        haptics.medium();
        sound.playPop();
      } else {
        haptics.light();
      }
      return next;
    });
  }, [haptics, sound]);

  /* Stable context getter — prevents useAiCopilot re-inits */
  const getContext = useCallback(() => {
    const route = ROUTE_TITLES.find((r) => r.pattern.test(pathname));
    return route ? route.title : 'M-EDU App';
  }, [pathname]);

  const {
    messages,
    status,
    error,
    canSend,
    lastPrompt,
    send,
    retry,
    stop,
    confirm,
    reject,
    dismissActionError,
    clear,
  } = useAiCopilot({ getContext });

  const { smartPrompts, routeTitle } = useAiContextSuggestions();

  const online = useOnlineStatus();
  const context = getContext();
  const streaming = status === 'sending' || status === 'thinking' || status === 'streaming';

  /* Audio/Haptic on completion */
  const prevStatus = useRef(status);
  const prevError = useRef(error);

  useEffect(() => {
    if (prevStatus.current === 'sending' || prevStatus.current === 'thinking' || prevStatus.current === 'streaming') {
      if (status === 'idle') {
        if (error && !prevError.current) {
          haptics.error();
          sound.playError();
        } else if (!error) {
          haptics.success();
          sound.playSuccess();
        }
      }
    }
    prevStatus.current = status;
    prevError.current = error;
  }, [status, error, haptics, sound]);

  /* Escape closes panel (unless clear dialog is open) */
  useEffect(() => {
    if (!open || clearOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        toggleOpen();
        orbRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, clearOpen, toggleOpen]);

  /* ⌘J / Ctrl+J toggles panel */
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        toggleOpen();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        window.dispatchEvent(new Event('medu-ai-toggle-voice'));
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [toggleOpen]);

  /* Custom event listener to open Copilot from Dashboard or any component with optional prompt */
  useEffect(() => {
    const handleOpenWithPrompt = (e: Event) => {
      const customEvent = e as CustomEvent<{ prompt?: string }>;
      openPanel();
      if (customEvent.detail?.prompt) {
        send(customEvent.detail.prompt);
      }
    };
    window.addEventListener('open-ai-copilot', handleOpenWithPrompt);
    return () => window.removeEventListener('open-ai-copilot', handleOpenWithPrompt);
  }, [openPanel, send]);

  /* Body scroll lock while open */
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  /* Focus trap while open */
  useFocusTrap(panelRef, open);

  const handleClose = useCallback(() => {
    toggleOpen();
    orbRef.current?.focus();
  }, [toggleOpen]);

  const handleClearConfirm = useCallback(() => {
    clear();
    setClearOpen(false);
  }, [clear]);

  /* Panel animation variants */
  const panelVariants: Variants = {
    hidden: {
      opacity: 0,
      x: 40,
      scale: 0.96,
      filter: 'blur(14px)',
    },
    visible: {
      opacity: 1,
      x: 0,
      scale: 1,
      filter: 'blur(0px)',
      transition: {
        type: 'spring',
        stiffness: 320,
        damping: 30,
        mass: 0.9,
        opacity: { duration: 0.24, ease: EASE_APPLE },
        filter: { duration: 0.32, ease: EASE_APPLE },
      },
    },
    exit: {
      opacity: 0,
      x: 32,
      scale: 0.97,
      filter: 'blur(10px)',
      transition: { duration: 0.22, ease: EASE_APPLE },
    },
  };

  const backdropVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.35, ease: EASE_APPLE } },
    exit: { opacity: 0, transition: { duration: 0.22, ease: EASE_APPLE } },
  };

  return (
    <>
      <MagicOrb
        open={open}
        onClick={toggleOpen}
        orbRef={orbRef}
        streaming={streaming}
      />

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop — mobile only */}
            <motion.div
              variants={backdropVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="fixed inset-0 z-[149] bg-black/30 dark:bg-slate-950/60 backdrop-blur-sm lg:hidden"
              onClick={handleClose}
              aria-hidden="true"
            />

            {/* Panel */}
            <motion.div
              ref={panelRef}
              id="ai-copilot-panel"
              role="dialog"
              aria-label={t('a11y.aiCopilot') || 'AI Copilot'}
              aria-modal="true"
              variants={panelVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="fixed inset-y-0 right-0 sm:inset-y-2 sm:right-2 z-[150] flex w-full sm:w-[440px] sm:max-w-[calc(100vw-1rem)] flex-col overflow-hidden"
              style={{
                background: 'var(--bg-card)',
                backdropFilter: 'blur(40px) saturate(1.8)',
                WebkitBackdropFilter: 'blur(40px) saturate(1.8)',
                border: '1px solid var(--border-glass)',
                borderRadius: '1.75rem',
                boxShadow:
                  'inset 0 1px 0 rgba(255,255,255,0.55), ' +
                  'inset 0 -1px 0 rgba(0,0,0,0.04), ' +
                  '0 24px 60px -12px rgba(0,0,0,0.28), ' +
                  '0 4px 16px -8px rgba(0,0,0,0.10)',
                willChange: 'transform, opacity, filter',
              }}
            >
              {/* Top gloss */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-24 rounded-t-[1.75rem]"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, transparent 100%)',
                }}
              />

              {/* Inner ring */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-[1.75rem] ring-1 ring-inset ring-black/[0.04] dark:ring-white/[0.06]"
              />

              {/* Chromatic edge */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-[1.75rem] opacity-30"
                style={{
                  background:
                    'linear-gradient(90deg, rgba(0,122,255,0.05) 0%, transparent 8%, transparent 92%, rgba(175,82,222,0.05) 100%)',
                }}
              />

              {/* Session tone line — 2px top accent */}
              <motion.span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-[2px] rounded-t-[1.75rem]"
                animate={{
                  background: streaming
                    ? 'linear-gradient(90deg, transparent 0%, rgba(255,149,0,0.7) 50%, transparent 100%)'
                    : 'linear-gradient(90deg, transparent 0%, rgba(0,122,255,0.5) 50%, transparent 100%)',
                  opacity: streaming ? [0.4, 1, 0.4] : 0.6,
                }}
                transition={
                  streaming
                    ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }
                    : { duration: 0.3 }
                }
              />

              <div className="relative z-10 flex min-h-0 flex-1 flex-col">
                <CopilotHeader
                  online={online}
                  context={context}
                  streaming={streaming}
                  onClear={() => setClearOpen(true)}
                  onClose={handleClose}
                  t={t}
                />

                {/* Contextual smart prompt chips */}
                {smartPrompts && smartPrompts.length > 0 && (
                  <div
                    className="relative shrink-0 border-b px-3.5 py-2 overflow-x-auto no-scrollbar flex items-center gap-1.5"
                    style={{
                      borderColor: 'var(--border-subtle)',
                      background: 'rgba(0,122,255,0.03)',
                    }}
                  >
                    <span className="flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wider text-[#007AFF] shrink-0 mr-1">
                      <Icon paths={I.sparkles} size={11} strokeWidth={2.5} />
                      {routeTitle}:
                    </span>
                    {smartPrompts.slice(0, 3).map((prompt, idx) => (
                      <button
                        key={idx}
                        type="button"
                        disabled={!canSend}
                        onClick={() => {
                          haptics.light();
                          sound.playTick();
                          send(prompt);
                        }}
                        className="shrink-0 text-left truncate max-w-[210px] rounded-full px-2.5 py-1 text-[11px] font-medium transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                        style={{
                          background: 'var(--bg-glass)',
                          border: '1px solid var(--border-glass)',
                          color: 'var(--text-secondary)',
                          boxShadow: '0 2px 6px -2px rgba(0,0,0,0.05)',
                        }}
                        title={prompt}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                )}

                {/* Messages + composer */}
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
                    <AiMessageList
                      messages={messages}
                      status={status}
                      error={error}
                      lastPrompt={lastPrompt}
                      promptsDisabled={!canSend}
                      onPickPrompt={(text) => canSend && send(text)}
                      onRetry={retry}
                      onConfirm={confirm}
                      onReject={reject}
                      onDismissActionError={dismissActionError}
                    />
                  </div>

                  <div
                    className="shrink-0"
                    style={{
                      borderTop: '1px solid var(--border-subtle)',
                      background: 'var(--bg-glass)',
                      backdropFilter: 'blur(20px) saturate(1.6)',
                      WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
                    }}
                  >
                    <AiComposer
                      status={status}
                      onSend={send}
                      onStop={stop}
                      onClear={() => setClearOpen(true)}
                    />
                  </div>
                </div>
              </div>

              {/* Footer keyboard hints */}
              <div
                className="relative z-10 flex items-center justify-between gap-2 px-4 py-2"
                style={{ borderTop: '1px solid var(--border-subtle)' }}
              >
                <p
                  className="text-[10.5px] font-medium"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {online ? t('ai.widget.connected') : t('ai.widget.offline')}
                </p>
                <div className="flex items-center gap-1.5">
                  <kbd
                    className="rounded-md border px-1.5 py-0.5 text-[9.5px] font-bold"
                    style={{
                      borderColor: 'var(--border)',
                      background: 'var(--bg-glass)',
                      color: 'var(--text-muted)',
                    }}
                    title={t('ai.widget.toggle')}
                  >
                    ⌘J
                  </kbd>
                  <kbd
                    className="rounded-md border px-1.5 py-0.5 text-[9.5px] font-bold"
                    style={{
                      borderColor: 'var(--border)',
                      background: 'var(--bg-glass)',
                      color: 'var(--text-muted)',
                    }}
                    title={t('ai.widget.close')}
                  >
                    Esc
                  </kbd>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        onConfirm={handleClearConfirm}
        title={t('ai.clearChatTitle') || 'Clear chat'}
        description={
          t('ai.clearChatDescription') ||
          "Conversation history will be removed from this device. This can't be undone."
        }
        confirmLabel={t('common.clear') || 'Clear'}
        cancelLabel={t('common.cancel') || 'Cancel'}
        tone="danger"
      />
    </>
  );
}

export default GlobalAiCopilot;
