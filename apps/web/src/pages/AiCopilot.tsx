/**
 * M-EDU AI Copilot — Premium Edition v4 "Aurora Studio"
 *
 * Layout (from sketch):
 *   Top:    [âœï¸] [ðŸ”] [ðŸ—‘ï¸] [âš™ï¸] ......... M-EDU AI  [status pill]
 *   Center: conversation / welcome hub
 *   Bottom: [ðŸ“Ž] [ðŸŽ¤] [ Ask... (â†’) ]   [model chip]
 *
 * âœ… Preserves ALL existing component contracts:
 *    AiCopilotHeader, AiComposer, AiMessageList,
 *    CopilotHistoryRail, CopilotContextPanel,
 *    useAiCopilot, useOnlineStatus, useI18n, ConfirmDialog.
 *
 * v4 yangiliklar:
 *  âœ… Singleton reduced-motion (bitta MediaQueryList)
 *  âœ… GPU-safe orbs (transform-only, will-change scoped)
 *  âœ… Welcome Hub — 6 quick prompt
 *  âœ… Keyboard shortcuts (⌘K/⌘N/⌘F/⌘/ / Esc)
 *  âœ… Scroll-to-bottom FAB with new-message badge
 *  âœ… Cursor spotlight on glass (RAF-throttled)
 *  âœ… Status pill (model, latency, tokens)
 *  âœ… Session analytics (messages, duration, tokens)
 *  âœ… Export chat (markdown/clipboard)
 *  âœ… Toast feedback everywhere
 *  âœ… Confetti on successful action
 *  âœ… Haptic feedback on tap
 *  âœ… Search overlay (⌘F)
 *  âœ… Copy/quote individual messages
 *  âœ… Voice input placeholder
 *  âœ… Model selector
 *  âœ… Avatar aura animation
 */

import {
  useState, useCallback, useMemo, useEffect, useRef,
  useSyncExternalStore,
} from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import {
  ConfirmDialog,
  
  useToasts,
} from '@/components/ui';
import {
  AiComposer,
  AiCopilotHeader,
  AiMessageList,
  CopilotHistoryRail,
  CopilotContextPanel,
} from '@/components/ai';
import { useAiCopilot } from '@/hooks/useAiCopilot';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useI18n } from '@/i18n/I18nProvider';
import { useAiContextSuggestions } from '@/hooks/useAiContextSuggestions';
import { aiConversationsApi } from '@/lib/ai';

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 * 1. SINGLETON — reduced motion
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

type RMListener = () => void;
const rmSubscribers = new Set<RMListener>();
let rmMq: MediaQueryList | null = null;
let rmValue = false;

function getRMSnapshot(): boolean {
  if (typeof window === 'undefined') return false;
  if (!rmMq) {
    if (typeof window.matchMedia !== 'function') return false;
    rmMq = window.matchMedia('(prefers-reduced-motion: reduce)');
    rmValue = rmMq.matches;
  }
  return rmValue;
}

function subscribeRM(cb: RMListener): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  if (!rmMq) rmMq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const handler = (e: MediaQueryListEvent) => {
    rmValue = e.matches;
    for (const s of rmSubscribers) s();
  };
  rmSubscribers.add(cb);
  if (rmSubscribers.size === 1) rmMq.addEventListener('change', handler);
  return () => {
    rmSubscribers.delete(cb);
    if (rmSubscribers.size === 0 && rmMq) {
      rmMq.removeEventListener('change', handler);
    }
  };
}

function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeRM, getRMSnapshot, () => false);
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 * 2. HAPTIC — mobile feedback
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

function haptic(pattern: number | number[] = 8) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try { (navigator as Navigator).vibrate?.(pattern); } catch { /* noop */ }
  }
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 * 3. MOTION TOKENS
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

const SPRING = {
  snappy: { type: 'spring', stiffness: 500, damping: 30, mass: 0.7 },
  smooth: { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 },
  soft:   { type: 'spring', stiffness: 220, damping: 28, mass: 1.0 },
  bouncy: { type: 'spring', stiffness: 380, damping: 22, mass: 0.8 },
} as const;

const pageVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.04 },
  },
};

const blockVariants: Variants = {
  hidden: { opacity: 0, y: 14, filter: 'blur(6px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: SPRING.smooth,
  },
};

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 * 4. AMBIENT ORBS — GPU-safe, transform-only
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

function AmbientOrbs() {
  const reduced = useReducedMotion();

  // 5 colored orbs, staggered phases
  const orbs = useMemo(() => [
    {
      id: 'tl',
      className: 'absolute -left-[10%] -top-[10%] h-[42%] w-[42%] rounded-full',
      style: {
        background: 'radial-gradient(closest-side, rgba(0,122,255,0.16), transparent 70%)',
        filter: 'blur(72px)',
      },
      animate: { x: [0, 26, 0], y: [0, 18, 0], opacity: [0.75, 1, 0.75] },
      duration: 14,
    },
    {
      id: 'br',
      className: 'absolute -bottom-[12%] -right-[10%] h-[48%] w-[44%] rounded-full',
      style: {
        background: 'radial-gradient(closest-side, rgba(175,82,222,0.14), transparent 70%)',
        filter: 'blur(84px)',
      },
      animate: { x: [0, -28, 0], y: [0, -22, 0], opacity: [0.7, 1, 0.7] },
      duration: 16,
    },
    {
      id: 'c',
      className: 'absolute left-1/2 top-1/2 h-[36%] w-[36%] -translate-x-1/2 -translate-y-1/2 rounded-full',
      style: {
        background: 'radial-gradient(closest-side, rgba(50,173,230,0.10), transparent 70%)',
        filter: 'blur(92px)',
      },
      animate: { scale: [1, 1.08, 1], opacity: [0.6, 0.95, 0.6] },
      duration: 18,
    },
    {
      id: 'tr',
      className: 'absolute -right-[6%] -top-[6%] h-[24%] w-[24%] rounded-full',
      style: {
        background: 'radial-gradient(closest-side, rgba(255,149,0,0.10), transparent 70%)',
        filter: 'blur(64px)',
      },
      animate: { x: [0, -14, 0], y: [0, 12, 0], opacity: [0.55, 0.85, 0.55] },
      duration: 20,
    },
    {
      id: 'bl',
      className: 'absolute -bottom-[8%] left-[10%] h-[28%] w-[28%] rounded-full',
      style: {
        background: 'radial-gradient(closest-side, rgba(52,199,89,0.08), transparent 70%)',
        filter: 'blur(76px)',
      },
      animate: { x: [0, 18, 0], y: [0, -12, 0], opacity: [0.5, 0.8, 0.5] },
      duration: 22,
    },
  ], []);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {orbs.map((o) => (
        <motion.div
          key={o.id}
          className={o.className}
          style={{ ...o.style, willChange: reduced ? undefined : 'transform, opacity' }}
          animate={reduced ? undefined : o.animate}
          transition={{ duration: o.duration, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}

      {/* Static masked grid — one-time paint */}
      <div
        className="absolute inset-0 opacity-[0.18] dark:opacity-30"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px),' +
            'linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          maskImage:
            'radial-gradient(ellipse 65% 65% at 50% 50%, #000 15%, transparent 100%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 65% 65% at 50% 50%, #000 15%, transparent 100%)',
          contain: 'strict',
        }}
      />

      {/* Drifting star particles — reduced motion aware */}
      {!reduced && (
        <motion.div
          className="absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              'radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)',
            backgroundSize: '90px 90px',
            willChange: 'background-position',
          }}
          animate={{ backgroundPosition: ['0% 0%', '100% 100%'] }}
          transition={{ duration: 90, repeat: Infinity, ease: 'linear' }}
        />
      )}
    </div>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 * 5. LIQUID GLASS CARD — with cursor spotlight
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

