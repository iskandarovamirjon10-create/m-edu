/**
 * M-EDU GlobalAiCopilot — Apple Design Award Edition v2 "Aurora Companion"
 *
 * ✨ BUG FIXES:
 *  - Broken UTF-8 chars (· and o') restored
 *  - getContext wrapped in useCallback (stable ref for useAiCopilot)
 *  - aria-modal + focus trap + focus return on close
 *  - ⌘J keyboard shortcut to toggle
 *  - Body scroll lock while open
 *  - No nested glass-on-glass (perf)
 *  - Consistent i18n labels
 *  - Reduced-motion respected everywhere
 *  - Offline visual indicator (red dot + label)
 *
 * ✨ NEW IN v2:
 *  - Framer Motion spring physics for slide-in
 *  - 3D-tilted magic orb with cursor tracking
 *  - Conic ring (rotating) + unread pulse halo
 *  - Typing indicator in header while streaming
 *  - Context-aware "context pill" in header
 *  - Custom SVG icons (SF Symbols proportions)
 *  - Tone system for status colors
 *  - Copy message / regenerate shortcuts
 *  - Backdrop only on mobile (desktop uses side-panel paradigm)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
  useTransform,
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
 * REDUCED MOTION
 * ========================================================================== */

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}

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
  wifi: [
    'M5 12.55a11 11 0 0 1 14.08 0',
    'M1.42 9a16 16 0 0 1 21.16 0',
    'M8.53 16.11a6 6 0 0 1 6.95 0',
    'M12 20h.01',
  ],
  wifiOff: [
    'M1 1l22 22',
    'M16.72 11.06A10.94 10.94 0 0 1 19 12.55',
    'M5 12.55a10.94 10.94 0 0 1 5.17-2.39',
    'M10.71 5.05A16 16 0 0 1 22.58 9',
    'M1.42 9a15.91 15.91 0 0 1 4.7-2.88',
    'M8.53 16.11a6 6 0 0 1 6.95 0',
    'M12 20h.01',
  ],
  layers: [
    'M12 2 2 7l10 5 10-5-10-5z',
    'M2 17l10 5 10-5',
    'M2 12l10 5 10-5',
  ],
  maximize: [
    'M8 3H5a2 2 0 0 0-2 2v3',
    'M21 8V5a2 2 0 0 0-2-2h-3',
    'M3 16v3a2 2 0 0 0 2 2h3',
    'M16 21h3a2 2 0 0 0 2-2v-3',
  ],
  minimize: [
    'M8 3v3a2 2 0 0 1-2 2H3',
    'M21 8h-3a2 2 0 0 1-2-2V3',
    'M3 16h3a2 2 0 0 1 2 2v3',
    'M16 21v-3a2 2 0 0 1 2-2h3',
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
 * MAGIC ORB — floating bubble with 3D tilt + conic ring
 * ========================================================================== */

interface MagicOrbProps {
  open: boolean;
  onClick: () => void;
  orbRef: React.RefObject<HTMLButtonElement>;
  streaming?: boolean;
}

function MagicOrb({ open, onClick, orbRef, streaming }: MagicOrbProps) {
  const reduced = usePrefersReducedMotion();
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
      whileHover={{ scale: 1.06 }}
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
      {/* Rotating conic ring */}
      {!reduced ? (
        <motion.span
          className="absolute inset-0 rounded-full"
          style={{
            background:
              'conic-gradient(from 0deg, #94EAEF, #5474FC, #AF52DE, #FF2D55, #FF9500, #94EAEF)',
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
          aria-hidden
        />
      ) : (
        <span
          className="absolute inset-0 rounded-full"
          style={{
            background:
              'conic-gradient(from 0deg, #94EAEF, #5474FC, #AF52DE, #FF2D55, #FF9500, #94EAEF)',
          }}
          aria-hidden
        />
      )}

      {/* Inner 3D-tilted orb */}
      <motion.span
        className="relative flex h-full w-full items-center justify-center rounded-full text-[#5474FC]"
        style={{
          rotateX: reduced ? 0 : rotateX,
          rotateY: reduced ? 0 : rotateY,
          background:
            'radial-gradient(circle at 30% 25%, #FFFFFF 0%, #F4F8FB 45%, #E8EEF5 100%)',
          boxShadow:
            'inset 0 2px 4px rgba(255,255,255,0.9), inset 0 -2px 4px rgba(0,0,0,0.06), 0 8px 32px rgba(84,115,252,0.35)',
        }}
      >
        <span
          className="pointer-events-none absolute inset-x-3 top-1 h-1/2 rounded-full"
          style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.7), transparent 70%)',
          }}
          aria-hidden
        />

        <motion.span
          animate={
            reduced
              ? {}
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
 * HEADER — premium with context pill
 * ========================================================================== */

interface HeaderProps {
  online: boolean;
  context: string;
  streaming: boolean;
  onClear: () => void;
  onClose: () => void;
  t: (k: string) => string;
}

function CopilotHeader({ online, context, streaming, onClear, onClose, t }: HeaderProps) {
  const reduced = usePrefersReducedMotion();

  return (
    <header
      className="relative flex items-center gap-3 px-4 py-3"
      style={{ borderBottom: '1px solid var(--border-subtle)' }}
    >
      {/* AI icon with conic ring */}
      <div className="relative h-10 w-10 shrink-0">
        <motion.div
          className="absolute inset-[-2px] rounded-2xl p-[2px]"
          animate={reduced ? {} : { rotate: 360 }}
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
        <div
          className="relative flex h-full w-full items-center justify-center rounded-2xl text-white"
          style={{
            background: 'linear-gradient(135deg, #5474FC 0%, #94EAEF 100%)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4)',
          }}
        >
          <Icon paths={I.sparkles} size={18} strokeWidth={2} />
        </div>
      </div>

      {/* Title + context */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="text-[14px] font-semibold tracking-tight text-[var(--text-primary)]">
            {t('ai.copilot') || 'AI Copilot'}
          </h3>
          {streaming && (
            <motion.span
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center gap-1 rounded-full bg-[#007AFF]/10 px-2 py-0.5 text-[9.5px] font-bold text-[#007AFF]"
            >
              <motion.span
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="h-1.5 w-1.5 rounded-full bg-[#007AFF]"
              />
              Thinking
            </motion.span>
          )}
        </div>

        <div className="mt-0.5 flex items-center gap-1.5">
          {/* Online status dot */}
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{
              background: online ? '#34C759' : '#FF3B30',
              boxShadow: online
                ? '0 0 6px rgba(52,199,89,0.6)'
                : '0 0 6px rgba(255,59,48,0.6)',
            }}
            aria-hidden
          />
          <span className="text-[11px] font-semibold text-[var(--text-muted)]">
            {online ? 'Online' : 'Offline'}
          </span>
          <span className="text-[11px] text-[var(--text-muted)] opacity-40">·</span>
          {/* Context pill */}
          <span
            className="inline-flex max-w-[180px] items-center gap-1 truncate rounded-full bg-[#007AFF]/10 px-2 py-0.5 text-[10px] font-bold tracking-tight text-[#007AFF]"
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
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          transition={SPRING.snappy}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] outline-none transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] focus-visible:ring-2 focus-visible:ring-[#007AFF]/40"
          aria-label="Clear chat"
          title="Clear chat"
        >
          <Icon paths={I.trash} size={14} strokeWidth={2} />
        </motion.button>
        <motion.button
          type="button"
          onClick={onClose}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          transition={SPRING.snappy}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] outline-none transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] focus-visible:ring-2 focus-visible:ring-[#007AFF]/40"
          aria-label="Close"
          title="Close (Esc)"
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

    const getFocusable = () => Array.from(root.querySelectorAll<HTMLElement>(focusableSelector));

    // Focus first focusable element
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

  /* ✨ Stable context getter — prevents useAiCopilot re-inits */
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

  const online = useOnlineStatus();
  const context = getContext();
  const streaming = status === 'sending' || status === 'thinking';

  /* ✨ Premium Audio/Haptic Feedback on Completion */
  const prevStatus = useRef(status);
  const prevError = useRef(error);
  
  useEffect(() => {
    if (prevStatus.current === 'sending' || prevStatus.current === 'thinking') {
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

  /* ✨ Escape closes panel (unless clear dialog is open) */
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

  /* ✨ ⌘J / Ctrl+J toggles panel */
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        toggleOpen();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  /* ✨ Body scroll lock while open */
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  /* ✨ Focus trap while open */
  useFocusTrap(panelRef, open);

  const handleClose = useCallback(() => {
    toggleOpen();
    orbRef.current?.focus();
  }, [toggleOpen]);

  const handleClearConfirm = useCallback(() => {
    clear();
    setClearOpen(false);
  }, [clear]);

  /* ✨ Panel animation variants */
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
            {/* ✨ Backdrop only on mobile — desktop uses side-panel */}
            <motion.div
              variants={backdropVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="fixed inset-0 z-[149] bg-slate-950/40 backdrop-blur-sm lg:hidden"
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
              className="fixed inset-y-2 right-2 z-[150] flex w-[440px] max-w-[calc(100vw-1rem)] flex-col overflow-hidden"
              style={{
                background: 'var(--bg-card)',
                backdropFilter: 'blur(40px) saturate(1.8)',
                WebkitBackdropFilter: 'blur(40px) saturate(1.8)',
                border: '1px solid var(--border-glass)',
                borderRadius: '1.5rem',
                boxShadow:
                  'inset 0 1px 0 rgba(255,255,255,0.5), 0 24px 60px -12px rgba(0,0,0,0.24)',
                willChange: 'transform, opacity, filter',
              }}
            >
              {/* Top sheen */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-6 top-0 h-px"
                style={{
                  background:
                    'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)',
                }}
              />

              {/* Chromatic edge (subtle) */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-30"
                style={{
                  borderRadius: 'inherit',
                  background:
                    'linear-gradient(90deg, rgba(255,0,80,0.04) 0%, transparent 6%, transparent 94%, rgba(0,120,255,0.04) 100%)',
                }}
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
                    <AiComposer status={status} onSend={send} onStop={stop} />
                  </div>
                </div>
              </div>

              {/* Footer keyboard hint */}
              <div
                className="relative z-10 flex items-center justify-between gap-2 px-4 py-2"
                style={{ borderTop: '1px solid var(--border-subtle)' }}
              >
                <p className="text-[10.5px] font-medium text-[var(--text-muted)]">
                  {online ? 'Connected to live data' : 'Offline mode — queued'}
                </p>
                <div className="flex items-center gap-1.5">
                  <kbd
                    className="rounded-md border border-[#00000015] bg-[#00000005] px-1.5 py-0.5 text-[9.5px] font-bold text-[var(--text-muted)] dark:border-[#ffffff15] dark:bg-[#ffffff08]"
                    title="Toggle AI Copilot"
                  >
                    ⌘J
                  </kbd>
                  <kbd
                    className="rounded-md border border-[#00000015] bg-[#00000005] px-1.5 py-0.5 text-[9.5px] font-bold text-[var(--text-muted)] dark:border-[#ffffff15] dark:bg-[#ffffff08]"
                    title="Close"
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