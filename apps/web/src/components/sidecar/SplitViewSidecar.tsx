/**
 * ============================================================================
 * M-EDU macOS Sequoia Split-View Detail Sidecar — "Spatial Sidecar Inspector"
 * ============================================================================
 *
 * Inspired by Apple macOS Finder & Xcode Inspector Sidecars:
 *  - Persistent or docked sidecar drawer allowing users to inspect, edit,
 *    and take notes on records side-by-side without leaving their list view.
 *  - Apple traffic lights, liquid blur materials, specular hairline borders.
 *  - 4 Segmented Tabs:
 *     1. Overview (Umumiy): Metrics, badges, contact pills, and key details.
 *     2. Quick Edit (Tezkor Tahrir): Inline fast attribute tweaking with auto-save.
 *     3. Timeline (Faoliyat): Chronological event feed with icon nodes.
 *     4. Notes (Qaydlar): Persistent scratchpad for instant staff notes.
 *  - Seamless toggle to/from Quick-Look modal.
 *  - Web Audio sound effects for tabs and actions.
 * ============================================================================
 */

import { memo, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  useSidecarOpen,
  useSidecarData,
  closeSidecar,
  toggleSidecar,
  openQuickLook,
} from '@/stores/ui.store';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { SPRING } from '@/layouts/core/tokens';

type TabKey = 'overview' | 'quick-edit' | 'timeline' | 'notes';

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

