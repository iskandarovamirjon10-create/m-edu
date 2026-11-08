/**
 * M-EDU Bulk Student Action Modals — Cupertino Spatial Studio
 *
 * Enterprise Batch Operations Studio:
 *  1. BulkAssignGroupModal — Group enrollment with live occupancy & animated capacity telemetry
 *  2. BulkStatusModal — Spatial status transitions (Active, Paused, Graduated, Inactive, Dropped)
 *  3. BulkBadgesStudioModal — Printable Apple Wallet ID Passes with RealQrCode & SVG Code-128 Barcode
 *  4. BulkNotificationModal — Multi-channel SMS/Telegram broadcast with iOS 18 iMessage live simulator
 */

import React, { useState, useMemo, useRef, memo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GlassModal,
  GlassButton,
  GlassField,
  GlassSelect,
  GlassTextArea,
} from '@/components/ui';
import { RealQrCode } from '@/components/ui/RealQrCode';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { fullName } from '@/lib/format';
import type { Student, Group } from '@/lib/types';

/* ══════════════════════════════════════════════════════════════════════════
 * MOTION & DESIGN TOKENS — 120Hz ProMotion Physics
 * ════════════════════════════════════════════════════════════════════════ */

const SPRING = {
  snappy: { type: 'spring' as const, stiffness: 520, damping: 34, mass: 0.58 },
  smooth: { type: 'spring' as const, stiffness: 340, damping: 30, mass: 0.82 },
  bounce: { type: 'spring' as const, stiffness: 420, damping: 24, mass: 0.7 },
} as const;

const EASE_OUT_EXPO = [0.22, 1, 0.36, 1] as const;

/* ══════════════════════════════════════════════════════════════════════════
 * PRECISION VECTOR ICONS (SF Symbols Inspired)
 * ════════════════════════════════════════════════════════════════════════ */

const I = {
  users: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M22 21v-2a4 4 0 0 0-3-3.87',
    'M16 3.13a4 4 0 0 1 0 7.75',
  ],
  checkCircle: ['M22 11.08V12a10 10 0 1 1-5.93-9.14', 'M22 4 12 14.01l-3-3'],
  snowflake: [
    'M12 2v20',
    'M17 5 7 19',
    'M7 5 17 19',
    'M2 12h20',
    'M20 9l-4 3 4 3',
    'M4 9l4 3-4 3',
  ],
  award: [
    'M12 15a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z',
    'M8.21 13.89 7 23l5-3 5 3-1.21-9.12',
  ],
  archive: [
    'M21 8v13H3V8',
    'M1 3h22v5H1z',
    'M10 12h4',
  ],
  userMinus: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M22 11h-6',
  ],
  printer: [
    'M6 9V2h12v7',
    'M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2',
    'M6 14h12v8H6z',
  ],
  sparkles: [
    'M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z',
  ],
  send: ['M22 2 11 13', 'M22 2l-7 20-4-9-9-4 20-7z'],
  shieldCheck: [
    'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    'm9 12 2 2 4-4',
  ],
  layers: [
    'm12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z',
    'm22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65',
    'm22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65',
  ],
  check: ['M20 6 9 17l-5-5'],
  sun: [
    'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z',
    'M12 1v2',
    'M12 21v2',
    'M4.22 4.22l1.42 1.42',
    'M18.36 18.36l1.42 1.42',
    'M1 12h2',
    'M21 12h2',
  ],
  moon: ['M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z'],
} as const;

