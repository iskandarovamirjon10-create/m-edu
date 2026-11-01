/**
 * ============================================================================
 * M-EDU macOS Sequoia Quick-Look Modal — v2.0 "Spatial Inspector Ultra"
 * ============================================================================
 *
 * Architectural & UX Upgrades in v2.0:
 *  - Fixed AnimatePresence exit lifecycle (unmount animation now plays smoothly)
 *  - Interactive macOS Traffic Lights: Close (Red), Dock to Sidecar (Yellow),
 *    and Toggle Expanded Spatial View (Green) with layout projection
 *  - Memory-safe clipboard controller with animated SVG checkmarks
 *  - Automatic body scroll-lock & accessible focus restoration
 *  - Specular multi-layer glassmorphism with dynamic ambient status glow
 * ============================================================================
 */

import { memo, useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUiSelector, closeQuickLook, openSidecar } from '@/stores/ui.store';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { SPRING } from '@/layouts/core/tokens';

type ToneKey = 'blue' | 'emerald' | 'amber' | 'rose' | 'purple' | 'slate';

const STATUS_TONES: Record<
  ToneKey,
  {
    bg: string;
    text: string;
    border: string;
    dot: string;
    glow: string;
    gradient: string;
  }
> = {
  blue: {
    bg: 'bg-blue-500/10 dark:bg-blue-500/15',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-500/25 dark:border-blue-400/25',
    dot: 'bg-blue-600 dark:bg-blue-400',
    glow: 'from-blue-500/15 via-blue-500/5 to-transparent',
    gradient: 'from-blue-600 to-indigo-700 shadow-blue-500/25',
  },
  emerald: {
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-500/25 dark:border-emerald-400/25',
    dot: 'bg-emerald-600 dark:bg-emerald-400',
    glow: 'from-emerald-500/15 via-emerald-500/5 to-transparent',
    gradient: 'from-emerald-600 to-teal-700 shadow-emerald-500/25',
  },
  amber: {
    bg: 'bg-amber-500/10 dark:bg-amber-500/15',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-500/25 dark:border-amber-400/25',
    dot: 'bg-amber-500 dark:bg-amber-400',
    glow: 'from-amber-500/15 via-amber-500/5 to-transparent',
    gradient: 'from-amber-500 to-orange-600 shadow-amber-500/25',
  },
  rose: {
    bg: 'bg-rose-500/10 dark:bg-rose-500/15',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-500/25 dark:border-rose-400/25',
    dot: 'bg-rose-600 dark:bg-rose-400',
    glow: 'from-rose-500/15 via-rose-500/5 to-transparent',
    gradient: 'from-rose-600 to-pink-700 shadow-rose-500/25',
  },
  purple: {
    bg: 'bg-purple-500/10 dark:bg-purple-500/15',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-500/25 dark:border-purple-400/25',
    dot: 'bg-purple-600 dark:bg-purple-400',
    glow: 'from-purple-500/15 via-purple-500/5 to-transparent',
    gradient: 'from-purple-600 to-violet-700 shadow-purple-500/25',
  },
  slate: {
    bg: 'bg-slate-500/10 dark:bg-slate-500/15',
    text: 'text-slate-700 dark:text-slate-300',
    border: 'border-slate-500/25 dark:border-slate-400/20',
    dot: 'bg-slate-500 dark:bg-slate-400',
    glow: 'from-slate-500/15 via-slate-500/5 to-transparent',
    gradient: 'from-slate-700 to-slate-900 shadow-slate-500/25',
  },
};

