/**
 * ============================================================================
 * M-EDU macOS Sequoia Quick-Look Modal — v1.0 "Spatial Inspector"
 * ============================================================================
 *
 * Inspired by Apple macOS Finder Quick-Look:
 *  - Instant item preview without navigating away or losing table context
 *  - Triggered via [Spacebar] or dedicated Quick-Look action
 *  - Apple macOS traffic light controls & specular frosted glass material
 *  - Integrated Web Audio haptic chime feedback
 *  - Keyboard shortcuts: Space / Esc to dismiss, Enter to open full record
 * ============================================================================
 */

import { memo, useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUiSelector, closeQuickLook, openSidecar } from '@/stores/ui.store';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { SPRING } from '@/layouts/core/tokens';

const STATUS_TONES = {
  blue: {
    bg: 'bg-blue-500/10 dark:bg-blue-500/15',
    text: 'text-blue-700 dark:text-blue-400',
    border: 'border-blue-500/25',
    dot: 'bg-blue-600',
  },
  emerald: {
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-500/25',
    dot: 'bg-emerald-600',
  },
  amber: {
    bg: 'bg-amber-500/10 dark:bg-amber-500/15',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-500/25',
    dot: 'bg-amber-500',
  },
  rose: {
    bg: 'bg-rose-500/10 dark:bg-rose-500/15',
    text: 'text-rose-700 dark:text-rose-400',
    border: 'border-rose-500/25',
    dot: 'bg-rose-600',
  },
  purple: {
    bg: 'bg-purple-500/10 dark:bg-purple-500/15',
    text: 'text-purple-700 dark:text-purple-400',
    border: 'border-purple-500/25',
    dot: 'bg-purple-600',
  },
  slate: {
    bg: 'bg-slate-500/10 dark:bg-slate-500/15',
    text: 'text-slate-700 dark:text-slate-300',
    border: 'border-slate-500/25',
    dot: 'bg-slate-500',
  },
};