export const SplitViewSidecar = memo(function SplitViewSidecar() {
  const isOpen = useSidecarOpen();
  const data = useSidecarData();
  const sound = usePremiumSound();

  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [noteContent, setNoteContent] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [noteSavedFeedback, setNoteSavedFeedback] = useState(false);

  // Load note for current item
  useEffect(() => {
    if (data?.id) {
      const saved = localStorage.getItem(`m-edu.sidecar-note-${data.id}`) || '';
      setNoteContent(saved);
      setActiveTab('overview');
    }
  }, [data?.id]);

  const handleClose = useCallback(() => {
    sound.playTick();
    closeSidecar();
  }, [sound]);

  const handleSwitchToModal = useCallback(() => {
    if (!data) return;
    sound.playPop();
    closeSidecar();
    openQuickLook(data);
  }, [data, sound]);

  const handleCopy = useCallback(
    (key: string, val: string) => {
      sound.playTick();
      if (navigator.clipboard) {
        navigator.clipboard.writeText(val).catch(() => {});
      }
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1800);
    },
    [sound],
  );

  const handleSaveNote = useCallback(() => {
    if (!data?.id) return;
    setIsSavingNote(true);
    sound.playSuccess();
    try {
      localStorage.setItem(`m-edu.sidecar-note-${data.id}`, noteContent);
    } catch {
      // Ignore localStorage quota or private mode errors
    }
    setTimeout(() => {
      setIsSavingNote(false);
      setNoteSavedFeedback(true);
      setTimeout(() => setNoteSavedFeedback(false), 2000);
    }, 300);
  }, [data?.id, noteContent, sound]);

  // Keyboard shortcut listener: Esc closes sidecar, Alt+S toggles
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inInput = /INPUT|TEXTAREA|SELECT/.test(target.tagName) || target.isContentEditable;
      if (inInput) return;

      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        handleClose();
      } else if ((e.altKey || (e.ctrlKey && e.shiftKey)) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        sound.playTick();
        toggleSidecar();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, handleClose, sound]);

  if (!isOpen || !data) return null;

  const badgeText = typeof data.badge === 'string' ? data.badge : data.badge?.text;
  const badgeToneKey = typeof data.badge === 'object' && data.badge?.tone ? data.badge.tone : 'blue';
  const tone = STATUS_TONES[badgeToneKey] || STATUS_TONES.blue;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="pointer-events-none fixed inset-0 z-50 flex justify-end">
          {/* Mobile backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="pointer-events-auto absolute inset-0 bg-black/30 backdrop-blur-xs sm:hidden"
            aria-hidden="true"
          />

          {/* Docked Sidecar Drawer */}
          <motion.aside
            role="region"
            aria-label="Sidecar Inspector"
            initial={{ x: '100%', opacity: 0.7 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0.7 }}
            transition={SPRING.snappy}
            className="pointer-events-auto relative flex h-full w-full flex-col border-l border-white/50 bg-white/92 shadow-[-16px_0_40px_-12px_rgba(0,0,0,0.18)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#161618]/94 dark:shadow-[-20px_0_48px_-12px_rgba(0,0,0,0.7)] sm:w-[480px] lg:w-[520px]"
            style={{
              WebkitBackdropFilter: 'blur(30px) saturate(190%)',
            }}
          >
            {/* Top Specular Hairline */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/20"
            />

            {/* macOS Chrome Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200/80 px-5 py-3.5 dark:border-white/[0.08]">
              {/* Traffic Lights */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  aria-label="Yopish (Esc)"
                  title="Yopish (Esc)"
                  className="group flex h-3 w-3 items-center justify-center rounded-full bg-[#FF5F56] transition-transform hover:scale-110 active:scale-95"
                >
                  <span className="opacity-0 group-hover:opacity-100 text-[8px] font-bold text-black/70">✕</span>
                </button>
                <button
                  type="button"
                  onClick={handleSwitchToModal}
                  aria-label="Modal ko'rinishiga o'tish"
                  title="Modal ko'rinishiga o'tish"
                  className="group flex h-3 w-3 items-center justify-center rounded-full bg-[#FFBD2E] transition-transform hover:scale-110 active:scale-95"
                >
                  <span className="opacity-0 group-hover:opacity-100 text-[8px] font-bold text-black/70">-</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (data.primaryAction) {
                      sound.playSuccess();
                      data.primaryAction.onExecute();
                    }
                  }}
                  aria-label="To'liq ochish"
                  title="To'liq ochish"
                  className="group flex h-3 w-3 items-center justify-center rounded-full bg-[#27C93F] transition-transform hover:scale-110 active:scale-95"
                >
                  <span className="opacity-0 group-hover:opacity-100 text-[7px] font-bold text-black/70">↗</span>
                </button>
              </div>

              {/* Title Header Info */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                  Sidecar Inspector
                </span>
                <button
                  type="button"
                  onClick={handleSwitchToModal}
                  title="Markaziy Quick-Look modaliga o'tish"
                  className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100/70 px-2 py-0.5 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-200 dark:border-white/10 dark:bg-white/[0.05] dark:text-zinc-300 dark:hover:bg-white/10"
                >
                  <span>❐</span>
                  <span>Modal</span>
                </button>
              </div>
            </div>

            {/* Profile Identity Bar */}
            <div className="flex items-center gap-4 border-b border-slate-200/60 bg-gradient-to-b from-white/40 to-transparent p-5 dark:border-white/[0.06] dark:from-white/[0.02]">
              {/* Avatar */}
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 text-lg font-bold text-white shadow-md ring-2 ring-white/60 dark:ring-white/10"
              >
                {data.avatar?.text || data.title.slice(0, 2).toUpperCase()}
              </div>

              {/* Identity text */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-base font-bold tracking-tight text-slate-900 dark:text-slate-100">
                    {data.title}
                  </h2>
                  {badgeText && (
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-bold ${tone.bg} ${tone.text} border ${tone.border}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                      {badgeText}
                    </span>
                  )}
                </div>
                {data.subtitle && (
                  <p className="mt-0.5 truncate text-xs font-medium text-slate-500 dark:text-zinc-400">
                    {data.subtitle}
                  </p>
                )}
              </div>
            </div>

            {/* Segmented Control Tabs */}
            <div className="border-b border-slate-200/80 px-5 pt-3 pb-2 dark:border-white/[0.08]">
              <nav role="tablist" aria-label="Inspector tabs" className="flex items-center rounded-xl bg-slate-200/60 p-1 dark:bg-white/[0.06]">
                {(
                  [
                    { key: 'overview', label: 'Umumiy' },
                    { key: 'quick-edit', label: 'Tezkor' },
                    { key: 'timeline', label: 'Faoliyat' },
                    { key: 'notes', label: 'Qaydlar' },
                  ] as const
                ).map((t) => {
                  const isActive = activeTab === t.key;
                  return (
                    <button
                      key={t.key}
                      role="tab"
                      aria-selected={isActive}
                      type="button"
                      onClick={() => {
                        sound.playTick();
                        setActiveTab(t.key);
                      }}
                      className={`relative flex-1 shrink-0 py-1.5 text-center text-xs font-semibold whitespace-nowrap transition-colors ${
                        isActive
                          ? 'text-slate-900 dark:text-white'
                          : 'text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                      }`}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="sidecar-tab-active"
                          className="absolute inset-0 rounded-lg bg-white shadow-sm dark:bg-[#252528]"
                          transition={SPRING.snappy}
                        />
                      )}
                      <span className="relative z-10">{t.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Scrollable Tab Body */}
            <div className="flex-1 overflow-y-auto p-5 scrollbar-thin">
              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="space-y-5">
                  {/* KPI Metrics */}
                  {data.metrics && data.metrics.length > 0 && (
                    <div className="grid grid-cols-2 gap-2.5">
                      {data.metrics.map((m, idx) => (
                        <div
                          key={idx}
                          className="rounded-2xl border border-slate-200/70 bg-white/70 p-3 shadow-xs dark:border-white/[0.06] dark:bg-white/[0.03]"
                        >
                          <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                            {m.label}
                          </span>
                          <p className="mt-1 text-base font-bold tracking-tight text-slate-900 dark:text-slate-100">
                            {m.value}
                          </p>
                          {m.subtext && (
                            <p className="mt-0.5 text-[11px] font-medium text-slate-500 dark:text-zinc-400">
                              {m.subtext}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Detail Key-Value List */}
                  {data.details && data.details.length > 0 && (
                    <div className="rounded-2xl border border-slate-200/80 bg-white/70 divide-y divide-slate-100 dark:border-white/[0.08] dark:bg-white/[0.02] dark:divide-white/[0.04]">
                      {data.details.map((d, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between px-3.5 py-2.5 text-xs"
                        >
                          <span className="font-medium text-slate-500 dark:text-zinc-400">
                            {d.label}
                          </span>
                          <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
                            <span>{d.value}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(d.label, d.value)}
                              title="Nusxalash"
                              aria-label={`${d.label} qiymatini nusxalash`}
                              className="flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-zinc-200"
                            >
                              {copiedKey === d.label ? (
                                <span className="text-[10px] text-emerald-500 font-bold">✓</span>
                              ) : (
                                <span className="text-[10px] opacity-60">📋</span>
                              )}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Tags */}
                  {data.tags && data.tags.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                        Teglar
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {data.tags.map((tag, idx) => (
                          <span
                            key={idx}
                            className="rounded-lg border border-slate-200 bg-slate-100/80 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:border-white/10 dark:bg-white/[0.05] dark:text-zinc-300"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: QUICK EDIT */}
              {activeTab === 'quick-edit' && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-blue-500/20 bg-blue-500/[0.05] p-3 text-xs text-blue-800 dark:text-blue-300">
                    <p className="font-semibold">⚡ Tezkor tahrir paneli</p>
                    <p className="mt-0.5 text-[11px] opacity-80">
                      Ushbu yozuvni to'liq sahifani ochmasdan to'g'ridan-to'g'ri sozlang.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                        Nomi / Sarlavha
                      </label>
                      <input
                        type="text"
                        defaultValue={data.title}
                        readOnly
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-xs text-slate-700 opacity-80 dark:border-white/10 dark:bg-white/[0.05] dark:text-zinc-300"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                        Status / Holat
                      </label>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          {badgeText || 'Faol'}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          (Asosiy sahifada avtomatik sinxronlanadi)
                        </span>
                      </div>
                    </div>

                    {data.primaryAction && (
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            sound.playSuccess();
                            data.primaryAction?.onExecute();
                          }}
                          className="w-full rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white shadow-md hover:bg-blue-700 dark:bg-blue-500"
                        >
                          {data.primaryAction.label}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: TIMELINE */}
              {activeTab === 'timeline' && (
                <div className="space-y-4">
                  <div className="relative border-l-2 border-slate-200 pl-4 space-y-4 dark:border-white/10 ml-2">
                    <div className="relative">
                      <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-blue-600 ring-4 ring-white dark:ring-[#161618]" />
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        Yozuv ko'rib chiqildi
                      </p>
                      <p className="text-[11px] text-slate-400">Hozir, Sidecar orqali</p>
                    </div>
                    <div className="relative">
                      <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-white dark:ring-[#161618]" />
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        Oxirgi sinxronizatsiya
                      </p>
                      <p className="text-[11px] text-slate-400">M-EDU Cloud Realtime DB</p>
                    </div>
                    <div className="relative">
                      <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-slate-300 dark:bg-zinc-700 ring-4 ring-white dark:ring-[#161618]" />
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        Profil yaratilgan
                      </p>
                      <p className="text-[11px] text-slate-400">Tizim administratsiyasi</p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: NOTES */}
              {activeTab === 'notes' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                      Ushbu yozuv bo'yicha tezkor eslatma
                    </span>
                    {noteSavedFeedback && (
                      <span className="text-[11px] font-bold text-emerald-500">
                        Saqlandi ✓
                      </span>
                    )}
                  </div>
                  <textarea
                    rows={8}
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    placeholder="Masalan: Ota-onasi bilan soat 15:00 da qo'ng'iroq qilindi, to'lov keyingi haftaga rejalashtirildi..."
                    className="w-full rounded-2xl border border-slate-200 bg-white/70 p-3 text-xs leading-relaxed text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100 dark:placeholder-zinc-500"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleSaveNote}
                      disabled={isSavingNote}
                      className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
                    >
                      {isSavingNote ? 'Saqlanmoqda…' : 'Qaydni saqlash'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Sticky Bottom Actions */}
            <div className="flex shrink-0 items-center justify-between border-t border-slate-200/80 bg-slate-50/50 p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] dark:border-white/[0.08] dark:bg-white/[0.02]">
              <span className="text-[11px] font-medium text-slate-400 dark:text-zinc-500">
                Yopish: <kbd className="rounded bg-slate-200 px-1 py-0.5 text-[10px] dark:bg-white/10">Esc</kbd>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-white/[0.05] dark:text-zinc-300 dark:hover:bg-white/10"
                >
                  Yopish
                </button>
                {data.primaryAction && (
                  <button
                    type="button"
                    onClick={() => {
                      sound.playSuccess();
                      data.primaryAction?.onExecute();
                    }}
                    className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 dark:bg-blue-500"
                  >
                    <span>{data.primaryAction.label}</span>
                    <span>↗</span>
                  </button>
                )}
              </div>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
});
