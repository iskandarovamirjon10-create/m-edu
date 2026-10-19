/**
 * M-EDU AI Copilot — Apple Premium Edition v5.0 "iOS 27 Spatial Liquid Glass"
 *
 * Adaptive Multi-Device Architecture:
 *   📱 Phone   (< 768px):   Edge-to-edge Liquid Sheet + Dynamic Island HUD + Swipe Glass Drawers
 *   📟 Tablet  (768-1279px): Split-View Stage Manager + Slide-Over Context Glass Drawer
 *   🖥 Desktop (>= 1280px):  3-Column Spatial Studio + Specular Cursor Refraction + ⌘K Spotlight
 *
 * ✅ 100% Preserves ALL existing component contracts:
 *    AiCopilotHeader, AiComposer, AiMessageList,
 *    CopilotHistoryRail, CopilotContextPanel,
 *    useAiCopilot, useOnlineStatus, useI18n, ConfirmDialog.
 */

import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  useSyncExternalStore,
} from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { ConfirmDialog, useToasts } from '@/components/ui';
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

/* ══════════════════════════════════════════════════════════════════════════
 * 1. SINGLETON — Reduced Motion & Viewport Breakpoint Watchers
 * ════════════════════════════════════════════════════════════════════════ */

type Listener = () => void;
const rmSubscribers = new Set<Listener>();
let rmMq: MediaQueryList | null = null;
let rmValue = false;

function getRMSnapshot(): boolean {
  if (typeof window === 'undefined') return false;
  if (!rmMq && typeof window.matchMedia === 'function') {
    rmMq = window.matchMedia('(prefers-reduced-motion: reduce)');
    rmValue = rmMq.matches;
  }
  return rmValue;
}

function subscribeRM(cb: Listener): () => void {
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

/* ══════════════════════════════════════════════════════════════════════════
 * 2. HAPTIC ENGINE — Subtle Taptic Engine Simulation
 * ════════════════════════════════════════════════════════════════════════ */

function haptic(pattern: number | number[] = 8) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate?.(pattern);
    } catch {
      /* ignore unsupported devices */
    }
  }
}

/* ══════════════════════════════════════════════════════════════════════════
 * 3. iOS 27 FLUID SPRING PHYSICS & VARIANTS
 * ════════════════════════════════════════════════════════════════════════ */

const SPRING = {
  island: { type: 'spring', stiffness: 460, damping: 32, mass: 0.65 },
  snappy: { type: 'spring', stiffness: 520, damping: 34, mass: 0.7 },
  smooth: { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 },
  sheet:  { type: 'spring', stiffness: 390, damping: 36, mass: 0.85 },
} as const;

const pageVariants: Variants = {
  hidden: { opacity: 0, scale: 0.985 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { ...SPRING.smooth, staggerChildren: 0.06, delayChildren: 0.02 },
  },
};

const blockVariants: Variants = {
  hidden: { opacity: 0, y: 12, filter: 'blur(6px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      ...SPRING.smooth,
      filter: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
    },
  },
};

/* ══════════════════════════════════════════════════════════════════════════
 * 4. AMBIENT CAUSTIC ORBS — iOS 27 Spatial Backlight (GPU-Safe & Optimized)
 * ════════════════════════════════════════════════════════════════════════ */