const SFIcon = memo(function SFIcon({
  paths,
  size = 16,
  className = '',
  strokeWidth = 1.9,
}: {
  paths: readonly string[];
  size?: number;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * SHARED MICRO-HELPERS (Squircle Palettes & Deterministic Code-128 Barcode)
 * ════════════════════════════════════════════════════════════════════════ */

const AVATAR_GRADIENTS: ReadonlyArray<readonly [string, string]> = [
  ['#0F172A', '#2563EB'],
  ['#1E3A8A', '#3B82F6'],
  ['#312E81', '#6366F1'],
  ['#064E3B', '#10B981'],
  ['#78350F', '#F59E0B'],
  ['#134E4A', '#14B8A6'],
  ['#4C1D95', '#8B5CF6'],
  ['#831843', '#EC4899'],
];

function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function getInitials(name?: string | null): string {
  if (!name || typeof name !== 'string') return '—';
  return (
    name
      .trim()
      .split(/\s+/)
      .map((w) => w.charAt(0))
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'M'
  );
}

function getAvatarGradient(name: string): string {
  const [a, b] = AVATAR_GRADIENTS[hashString(name) % AVATAR_GRADIENTS.length];
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

/** Deterministic SVG Code-128 style vector barcode generator */
const VectorCode128Barcode = memo(function VectorCode128Barcode({
  value,
  className = '',
}: {
  value: string;
  className?: string;
}) {
  const bars = useMemo(() => {
    const clean = value || 'MEDU-PASS';
    const result: { x: number; w: number }[] = [];
    let cursor = 0;
    // Start guard pattern
    result.push({ x: cursor, w: 2 });
    cursor += 3;
    result.push({ x: cursor, w: 1 });
    cursor += 2;

    for (let i = 0; i < Math.max(14, clean.length); i += 1) {
      const code = clean.charCodeAt(i % clean.length) + i * 17;
      const w1 = (code % 3) + 1;
      const g1 = ((code >> 2) % 2) + 1;
      const w2 = ((code >> 4) % 2) + 1;
      const g2 = ((code >> 6) % 2) + 1;
      result.push({ x: cursor, w: w1 });
      cursor += w1 + g1;
      result.push({ x: cursor, w: w2 });
      cursor += w2 + g2;
    }
    // Stop guard pattern
    result.push({ x: cursor, w: 2 });
    cursor += 3;
    result.push({ x: cursor, w: 1.5 });
    cursor += 2;
    return { items: result, totalWidth: cursor };
  }, [value]);

  return (
    <svg
      viewBox={`0 0 ${bars.totalWidth} 24`}
      preserveAspectRatio="none"
      className={className}
      aria-label={`Barcode ${value}`}
    >
      {bars.items.map((b, idx) => (
        <rect
          key={idx}
          x={b.x}
          y={0}
          width={b.w}
          height={24}
          rx={0.4}
          fill="currentColor"
        />
      ))}
    </svg>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * 1. BULK ASSIGN GROUP MODAL — Spatial Capacity & Roster Studio
 * ════════════════════════════════════════════════════════════════════════ */

interface BulkAssignGroupModalProps {
  open: boolean;
  onClose: () => void;
  students: Student[];
  groups: Group[];
  loading?: boolean;
  onAssign: (groupId: string) => void;
}

export const BulkAssignGroupModal = memo(function BulkAssignGroupModal({
  open,
  onClose,
  students,
  groups,
  loading = false,
  onAssign,
}: BulkAssignGroupModalProps) {
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [showAllStudents, setShowAllStudents] = useState(false);
  const { playPop, playTick } = usePremiumSound();

  const activeGroups = useMemo(
    () => groups.filter((g) => g.isActive !== false),
    [groups],
  );
  const targetGroup = useMemo(
    () => activeGroups.find((g) => g.id === selectedGroupId),
    [activeGroups, selectedGroupId],
  );

  // Estimate current group occupancy safely if provided on Group object
  const occupancyTelemetry = useMemo(() => {
    if (!targetGroup) return null;
    const rawGroup = targetGroup as Group & {
      studentCount?: number;
      _count?: { students?: number };
    };
    const currentCount =
      rawGroup.studentCount ?? rawGroup._count?.students ?? 0;
    const capacity = targetGroup.capacity || 24;
    const projectedCount = currentCount + students.length;
    const currentPct = Math.min(100, Math.round((currentCount / capacity) * 100));
    const addedPct = Math.min(
      100 - currentPct,
      Math.round((students.length / capacity) * 100),
    );
    const isOverCapacity = projectedCount > capacity;

    return {
      currentCount,
      capacity,
      projectedCount,
      currentPct,
      addedPct,
      isOverCapacity,
    };
  }, [targetGroup, students.length]);

  const visibleStudents = showAllStudents ? students : students.slice(0, 12);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroupId) return;
    playPop();
    onAssign(selectedGroupId);
  };

  return (
    <GlassModal
      open={open}
      onClose={onClose}
      title="Guruhga ommaviy biriktirish"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Selected Roster Pill Showcase */}
        <div className="relative overflow-hidden rounded-[20px] border border-blue-500/20 bg-gradient-to-br from-blue-500/[0.08] via-sky-500/[0.04] to-transparent p-4 dark:border-sky-400/20">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#007AFF]/15 text-[#007AFF] dark:bg-sky-400/20 dark:text-sky-300">
                <SFIcon paths={I.users} size={14} />
              </div>
              <span className="text-[12.5px] font-bold text-slate-800 dark:text-slate-100">
                Tanlangan talabalar tarkibi
              </span>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#007AFF]/15 px-2.5 py-0.5 text-[11px] font-extrabold text-[#007AFF] tabular-nums dark:bg-sky-400/20 dark:text-sky-300">
              {students.length} nafar
            </span>
          </div>

          <div className="mt-3 flex max-h-32 flex-wrap gap-1.5 overflow-y-auto pr-1">
            {visibleStudents.map((s) => {
              const name =
                fullName(s.user?.firstName, s.user?.lastName) || 'Talaba';
              return (
                <span
                  key={s.id}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-black/[0.06] bg-white/85 py-1 pl-1 pr-2.5 text-[11.5px] font-semibold text-slate-800 shadow-2xs dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200"
                >
                  <span
                    className="flex h-4.5 w-4.5 items-center justify-center rounded-[6px] text-[9px] font-extrabold text-white"
                    style={{ background: getAvatarGradient(name) }}
                  >
                    {getInitials(name)}
                  </span>
                  <span className="max-w-[130px] truncate">{name}</span>
                </span>
              );
            })}
            {students.length > 12 && (
              <button
                type="button"
                onClick={() => setShowAllStudents((v) => !v)}
                className="inline-flex items-center rounded-xl border border-blue-500/25 bg-blue-500/10 px-2.5 py-1 text-[11px] font-bold text-[#007AFF] transition hover:bg-blue-500/20 dark:text-sky-300"
              >
                {showAllStudents
                  ? "Kamroq ko'rsatish"
                  : `+${students.length - 12} ta barchasini ko'rish`}
              </button>
            )}
          </div>
        </div>

        {/* Quick Group Cards + Dropdown Selector */}
        <GlassField label="Qaysi guruhga biriktirilsin?" required>
          <GlassSelect
            value={selectedGroupId}
            onChange={(e) => {
              playTick();
              setSelectedGroupId(e.target.value);
            }}
            required
          >
            <option value="">Maqsadli guruhni tanlang...</option>
            {activeGroups.map((g) => {
              const capStr = g.capacity ? ` · Sig'im: ${g.capacity} ta` : '';
              return (
                <option key={g.id} value={g.id}>
                  {g.name}
                  {capStr}
                </option>
              );
            })}
          </GlassSelect>
        </GlassField>

        {/* Fast Tap Group Pills (Top 6 Groups) */}
        {activeGroups.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Tezkor tanlash
            </span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {activeGroups.slice(0, 6).map((g) => {
                const isSelected = g.id === selectedGroupId;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => {
                      playTick();
                      setSelectedGroupId(g.id);
                    }}
                    className={[
                      'group relative flex items-center justify-between gap-2 overflow-hidden rounded-xl border px-3 py-2 text-left transition-all duration-150',
                      isSelected
                        ? 'border-[#007AFF] bg-[#007AFF]/10 text-[#007AFF] shadow-xs dark:border-sky-400 dark:bg-sky-400/15 dark:text-sky-300'
                        : 'border-slate-200/80 bg-white/60 text-slate-700 hover:border-slate-300 hover:bg-white dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300',
                    ].join(' ')}
                  >
                    <span className="truncate text-[12px] font-bold">
                      {g.name}
                    </span>
                    {g.capacity && (
                      <span className="shrink-0 rounded-md bg-black/[0.04] px-1.5 py-0.5 font-mono text-[10px] font-bold opacity-75 dark:bg-white/10">
                        {g.capacity}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Live Group Capacity & Telemetry Card */}
        <AnimatePresence mode="wait">
          {targetGroup && occupancyTelemetry && (
            <motion.div
              key={targetGroup.id}
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={SPRING.smooth}
              className="rounded-[18px] border border-slate-200/80 bg-slate-50/90 p-3.5 dark:border-white/10 dark:bg-surface-800/80"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10B981]" />
                  <span className="text-[13px] font-extrabold text-slate-900 dark:text-white">
                    {targetGroup.name}
                  </span>
                </div>
                <span
                  className={[
                    'rounded-full px-2 py-0.5 text-[10.5px] font-extrabold tabular-nums',
                    occupancyTelemetry.isOverCapacity
                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                      : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
                  ].join(' ')}
                >
                  +{students.length} yangi a&apos;zo · Sig&apos;im:{' '}
                  {occupancyTelemetry.capacity} ta
                </span>
              </div>

              {/* Segmented Apple Storage-style Capacity Bar */}
              <div className="mt-2.5 flex h-2 w-full overflow-hidden rounded-full bg-slate-200/80 p-0.5 dark:bg-white/10">
                {occupancyTelemetry.currentPct > 0 && (
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${occupancyTelemetry.currentPct}%` }}
                    transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
                    className="h-full rounded-l-full bg-slate-500 dark:bg-slate-400"
                  />
                )}
                <motion.div
                  initial={{ width: 0 }}
                  animate={{
                    width: `${Math.max(8, occupancyTelemetry.addedPct)}%`,
                  }}
                  transition={{ duration: 0.65, ease: EASE_OUT_EXPO }}
                  className={`h-full rounded-full ${
                    occupancyTelemetry.isOverCapacity
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                      : 'bg-gradient-to-r from-[#007AFF] to-sky-400'
                  }`}
                />
              </div>

              <p className="mt-2 text-[11.5px] text-slate-500 dark:text-slate-400">
                Tanlangan{' '}
                <strong className="text-slate-800 dark:text-slate-200">
                  {students.length} ta talaba
                </strong>{' '}
                darhol guruh jurnaliga va dars jadvaliga faol o&apos;quvchi
                sifatida biriktiriladi.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action Footer */}
        <div className="flex justify-end gap-2.5 pt-2">
          <GlassButton
            type="button"
            variant="secondary"
            disabled={loading}
            onClick={onClose}
          >
            Bekor qilish
          </GlassButton>
          <GlassButton
            type="submit"
            variant="primary"
            disabled={!selectedGroupId || loading}
            loading={loading}
          >
            {loading ? 'Biriktirilmoqda...' : 'Guruhga biriktirish'}
          </GlassButton>
        </div>
      </form>
    </GlassModal>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * 2. BULK STATUS MODAL — Spatial Radio Cards (All 5 States Supported)
 * ════════════════════════════════════════════════════════════════════════ */

type BulkStudentStatus =
  | 'ACTIVE'
  | 'PAUSED'
  | 'INACTIVE'
  | 'GRADUATED'
  | 'DROPPED';

interface BulkStatusModalProps {
  open: boolean;
  onClose: () => void;
  students: Student[];
  loading?: boolean;
  onUpdateStatus: (status: BulkStudentStatus) => void;
}

const STATUS_CONFIG: ReadonlyArray<{
  value: BulkStudentStatus;
  label: string;
  desc: string;
  badge: string;
  icon: readonly string[];
  iconTone: string;
  ringTone: string;
}> = [
  {
    value: 'ACTIVE',
    label: "Faol (O'qimoqda)",
    desc: 'Talabalar darslarda qatnashmoqda, davomat va tizim huquqlari toʻliq ochiq',
    badge: 'Tavsiya etiladi',
    icon: I.checkCircle,
    iconTone:
      'bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400',
    ringTone:
      'border-emerald-500/70 bg-emerald-500/[0.07] dark:border-emerald-400/70 dark:bg-emerald-500/[0.1]',
  },
  {
    value: 'PAUSED',
    label: 'Muzlatilgan (Vaqtincha tanaffus)',
    desc: "Darslar va to'lovlar vaqtincha to'xtatilgan, guruhdagi o'rni saqlanadi",
    badge: 'Freeze',
    icon: I.snowflake,
    iconTone:
      'bg-sky-500/15 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400',
    ringTone:
      'border-sky-500/70 bg-sky-500/[0.07] dark:border-sky-400/70 dark:bg-sky-500/[0.1]',
  },
  {
    value: 'GRADUATED',
    label: 'Bitirgan (Kursni tamomlagan)',
    desc: "O'quv dasturini muvaffaqiyatli yakunlagan va bitiruvchi maqomini olgan",
    badge: 'Alumni',
    icon: I.award,
    iconTone:
      'bg-violet-500/15 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400',
    ringTone:
      'border-violet-500/70 bg-violet-500/[0.07] dark:border-violet-400/70 dark:bg-violet-500/[0.1]',
  },
  {
    value: 'INACTIVE',
    label: 'Nofaol / Arxiv',
    desc: "Hisob tizimda vaqtincha yopiladi va arxiv ro'yxatiga o'tkaziladi",
    badge: 'Arxiv',
    icon: I.archive,
    iconTone:
      'bg-slate-500/15 text-slate-600 dark:bg-white/10 dark:text-slate-300',
    ringTone:
      'border-slate-500/70 bg-slate-500/[0.07] dark:border-slate-400/60 dark:bg-white/[0.06]',
  },
  {
    value: 'DROPPED',
    label: "Safdan chiqqan (O'qishni to'xtatgan)",
    desc: "Kursni yakunlamasdan tark etgan, faol guruhlardan chiqariladi",
    badge: 'Chiqarilgan',
    icon: I.userMinus,
    iconTone:
      'bg-rose-500/15 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400',
    ringTone:
      'border-rose-500/70 bg-rose-500/[0.07] dark:border-rose-400/70 dark:bg-rose-500/[0.1]',
  },
];

export const BulkStatusModal = memo(function BulkStatusModal({
  open,
  onClose,
  students,
  loading = false,
  onUpdateStatus,
}: BulkStatusModalProps) {
  const [status, setStatus] = useState<BulkStudentStatus>('ACTIVE');
  const { playPop, playTick } = usePremiumSound();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    playPop();
    onUpdateStatus(status);
  };

  return (
    <GlassModal
      open={open}
      onClose={onClose}
      title="Talabalar holatini ommaviy yangilash"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-100/70 px-3.5 py-2.5 text-xs dark:border-white/10 dark:bg-white/[0.04]">
          <span className="font-medium text-slate-600 dark:text-slate-300">
            Yangilanayotgan talabalar soni:
          </span>
          <span className="rounded-lg bg-slate-900 px-2 py-0.5 text-[11px] font-extrabold text-white tabular-nums dark:bg-white dark:text-slate-900">
            {students.length} nafar
          </span>
        </div>

        <div
          role="radiogroup"
          aria-label="Talaba holati"
          className="space-y-2"
        >
          {STATUS_CONFIG.map((opt) => {
            const isSelected = status === opt.value;
            return (
              <motion.button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={isSelected}
                whileTap={{ scale: 0.99 }}
                onClick={() => {
                  playTick();
                  setStatus(opt.value);
                }}
                className={[
                  'group relative flex w-full items-start gap-3.5 overflow-hidden rounded-[18px] border p-3.5 text-left transition-all duration-200 outline-none',
                  isSelected
                    ? `${opt.ringTone} shadow-sm`
                    : 'border-slate-200/75 bg-white/70 hover:border-slate-300 hover:bg-white/95 dark:border-white/[0.08] dark:bg-white/[0.03] dark:hover:bg-white/[0.05]',
                ].join(' ')}
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] transition-transform duration-200 group-hover:scale-105 ${opt.iconTone}`}
                >
                  <SFIcon paths={opt.icon} size={18} strokeWidth={2.0} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13.5px] font-extrabold text-slate-900 dark:text-white">
                      {opt.label}
                    </span>
                    <span className="rounded-full bg-black/[0.05] px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-white/10 dark:text-slate-300">
                      {opt.badge}
                    </span>
                  </div>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-slate-500 dark:text-slate-400">
                    {opt.desc}
                  </p>
                </div>

                <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-300 dark:border-white/20">
                  {isSelected && (
                    <motion.div
                      layoutId="bulk-status-active-dot"
                      transition={SPRING.snappy}
                      className="flex h-5 w-5 items-center justify-center rounded-full bg-[#007AFF] text-white dark:bg-sky-400 dark:text-slate-950"
                    >
                      <SFIcon paths={I.check} size={11} strokeWidth={3} />
                    </motion.div>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>

        <div className="flex justify-end gap-2.5 pt-2">
          <GlassButton
            type="button"
            variant="secondary"
            disabled={loading}
            onClick={onClose}
          >
            Bekor qilish
          </GlassButton>
          <GlassButton type="submit" variant="primary" loading={loading}>
            {loading ? 'Yangilanmoqda...' : 'Holatni tasdiqlash'}
          </GlassButton>
        </div>
      </form>
    </GlassModal>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * 3. BULK BADGES & ID CARDS STUDIO — Apple Wallet Pass & Code-128 Barcode
 * ════════════════════════════════════════════════════════════════════════ */

interface BulkBadgesStudioModalProps {
  open: boolean;
  onClose: () => void;
  students: Student[];
}

export const BulkBadgesStudioModal = memo(function BulkBadgesStudioModal({
  open,
  onClose,
  students,
}: BulkBadgesStudioModalProps) {
  const [passTheme, setPassTheme] = useState<'obsidian' | 'pearl'>('obsidian');
  const [showBarcode, setShowBarcode] = useState(true);
  const { playPop, playTick } = usePremiumSound();

  const handlePrint = () => {
    playPop();
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const academicYear = useMemo(() => {
    const y = new Date().getFullYear();
    return `${y}/${y + 1}`;
  }, []);

  return (
    <GlassModal
      open={open}
      onClose={onClose}
      title={`Apple Wallet ID-Pass & QR Studio (${students.length} ta guvohnoma)`}
    >
      <div className="space-y-4">
        {/* Studio Control Bar */}
        <div className="flex flex-col justify-between gap-3 rounded-[20px] border border-slate-200/80 bg-slate-50/85 p-3.5 sm:flex-row sm:items-center dark:border-white/10 dark:bg-surface-800/70 print:hidden">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-sm">
              <SFIcon paths={I.shieldCheck} size={19} />
            </div>
            <div>
              <p className="text-[13px] font-extrabold text-slate-900 dark:text-white">
                Turniket, Face ID va Apple Wallet standartidagi ID-Kartalar
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Vektorli QR-kod va Code-128 shtrix-kodi bilan yuqori aniqlikda
                chop etishga tayyor.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Theme Switcher */}
            <div className="inline-flex items-center rounded-xl border border-slate-200/80 bg-white/80 p-1 dark:border-white/10 dark:bg-white/[0.04]">
              <button
                type="button"
                onClick={() => {
                  playTick();
                  setPassTheme('obsidian');
                }}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                  passTheme === 'obsidian'
                    ? 'bg-slate-900 text-white shadow-2xs dark:bg-white dark:text-slate-900'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                }`}
              >
                <SFIcon paths={I.moon} size={11} />
                Obsidian
              </button>
              <button
                type="button"
                onClick={() => {
                  playTick();
                  setPassTheme('pearl');
                }}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                  passTheme === 'pearl'
                    ? 'bg-slate-900 text-white shadow-2xs dark:bg-white dark:text-slate-900'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                }`}
              >
                <SFIcon paths={I.sun} size={11} />
                Pearl
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                playTick();
                setShowBarcode((v) => !v);
              }}
              className={`rounded-xl border px-2.5 py-1.5 text-[11px] font-bold transition ${
                showBarcode
                  ? 'border-blue-500/40 bg-blue-500/10 text-[#007AFF] dark:text-sky-300'
                  : 'border-slate-200/80 bg-white/60 text-slate-500 dark:border-white/10 dark:bg-white/[0.03]'
              }`}
            >
              Code-128
            </button>

            <GlassButton
              type="button"
              variant="primary"
              onClick={handlePrint}
              className="!bg-emerald-600 hover:!bg-emerald-700 text-white shrink-0 shadow-sm"
            >
              <span className="inline-flex items-center gap-1.5">
                <SFIcon paths={I.printer} size={14} />
                <span>Chop etish / PDF</span>
              </span>
            </GlassButton>
          </div>
        </div>

        {/* Printable Grid of Holographic ID Passes */}
        <div className="max-h-[64vh] overflow-y-auto pr-1 print:max-h-none print:overflow-visible">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 print:grid-cols-2 print:gap-4 print:p-0">
            {students.map((student) => {
              const name =
                fullName(student.user?.firstName, student.user?.lastName) ||
                "O'quvchi";
              const activeGroup =
                (student.groups ?? []).find((g) => g.isActive)?.group?.name ||
                'Asosiy Oqim';
              const studentIdStr = String(student.id || '');
              const studentCode = studentIdStr.slice(0, 8).toUpperCase();
              const isDarkPass = passTheme === 'obsidian';

              return (
                <div
                  key={student.id}
                  className={[
                    'group relative overflow-hidden rounded-[22px] border p-4.5 transition-all duration-300 print:break-inside-avoid print:border-black print:shadow-none',
                    isDarkPass
                      ? 'border-white/15 bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 text-white shadow-[0_14px_34px_-10px_rgba(15,23,42,0.55)]'
                      : 'border-slate-300/90 bg-gradient-to-br from-white via-slate-50/90 to-sky-50/40 text-slate-900 shadow-[0_12px_30px_-10px_rgba(15,23,42,0.12)]',
                  ].join(' ')}
                >
                  {/* Holographic Foil Strip */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-sky-400 via-indigo-500 to-emerald-400"
                  />
                  {/* Ambient Specular Glow */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-sky-400/15 blur-2xl print:hidden"
                  />

                  {/* Lanyard Punch Slot */}
                  <div
                    className={`mx-auto mb-3 h-1.5 w-12 rounded-full ${
                      isDarkPass
                        ? 'bg-white/20 ring-1 ring-white/10'
                        : 'bg-slate-300/90 ring-1 ring-black/5'
                    } print:bg-black`}
                  />

                  {/* Top Pass Header */}
                  <div
                    className={`flex items-center justify-between border-b pb-2.5 ${
                      isDarkPass ? 'border-white/10' : 'border-slate-200/80'
                    } print:border-black`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-gradient-to-tr from-[#007AFF] to-sky-400 text-[12px] font-black text-white shadow-xs">
                        M
                      </div>
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.12em]">
                          M-EDU ACADEMY
                        </p>
                        <p
                          className={`text-[9px] font-extrabold uppercase tracking-[0.18em] ${
                            isDarkPass ? 'text-sky-400' : 'text-[#007AFF]'
                          }`}
                        >
                          VERIFIED STUDENT PASS · {academicYear}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`rounded-lg px-2 py-0.5 font-mono text-[10.5px] font-extrabold tracking-wider ${
                        isDarkPass
                          ? 'bg-white/10 text-sky-300 ring-1 ring-white/15'
                          : 'bg-slate-900/5 text-slate-800 ring-1 ring-black/10'
                      }`}
                    >
                      #{studentCode}
                    </span>
                  </div>

                  {/* Center Identity Cluster */}
                  <div className="mt-3.5 flex items-center gap-3.5">
                    {/* Squircle Avatar */}
                    <div className="relative shrink-0">
                      <div
                        className="flex h-16 w-16 items-center justify-center rounded-[16px] text-lg font-black text-white shadow-md ring-2 ring-white/20"
                        style={{ background: getAvatarGradient(name) }}
                      >
                        {getInitials(name)}
                      </div>
                      <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white ring-2 ring-slate-900">
                        <SFIcon paths={I.check} size={9} strokeWidth={3.2} />
                      </span>
                    </div>

                    {/* Student Metadata */}
                    <div className="min-w-0 flex-1">
                      <div
                        className={`text-[9px] font-bold uppercase tracking-widest ${
                          isDarkPass ? 'text-slate-400' : 'text-slate-400'
                        }`}
                      >
                        O&apos;quvchi F.I.Sh
                      </div>
                      <h4 className="truncate text-[15px] font-black tracking-tight">
                        {name}
                      </h4>

                      <div className="mt-1.5 flex items-center gap-2">
                        <span
                          className={`inline-flex max-w-[140px] truncate rounded-md px-2 py-0.5 text-[10.5px] font-bold ${
                            isDarkPass
                              ? 'bg-sky-500/20 text-sky-300'
                              : 'bg-blue-500/10 text-blue-700'
                          }`}
                        >
                          {activeGroup}
                        </span>
                        <span
                          className={`text-[10px] font-semibold ${
                            isDarkPass ? 'text-emerald-400' : 'text-emerald-600'
                          }`}
                        >
                          ● FAOL
                        </span>
                      </div>
                    </div>

                    {/* Scannable Optical QR */}
                    <div className="shrink-0 rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-sm">
                      <RealQrCode
                        value={`student:${studentIdStr}`}
                        margin={1}
                        title={`QR for ${name}`}
                        className="h-16 w-16"
                      />
                    </div>
                  </div>

                  {/* Optional Code-128 Vector Barcode Footer */}
                  {showBarcode && (
                    <div
                      className={`mt-3.5 rounded-xl px-3 py-2 ${
                        isDarkPass
                          ? 'bg-white/[0.06] text-white/90'
                          : 'bg-slate-900/[0.04] text-slate-900'
                      }`}
                    >
                      <VectorCode128Barcode
                        value={studentIdStr.toUpperCase()}
                        className="h-5 w-full"
                      />
                      <div className="mt-1 flex items-center justify-between font-mono text-[8.5px] tracking-[0.22em] opacity-70">
                        <span>MEDU-{studentCode}</span>
                        <span>BIOMETRIC-ID</span>
                      </div>
                    </div>
                  )}

                  {/* Micro Security Watermark */}
                  <div
                    className={`mt-2.5 flex items-center justify-between text-[9px] font-medium opacity-60`}
                  >
                    <span>Shaxsiy o&apos;quvchi ruxsatnomasi</span>
                    <span>QR / NFC Turniket</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end pt-2 print:hidden">
          <GlassButton type="button" variant="secondary" onClick={onClose}>
            Yopish
          </GlassButton>
        </div>
      </div>
    </GlassModal>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * 4. BULK NOTIFICATION MODAL — iOS 18 iMessage Live Broadcast Studio
 * ════════════════════════════════════════════════════════════════════════ */

interface BulkNotificationModalProps {
  open: boolean;
  onClose: () => void;
  students: Student[];
  onSend: (data: {
    audience: 'STUDENTS' | 'PARENTS' | 'BOTH';
    message: string;
  }) => void;
  loading?: boolean;
}

const SMS_TEMPLATES: ReadonlyArray<{
  id: string;
  title: string;
  text: string;
}> = [
  {
    id: 'schedule',
    title: '📅 Dars eslatmasi',
    text: 'Assalomu alaykum, {ism}! Ertaga {guruh} guruhi darslari jadval asosida oʻz vaqtida boshlanadi. Kechikmasdan kelishingizni soʻraymiz.',
  },
  {
    id: 'payment',
    title: "💳 To'lov eslatmasi",
    text: "Hurmatli {ism} {familiya}, {guruh} guruhi uchun joriy oy o'quv to'lovini amalga oshirishingizni eslatib o'tamiz. M-EDU ma'muriyati.",
  },
  {
    id: 'exam',
    title: '🏆 Imtihon / Sinov',
    text: 'Diqqat, {ism}! Shu hafta {guruh} guruhida oraliq nazorat imtihoni boʻlib oʻtadi. Tayyorgarlik koʻrib kelishingizni soʻraymiz!',
  },
];

export const BulkNotificationModal = memo(function BulkNotificationModal({
  open,
  onClose,
  students,
  onSend,
  loading = false,
}: BulkNotificationModalProps) {
  const [audience, setAudience] = useState<'STUDENTS' | 'PARENTS' | 'BOTH'>(
    'STUDENTS',
  );
  const [message, setMessage] = useState(SMS_TEMPLATES[0].text);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const { playPop, playTick } = usePremiumSound();

  const handleInsertVariable = useCallback(
    (variable: string) => {
      playTick();
      const el = textAreaRef.current;
      if (el && typeof el.selectionStart === 'number') {
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const next =
          message.slice(0, start) + variable + message.slice(end);
        setMessage(next);
        setTimeout(() => {
          el.focus();
          el.setSelectionRange(
            start + variable.length,
            start + variable.length,
          );
        }, 10);
      } else {
        setMessage((prev) => `${prev.trimEnd()} ${variable} `);
      }
    },
    [message, playTick],
  );

  const sampleStudent = students[0];
  const sampleFullName = sampleStudent
    ? fullName(sampleStudent.user?.firstName, sampleStudent.user?.lastName) ||
      'Talaba'
    : 'Talaba';
  const sampleFirstName = sampleFullName.split(' ')[0] || sampleFullName;
  const sampleLastName = sampleFullName.split(' ').slice(1).join(' ') || '';
  const sampleGroup =
    (sampleStudent?.groups ?? []).find((g) => g.isActive)?.group?.name ||
    'IELTS Master';

  const previewText = useMemo(() => {
    return message
      .replace(/\{ism\}/g, sampleFirstName)
      .replace(/\{familiya\}/g, sampleLastName)
      .replace(/\{guruh\}/g, sampleGroup);
  }, [message, sampleFirstName, sampleLastName, sampleGroup]);

  const charCount = message.length;
  const smsSegments = Math.max(1, Math.ceil(charCount / 140));
  const totalRecipients =
    audience === 'BOTH' ? students.length * 2 : students.length;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    playPop();
    onSend({ audience, message });
  };

  return (
    <GlassModal
      open={open}
      onClose={onClose}
      title="Ommaviy SMS & Xabarnoma Studiyasi"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* iOS Segmented Audience Control */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
              Qabul qiluvchilar auditoriyasi
            </label>
            <span className="text-[11px] font-bold text-[#007AFF] tabular-nums dark:text-sky-400">
              {totalRecipients} ta abonent
            </span>
          </div>

          <div
            role="tablist"
            className="grid grid-cols-1 sm:grid-cols-3 gap-1 rounded-2xl border border-slate-200/80 bg-slate-100/80 p-1 dark:border-white/10 dark:bg-white/[0.04]"
          >
            {(
              [
                { id: 'STUDENTS' as const, label: "O'quvchilarga" },
                { id: 'PARENTS' as const, label: 'Ota-onalarga' },
                { id: 'BOTH' as const, label: 'Ikkalasiga ham' },
              ]
            ).map((opt) => {
              const isSelected = audience === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => {
                    playTick();
                    setAudience(opt.id);
                  }}
                  className={[
                    'relative rounded-xl py-2 text-xs font-extrabold transition-colors outline-none',
                    isSelected
                      ? 'text-slate-900 dark:text-white'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400',
                  ].join(' ')}
                >
                  {isSelected && (
                    <motion.span
                      layoutId="sms-audience-segmented-pill"
                      transition={SPRING.snappy}
                      className="absolute inset-0 rounded-xl border border-black/5 bg-white shadow-xs dark:border-white/10 dark:bg-white/[0.12]"
                    />
                  )}
                  <span className="relative z-10">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Smart Quick Templates */}
        <div className="space-y-1.5">
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Tayyor shablonlar
          </span>
          <div className="flex flex-wrap gap-1.5">
            {SMS_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => {
                  playTick();
                  setMessage(tpl.text);
                }}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200/80 bg-white/75 px-2.5 py-1 text-[11.5px] font-bold text-slate-700 transition hover:border-blue-400 hover:text-[#007AFF] dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200"
              >
                {tpl.title}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Variable Insertion Chips */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-500/15 bg-blue-500/[0.04] px-3 py-2 dark:border-sky-400/15">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300">
            <SFIcon
              paths={I.sparkles}
              size={13}
              className="text-[#007AFF] dark:text-sky-400"
            />
            Avto-o&apos;zgaruvchilar:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {[
              { tag: '{ism}', desc: 'Ism' },
              { tag: '{familiya}', desc: 'Familiya' },
              { tag: '{guruh}', desc: 'Guruh' },
            ].map((v) => (
              <button
                key={v.tag}
                type="button"
                onClick={() => handleInsertVariable(v.tag)}
                className="inline-flex items-center gap-1 rounded-lg border border-blue-500/25 bg-white px-2 py-0.5 text-[11px] font-extrabold text-[#007AFF] shadow-2xs transition hover:scale-105 active:scale-95 dark:border-sky-400/30 dark:bg-slate-900 dark:text-sky-300"
              >
                <code>{v.tag}</code>
                <span className="text-[9.5px] font-medium opacity-70">
                  · {v.desc}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Message Composer */}
        <GlassField label="Xabar matni" required>
          <GlassTextArea
            ref={textAreaRef}
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Xabar matnini kiriting..."
            required
          />
        </GlassField>

        {/* Telemetry Counter Bar */}
        <div className="flex items-center justify-between px-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          <span>
            Jami trafigi:{' '}
            <strong className="text-slate-800 dark:text-slate-200">
              {totalRecipients * smsSegments} ta SMS paket
            </strong>
          </span>
          <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[10.5px] font-bold text-slate-700 tabular-nums dark:bg-white/10 dark:text-slate-300">
            {charCount} belgi · {smsSegments} segment
          </span>
        </div>

        {/* iOS 18 iMessage Live Bubble Simulator */}
        <div className="overflow-hidden rounded-[20px] border border-slate-200/80 bg-gradient-to-b from-slate-100/90 to-slate-50/90 p-3.5 dark:border-white/10 dark:from-surface-900/90 dark:to-surface-800/90">
          <div className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <span>iMessage / SMS Jonli Ko&apos;rinish ({sampleFirstName})</span>
            <span>Hozir</span>
          </div>

          <div className="flex flex-col items-end">
            <motion.div
              key={previewText}
              initial={{ opacity: 0.85, scale: 0.99 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={SPRING.snappy}
              className="relative max-w-[92%] rounded-[18px] rounded-br-[4px] bg-gradient-to-b from-[#007AFF] to-[#0062CC] px-3.5 py-2.5 text-[13px] leading-relaxed font-medium text-white shadow-[0_6px_18px_-4px_rgba(0,122,255,0.45)]"
            >
              <p className="whitespace-pre-wrap">{previewText || '...'}</p>
            </motion.div>
            <span className="mt-1 pr-1 text-[10px] font-semibold text-slate-400">
              Yetkazildi · M-EDU SMS
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2.5 pt-2">
          <GlassButton
            type="button"
            variant="secondary"
            disabled={loading}
            onClick={onClose}
          >
            Bekor qilish
          </GlassButton>
          <GlassButton
            type="submit"
            variant="primary"
            loading={loading}
            disabled={!message.trim()}
          >
            <span className="inline-flex items-center gap-1.5">
              <SFIcon paths={I.send} size={13} />
              <span>
                {loading
                  ? 'Yuborilmoqda...'
                  : `${totalRecipients} ta qabul qiluvchiga yuborish`}
              </span>
            </span>
          </GlassButton>
        </div>
      </form>
    </GlassModal>
  );
});