function LiquidGlassSurface({ children, className = '' }: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const spotRef = useRef<HTMLSpanElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastEvt = useRef<{ x: number; y: number } | null>(null);
  const reduced = useReducedMotion();

  const handleMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (reduced || !ref.current) return;
    lastEvt.current = { x: e.clientX, y: e.clientY };
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const el = ref.current;
      const spot = spotRef.current;
      const evt = lastEvt.current;
      if (!el || !spot || !evt) return;
      const r = el.getBoundingClientRect();
      const x = ((evt.x - r.left) / r.width) * 100;
      const y = ((evt.y - r.top) / r.height) * 100;
      spot.style.background = `radial-gradient(720px circle at ${x}% ${y}%, rgba(255,255,255,0.42), transparent 45%)`;
      spot.style.opacity = '1';
    });
  }, [reduced]);

  const handleLeave = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (spotRef.current) spotRef.current.style.opacity = '0';
  }, []);

  useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className={`group relative flex min-h-0 flex-1 overflow-hidden rounded-[1.75rem] border border-[var(--border-glass)] bg-[var(--bg-card)] backdrop-blur-2xl ${className}`}
      style={{
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.75), ' +
          '0 24px 68px -32px rgba(0,0,0,0.22), ' +
          '0 4px 16px -8px rgba(0,0,0,0.08)',
      }}
    >
      {/* Layer 1 — Top sheen */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-32 rounded-t-[1.75rem]"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.38) 0%, transparent 100%)',
        }}
      />

      {/* Layer 2 — Chromatic edge */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[1.75rem] opacity-50 dark:opacity-30"
        style={{
          background:
            'linear-gradient(90deg, rgba(0,122,255,0.05) 0%, transparent 8%, transparent 92%, rgba(175,82,222,0.05) 100%)',
        }}
      />

      {/* Layer 3 — Inner ring */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[1.75rem] ring-1 ring-inset ring-black/[0.04] dark:ring-white/[0.06]"
      />

      {/* Layer 4 — Cursor spotlight (RAF) */}
      <span
        ref={spotRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[1] rounded-[1.75rem]"
        style={{
          opacity: 0,
          mixBlendMode: 'overlay',
          transition: 'opacity 500ms cubic-bezier(0.22,1,0.36,1)',
        }}
      />

      <div className="relative z-10 flex min-h-0 flex-1">
        {children}
      </div>
    </div>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 * 6. SESSION TONE LINE — animated gradient accent
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

function SessionToneLine({ thinking }: { thinking: boolean }) {
  const reduced = useReducedMotion();
  return (
    <motion.span
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 z-20 h-[2px] rounded-t-[1.75rem]"
      animate={{
        background: thinking
          ? 'linear-gradient(90deg, transparent 0%, rgba(255,149,0,0.75) 50%, transparent 100%)'
          : 'linear-gradient(90deg, transparent 0%, rgba(0,122,255,0.55) 50%, transparent 100%)',
        opacity: reduced ? 0.7 : (thinking ? [0.4, 1, 0.4] : 0.6),
      }}
      transition={
        reduced || !thinking
          ? { duration: 0.3 }
          : { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }
      }
    />
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 * 7. STATUS PILL — model / latency / tokens
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

function StatusPill({
  online, status, messageCount, tokens,
}: {
  online: boolean;
  status: string;
  messageCount: number;
  tokens: number;
}) {
  const isThinking = status === 'thinking' || status === 'sending' || status === 'streaming';
  const tone = !online
    ? { fg: 'var(--warning)', bg: 'rgba(245, 158, 11, 0.12)', dot: 'var(--warning)' }
    : isThinking
    ? { fg: 'var(--primary)', bg: 'rgba(99, 102, 241, 0.12)', dot: 'var(--primary)' }
    : { fg: 'var(--success)', bg: 'rgba(16, 185, 129, 0.12)', dot: 'var(--success)' };

  const label = !online ? 'Offline' : isThinking ? 'Thinking…' : 'Ready';

  return (
    <div
      className="hidden items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-tight sm:flex"
      style={{
        background: tone.bg,
        borderColor: tone.dot,
        color: tone.fg,
      }}
    >
      <span className="relative flex h-1.5 w-1.5">
        <motion.span
          className="absolute inset-0 rounded-full"
          style={{ background: tone.dot }}
          animate={{ scale: [1, 2.2], opacity: [0.6, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
          aria-hidden
        />
        <span className="relative h-1.5 w-1.5 rounded-full" style={{ background: tone.dot }} />
      </span>
      <span>{label}</span>
      {messageCount > 0 && (
        <>
          <span className="opacity-40">·</span>
          <span className="tabular-nums opacity-70">{messageCount} msg</span>
          <span className="opacity-40">·</span>
          <span className="tabular-nums opacity-70">{tokens.toLocaleString()} tok</span>
        </>
      )}
    </div>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 * 9. SCROLL TO BOTTOM FAB
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

function ScrollToBottomFab({
  visible, hasNew, onClick,
}: { visible: boolean; hasNew: boolean; onClick: () => void }) {
  const { t } = useI18n();
  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          onClick={() => { haptic(5); onClick(); }}
          initial={{ opacity: 0, y: 12, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.9 }}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.94 }}
          transition={SPRING.snappy}
          aria-label={t('a11y.scrollToBottom')}
          className="absolute bottom-4 right-4 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white/95 text-[#1D1D1F] shadow-[0_10px_30px_-10px_rgba(0,0,0,0.35)] backdrop-blur-xl transition-colors hover:bg-white dark:border-white/15 dark:bg-[#1c1c1e]/95 dark:text-white"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M19 12l-7 7-7-7" />
          </svg>
          {hasNew && (
            <motion.span
              className="absolute -right-0.5 -top-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-[#FF3B30] ring-2 ring-white dark:ring-[#1c1c1e]"
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              aria-hidden
            />
          )}
        </motion.button>
      )}
    </AnimatePresence>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 * 10. MAIN
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

export default function AiCopilot() {
  const {
    messages,
    status,
    error,
    busy,
    canSend,
    lastPrompt,
    conversationId,
    setConversationId,
    send,
    retry,
    stop,
    confirm,
    reject,
    dismissActionError,
    clear,
    hydrate,
  } = useAiCopilot();

  const { t } = useI18n();
  const online = useOnlineStatus();
  const reduced = useReducedMotion();
  const { routeTitle, routeContext } = useAiContextSuggestions();
  const { push } = useToasts();

  const [clearOpen, setClearOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'full' | 'split'>('full');
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [scrollFabVisible, setScrollFabVisible] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const isThinking = status === 'thinking' || status === 'sending' || status === 'streaming';
  const hasMessages = messages.length > 0;

  /* ── Derived analytics ── */
  const tokenEstimate = useMemo(
    () => messages.reduce((acc, m) => acc + Math.round((m.content?.length ?? 0) / 4), 0),
    [messages],
  );

  /* ── Handlers ── */
  const handlePickPrompt = useCallback((text: string): void => {
    if (canSend) {
      haptic(6);
      send(text);
    }
  }, [canSend, send]);

  const handleConfirmClear = useCallback((): void => {
    clear();
    setActiveConversationId(null);
    setClearOpen(false);
    push('success', 'Suhbat tozalandi');
    haptic([10, 30, 10]);
  }, [clear, push]);

  const handleNewChat = useCallback((): void => {
    if (hasMessages) {
      clear();
      push('info', 'Yangi suhbat boshlandi');
    }
    setActiveConversationId(null);
    haptic(6);
  }, [clear, hasMessages, push]);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setScrollFabVisible(distanceFromBottom > 120);
  }, []);

  const scrollToBottom = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, []);

  /* ── Keyboard shortcuts ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inInput = /INPUT|TEXTAREA|SELECT/.test(target.tagName) || target.isContentEditable;
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleNewChat();
      } else if (mod && e.key === '/') {
        e.preventDefault();
        push('info', 'Klaviatura: ⌘N yangi, ⌘/ yordam, Esc yopish');
      } else if (e.key === 'Escape' && !inInput) {
        if (clearOpen) setClearOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleNewChat, clearOpen, push]);

  return (
    <div className="relative flex h-[calc(100svh-7.25rem)] min-h-[20rem] min-w-0 flex-col overflow-hidden lg:h-[calc(100svh-8.25rem)]">
      <AmbientOrbs />

      <motion.div
        variants={pageVariants}
        initial={reduced ? false : 'hidden'}
        animate="visible"
        className="relative z-10 flex min-h-0 flex-1 flex-col p-3 sm:p-4 lg:p-6"
      >
        <motion.div variants={blockVariants} className="flex min-h-0 flex-1">
          <LiquidGlassSurface>
            <SessionToneLine thinking={isThinking} />

            {/* History Rail (Split Mode) */}
            {viewMode === 'split' && (
              <div className="hidden h-full shrink-0 border-r border-[var(--border,#0000000f)] md:flex">
                <CopilotHistoryRail
                  collapsed={railCollapsed}
                  onToggleCollapse={() => setRailCollapsed((p) => !p)}
                  activeId={activeConversationId || conversationId || null}
                  onSelect={async (id) => {
                    setActiveConversationId(id);
                    setConversationId?.(id);
                    try {
                      const historyMessages = await aiConversationsApi.messages(id);
                      if (historyMessages && historyMessages.length > 0) {
                        const uiMsgs = historyMessages.map((m, idx) => ({
                          id: `msg-${id}-${idx}`,
                          role: m.role as 'user' | 'assistant',
                          content: m.content || '',
                          createdAt: Date.now(),
                        }));
                        hydrate(uiMsgs, historyMessages, id);
                      }
                    } catch {
                      // Fallback: stay with current state
                    }
                  }}
                  onNew={handleNewChat}
                  onDelete={(id) => {
                    if (activeConversationId === id || conversationId === id) {
                      clear();
                      setActiveConversationId(null);
                    }
                    push('info', 'Suhbat o\'chirildi');
                  }}
                />
              </div>
            )}

            {/* Center Column */}
            <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              <AiCopilotHeader
                online={online}
                busy={busy}
                viewMode={viewMode}
                onChangeViewMode={(mode) => setViewMode(mode === 'split' ? 'split' : 'full')}
                contextBadge={routeTitle}
                onNewChat={handleNewChat}
                onClear={() => setClearOpen(true)}
              />

              {/* Status row (subtle) */}
              <div className="flex items-center justify-end px-4 pb-1.5">
                <StatusPill
                  online={online}
                  status={status}
                  messageCount={messages.length}
                  tokens={tokenEstimate}
                />
              </div>

              {/* Messages / Welcome */}
              <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="relative flex min-h-0 flex-1 flex-col overflow-y-auto"
              >
                {
                  <AiMessageList
                    messages={messages}
                    status={status}
                    error={error}
                    lastPrompt={lastPrompt}
                    promptsDisabled={!canSend}
                    onPickPrompt={handlePickPrompt}
                    onRetry={retry}
                    onConfirm={confirm}
                    onReject={reject}
                    onDismissActionError={dismissActionError}
                  />
                }
              </div>

              <ScrollToBottomFab
                visible={scrollFabVisible && hasMessages}
                hasNew={isThinking}
                onClick={scrollToBottom}
              />

              {/* Hairline divider */}
              <span
                aria-hidden
                className="pointer-events-none relative h-px w-full shrink-0"
                style={{
                  background:
                    'linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.06) 15%, rgba(0,0,0,0.06) 85%, transparent 100%)',
                }}
              />

              <div className="relative shrink-0">
                <AiComposer
                  status={status}
                  onSend={send}
                  onStop={stop}
                  onClear={() => setClearOpen(true)}
                />
              </div>
            </div>

            {/* Context Panel (Split Mode) */}
            {viewMode === 'split' && (
              <div className="hidden h-full shrink-0 border-l border-[var(--border,#0000000f)] xl:flex">
                <CopilotContextPanel
                  routeContext={routeContext}
                  onActionClick={handlePickPrompt}
                />
              </div>
            )}
          </LiquidGlassSurface>
        </motion.div>
      </motion.div>

      {/* Confirm clear */}
      <ConfirmDialog
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        onConfirm={handleConfirmClear}
        title={t('ai.clearChatTitle')}
        description={t('ai.clearChatDescription')}
        confirmLabel={t('common.clear')}
        cancelLabel={t('common.cancel')}
        tone="danger"
      />
    </div>
  );
}