export const QuickLookModal = memo(function QuickLookModal() {
  const isOpen = useUiSelector((s) => s.isQuickLookOpen);
  const data = useUiSelector((s) => s.quickLookData);
  const sound = usePremiumSound();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const handleClose = useCallback(() => {
    sound.playTick();
    closeQuickLook();
  }, [sound]);

  // Handle keyboard: Escape or Space to close, Enter to execute primary action
  useEffect(() => {
    if (!isOpen) return;

    sound.playPop();

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inInput = /INPUT|TEXTAREA|SELECT/.test(target.tagName) || target.isContentEditable;
      if (inInput) return;

      if (e.key === 'Escape' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        handleClose();
        return;
      }

      if (e.key === 'Enter' && data?.primaryAction) {
        e.preventDefault();
        e.stopPropagation();
        sound.playSuccess();
        data.primaryAction.onExecute();
        closeQuickLook();
        return;
      }
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [isOpen, data, handleClose, sound]);

  const copyToClipboard = useCallback(
    (key: string, value: string) => {
      if (!navigator.clipboard) return;
      navigator.clipboard.writeText(value);
      setCopiedKey(key);
      sound.playTick();
      setTimeout(() => setCopiedKey(null), 1800);
    },
    [sound],
  );

  if (!isOpen || !data) return null;

  const badgeText = typeof data.badge === 'string' ? data.badge : data.badge?.text;
  const badgeToneKey = typeof data.badge === 'object' && data.badge?.tone ? data.badge.tone : 'blue';
  const tone = STATUS_TONES[badgeToneKey] || STATUS_TONES.blue;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 md:p-10">
        {/* Apple macOS Frosted Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={handleClose}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-md dark:bg-black/65"
          aria-hidden="true"
        />

        {/* Modal Card */}
        <motion.div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-label={data.title}
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={SPRING.smooth}
          className="relative z-10 flex max-h-[calc(100vh-2rem)] sm:max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-[1.6rem] border border-white/80 bg-white/90 shadow-[0_24px_70px_rgba(15,23,42,0.25),0_0_0_1px_rgba(15,23,42,0.06)] backdrop-blur-3xl dark:border-white/[0.12] dark:bg-[#0B0F19]/92 dark:shadow-[0_28px_80px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.06)]"
        >
          {/* Top Specular Hairline */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent dark:via-white/20"
          />

          {/* macOS Titlebar with Traffic Lights */}
          <div className="flex h-11 items-center justify-between border-b border-slate-200/60 bg-slate-100/50 px-4.5 dark:border-white/[0.08] dark:bg-white/[0.03]">
            <div className="flex items-center gap-2">
              {/* Traffic Lights */}
              <button
                type="button"
                onClick={handleClose}
                aria-label="Yopish"
                title="Yopish (Esc / Space)"
                className="group relative flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#FF5F56] transition-transform hover:scale-105 active:scale-95"
              >
                <span className="opacity-0 transition-opacity group-hover:opacity-100 text-[9px] font-bold text-red-950 leading-none">
                  ×
                </span>
              </button>
              <div
                className="h-3.5 w-3.5 rounded-full bg-[#FFBD2E] opacity-75"
                title="Minimallashtirish"
              />
              <div
                className="h-3.5 w-3.5 rounded-full bg-[#27C93F] opacity-75"
                title="Kengaytirish"
              />

              <span className="ml-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                macOS Quick-Look · {data.type}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  sound.playPop();
                  closeQuickLook();
                  openSidecar(data);
                }}
                title="Docked Sidecar Inspectorga o'tish"
                className="flex items-center gap-1 rounded-lg border border-slate-200/80 bg-white/70 px-2 py-0.5 text-[10.5px] font-semibold text-slate-600 transition-colors hover:bg-slate-200/70 dark:border-white/10 dark:bg-white/[0.06] dark:text-zinc-300 dark:hover:bg-white/10"
              >
                <span>◨</span>
                <span>Sidecar</span>
              </button>

              {/* Status Badge */}
              {badgeText && (
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold tracking-tight ${tone.bg} ${tone.text} ${tone.border}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                  {badgeText}
                </span>
              )}
            </div>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 scrollbar-thin">
            {/* Identity Strip */}
            <div className="flex items-start gap-4.5">
              <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] text-xl font-bold text-white shadow-md shadow-blue-500/20">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-2xl bg-[linear-gradient(180deg,rgba(255,255,255,0.4)_0%,rgba(255,255,255,0)_50%)]"
                />
                {data.avatar?.text || data.title.slice(0, 2).toUpperCase()}
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="truncate text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {data.title}
                </h3>
                {data.subtitle && (
                  <p className="mt-0.5 text-[13px] font-medium text-slate-500 dark:text-slate-400">
                    {data.subtitle}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                    ID: {data.id}
                  </span>
                  {data.tags?.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md bg-slate-100 px-2 py-0.5 text-[10.5px] font-medium text-slate-600 dark:bg-white/[0.06] dark:text-slate-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Metrics Grid */}
            {data.metrics && data.metrics.length > 0 && (
              <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {data.metrics.map((m, i) => (
                  <div
                    key={`${m.label}-${i}`}
                    className="rounded-xl border border-slate-200/70 bg-slate-50/70 p-3 dark:border-white/[0.08] dark:bg-white/[0.03]"
                  >
                    <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      {m.label}
                    </p>
                    <p className="mt-1 text-base font-bold tabular-nums tracking-tight text-slate-900 dark:text-white">
                      {m.value}
                    </p>
                    {m.subtext && (
                      <p className="mt-0.5 text-[10.5px] font-medium text-slate-500 dark:text-slate-400">
                        {m.subtext}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Details List */}
            {data.details && data.details.length > 0 && (
              <div className="mt-5 divide-y divide-slate-100 rounded-xl border border-slate-200/70 bg-white/60 p-1 dark:divide-white/[0.06] dark:border-white/[0.08] dark:bg-white/[0.02]">
                {data.details.map((d, i) => {
                  const isCopied = copiedKey === d.label;
                  return (
                    <div
                      key={`${d.label}-${i}`}
                      className="flex items-center justify-between px-3.5 py-2.5 text-[12.5px]"
                    >
                      <span className="font-medium text-slate-500 dark:text-slate-400">
                        {d.label}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {d.value}
                        </span>
                        {d.copyable !== false && (
                          <button
                            type="button"
                            onClick={() => copyToClipboard(d.label, d.value)}
                            title="Nusxalash"
                            className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-blue-600 transition hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30"
                          >
                            {isCopied ? 'Nusxalandi ✓' : 'Nusxa'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="flex flex-col-reverse gap-3 border-t border-slate-200/70 bg-slate-50/60 px-6 py-3.5 sm:flex-row sm:items-center sm:justify-between dark:border-white/[0.08] dark:bg-white/[0.02]">
            {/* Keyboard hints */}
            <div className="flex items-center gap-2 text-[11px] font-medium text-slate-400 dark:text-slate-500">
              <span className="inline-flex items-center gap-1 rounded bg-slate-200/80 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-700 dark:bg-white/10 dark:text-slate-300">
                Space / Esc
              </span>
              <span>yopish</span>
              <span className="opacity-40">·</span>
              <span className="inline-flex items-center gap-1 rounded bg-slate-200/80 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-700 dark:bg-white/10 dark:text-slate-300">
                ↵ Enter
              </span>
              <span>ochish</span>
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-2">
              {data.secondaryAction && (
                <button
                  type="button"
                  onClick={() => {
                    sound.playTick();
                    data.secondaryAction?.onExecute();
                    closeQuickLook();
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[12.5px] font-bold text-slate-700 transition hover:bg-slate-50 active:scale-97 dark:border-white/10 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/15"
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
                    closeQuickLook();
                  }}
                  className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-[12.5px] font-bold text-white shadow-sm shadow-blue-600/30 transition hover:bg-blue-500 active:scale-97"
                >
                  <span>{data.primaryAction.label}</span>
                  <span className="rounded bg-white/20 px-1 font-mono text-[10px]">↵</span>
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
});

export default QuickLookModal;