export const QuickLookModal = memo(function QuickLookModal() {
  const isOpen = useUiSelector((s) => s.isQuickLookOpen);
  const data = useUiSelector((s) => s.quickLookData);
  const sound = usePremiumSound();

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const handleClose = useCallback(() => {
    sound.playTick();
    setIsExpanded(false);
    closeQuickLook();
  }, [sound]);

  const handleDockToSidecar = useCallback(() => {
    if (!data) return;
    sound.playPop();
    setIsExpanded(false);
    closeQuickLook();
    openSidecar(data);
  }, [data, sound]);

  const handleToggleExpand = useCallback(() => {
    sound.playTick();
    setIsExpanded((prev) => !prev);
  }, [sound]);

  // Cleanup copy timer on unmount
  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  // Lock body scroll & manage focus lifecycle when modal opens
  useEffect(() => {
    if (!isOpen || !data) return;

    previousFocusRef.current = document.activeElement as HTMLElement;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus modal container for immediate screen-reader & keyboard readiness
    requestAnimationFrame(() => {
      modalRef.current?.focus({ preventScroll: true });
    });

    return () => {
      document.body.style.overflow = originalOverflow;
      previousFocusRef.current?.focus?.({ preventScroll: true });
    };
  }, [isOpen, data]);

  // Global keyboard shortcuts: Space / Esc to close, Enter for primary action
  useEffect(() => {
    if (!isOpen || !data) return;

    sound.playPop();

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inEditable =
        /INPUT|TEXTAREA|SELECT/.test(target.tagName) || target.isContentEditable;
      if (inEditable) return;

      if (e.key === 'Escape' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        handleClose();
        return;
      }

      if (e.key === 'Enter' && data.primaryAction) {
        e.preventDefault();
        e.stopPropagation();
        sound.playSuccess();
        data.primaryAction.onExecute();
        setIsExpanded(false);
        closeQuickLook();
      }
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [isOpen, data, handleClose, sound]);

  const copyToClipboard = useCallback(
    async (key: string, value: string) => {
      if (!navigator.clipboard) return;
      try {
        await navigator.clipboard.writeText(value);
        setCopiedKey(key);
        sound.playTick();
        if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
        copyTimerRef.current = setTimeout(() => setCopiedKey(null), 1800);
      } catch {
        // Fallback silent ignore if clipboard permission denied
      }
    },
    [sound],
  );

  const badgeText = typeof data?.badge === 'string' ? data.badge : data?.badge?.text;
  const rawTone =
    typeof data?.badge === 'object' && data?.badge?.tone ? data.badge.tone : 'blue';
  const tone = STATUS_TONES[(rawTone as ToneKey) in STATUS_TONES ? (rawTone as ToneKey) : 'blue'];

  return (
    <AnimatePresence>
      {isOpen && data && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6 md:p-10">
          {/* Apple macOS Sequoia Frosted Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            onClick={handleClose}
            className="
              absolute inset-0 backdrop-blur-md
              bg-slate-950/35 dark:bg-black/70
            "
            aria-hidden="true"
          />

          {/* Spatial Modal Window */}
          <motion.div
            ref={modalRef}
            layout
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="quicklook-modal-title"
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 14 }}
            transition={SPRING.smooth}
            className={`
              relative z-10 flex w-full flex-col overflow-hidden outline-none
              rounded-[1.75rem] border border-white/80 dark:border-white/[0.12]
              bg-white/88 dark:bg-[#0B0F17]/90
              backdrop-blur-3xl saturate-150
              shadow-[0_28px_80px_-12px_rgba(15,23,42,0.32),0_0_0_1px_rgba(15,23,42,0.06)]
              dark:shadow-[0_32px_90px_-12px_rgba(0,0,0,0.85),0_0_0_1px_rgba(255,255,255,0.07)]
              ${
                isExpanded
                  ? 'max-w-3xl max-h-[90vh]'
                  : 'max-w-xl max-h-[calc(100vh-2rem)] sm:max-h-[85vh]'
              }
            `}
          >
            {/* Ambient Top Radial Glow */}
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b ${tone.glow}`}
            />

            {/* Top Specular Hairline */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent dark:via-white/25"
            />

            {/* macOS Sequoia Titlebar */}
            <div className="relative flex h-12 shrink-0 select-none items-center justify-between border-b border-slate-200/70 bg-slate-100/60 px-4.5 dark:border-white/[0.08] dark:bg-white/[0.03]">
              <div className="flex items-center gap-2">
                {/* Interactive Traffic Lights */}
                <div className="group/lights flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    aria-label="Yopish"
                    title="Yopish (Esc / Space)"
                    className="relative flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#FF5F56] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)] transition-transform active:scale-90"
                  >
                    <svg
                      viewBox="0 0 12 12"
                      className="h-2 w-2 stroke-[#4D0000] stroke-[2] opacity-0 transition-opacity group-hover/lights:opacity-100"
                    >
                      <path d="M3 3l6 6M9 3L3 9" strokeLinecap="round" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    onClick={handleDockToSidecar}
                    aria-label="Sidecar panelga o'tkazish"
                    title="Sidecar Inspectorga biriktirish"
                    className="relative flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#FFBD2E] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)] transition-transform active:scale-90"
                  >
                    <svg
                      viewBox="0 0 12 12"
                      className="h-2 w-2 stroke-[#5A3000] stroke-[2] opacity-0 transition-opacity group-hover/lights:opacity-100"
                    >
                      <path d="M2.5 6h7" strokeLinecap="round" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleExpand}
                    aria-label={isExpanded ? 'Kichraytirish' : 'Kengaytirish'}
                    title={isExpanded ? 'Standart o‘lcham' : 'Kengaytirilgan ko‘rinish'}
                    className="relative flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#27C93F] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)] transition-transform active:scale-90"
                  >
                    <svg
                      viewBox="0 0 12 12"
                      className="h-2 w-2 fill-[#003D00] opacity-0 transition-opacity group-hover/lights:opacity-100"
                    >
                      <path d="M2.5 9.5v-4l4 4h-4zm7-7v4l-4-4h4z" />
                    </svg>
                  </button>
                </div>

                <div className="mx-1.5 h-3.5 w-px bg-slate-300/70 dark:bg-white/10" />

                <span className="font-mono text-[10.5px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  Quick-Look · {data.type}
                </span>
              </div>

              {/* Right Titlebar Controls */}
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleDockToSidecar}
                  title="Docked Sidecar Inspectorga o'tish"
                  className="
                    group inline-flex items-center gap-1.5 rounded-lg
                    border border-slate-200/80 dark:border-white/10
                    bg-white/80 dark:bg-white/[0.06]
                    px-2.5 py-1 text-[11px] font-semibold
                    text-slate-600 dark:text-slate-300
                    shadow-2xs transition-all
                    hover:border-slate-300 hover:bg-white dark:hover:bg-white/12
                    active:scale-95
                  "
                >
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    className="h-3.5 w-3.5 text-slate-400 transition-colors group-hover:text-blue-500 dark:text-slate-400"
                  >
                    <rect
                      x="2"
                      y="2.5"
                      width="12"
                      height="11"
                      rx="2"
                      stroke="currentColor"
                      strokeWidth="1.4"
                    />
                    <path d="M9.5 2.5v11" stroke="currentColor" strokeWidth="1.4" />
                  </svg>
                  <span>Sidecar</span>
                </button>

                {badgeText && (
                  <span
                    className={`
                      inline-flex items-center gap-1.5 rounded-full border
                      px-2.5 py-0.5 text-[11px] font-bold tracking-tight
                      ${tone.bg} ${tone.text} ${tone.border}
                    `}
                  >
                    <span className="relative flex h-1.5 w-1.5">
                      <span
                        className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${tone.dot}`}
                      />
                      <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                    </span>
                    {badgeText}
                  </span>
                )}
              </div>
            </div>

            {/* Body Content */}
            <div className="relative flex-1 overflow-y-auto p-5 sm:p-6 scrollbar-thin">
              {/* Identity Hero Strip */}
              <div className="flex items-start gap-4 sm:gap-5">
                <div
                  className={`
                    relative flex h-16 w-16 shrink-0 select-none items-center justify-center
                    rounded-2xl bg-gradient-to-br ${tone.gradient}
                    text-xl font-extrabold tracking-tight text-white shadow-lg
                  `}
                >
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 rounded-2xl bg-[linear-gradient(180deg,rgba(255,255,255,0.38)_0%,rgba(255,255,255,0)_55%)] ring-1 ring-inset ring-white/30"
                  />
                  <span className="relative drop-shadow-xs">
                    {data.avatar?.text || data.title.slice(0, 2).toUpperCase()}
                  </span>
                </div>

                <div className="min-w-0 flex-1 pt-0.5">
                  <h3
                    id="quicklook-modal-title"
                    className="truncate text-xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-[21px]"
                  >
                    {data.title}
                  </h3>

                  {data.subtitle && (
                    <p className="mt-0.5 line-clamp-2 text-[13px] font-medium text-slate-500 dark:text-slate-400">
                      {data.subtitle}
                    </p>
                  )}

                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => copyToClipboard('__id__', String(data.id))}
                      title="ID raqamdan nusxa olish"
                      className="
                        inline-flex items-center gap-1 rounded-md
                        border border-slate-200/80 dark:border-white/10
                        bg-slate-100/80 dark:bg-white/[0.05]
                        px-2 py-0.5 font-mono text-[11px] font-semibold
                        text-slate-500 dark:text-slate-400
                        transition-colors hover:border-blue-500/30 hover:text-blue-600 dark:hover:text-blue-400
                      "
                    >
                      <span>ID: {data.id}</span>
                      {copiedKey === '__id__' && (
                        <span className="text-emerald-500">✓</span>
                      )}
                    </button>

                    {data.tags?.map((tag) => (
                      <span
                        key={tag}
                        className="
                          rounded-md border border-slate-200/60 dark:border-white/[0.07]
                          bg-white/70 dark:bg-white/[0.04]
                          px-2 py-0.5 text-[11px] font-semibold
                          text-slate-600 dark:text-slate-300
                        "
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bento Metrics Grid */}
              {data.metrics && data.metrics.length > 0 && (
                <div
                  className={`mt-6 grid gap-2.5 ${
                    isExpanded ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-4'
                  }`}
                >
                  {data.metrics.map((m, i) => (
                    <motion.div
                      key={`${m.label}-${i}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.035, duration: 0.2 }}
                      className="
                        group relative overflow-hidden rounded-2xl
                        border border-slate-200/80 dark:border-white/[0.08]
                        bg-gradient-to-b from-white/90 to-slate-50/70
                        dark:from-white/[0.05] dark:to-white/[0.02]
                        p-3.5 shadow-2xs transition-all
                        hover:border-slate-300/90 dark:hover:border-white/[0.14]
                      "
                    >
                      <p className="truncate text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        {m.label}
                      </p>
                      <p className="mt-1 truncate text-[17px] font-extrabold tabular-nums tracking-tight text-slate-900 dark:text-white">
                        {m.value}
                      </p>
                      {m.subtext && (
                        <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          {m.subtext}
                        </p>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Inspector Key-Value Details List */}
              {data.details && data.details.length > 0 && (
                <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200/80 bg-white/70 shadow-2xs dark:border-white/[0.08] dark:bg-white/[0.02]">
                  <div className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                    {data.details.map((d, i) => {
                      const isCopied = copiedKey === d.label;
                      const canCopy = d.copyable !== false && Boolean(d.value);

                      return (
                        <motion.div
                          key={`${d.label}-${i}`}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.05 + i * 0.02 }}
                          className="
                            group flex items-center justify-between gap-4
                            px-4 py-2.5 text-[13px] transition-colors
                            hover:bg-slate-50/80 dark:hover:bg-white/[0.03]
                          "
                        >
                          <span className="shrink-0 font-medium text-slate-500 dark:text-slate-400">
                            {d.label}
                          </span>

                          <div className="flex min-w-0 items-center gap-2">
                            <span className="truncate font-semibold text-slate-900 dark:text-slate-100">
                              {d.value}
                            </span>

                            {canCopy && (
                              <button
                                type="button"
                                onClick={() => copyToClipboard(d.label, String(d.value))}
                                title="Nusxalash"
                                className={`
                                  inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5
                                  text-[10.5px] font-semibold transition-all
                                  ${
                                    isCopied
                                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                      : 'bg-slate-100 text-slate-600 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-blue-500/10 hover:text-blue-600 dark:bg-white/[0.07] dark:text-slate-300 dark:hover:text-blue-400'
                                  }
                                `}
                              >
                                {isCopied ? (
                                  <>
                                    <svg
                                      viewBox="0 0 12 12"
                                      fill="none"
                                      className="h-3 w-3 stroke-current stroke-[2]"
                                    >
                                      <path
                                        d="M2.5 6.5l2.2 2.2 4.8-5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                    </svg>
                                    <span>Nusxalandi</span>
                                  </>
                                ) : (
                                  <span>Nusxa</span>
                                )}
                              </button>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* macOS Action Footer */}
            <div className="flex flex-col-reverse gap-3 border-t border-slate-200/70 bg-slate-50/80 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:border-white/[0.08] dark:bg-white/[0.02]">
              {/* Tactile Keycap Hints */}
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-slate-400 dark:text-slate-500">
                <kbd className="inline-flex items-center rounded-md border border-slate-300/80 bg-white px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-600 shadow-[0_1px_0_rgba(0,0,0,0.08)] dark:border-white/15 dark:bg-white/10 dark:text-slate-300">
                  Space
                </kbd>
                <span>yoki</span>
                <kbd className="inline-flex items-center rounded-md border border-slate-300/80 bg-white px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-600 shadow-[0_1px_0_rgba(0,0,0,0.08)] dark:border-white/15 dark:bg-white/10 dark:text-slate-300">
                  Esc
                </kbd>
                <span>yopish</span>

                {data.primaryAction && (
                  <>
                    <span className="mx-0.5 opacity-40">·</span>
                    <kbd className="inline-flex items-center rounded-md border border-slate-300/80 bg-white px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-600 shadow-[0_1px_0_rgba(0,0,0,0.08)] dark:border-white/15 dark:bg-white/10 dark:text-slate-300">
                      ↵ Enter
                    </kbd>
                    <span>ochish</span>
                  </>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5">
                {data.secondaryAction && (
                  <button
                    type="button"
                    onClick={() => {
                      sound.playTick();
                      data.secondaryAction?.onExecute();
                      setIsExpanded(false);
                      closeQuickLook();
                    }}
                    className="
                      rounded-xl border border-slate-200/90 dark:border-white/12
                      bg-white dark:bg-white/[0.07]
                      px-3.5 py-2 text-[12.5px] font-bold
                      text-slate-700 dark:text-slate-200
                      shadow-2xs transition-all
                      hover:bg-slate-50 dark:hover:bg-white/12
                      active:scale-97
                    "
                  >
                    {data.secondaryAction.label}
                  </button>
                )}

                {data.primaryAction && (
                  <button
                    type="button"
                    onClick={() => {
                      sound.playSuccess();
                      data.primaryAction?.onExecute();
                      setIsExpanded(false);
                      closeQuickLook();
                    }}
                    className="
                      group relative inline-flex items-center gap-2 overflow-hidden
                      rounded-xl bg-gradient-to-b from-blue-500 to-blue-600
                      px-4 py-2 text-[12.5px] font-bold text-white
                      shadow-[0_4px_14px_rgba(37,99,235,0.35),inset_0_1px_0_rgba(255,255,255,0.25)]
                      transition-all hover:from-blue-500 hover:to-blue-500
                      active:scale-97
                    "
                  >
                    <span>{data.primaryAction.label}</span>
                    <kbd className="rounded bg-white/20 px-1.5 py-0.2 font-mono text-[10px] font-semibold text-white/95">
                      ↵
                    </kbd>
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
});

export default QuickLookModal;