function AmbientOrbs({ thinking }: { thinking: boolean }) {
  const reduced = useReducedMotion();

  const orbs = useMemo(
    () => [
      {
        id: 'cyan-top',
        className: 'absolute -left-[10%] -top-[12%] h-[42%] w-[42%] rounded-full',
        style: {
          background:
            'radial-gradient(closest-side, rgba(10, 132, 255, 0.18), rgba(90, 200, 250, 0.05) 60%, transparent 80%)',
          filter: 'blur(36px)',
          willChange: 'transform',
          transform: 'translateZ(0)',
        },
        animate: { x: [0, 24, 0], y: [0, 16, 0], scale: [1, 1.04, 1] },
        duration: 15,
      },
      {
        id: 'violet-bottom',
        className: 'absolute -bottom-[12%] -right-[8%] h-[44%] w-[42%] rounded-full',
        style: {
          background:
            'radial-gradient(closest-side, rgba(191, 90, 242, 0.16), rgba(94, 92, 230, 0.05) 60%, transparent 80%)',
          filter: 'blur(40px)',
          willChange: 'transform',
          transform: 'translateZ(0)',
        },
        animate: { x: [0, -24, 0], y: [0, -18, 0], scale: [1, 1.05, 1] },
        duration: 18,
      },
      {
        id: 'aurora-core',
        className:
          'absolute left-1/2 top-1/2 h-[36%] w-[38%] -translate-x-1/2 -translate-y-1/2 rounded-full',
        style: {
          background: thinking
            ? 'radial-gradient(closest-side, rgba(255, 159, 10, 0.15), rgba(255, 55, 95, 0.06) 60%, transparent 80%)'
            : 'radial-gradient(closest-side, rgba(100, 210, 255, 0.10), transparent 75%)',
          filter: 'blur(44px)',
          willChange: 'transform, opacity',
          transform: 'translateZ(0)',
        },
        animate: { scale: thinking ? [1, 1.12, 1] : [1, 1.05, 1], opacity: [0.65, 0.95, 0.65] },
        duration: thinking ? 4.5 : 16,
      },
      {
        id: 'mint-accent',
        className: 'absolute -bottom-[8%] left-[8%] h-[28%] w-[28%] rounded-full',
        style: {
          background: 'radial-gradient(closest-side, rgba(48, 209, 88, 0.09), transparent 75%)',
          filter: 'blur(36px)',
          willChange: 'transform',
          transform: 'translateZ(0)',
        },
        animate: { x: [0, 18, 0], y: [0, -12, 0] },
        duration: 21,
      },
    ],
    [thinking],
  );

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden select-none">
      {orbs.map((o) => (
        <motion.div
          key={o.id}
          className={o.className}
          style={{ ...o.style, willChange: reduced ? undefined : 'transform, opacity' }}
          animate={reduced ? undefined : o.animate}
          transition={{ duration: o.duration, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}

      {/* Precision Spatial Micro-Grid */}
      <div
        className="absolute inset-0 opacity-[0.16] dark:opacity-[0.24]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(120,120,128,0.12) 1px, transparent 1px),' +
            'linear-gradient(to bottom, rgba(120,120,128,0.12) 1px, transparent 1px)',
          backgroundSize: '36px 36px',
          maskImage: 'radial-gradient(ellipse 75% 70% at 50% 45%, #000 20%, transparent 100%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 75% 70% at 50% 45%, #000 20%, transparent 100%)',
        }}
      />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * 5. iOS 27 LIQUID GLASS SURFACE — Specular Refraction & Fresnel Rim
 * ════════════════════════════════════════════════════════════════════════ */

function LiquidGlassSurface({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const spotRef = useRef<HTMLSpanElement | null>(null);
  const rimRef = useRef<HTMLSpanElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastEvt = useRef<{ x: number; y: number } | null>(null);
  const reduced = useReducedMotion();

  const handleMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (reduced || !ref.current) return;
      lastEvt.current = { x: e.clientX, y: e.clientY };
      if (rafRef.current !== null) return;

      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const el = ref.current;
        const spot = spotRef.current;
        const rim = rimRef.current;
        const evt = lastEvt.current;
        if (!el || !spot || !evt) return;

        const r = el.getBoundingClientRect();
        const x = ((evt.x - r.left) / r.width) * 100;
        const y = ((evt.y - r.top) / r.height) * 100;

        spot.style.background = `radial-gradient(640px circle at ${x}% ${y}%, rgba(255,255,255,0.32), rgba(100,210,255,0.06) 35%, transparent 60%)`;
        spot.style.opacity = '1';

        if (rim) {
          rim.style.background = `radial-gradient(420px circle at ${x}% ${y}%, rgba(255,255,255,0.65), transparent 50%)`;
          rim.style.opacity = '1';
        }
      });
    },
    [reduced],
  );

  const handleLeave = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (spotRef.current) spotRef.current.style.opacity = '0';
    if (rimRef.current) rimRef.current.style.opacity = '0';
  }, []);

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className={`group relative flex min-h-0 flex-1 overflow-hidden rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.35rem] border border-white/45 dark:border-white/[0.12] bg-white/[0.68] dark:bg-[#121318]/[0.68] backdrop-blur-3xl backdrop-saturate-[190%] transition-shadow duration-500 ${className}`}
      style={{
        boxShadow:
          'inset 0 1.5px 1px 0 rgba(255, 255, 255, 0.82), ' +
          'inset 0 -1px 1px 0 rgba(255, 255, 255, 0.18), ' +
          '0 28px 80px -28px rgba(0, 0, 0, 0.28), ' +
          '0 8px 24px -10px rgba(10, 132, 255, 0.08)',
      }}
    >
      {/* Layer 1 — Curved Optical Crown Highlight */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-28 rounded-t-[inherit] opacity-80 dark:opacity-25"
        style={{
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.62) 0%, rgba(255,255,255,0.12) 45%, transparent 100%)',
        }}
      />

      {/* Layer 2 — Iridescent Prismatic Dispersion Edge */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-60 dark:opacity-40"
        style={{
          background:
            'linear-gradient(125deg, rgba(10,132,255,0.07) 0%, transparent 22%, transparent 78%, rgba(191,90,242,0.07) 100%)',
        }}
      />

      {/* Layer 3 — Titanium Micro-Bezel Ring */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-[1px] rounded-[inherit] ring-1 ring-inset ring-black/[0.04] dark:ring-white/[0.07]"
      />

      {/* Layer 4 — Interactive Cursor Specular Reflection */}
      <span
        ref={spotRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[1] rounded-[inherit]"
        style={{
          opacity: 0,
          mixBlendMode: 'soft-light',
          transition: 'opacity 450ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      />

      {/* Layer 5 — Interactive Fresnel Border Glow */}
      <span
        ref={rimRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[2] rounded-[inherit] p-[1px]"
        style={{
          opacity: 0,
          WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
          transition: 'opacity 400ms ease',
        }}
      />

      <div className="relative z-10 flex min-h-0 min-w-0 flex-1">{children}</div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * 6. APPLE INTELLIGENCE LUMINOUS AURA — Top Edge Energy Ribbon
 * ════════════════════════════════════════════════════════════════════════ */

function SessionToneLine({ thinking }: { thinking: boolean }) {
  const reduced = useReducedMotion();
  return (
    <motion.span
      aria-hidden
      className="pointer-events-none absolute inset-x-6 top-0 z-30 h-[2.5px] rounded-full"
      animate={{
        background: thinking
          ? 'linear-gradient(90deg, transparent 0%, #0A84FF 20%, #BF5AF2 50%, #FF375F 80%, transparent 100%)'
          : 'linear-gradient(90deg, transparent 0%, rgba(10,132,255,0.65) 50%, transparent 100%)',
        opacity: reduced ? 0.75 : thinking ? [0.55, 1, 0.55] : 0.65,
        scaleX: thinking ? [0.92, 1.04, 0.92] : 1,
      }}
      transition={
        reduced || !thinking
          ? { duration: 0.4 }
          : { duration: 2.2, repeat: Infinity, ease: 'easeInOut' }
      }
      style={{
        boxShadow: thinking ? '0 2px 16px rgba(191, 90, 242, 0.55)' : 'none',
      }}
    />
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * 7. iOS 27 DYNAMIC ISLAND CONTROL BAR — Adaptive Phone / Tablet / Desktop
 * ════════════════════════════════════════════════════════════════════════ */

interface ModelOption {
  id: string;
  label: string;
  badge: string;
}

const AI_MODELS: ModelOption[] = [
  { id: 'medu-pro', label: 'M-EDU 2.5 Pro', badge: 'Spatial' },
  { id: 'medu-flash', label: 'M-EDU Flash', badge: 'Instant' },
  { id: 'medu-reason', label: 'DeepThink R1', badge: 'Math/Code' },
];

function DynamicIslandBar({
  online,
  status,
  messageCount,
  tokens,
  selectedModel,
  onSelectModel,
  onOpenHistoryDrawer,
  onOpenContextDrawer,
  onOpenSearch,
  onExportChat,
  viewMode,
}: {
  online: boolean;
  status: string;
  messageCount: number;
  tokens: number;
  selectedModel: ModelOption;
  onSelectModel: (m: ModelOption) => void;
  onOpenHistoryDrawer: () => void;
  onOpenContextDrawer: () => void;
  onOpenSearch: () => void;
  onExportChat: () => void;
  viewMode: 'full' | 'split';
}) {
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const isThinking = status === 'thinking' || status === 'sending' || status === 'streaming';

  const statusTone = !online
    ? { label: 'Offline', dot: '#FF9F0A', bg: 'rgba(255, 159, 10, 0.14)', text: '#FF9F0A' }
    : isThinking
    ? { label: 'Synthesizing…', dot: '#BF5AF2', bg: 'rgba(191, 90, 242, 0.14)', text: '#BF5AF2' }
    : { label: 'Ready', dot: '#30D158', bg: 'rgba(48, 209, 88, 0.14)', text: '#30D158' };

  return (
    <div className="relative z-20 flex flex-wrap items-center justify-between gap-2 border-b border-black/[0.04] dark:border-white/[0.06] bg-white/35 dark:bg-white/[0.02] px-3 py-2 sm:px-4 backdrop-blur-xl">
      {/* Left — Mobile/Tablet Drawer Triggers + Model Selector Pill */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Phone/Tablet History Drawer Button */}
        <button
          type="button"
          onClick={() => {
            haptic(6);
            onOpenHistoryDrawer();
          }}
          title="Suhbatlar tarixi"
          className={`inline-flex h-8 items-center gap-1.5 rounded-full border border-black/[0.07] dark:border-white/[0.1] bg-white/70 dark:bg-white/[0.06] px-2.5 text-xs font-medium text-neutral-700 dark:text-neutral-200 shadow-sm backdrop-blur-md transition active:scale-95 hover:bg-white dark:hover:bg-white/10 ${
            viewMode === 'split' ? 'md:hidden' : ''
          }`}
        >
          <svg className="h-3.5 w-3.5 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="16" rx="3" />
            <line x1="9" y1="4" x2="9" y2="20" />
          </svg>
          <span className="hidden xs:inline">Tarix</span>
        </button>

        {/* iOS 27 Liquid Model Selector */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              haptic(5);
              setModelMenuOpen((p) => !p);
            }}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-black/[0.07] dark:border-white/[0.1] bg-white/75 dark:bg-white/[0.07] px-3 text-xs font-semibold tracking-tight text-neutral-800 dark:text-neutral-100 shadow-sm backdrop-blur-md transition hover:bg-white dark:hover:bg-white/15 active:scale-95"
          >
            <span className="h-2 w-2 rounded-full bg-gradient-to-tr from-[#0A84FF] to-[#BF5AF2]" />
            <span>{selectedModel.label}</span>
            <span className="hidden rounded-full bg-[#0A84FF]/10 dark:bg-[#0A84FF]/20 px-1.5 py-0.5 text-[10px] font-medium text-[#0A84FF] sm:inline">
              {selectedModel.badge}
            </span>
            <svg className="h-3 w-3 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>

          <AnimatePresence>
            {modelMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setModelMenuOpen(false)}
                />
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.95 }}
                  transition={SPRING.snappy}
                  className="absolute left-0 top-10 z-40 w-56 overflow-hidden rounded-2xl border border-white/60 dark:border-white/15 bg-white/90 dark:bg-[#1C1C1E]/90 p-1.5 shadow-2xl backdrop-blur-2xl"
                >
                  {AI_MODELS.map((m) => {
                    const active = m.id === selectedModel.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          haptic(6);
                          onSelectModel(m);
                          setModelMenuOpen(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition ${
                          active
                            ? 'bg-[#0A84FF] text-white font-semibold shadow-sm'
                            : 'text-neutral-700 dark:text-neutral-200 hover:bg-black/5 dark:hover:bg-white/10'
                        }`}
                      >
                        <span>{m.label}</span>
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                            active ? 'bg-white/20 text-white' : 'bg-black/5 dark:bg-white/10 opacity-75'
                          }`}
                        >
                          {m.badge}
                        </span>
                      </button>
                    );
                  })}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Center / Right — Dynamic Island Status Pill & Quick Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Dynamic Island Telemetry Capsule */}
        <motion.div
          layout
          transition={SPRING.island}
          className="flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-tight shadow-inner"
          style={{
            background: statusTone.bg,
            borderColor: `${statusTone.dot}40`,
            color: statusTone.text,
          }}
        >
          <span className="relative flex h-2 w-2">
            <motion.span
              className="absolute inset-0 rounded-full"
              style={{ background: statusTone.dot }}
              animate={{ scale: [1, 2.3], opacity: [0.65, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
            />
            <span className="relative h-2 w-2 rounded-full" style={{ background: statusTone.dot }} />
          </span>
          <span>{statusTone.label}</span>
          {messageCount > 0 && (
            <span className="hidden items-center gap-1.5 tabular-nums opacity-80 sm:inline-flex">
              <span>·</span>
              <span>{messageCount} msg</span>
              <span className="hidden md:inline">·</span>
              <span className="hidden md:inline">{tokens.toLocaleString()} tok</span>
            </span>
          )}
        </motion.div>

        {/* Search Action (⌘F / ⌘K) */}
        {messageCount > 0 && (
          <button
            type="button"
            onClick={() => {
              haptic(5);
              onOpenSearch();
            }}
            title="Suhbatdan qidirish (⌘F)"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/[0.07] dark:border-white/[0.1] bg-white/70 dark:bg-white/[0.06] text-neutral-700 dark:text-neutral-200 backdrop-blur-md transition hover:bg-white dark:hover:bg-white/15 active:scale-95"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </button>
        )}

        {/* Export Markdown Action */}
        {messageCount > 0 && (
          <button
            type="button"
            onClick={() => {
              haptic(8);
              onExportChat();
            }}
            title="Markdown sifatida eksport qilish"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/[0.07] dark:border-white/[0.1] bg-white/70 dark:bg-white/[0.06] text-neutral-700 dark:text-neutral-200 backdrop-blur-md transition hover:bg-white dark:hover:bg-white/15 active:scale-95"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
            </svg>
          </button>
        )}

        {/* Tablet/Phone Context Slide-Over Trigger */}
        <button
          type="button"
          onClick={() => {
            haptic(6);
            onOpenContextDrawer();
          }}
          title="Kontekst va tavsiyalar"
          className={`inline-flex h-8 items-center gap-1 rounded-full border border-black/[0.07] dark:border-white/[0.1] bg-white/70 dark:bg-white/[0.06] px-2.5 text-xs font-medium text-neutral-700 dark:text-neutral-200 backdrop-blur-md transition hover:bg-white dark:hover:bg-white/15 active:scale-95 ${
            viewMode === 'split' ? 'xl:hidden' : ''
          }`}
        >
          <svg className="h-3.5 w-3.5 text-[#0A84FF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3L12 3z" />
          </svg>
          <span className="hidden sm:inline">Kontekst</span>
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * 8. SPOTLIGHT SEARCH OVERLAY (⌘F / ⌘K) — iOS 27 Glass Sheet
 * ════════════════════════════════════════════════════════════════════════ */

function SpotlightSearchModal({
  open,
  query,
  onChangeQuery,
  onClose,
  messages,
}: {
  open: boolean;
  query: string;
  onChangeQuery: (q: string) => void;
  onClose: () => void;
  messages: Array<{ id?: string; role: string; content: string }>;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      const id = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(id);
    }
  }, [open]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return messages.filter((m) => (m.content || '').toLowerCase().includes(q));
  }, [messages, query]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-50 flex items-start justify-center bg-black/25 dark:bg-black/50 p-3 pt-14 sm:p-6 sm:pt-20 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.96 }}
            transition={SPRING.snappy}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg overflow-hidden rounded-3xl border border-white/60 dark:border-white/15 bg-white/85 dark:bg-[#1C1C1E]/90 shadow-[0_24px_64px_rgba(0,0,0,0.35)] backdrop-blur-3xl"
          >
            <div className="flex items-center gap-3 border-b border-black/[0.06] dark:border-white/[0.08] px-4 py-3">
              <svg className="h-4 w-4 text-[#0A84FF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => onChangeQuery(e.target.value)}
                placeholder="Suhbat ichidan qidirish…"
                className="flex-1 bg-transparent text-sm text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={onClose}
                className="rounded-full bg-black/5 dark:bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-neutral-600 dark:text-neutral-300"
              >
                ESC
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto p-2">
              {!query.trim() ? (
                <p className="py-6 text-center text-xs text-neutral-400">
                  Kalit so'zni kiriting (masalan, formula, kod yoki mavzu nomi)
                </p>
              ) : matches.length === 0 ? (
                <p className="py-6 text-center text-xs text-neutral-400">
                  Hech narsa topilmadi
                </p>
              ) : (
                matches.map((m, idx) => (
                  <div
                    key={m.id || idx}
                    className="mb-1.5 rounded-2xl border border-black/[0.04] dark:border-white/[0.06] bg-white/60 dark:bg-white/[0.04] p-3 text-xs"
                  >
                    <span className="mb-1 inline-block rounded-full bg-[#0A84FF]/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-[#0A84FF]">
                      {m.role === 'user' ? 'Siz' : 'M-EDU AI'}
                    </span>
                    <p className="line-clamp-3 text-neutral-700 dark:text-neutral-200">
                      {m.content}
                    </p>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * 9. SCROLL TO BOTTOM FAB — Liquid Capsule
 * ════════════════════════════════════════════════════════════════════════ */

function ScrollToBottomFab({
  visible,
  hasNew,
  onClick,
}: {
  visible: boolean;
  hasNew: boolean;
  onClick: () => void;
}) {
  const { t } = useI18n();
  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          onClick={() => {
            haptic(5);
            onClick();
          }}
          initial={{ opacity: 0, y: 14, scale: 0.88 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 14, scale: 0.88 }}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          transition={SPRING.snappy}
          aria-label={t('a11y.scrollToBottom')}
          className="absolute bottom-24 right-4 sm:right-6 z-30 flex h-10 items-center gap-1.5 rounded-full border border-white/60 dark:border-white/15 bg-white/85 dark:bg-[#1C1C1E]/85 px-3.5 text-xs font-semibold text-neutral-900 dark:text-white shadow-[0_12px_32px_-8px_rgba(0,0,0,0.35)] backdrop-blur-2xl"
        >
          <svg
            className="h-4 w-4 text-[#0A84FF]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 5v14M19 12l-7 7-7-7" />
          </svg>
          <span className="hidden sm:inline">Pastga</span>
          {hasNew && (
            <motion.span
              className="flex h-2.5 w-2.5 rounded-full bg-[#FF375F]"
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
              aria-hidden
            />
          )}
        </motion.button>
      )}
    </AnimatePresence>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * 10. MAIN COMPONENT — AiCopilot (Phone + Tablet + Desktop)
 * ════════════════════════════════════════════════════════════════════════ */

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

  /* ── UI States ── */
  const [clearOpen, setClearOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'full' | 'split'>('split');
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [scrollFabVisible, setScrollFabVisible] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelOption>(AI_MODELS[0]);

  /* ── Mobile / Tablet Glass Drawers & Spotlight Search ── */
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);
  const [mobileContextOpen, setMobileContextOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const isThinking = status === 'thinking' || status === 'sending' || status === 'streaming';
  const hasMessages = messages.length > 0;

  /* ── Derived Analytics ── */
  const tokenEstimate = useMemo(
    () => messages.reduce((acc, m) => acc + Math.round((m.content?.length ?? 0) / 4), 0),
    [messages],
  );

  /* ── Handlers ── */
  const handlePickPrompt = useCallback(
    (text: string): void => {
      if (canSend) {
        haptic(6);
        send(text);
        setMobileContextOpen(false);
      }
    },
    [canSend, send],
  );

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
    setMobileHistoryOpen(false);
    haptic(6);
  }, [clear, hasMessages, push]);

  const handleSelectConversation = useCallback(
    async (id: string) => {
      setActiveConversationId(id);
      setConversationId?.(id);
      setMobileHistoryOpen(false);
      haptic(5);
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
        // Fallback: keep current state
      }
    },
    [hydrate, setConversationId],
  );

  const handleDeleteConversation = useCallback(
    (id: string) => {
      if (activeConversationId === id || conversationId === id) {
        clear();
        setActiveConversationId(null);
      }
      push('info', "Suhbat o'chirildi");
    },
    [activeConversationId, clear, conversationId, push],
  );

  const handleExportChat = useCallback(async () => {
    if (!hasMessages) return;
    const md = messages
      .map((m) => `### ${m.role === 'user' ? '👤 Siz' : '🤖 M-EDU AI'}\n\n${m.content}\n`)
      .join('\n---\n\n');

    try {
      await navigator.clipboard.writeText(md);
      push('success', 'Suhbat Markdown formatida nusxalandi!');
    } catch {
      push('info', 'Eksport tayyor');
    }
  }, [hasMessages, messages, push]);

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

  /* ── Global Keyboard Shortcuts (Desktop / iPad Magic Keyboard) ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inInput = /INPUT|TEXTAREA|SELECT/.test(target.tagName) || target.isContentEditable;
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleNewChat();
      } else if (mod && (e.key.toLowerCase() === 'f' || e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        setSearchOpen((p) => !p);
      } else if (mod && e.key === '/') {
        e.preventDefault();
        push('info', 'Klaviatura: ⌘N yangi, ⌘K qidiruv, ⌘/ yordam, Esc yopish');
      } else if (e.key === 'Escape') {
        if (searchOpen) setSearchOpen(false);
        else if (mobileHistoryOpen) setMobileHistoryOpen(false);
        else if (mobileContextOpen) setMobileContextOpen(false);
        else if (clearOpen && !inInput) setClearOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleNewChat, clearOpen, searchOpen, mobileHistoryOpen, mobileContextOpen, push]);

  return (
    <div className="relative flex h-[calc(100dvh-5.5rem)] sm:h-[calc(100dvh-6.75rem)] lg:h-[calc(100dvh-7.75rem)] min-h-[22rem] min-w-0 flex-col overflow-hidden select-none sm:select-auto">
      <AmbientOrbs thinking={isThinking} />

      <motion.div
        variants={pageVariants}
        initial={reduced ? false : 'hidden'}
        animate="visible"
        className="relative z-10 flex min-h-0 flex-1 flex-col p-1.5 sm:p-3 lg:p-5"
      >
        <motion.div variants={blockVariants} className="flex min-h-0 flex-1">
          <LiquidGlassSurface>
            <SessionToneLine thinking={isThinking} />

            {/* ── 1. DESKTOP & TABLET HISTORY RAIL (Split Mode) ── */}
            {viewMode === 'split' && (
              <div className="hidden h-full shrink-0 border-r border-black/[0.05] dark:border-white/[0.07] bg-white/25 dark:bg-black/15 backdrop-blur-xl md:flex">
                <CopilotHistoryRail
                  collapsed={railCollapsed}
                  onToggleCollapse={() => setRailCollapsed((p) => !p)}
                  activeId={activeConversationId || conversationId || null}
                  onSelect={handleSelectConversation}
                  onNew={handleNewChat}
                  onDelete={handleDeleteConversation}
                />
              </div>
            )}

            {/* ── 2. CENTER CONVERSATION STAGE (Phone + Tablet + Desktop) ── */}
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

              {/* iOS 27 Dynamic Island Adaptive Bar */}
              <DynamicIslandBar
                online={online}
                status={status}
                messageCount={messages.length}
                tokens={tokenEstimate}
                selectedModel={selectedModel}
                onSelectModel={(m) => {
                  setSelectedModel(m);
                  push('info', `${m.label} tanlandi`);
                }}
                onOpenHistoryDrawer={() => setMobileHistoryOpen(true)}
                onOpenContextDrawer={() => setMobileContextOpen(true)}
                onOpenSearch={() => setSearchOpen(true)}
                onExportChat={handleExportChat}
                viewMode={viewMode}
              />

              {/* Messages Viewport */}
              <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="relative flex min-h-0 flex-1 flex-col overflow-y-auto scroll-smooth px-1 sm:px-2"
              >
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
              </div>

              <ScrollToBottomFab
                visible={scrollFabVisible && hasMessages}
                hasNew={isThinking}
                onClick={scrollToBottom}
              />

              {/* Specular Hairline Divider */}
              <span
                aria-hidden
                className="pointer-events-none relative h-px w-full shrink-0"
                style={{
                  background:
                    'linear-gradient(90deg, transparent 0%, rgba(120,120,128,0.18) 20%, rgba(120,120,128,0.18) 80%, transparent 100%)',
                }}
              />

              {/* Floating iOS 27 Composer Dock */}
              <div className="relative shrink-0 bg-white/40 dark:bg-black/20 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-2xl">
                <AiComposer
                  status={status}
                  onSend={send}
                  onStop={stop}
                  onClear={() => setClearOpen(true)}
                />
              </div>
            </div>

            {/* ── 3. DESKTOP CONTEXT PANEL (XL+) ── */}
            {viewMode === 'split' && (
              <div className="hidden h-full shrink-0 border-l border-black/[0.05] dark:border-white/[0.07] bg-white/25 dark:bg-black/15 backdrop-blur-xl xl:flex">
                <CopilotContextPanel
                  routeContext={routeContext}
                  onActionClick={handlePickPrompt}
                />
              </div>
            )}

            {/* ── 4. PHONE / TABLET LIQUID GLASS DRAWER: HISTORY ── */}
            <AnimatePresence>
              {mobileHistoryOpen && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setMobileHistoryOpen(false)}
                    className="absolute inset-0 z-40 bg-black/30 dark:bg-black/55 backdrop-blur-sm"
                  />
                  <motion.div
                    initial={{ x: '-100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '-100%' }}
                    transition={SPRING.sheet}
                    className="absolute inset-y-0 left-0 z-50 flex w-[84%] max-w-xs flex-col overflow-hidden rounded-r-[1.75rem] border-r border-white/50 dark:border-white/15 bg-white/90 dark:bg-[#16171D]/92 shadow-2xl backdrop-blur-3xl"
                  >
                    <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 px-4 py-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                        Suhbatlar tarixi
                      </span>
                      <button
                        type="button"
                        onClick={() => setMobileHistoryOpen(false)}
                        className="rounded-full bg-black/5 dark:bg-white/10 px-2.5 py-1 text-xs font-semibold"
                      >
                        Yopish
                      </button>
                    </div>
                    <div className="flex min-h-0 flex-1 overflow-y-auto">
                      <CopilotHistoryRail
                        collapsed={false}
                        onToggleCollapse={() => setMobileHistoryOpen(false)}
                        activeId={activeConversationId || conversationId || null}
                        onSelect={handleSelectConversation}
                        onNew={handleNewChat}
                        onDelete={handleDeleteConversation}
                      />
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            {/* ── 5. PHONE / TABLET SLIDE-OVER GLASS SHEET: CONTEXT ── */}
            <AnimatePresence>
              {mobileContextOpen && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setMobileContextOpen(false)}
                    className="absolute inset-0 z-40 bg-black/30 dark:bg-black/55 backdrop-blur-sm"
                  />
                  <motion.div
                    initial={{ x: '100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '100%' }}
                    transition={SPRING.sheet}
                    className="absolute inset-y-0 right-0 z-50 flex w-[86%] max-w-sm flex-col overflow-hidden rounded-l-[1.75rem] border-l border-white/50 dark:border-white/15 bg-white/90 dark:bg-[#16171D]/92 shadow-2xl backdrop-blur-3xl"
                  >
                    <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 px-4 py-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#0A84FF]">
                        AI Kontekst & Tavsiyalar
                      </span>
                      <button
                        type="button"
                        onClick={() => setMobileContextOpen(false)}
                        className="rounded-full bg-black/5 dark:bg-white/10 px-2.5 py-1 text-xs font-semibold"
                      >
                        Yopish
                      </button>
                    </div>
                    <div className="flex min-h-0 flex-1 overflow-y-auto">
                      <CopilotContextPanel
                        routeContext={routeContext}
                        onActionClick={handlePickPrompt}
                      />
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            {/* ── 6. SPOTLIGHT SEARCH MODAL (⌘F / ⌘K) ── */}
            <SpotlightSearchModal
              open={searchOpen}
              query={searchQuery}
              onChangeQuery={setSearchQuery}
              onClose={() => setSearchOpen(false)}
              messages={messages}
            />
          </LiquidGlassSurface>
        </motion.div>
      </motion.div>

      {/* Confirm Clear Dialog */}
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