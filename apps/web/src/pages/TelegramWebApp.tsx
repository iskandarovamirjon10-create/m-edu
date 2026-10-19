/**
 * ============================================================================
 *  M-EDU Telegram WebApp — Apple Design Award Edition (v4.2 Final)
 *  Ota-ona / O'qituvchi / O'quvchi / AI Copilot / Digital Pass
 * ============================================================================
 */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import request, {
  aiApi,
  assignmentsApi,
  attendanceApi,
  gamificationApi,
  groupsApi,
  parentPortalApi,
  scheduleApi,
} from '@/lib/api';
import { useToast } from '@/components/ui';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useAuth } from '@/auth/AuthContext';
import { getErrorMessage } from '@/lib/errorMessages';
import type { TelegramWebApp } from '@/types/telegram';
import { useTelegram, type HapticStyle } from '@/hooks/useTelegram';
import {
  SPRING_SNAPPY,
  SPRING_SMOOTH,
  SPRING_SHEET,
  STAGGER_CONTAINER,
  I,
  Icon,
  type AttendanceStatus,
  type TabId,
  type Tone,
  todayKey,
  todayDayOfWeek,
  sameDayStr,
  itemsOf,
  normalizeChildren,
  formatUZS,
  formatNum,
  formatDateShort,
  formatDue,
  formatRelative,
  getTimeGreeting,
  RELATION_LABELS,
  INVOICE_STATUS,
  ASSIGNMENT_LABELS,
  XP_TYPE_LABELS,
  STATUS_META,
  ROLE_LABELS,
  tgThemeStyle,
  LIQUID_GLASS_CSS,
  TONE_COLORS,
  Surface,
  Pill,
  Btn,
  Skeleton,
  EmptyState,
  ErrorState,
  ProgressRing,
  Avatar,
  CardHead,
} from '@/components/telegram/TelegramPresentation';

/* ============================================================================
 * TYPES — Backend kontraktlari
 * ========================================================================== */

interface ChildPermissions {
  grades?: boolean;
  payments?: boolean;
  attendance?: boolean;
}

interface ParentChild {
  studentId: string;
  name: string;
  groupId?: string | null;
  relationship?: string | null;
  permissions?: ChildPermissions;
}

interface AttendanceRow {
  id: string;
  studentId?: string;
  date: string;
  status: AttendanceStatus;
  source?: string | null;
  note?: string | null;
  group: { id: string; name: string } | null;
  lesson?: { id: string; date: string; startTime: string; topic?: string | null } | null;
}

interface AttendanceSummary {
  total: number;
  byStatus: Partial<Record<AttendanceStatus, number>>;
  attendanceRate: number | null;
}

interface GradeRow {
  id: string;
  value: number;
  maxValue?: number | null;
  label?: string | null;
  notes?: string | null;
  createdAt: string;
  group?: { id: string; name: string } | null;
}

interface ExamResultRow {
  id: string;
  marksObtained: number;
  isPassed: boolean;
  exam: { id: string; title: string; subject?: string | null; examDate: string; examType?: string | null };
}

interface GradesResponse {
  grades: GradeRow[];
  examResults: ExamResultRow[];
}

interface Invoice {
  id: string;
  number: string;
  status: string;
  total: number;
  paidAmount?: number | null;
  refundedAmount?: number | null;
  dueDate?: string | null;
  issueDate?: string | null;
}

interface PaymentRecord {
  id: string;
  amount: number;
  status: string;
  method?: string | null;
  receiptNumber?: string | null;
  paidAt?: string | null;
}

interface InvoicesResponse {
  invoices: Invoice[];
  payments: PaymentRecord[];
  outstanding: number;
  overdue: number;
}

interface AssignmentItem {
  id: string;
  title: string;
  description?: string | null;
  dueDate: string;
  maxScore?: number;
  status: string;
  Group?: { id: string; name: string } | null;
}

interface ScheduleItem {
  id: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  room?: string | null;
  groupId: string;
  group: { id: string; name: string };
}

interface GroupUser {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
}

interface GroupEnrollment {
  student: { id: string; user?: GroupUser | null };
}

interface GroupDetail {
  id: string;
  name: string;
  enrollments?: GroupEnrollment[] | null;
}

interface GroupSummary {
  id: string;
  name: string;
  teacherId?: string | null;
  teacher?: { id: string; userId?: string | null } | null;
}

interface GamificationMe {
  xp: number;
  coins: number;
  level: number;
  xpToNextLevel: number;
  rank?: number | null;
  rankTotal?: number;
}

interface XpEvent {
  id: string;
  type: string;
  xp: number;
  coins: number;
  createdAt: string;
}

interface RewardItem {
  id: string;
  title: string;
  description?: string;
  costCoins: number;
  category?: string;
  icon?: string;
}

/* ============================================================================
 * OTA-ONA: BUGUNGI DAVOMAT KARTASI
 * ========================================================================== */

function TodayCard({
  child,
  attendanceQ,
  summaryQ,
}: {
  child: ParentChild;
  attendanceQ: UseQueryResult<AttendanceRow[]>;
  summaryQ: UseQueryResult<AttendanceSummary>;
}) {
  const isFirstLoad = attendanceQ.isLoading && summaryQ.isLoading;
  const rows = attendanceQ.data ?? [];
  const today = rows.find((r) => sameDayStr(r.date));
  const summary = summaryQ.data;
  const rate = summary?.attendanceRate ?? null;
  const byStatus = summary?.byStatus ?? {};
  const total = summary?.total ?? 0;
  const meta = today ? STATUS_META[today.status] : null;
  const tone: Tone = meta?.tone ?? 'blue';

  if (isFirstLoad) {
    return (
      <Surface className="p-5">
        <Skeleton height={96} />
        <div className="mt-3 flex gap-3">
          <Skeleton className="flex-1" height={52} />
          <Skeleton className="flex-1" height={52} />
        </div>
      </Surface>
    );
  }

  if (attendanceQ.isError) {
    return (
      <Surface className="p-2">
        <ErrorState
          message="Davomat ma'lumotlarini yuklab bo'lmadi."
          onRetry={() => {
            attendanceQ.refetch();
            summaryQ.refetch();
          }}
        />
      </Surface>
    );
  }

  const lesson = today?.lesson;
  const groupName = today?.group?.name ?? child.name;

  return (
    <Surface tone={tone} className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={SPRING_SNAPPY}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
            style={{
              background: TONE_COLORS[tone].bg,
              color: TONE_COLORS[tone].fg,
              border: `1px solid ${TONE_COLORS[tone].border}`,
              boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.25)',
            }}
          >
            <Icon paths={meta?.icon ?? I.calendar} size={25} strokeWidth={2.1} />
          </motion.div>
          <div>
            {meta ? (
              <Pill tone={tone} icon={meta.icon}>
                {meta.label}
              </Pill>
            ) : (
              <Pill tone="slate" icon={I.clock}>
                Kutilmoqda
              </Pill>
            )}
            <h3 className="mt-1.5 text-[16.5px] font-bold leading-tight tracking-tight" style={{ color: 'var(--text-primary)' }}>
              {!today
                ? `Bugungi holat: ${child.name.split(' ')[0] ?? 'farzandingiz'}`
                : today.status === 'PRESENT'
                ? 'Farzandingiz darsda'
                : today.status === 'LATE'
                ? 'Kechikish bilan yetib keldi'
                : today.status === 'ABSENT'
                ? 'Bugun darsga kelmadi'
                : 'Sababli darsga kelmadi'}
            </h3>
            <p className="mt-0.5 text-[11.5px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
              {RELATION_LABELS[child.relationship ?? ''] ?? 'Farzand'} • {groupName}
            </p>
          </div>
        </div>
      </div>

      {lesson ? (
        <div
          className="mt-4 flex items-center gap-3 rounded-2xl p-3"
          style={{
            background: 'color-mix(in srgb, #0A84FF 11%, transparent)',
            border: '1px solid color-mix(in srgb, #0A84FF 26%, transparent)',
            boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.14)',
          }}
        >
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white"
            style={{ background: 'linear-gradient(135deg, #0A84FF, #6366F1)' }}
          >
            <Icon paths={I.bookOpen} size={17} strokeWidth={2.1} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10.5px] font-bold uppercase tracking-wider" style={{ color: '#0A84FF' }}>
              {lesson.startTime && `${lesson.startTime}  •  `}Joriy mashg'ulot
            </p>
            <p className="truncate text-[13.5px] font-bold" style={{ color: 'var(--text-primary)' }}>
              {lesson.topic || groupName}
            </p>
          </div>
          <span
            className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold"
            style={{ background: 'color-mix(in srgb, #0A84FF 16%, transparent)', color: '#0A84FF' }}
          >
            Darsda
          </span>
        </div>
      ) : (
        <div className="liquid-inset mt-4 flex items-center gap-3 p-3">
          <Icon paths={I.calendar} size={18} strokeWidth={2.1} style={{ color: TONE_COLORS[tone].fg }} />
          <p className="text-[12.5px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
            Bugungi dars jadvali hali qayd etilmagan.
          </p>
        </div>
      )}

      {today?.note && (
        <div className="liquid-inset mt-3 px-3.5 py-3">
          <div className="mb-1 flex items-center gap-1.5">
            <Icon paths={I.messageSquare} size={13} strokeWidth={2.2} style={{ color: TONE_COLORS.purple.fg }} />
            <span className="text-[10.5px] font-bold uppercase tracking-wider" style={{ color: TONE_COLORS.purple.fg }}>
              Ustoz izohi
            </span>
          </div>
          <p className="text-[12.5px] italic leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            “{today.note}”
          </p>
        </div>
      )}

      <div className="mt-4 flex items-center gap-4 border-t pt-4" style={{ borderColor: 'var(--border-subtle)' }}>
        {summaryQ.isLoading ? (
          <Skeleton height={68} className="w-[68px] rounded-full" />
        ) : (
          <ProgressRing value={rate ?? 0} center={rate != null ? `${Math.round(rate)}%` : '—'} sub="Davomat" tone="green" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(STATUS_META) as AttendanceStatus[]).map((s) => {
              const count = byStatus[s] ?? 0;
              if (!count) return null;
              const m = STATUS_META[s];
              return (
                <Pill key={s} tone={m.tone} icon={m.icon}>
                  {m.label} {count}
                </Pill>
              );
            })}
            {total === 0 && (
              <span className="text-[11.5px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
                Hozircha davomat statistikasi yo'q.
              </span>
            )}
          </div>
          {total > 0 && (
            <p className="mt-1.5 text-[11.5px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
              Jami {total} ta darsda qayd etilgan.
            </p>
          )}
        </div>
      </div>
    </Surface>
  );
}

/* ============================================================================
 * OTA-ONA: BAHOLAR KARTASI
 * ========================================================================== */

function GradesCard({
  child,
  gradesQ,
}: {
  child: ParentChild;
  gradesQ: UseQueryResult<GradesResponse>;
}) {
  if (gradesQ.isLoading) {
    return (
      <Surface className="p-5">
        <Skeleton height={24} />
        <div className="mt-3 space-y-2">
          <Skeleton height={56} />
          <Skeleton height={56} />
        </div>
      </Surface>
    );
  }
  if (gradesQ.isError) {
    return (
      <Surface className="p-2">
        <ErrorState message="Baholar yuklab bo'lmadi." onRetry={() => gradesQ.refetch()} />
      </Surface>
    );
  }

  const grades = gradesQ.data?.grades ?? [];
  const exams = gradesQ.data?.examResults ?? [];

  return (
    <Surface tone="orange" className="p-5">
      <CardHead
        icon={I.star}
        tone="orange"
        title="Baholar va natijalar"
        meta={
          <span className="text-[11px] font-bold" style={{ color: TONE_COLORS.orange.fg }}>
            {child.name.split(' ')[0]} uchun
          </span>
        }
      />
      {grades.length === 0 && exams.length === 0 ? (
        <EmptyState icon={I.star} tone="orange" title="Hozircha baholar yo'q" message="Ustoz baho qo'yganida shu yerda ko'rinadi." />
      ) : (
        <div className="space-y-2.5">
          {grades.map((g) => (
            <div key={g.id} className="liquid-inset flex items-center justify-between gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-bold" style={{ color: 'var(--text-primary)' }}>
                  {g.label || g.group?.name || 'Dars bahosi'}
                </p>
                <div className="mt-0.5 flex items-center gap-2">
                  {g.notes && (
                    <span className="truncate text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                      {g.notes}
                    </span>
                  )}
                  <span className="shrink-0 text-[10.5px] font-semibold" style={{ color: 'var(--text-tertiary)' }}>
                    {formatDateShort(g.createdAt)}
                  </span>
                </div>
              </div>
              <span
                className="shrink-0 rounded-xl border px-2.5 py-1 text-[12.5px] font-bold tabular-nums"
                style={{
                  background: TONE_COLORS.orange.bg,
                  color: TONE_COLORS.orange.fg,
                  borderColor: TONE_COLORS.orange.border,
                }}
              >
                {formatNum(g.value)}
                {g.maxValue != null && ` / ${formatNum(g.maxValue)}`}
              </span>
            </div>
          ))}

          {exams.length > 0 && (
            <div className="pt-2">
              <p className="mb-2 text-[10.5px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                Imtihonlar
              </p>
              <div className="space-y-2">
                {exams.map((ex) => (
                  <div key={ex.id} className="liquid-inset flex items-center justify-between gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>
                        {ex.exam.title || ex.exam.subject}
                      </p>
                      <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                        {formatDateShort(ex.exam.examDate)}
                      </p>
                    </div>
                    <Pill tone={ex.isPassed ? 'green' : 'red'} icon={ex.isPassed ? I.checkCircle : I.xCircle}>
                      {ex.isPassed ? 'Topshirildi' : 'O\'tolmadi'} • {formatNum(ex.marksObtained)}
                    </Pill>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Surface>
  );
}

/* ============================================================================
 * OTA-ONA: UYGA VAZIFALAR KARTASI
 * ========================================================================== */

function AssignmentsCard({ child, groupId }: { child: ParentChild; groupId: string | null }) {
  const assignQ = useQuery<AssignmentItem[]>({
    queryKey: ['tg-child-assignments', child.studentId, groupId ?? 'none'],
    queryFn: async () => {
      if (!groupId) return [];
      const res = (await assignmentsApi.list({ groupId, status: 'PUBLISHED', limit: 5 })) as { items?: AssignmentItem[] };
      return itemsOf<AssignmentItem>(res);
    },
    enabled: Boolean(groupId),
    staleTime: 90_000,
  });

  return (
    <Surface tone="blue" className="p-5">
      <CardHead
        icon={I.bookOpen}
        tone="blue"
        title="Uyga vazifalar"
        meta={
          <span className="text-[11px] font-bold" style={{ color: '#0A84FF' }}>
            {child.name.split(' ')[0]} uchun
          </span>
        }
      />
      {!groupId ? (
        <EmptyState
          icon={I.bookOpen}
          tone="blue"
          title="Vazifalar topilmadi"
          message="Farzandingiz hali guruh yoki davomat ma'lumotiga ega emas. Vazifalar biriktirilganda shu yerda chiqadi."
        />
      ) : assignQ.isLoading ? (
        <div className="space-y-2">
          <Skeleton height={58} />
          <Skeleton height={58} />
        </div>
      ) : assignQ.isError ? (
        <ErrorState message="Vazifalar yuklab bo'lmadi." onRetry={() => assignQ.refetch()} />
      ) : (assignQ.data ?? []).length === 0 ? (
        <EmptyState icon={I.bookOpen} tone="blue" title="Yangi vazifalar yo'q" message="Ustoz vazifa biriktirganda shu yerda ko'rinadi." />
      ) : (
        <div className="space-y-2">
          {(assignQ.data ?? []).map((a) => {
            const overdue = new Date(a.dueDate).getTime() < Date.now();
            return (
              <div key={a.id} className="liquid-inset p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 flex-1 truncate text-[13.5px] font-bold" style={{ color: 'var(--text-primary)' }}>
                    {a.title}
                  </p>
                  <Pill tone={overdue ? 'red' : 'green'} icon={overdue ? I.alertCircle : I.clock}>
                    {overdue ? 'Muddati o\'tgan' : ASSIGNMENT_LABELS[a.status] ?? a.status}
                  </Pill>
                </div>
                {a.description && (
                  <p className="mt-1 line-clamp-2 text-[11.5px] leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
                    {a.description}
                  </p>
                )}
                <div className="mt-2.5 flex items-center justify-between">
                  <span className="text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    {a.Group?.name ?? 'Guruh'}
                  </span>
                  <span className="text-[11px] font-semibold" style={{ color: overdue ? TONE_COLORS.red.fg : 'var(--text-tertiary)' }}>
                    {formatDue(a.dueDate)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Surface>
  );
}

/* ============================================================================
 * OTA-ONA: TO'LOV KARTASI VA LIQUID SHEET
 * ========================================================================== */

function PaymentsCard({
  invoicesQ,
  onOpen,
}: {
  invoicesQ: UseQueryResult<InvoicesResponse>;
  onOpen: () => void;
}) {
  if (invoicesQ.isLoading) {
    return (
      <Surface className="p-5">
        <Skeleton height={76} />
      </Surface>
    );
  }
  if (invoicesQ.isError) {
    return (
      <Surface className="p-2">
        <ErrorState message="To'lov holati yuklab bo'lmadi." onRetry={() => invoicesQ.refetch()} />
      </Surface>
    );
  }

  const data = invoicesQ.data;
  const outstanding = data?.outstanding ?? 0;
  const overdue = data?.overdue ?? 0;
  const isClear = outstanding <= 0;

  return (
    <Surface tone={isClear ? 'green' : 'red'} interactive onClick={onOpen} className="cursor-pointer p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
            style={{
              background: TONE_COLORS[isClear ? 'green' : 'red'].bg,
              color: TONE_COLORS[isClear ? 'green' : 'red'].fg,
              border: `1px solid ${TONE_COLORS[isClear ? 'green' : 'red'].border}`,
            }}
          >
            <Icon paths={isClear ? I.checkCircle : I.wallet} size={22} strokeWidth={2.1} />
          </div>
          <div>
            <p className="text-[10.5px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
              Oylik to'lov holati
            </p>
            <h4 className="mt-0.5 text-[15.5px] font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              {isClear ? 'Qarzdorlik yo\'q' : 'To\'lov kutilmoqda'}
            </h4>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <span className="text-[15px] font-black tabular-nums" style={{ color: isClear ? '#10B981' : TONE_COLORS.red.fg }}>
                {isClear ? '0 so\'m' : formatUZS(outstanding)}
              </span>
              {overdue > 0 && <Pill tone="red">{formatUZS(overdue)} muddati o'tgan</Pill>}
            </div>
          </div>
        </div>
        <Btn
          tone={isClear ? 'ghost' : 'primary'}
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          className="shrink-0"
        >
          Batafsil
          <Icon paths={I.chevronRight} size={13} strokeWidth={2.4} />
        </Btn>
      </div>
    </Surface>
  );
}

function PaymentSheet({
  open,
  onClose,
  childName,
  data,
  contactAdmin,
  tg,
}: {
  open: boolean;
  onClose: () => void;
  childName: string;
  data?: InvoicesResponse;
  contactAdmin: () => void;
  tg: TelegramWebApp | null;
}) {
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const [payMethod, setPayMethod] = useState<'click' | 'payme' | 'uzum'>('payme');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);

    try {
      tg?.BackButton?.show?.();
      tg?.BackButton?.onClick?.(onClose);
    } catch {
      /* ignore */
    }

    const t = window.setTimeout(() => closeBtnRef.current?.focus(), 100);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(t);
      try {
        tg?.BackButton?.offClick?.(onClose);
        tg?.BackButton?.hide?.();
      } catch {
        /* ignore */
      }
    };
  }, [open, onClose, tg]);

  const invoices = data?.invoices ?? [];
  const payments = data?.payments ?? [];
  const outstanding = data?.outstanding ?? 0;

  return (
    <AnimatePresence>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="payment-sheet-title"
          className="fixed inset-0 z-50 flex items-end justify-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={SPRING_SHEET}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 500) onClose();
            }}
            onClick={(e) => e.stopPropagation()}
            className="liquid-glass relative w-full max-w-md !rounded-b-none !rounded-t-[34px] border-t"
            style={{
              background: 'color-mix(in srgb, var(--bg-surface) 88%, transparent)',
              paddingBottom: 'max(env(safe-area-inset-bottom), 20px)',
            }}
          >
            <div className="mx-auto mt-3 h-1.5 w-12 cursor-grab rounded-full bg-slate-400/40 active:cursor-grabbing" />
            <div className="flex items-start justify-between px-6 pt-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                  Oylik to'lovlar
                </p>
                <h3 id="payment-sheet-title" className="mt-1 text-[19px] font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                  {childName}
                </h3>
              </div>
              <button
                ref={closeBtnRef}
                type="button"
                onClick={onClose}
                aria-label="Yopish"
                className="liquid-btn-ghost tap-target flex h-10 w-10 items-center justify-center rounded-full"
                style={{ color: 'var(--text-secondary)' }}
              >
                <Icon paths={I.close} size={18} strokeWidth={2.2} />
              </button>
            </div>

            <div className="max-h-[62vh] overflow-y-auto px-6 pt-4">
              <div className="liquid-inset flex items-center justify-between p-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                    Qoldiq summa
                  </p>
                  <p className="mt-0.5 text-[21px] font-black tabular-nums" style={{ color: outstanding > 0 ? '#EF4444' : '#10B981' }}>
                    {outstanding > 0 ? formatUZS(outstanding) : '0 so\'m'}
                  </p>
                </div>
                <Pill tone={outstanding > 0 ? 'red' : 'green'} icon={outstanding > 0 ? I.alertCircle : I.checkCircle}>
                  {outstanding > 0 ? 'Kutilmoqda' : 'Toza'}
                </Pill>
              </div>

              {payments.length > 0 && (
                <p className="mb-2 mt-4 text-[10.5px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                  So'nggi to'lovlar
                </p>
              )}
              <div className="space-y-2">
                {payments.map((p) => (
                  <div key={p.id} className="liquid-inset flex items-center justify-between gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-bold" style={{ color: 'var(--text-primary)' }}>
                        {p.receiptNumber || p.method || 'To\'lov'}
                      </p>
                      <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                        {formatDateShort(p.paidAt)}
                      </p>
                    </div>
                    <span className="shrink-0 text-[13px] font-bold tabular-nums text-emerald-500">
                      +{formatUZS(p.amount)}
                    </span>
                  </div>
                ))}
                {payments.length === 0 && (
                  <div className="liquid-inset mt-3 flex items-center gap-2.5 p-3.5">
                    <Icon paths={I.wallet} size={18} strokeWidth={2.1} style={{ color: 'var(--text-tertiary)' }} />
                    <p className="text-[12px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                      Hozircha to'lovlar qayd etilmagan.
                    </p>
                  </div>
                )}
              </div>

              {invoices.length > 0 && (
                <p className="mb-2 mt-4 text-[10.5px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                  Hisob-fakturalar
                </p>
              )}
              <div className="space-y-2">
                {invoices.map((inv) => {
                  const st = INVOICE_STATUS[inv.status] ?? { label: inv.status, tone: 'slate' as Tone };
                  return (
                    <div key={inv.id} className="liquid-inset flex items-center justify-between gap-3 p-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12.5px] font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                          № {inv.number}
                        </p>
                        <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                          {inv.dueDate ? `Muddati: ${formatDateShort(inv.dueDate)}` : formatDateShort(inv.issueDate)}
                        </p>
                      </div>
                      <Pill tone={st.tone}>
                        {formatUZS(inv.total)} • {st.label}
                      </Pill>
                    </div>
                  );
                })}
              </div>

              {outstanding > 0 ? (
                <div className="liquid-inset mt-4 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                      Tezkor Onlayn To'lov
                    </p>
                    <span className="text-[11px] font-bold text-emerald-500">0% komissiya</span>
                  </div>
                  <div className="mt-2.5 grid grid-cols-3 gap-2">
                    {(['payme', 'click', 'uzum'] as const).map((method) => {
                      const isSel = payMethod === method;
                      const labels = { payme: 'Payme', click: 'Click Up', uzum: 'Uzum Bank' };
                      return (
                        <button
                          key={method}
                          type="button"
                          onClick={() => setPayMethod(method)}
                          className="liquid-btn rounded-xl py-2 text-center text-[11.5px] font-bold transition-all"
                          style={{
                            background: isSel ? 'rgba(16, 185, 129, 0.18)' : 'rgba(255, 255, 255, 0.05)',
                            borderColor: isSel ? '#10B981' : 'var(--glass-border)',
                            color: isSel ? '#10B981' : 'var(--text-secondary)',
                          }}
                        >
                          {labels[method]}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-3 text-[11px] leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
                    Tanlangan tizim orqali {childName} uchun {formatUZS(outstanding)} to'lovini amalga oshirish.
                  </p>
                  <div className="mt-3">
                    <Btn
                      className="w-full"
                      onClick={() => {
                        const payText = `M-EDU: ${childName} | Qarzdorlik: ${formatUZS(outstanding)} | Tizim: ${payMethod.toUpperCase()}`;
                        try {
                          navigator.clipboard?.writeText?.(payText);
                        } catch {
                          /* ignore */
                        }
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2500);
                        try {
                          tg?.openLink?.(`https://${payMethod}.uz`);
                        } catch {
                          /* fallback */
                        }
                      }}
                    >
                      <Icon paths={I.creditCard} size={15} strokeWidth={2.2} />
                      {copied ? "Nusxalandi! Ilovaga o'tilmoqda..." : `${payMethod.toUpperCase()} orqali to'lash`}
                    </Btn>
                  </div>
                </div>
              ) : (
                <div className="liquid-inset mt-4 p-3.5">
                  <p className="text-[11.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    Barcha hisoblar yopilgan, qarzdorlik mavjud emas. Avans yoki qo'shimcha xizmatlar uchun ma'muriyatga murojaat qilishingiz mumkin.
                  </p>
                </div>
              )}

              <div className="mt-4 flex flex-col gap-2.5 pb-2">
                <Btn tone="ghost" onClick={contactAdmin}>
                  <Icon paths={I.send} size={14} strokeWidth={2.2} />
                  Markaz ma'muriyatiga yozish
                </Btn>
                <Btn tone="ghost" onClick={onClose}>
                  Yopish
                </Btn>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/* ============================================================================
 * OTA-ONA: SEKSIYA
 * ========================================================================== */

function ChildSection({
  child,
  contactAdmin,
  haptic,
  tg,
}: {
  child: ParentChild;
  contactAdmin: () => void;
  haptic: (s: HapticStyle) => void;
  tg: TelegramWebApp | null;
}) {
  const canAttendance = child.permissions?.attendance !== false;
  const canGrades = child.permissions?.grades !== false;
  const canPayments = child.permissions?.payments !== false;

  const attendanceQ = useQuery<AttendanceRow[]>({
    queryKey: ['tg-child-attendance', child.studentId],
    queryFn: () => parentPortalApi.attendance(child.studentId) as Promise<AttendanceRow[]>,
    enabled: canAttendance,
    staleTime: 60_000,
  });
  const summaryQ = useQuery<AttendanceSummary>({
    queryKey: ['tg-child-summary', child.studentId],
    queryFn: () => parentPortalApi.attendanceSummary(child.studentId) as Promise<AttendanceSummary>,
    enabled: canAttendance,
    staleTime: 120_000,
  });
  const gradesQ = useQuery<GradesResponse>({
    queryKey: ['tg-child-grades', child.studentId],
    queryFn: () => parentPortalApi.grades(child.studentId) as Promise<GradesResponse>,
    enabled: canGrades,
    staleTime: 90_000,
  });
  const invoicesQ = useQuery<InvoicesResponse>({
    queryKey: ['tg-child-invoices', child.studentId],
    queryFn: () => parentPortalApi.invoices(child.studentId) as Promise<InvoicesResponse>,
    enabled: canPayments,
    staleTime: 120_000,
  });

  const groupId = useMemo(() => {
    if (child.groupId) return child.groupId;
    const attRow = (attendanceQ.data ?? []).find((r) => r.group?.id);
    if (attRow?.group?.id) return attRow.group.id;
    return gradesQ.data?.grades.find((g) => g.group?.id)?.group?.id ?? null;
  }, [child.groupId, attendanceQ.data, gradesQ.data]);

  const [payOpen, setPayOpen] = useState(false);

  if (!canAttendance && !canGrades && !canPayments) {
    return (
      <EmptyState
        icon={I.shieldCheck}
        tone="slate"
        title="Ko'rish huquqi yo'q"
        message="Bu farzand uchun ma'lumotlar markaz tomonidan cheklangan. Ruxsat olish uchun ma'muriyatga murojaat qiling."
      >
        <Btn onClick={contactAdmin}>
          <Icon paths={I.send} size={14} strokeWidth={2.2} />
          Markazga yozish
        </Btn>
      </EmptyState>
    );
  }

  return (
    <motion.div variants={STAGGER_CONTAINER} initial="hidden" animate="show" className="space-y-4">
      {canAttendance && <TodayCard child={child} attendanceQ={attendanceQ} summaryQ={summaryQ} />}
      {canGrades && <GradesCard child={child} gradesQ={gradesQ} />}
      <AssignmentsCard child={child} groupId={groupId} />
      {canPayments && (
        <PaymentsCard
          invoicesQ={invoicesQ}
          onOpen={() => {
            haptic('medium');
            setPayOpen(true);
          }}
        />
      )}
      <PaymentSheet
        open={payOpen}
        onClose={() => setPayOpen(false)}
        childName={child.name}
        data={invoicesQ.data}
        contactAdmin={contactAdmin}
        tg={tg}
      />
    </motion.div>
  );
}

/* ============================================================================
 * OTA-ONA VIEW
 * ========================================================================== */

function ParentView({
  contactAdmin,
  haptic,
  tg,
}: {
  contactAdmin: () => void;
  haptic: (s: HapticStyle) => void;
  tg: TelegramWebApp | null;
}) {
  const [idx, setIdx] = useState(0);
  const { hasAnyRole } = useAuth();
  const canAccessParent = hasAnyRole('PARENT', 'SUPER_ADMIN');

  const childrenQ = useQuery<ParentChild[]>({
    queryKey: ['tg-parent-children'],
    queryFn: async () => {
      const res = await parentPortalApi.children();
      return (normalizeChildren(res) as ParentChild[]) ?? [];
    },
    staleTime: 60_000,
    enabled: canAccessParent,
  });

  if (childrenQ.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="rounded-[30px]" height={180} />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="rounded-[24px]" height={96} />
          <Skeleton className="rounded-[24px]" height={96} />
        </div>
        <Skeleton className="rounded-[30px]" height={140} />
      </div>
    );
  }
  if (childrenQ.isError) {
    return (
      <div className="pt-6">
        <ErrorState message="Farzandlar ro'yxatini yuklab bo'lmadi." onRetry={() => childrenQ.refetch()} />
      </div>
    );
  }

  const children: ParentChild[] = childrenQ.data ?? [];
  if (children.length === 0) {
    return (
      <div className="pt-6">
        <EmptyState
          icon={I.graduationCap}
          tone="blue"
          title="Farzand biriktirilmagan"
          message="Sizning hisobingizga hali o'quvchi biriktirilmagan. Farzandingizni ulash uchun markaz ma'muriyatiga murojaat qiling."
        >
          <Btn onClick={contactAdmin}>
            <Icon paths={I.send} size={14} strokeWidth={2.2} />
            Ma'muriyat bilan bog'lanish
          </Btn>
          <Btn tone="ghost" onClick={() => childrenQ.refetch()}>
            <Icon paths={I.refresh} size={14} strokeWidth={2.2} />
            Qayta tekshirish
          </Btn>
        </EmptyState>
      </div>
    );
  }

  const safeIdx = Math.min(idx, children.length - 1);
  const active = children[safeIdx];

  return (
    <div className="space-y-4">
      {children.length > 1 && (
        <div className="medu-scroll-x flex gap-2.5 overflow-x-auto pb-1">
          {children.map((c, i) => {
            const isActive = safeIdx === i;
            return (
              <motion.button
                key={c.studentId}
                type="button"
                onClick={() => {
                  haptic('light');
                  setIdx(i);
                }}
                whileTap={{ scale: 0.96 }}
                aria-pressed={isActive}
                className="relative flex shrink-0 items-center gap-2.5 rounded-2xl border px-3.5 py-2 text-left transition-colors"
                style={{
                  borderColor: isActive ? 'rgba(16,185,129,0.45)' : 'var(--border-subtle)',
                  background: isActive ? 'rgba(16,185,129,0.12)' : 'color-mix(in srgb, var(--text-primary) 4%, transparent)',
                  boxShadow: isActive ? 'inset 0 1px 0 0 rgba(255,255,255,0.25)' : 'none',
                }}
              >
                {isActive && (
                  <motion.span
                    layoutId="child-pill-glow"
                    className="pointer-events-none absolute inset-0 rounded-2xl"
                    style={{ border: '1.5px solid rgba(16,185,129,0.55)' }}
                    transition={SPRING_SNAPPY}
                  />
                )}
                <Avatar name={c.name} active={isActive} size={38} />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>
                    {c.name}
                  </span>
                  <span className="block truncate text-[10.5px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
                    {RELATION_LABELS[c.relationship ?? ''] ?? 'O\'quvchi'}
                  </span>
                </span>
              </motion.button>
            );
          })}
        </div>
      )}
      <ChildSection key={active.studentId} child={active} contactAdmin={contactAdmin} haptic={haptic} tg={tg} />
    </div>
  );
}

/* ============================================================================
 * O'QITUVCHI VIEW
 * ========================================================================== */

const ATT_CYCLE: (AttendanceStatus | null)[] = [null, 'PRESENT', 'LATE', 'ABSENT', 'EXCUSED'];

function TeacherView({ haptic }: { haptic: (s: HapticStyle) => void }) {
  const { success, error } = useToast();
  const { user } = useAuth();
  const myUserId = user?.id;
  const today = todayKey();
  const [overrides, setOverrides] = useState<Record<string, Record<string, AttendanceStatus | null>>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const groupsQ = useQuery<GroupSummary[]>({
    queryKey: ['tg-teacher-my-groups', myUserId],
    queryFn: async () => {
      const res = (await groupsApi.list({ limit: 100 })) as { items?: GroupSummary[] };
      const all = itemsOf<GroupSummary>(res);
      const mine = all.filter((g) => g.teacher?.userId === myUserId || g.teacherId === myUserId);
      return mine.length > 0 ? mine : all;
    },
    enabled: Boolean(myUserId),
    staleTime: 120_000,
  });

  const teacherId = groupsQ.data?.[0]?.teacherId ?? groupsQ.data?.[0]?.teacher?.id ?? null;
  const dayOfWeek = todayDayOfWeek();

  const schedQ = useQuery<ScheduleItem[]>({
    queryKey: ['tg-teacher-schedule', teacherId, dayOfWeek],
    queryFn: async () => {
      const res = (await scheduleApi.list({ teacherId, dayOfWeek, limit: 20 })) as { items?: ScheduleItem[] };
      return itemsOf<ScheduleItem>(res);
    },
    enabled: Boolean(teacherId),
    staleTime: 60_000,
  });

  const lessons = schedQ.data ?? [];
  const groupIds = useMemo(() => [...new Set(lessons.map((l) => l.groupId).filter(Boolean))], [lessons]);

  const detailsQ = useQuery<GroupDetail[]>({
    queryKey: ['tg-teacher-groups-detail', groupIds.join('|')],
    queryFn: async () => Promise.all(groupIds.map((id) => groupsApi.get(id) as Promise<GroupDetail>)),
    enabled: groupIds.length > 0,
    staleTime: 120_000,
  });

  const attTodayQ = useQuery<AttendanceRow[][]>({
    queryKey: ['tg-teacher-att-today', groupIds.join('|'), today],
    queryFn: async () =>
      Promise.all(
        groupIds.map(async (gid) => {
          const res = (await attendanceApi.list({ groupId: gid, date: today, limit: 100 })) as { items?: AttendanceRow[] };
          return itemsOf<AttendanceRow>(res);
        }),
      ),
    enabled: groupIds.length > 0,
    staleTime: 30_000,
    retry: false,
  });

  const groupMap = useMemo(() => new Map((detailsQ.data ?? []).map((g) => [g.id, g])), [detailsQ.data]);
  const attMap = useMemo(() => {
    const m = new Map<string, AttendanceRow[]>();
    groupIds.forEach((gid, i) => m.set(gid, attTodayQ.data?.[i] ?? []));
    return m;
  }, [groupIds, attTodayQ.data]);

  const statusOf = (
    lessonId: string,
    studentId: string,
    serverStatus: AttendanceStatus | null,
  ): AttendanceStatus | null => {
    const lessonOv = overrides[lessonId];
    if (lessonOv && studentId in lessonOv) {
      return lessonOv[studentId];
    }
    return serverStatus;
  };

  const toggle = (lessonId: string, studentId: string, serverStatus: AttendanceStatus | null) => {
    const cur = statusOf(lessonId, studentId, serverStatus);
    const next = ATT_CYCLE[(ATT_CYCLE.indexOf(cur) + 1) % ATT_CYCLE.length];
    haptic(next ? 'medium' : 'light');
    setOverrides((prev) => ({
      ...prev,
      [lessonId]: {
        ...prev[lessonId],
        [studentId]: next,
      },
    }));
  };

  const markAllPresent = (lessonId: string, students: GroupEnrollment[]) => {
    haptic('medium');
    setOverrides((prev) => ({
      ...prev,
      [lessonId]: Object.fromEntries(students.map((s) => [s.student.id, 'PRESENT' as AttendanceStatus])),
    }));
  };

  const saveLesson = async (lesson: ScheduleItem, group: GroupDetail, students: GroupEnrollment[]) => {
    const rows = attMap.get(lesson.groupId) ?? [];
    const serverByStudent = new Map(rows.map((r) => [r.studentId ?? '', r]));
    const records = students
      .map((st) => ({
        studentId: st.student.id,
        status: statusOf(lesson.id, st.student.id, serverByStudent.get(st.student.id)?.status ?? null),
      }))
      .filter((r): r is { studentId: string; status: AttendanceStatus } => Boolean(r.status));
    if (records.length === 0) return;

    setSavingId(lesson.id);
    try {
      await attendanceApi.create({ groupId: group.id, date: today, records });
      haptic('success');
      success('Davomat saqlandi', `${group.name} — ${records.length} o'quvchi belgilandi`);
      setOverrides((prev) => {
        const next = { ...prev };
        delete next[lesson.id];
        return next;
      });
      await attTodayQ.refetch();
    } catch (e) {
      haptic('error');
      error('Saqlashda xatolik', getErrorMessage(e));
    } finally {
      setSavingId(null);
    }
  };

  if (groupsQ.isLoading || schedQ.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="rounded-[30px]" height={200} />
        <Skeleton className="rounded-[30px]" height={200} />
      </div>
    );
  }
  if (groupsQ.isError) {
    return <ErrorState message="Guruhlar ro'yxatini yuklab bo'lmadi." onRetry={() => groupsQ.refetch()} />;
  }
  if ((groupsQ.data ?? []).length === 0) {
    return (
      <EmptyState
        icon={I.users}
        tone="blue"
        title="Guruhlar topilmadi"
        message="Hisobingizga biriktirilgan guruhlar aniqlanmadi. Agar bu xato bo'lsa, markaz adminiga murojaat qiling."
      />
    );
  }
  if (schedQ.isError) {
    return <ErrorState message="Bugungi darslar yuklab bo'lmadi." onRetry={() => schedQ.refetch()} />;
  }
  if (lessons.length === 0) {
    return (
      <EmptyState
        icon={I.calendar}
        tone="blue"
        title="Bugun darslar yo'q"
        message={new Date().toLocaleDateString('uz-UZ', { weekday: 'long', day: 'numeric', month: 'long' })}
      />
    );
  }

  const groupLoading = detailsQ.isLoading || attTodayQ.isLoading;

  return (
    <motion.div variants={STAGGER_CONTAINER} initial="hidden" animate="show" className="space-y-4">
      {lessons.map((lesson) => {
        const group = groupMap.get(lesson.groupId);
        const students = group?.enrollments ?? [];
        const serverRows = attMap.get(lesson.groupId) ?? [];
        const serverByStudent = new Map(serverRows.map((r) => [r.studentId ?? '', r]));
        const markedCount = students.filter(
          (s) => statusOf(lesson.id, s.student.id, serverByStudent.get(s.student.id)?.status ?? null) != null,
        ).length;
        const isSaving = savingId === lesson.id;

        return (
          <Surface key={lesson.id} tone="blue" className="p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{
                    background: TONE_COLORS.blue.bg,
                    color: TONE_COLORS.blue.fg,
                    border: `1px solid ${TONE_COLORS.blue.border}`,
                  }}
                >
                  <Icon paths={I.calendar} size={18} strokeWidth={2.1} />
                </div>
                <div>
                  <span className="text-[10.5px] font-bold uppercase tracking-wider" style={{ color: '#0A84FF' }}>
                    {lesson.startTime}
                    {lesson.endTime ? ` – ${lesson.endTime}` : ''}
                  </span>
                  <h3 className="text-[15.5px] font-bold leading-tight tracking-tight" style={{ color: 'var(--text-primary)' }}>
                    {lesson.group.name}
                  </h3>
                  {lesson.room && (
                    <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                      Xona: {lesson.room}
                    </p>
                  )}
                </div>
              </div>
              <Pill tone="blue">{groupLoading ? '…' : `${students.length} o'quvchi`}</Pill>
            </div>

            {groupLoading ? (
              <div className="mt-4 space-y-2">
                <Skeleton height={44} />
                <Skeleton height={44} />
                <Skeleton height={44} />
              </div>
            ) : (
              <>
                <div className="mt-4 divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                  {students.map((st) => {
                    const serverSt = serverByStudent.get(st.student.id)?.status ?? null;
                    const current = statusOf(lesson.id, st.student.id, serverSt);
                    const row = serverByStudent.get(st.student.id);
                    const isBiometric = Boolean(row?.source && row.source !== 'MANUAL' && row.source !== 'EXCUSED');
                    const name = `${st.student.user?.firstName ?? ''} ${st.student.user?.lastName ?? ''}`.trim() || 'O\'quvchi';

                    return (
                      <motion.button
                        key={st.student.id}
                        type="button"
                        whileTap={{ scale: 0.985 }}
                        onClick={() => toggle(lesson.id, st.student.id, serverSt)}
                        className="flex w-full items-center justify-between gap-3 py-2.5 text-left"
                      >
                        <span className="flex min-w-0 items-center gap-2.5">
                          <Avatar name={name} size={34} active={current === 'PRESENT'} />
                          <span className="min-w-0">
                            <span className="block truncate text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                              {name}
                            </span>
                            {isBiometric && (
                              <span className="mt-0.5 flex items-center gap-1 text-[10px] font-bold" style={{ color: '#10B981' }}>
                                <Icon paths={I.shieldCheck} size={10} strokeWidth={2.6} />
                                {row?.source === 'FACE' ? 'Face ID' : 'Biometrik'}
                              </span>
                            )}
                          </span>
                        </span>

                        <AnimatePresence mode="wait" initial={false}>
                          {current ? (
                            <motion.span
                              key={current}
                              initial={{ scale: 0.85, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0.85, opacity: 0 }}
                              transition={SPRING_SNAPPY}
                              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11.5px] font-bold"
                              style={{
                                background: TONE_COLORS[STATUS_META[current].tone].bg,
                                color: TONE_COLORS[STATUS_META[current].tone].fg,
                                border: `1px solid ${TONE_COLORS[STATUS_META[current].tone].border}`,
                                boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.2)',
                              }}
                            >
                              <Icon paths={STATUS_META[current].icon} size={12} strokeWidth={2.4} />
                              {STATUS_META[current].label}
                            </motion.span>
                          ) : (
                            <motion.span
                              key="unset"
                              initial={{ scale: 0.9, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0.9, opacity: 0 }}
                              transition={{ duration: 0.12 }}
                              className="liquid-inset inline-flex shrink-0 items-center px-3 py-1.5 text-[11.5px] font-semibold"
                              style={{ color: 'var(--text-tertiary)' }}
                            >
                              Belgilash
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </motion.button>
                    );
                  })}
                </div>

                <div className="mt-4 flex items-center justify-between gap-2.5 border-t pt-4" style={{ borderColor: 'var(--border-subtle)' }}>
                  <Btn tone="ghost" onClick={() => markAllPresent(lesson.id, students)} className="px-3.5">
                    Hammasi keldi
                  </Btn>
                  <Btn onClick={() => group && saveLesson(lesson, group, students)} disabled={!group || markedCount === 0 || isSaving}>
                    {isSaving ? 'Saqlanmoqda…' : `Saqlash${markedCount ? ` (${markedCount})` : ''}`}
                  </Btn>
                </div>
              </>
            )}
          </Surface>
        );
      })}
    </motion.div>
  );
}

/* ============================================================================
 * O'QUVCHI VIEW
 * ========================================================================== */

function StudentView({ haptic }: { haptic: (s: HapticStyle) => void }) {
  const { success, error } = useToast();
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const meQ = useQuery<GamificationMe>({
    queryKey: ['tg-student-me'],
    queryFn: () => gamificationApi.me() as Promise<GamificationMe>,
    staleTime: 60_000,
  });
  const eventsQ = useQuery<XpEvent[]>({
    queryKey: ['tg-student-events'],
    queryFn: async () => {
      const res = (await gamificationApi.myEvents({ limit: 6 })) as { items?: XpEvent[] };
      return itemsOf<XpEvent>(res);
    },
    staleTime: 60_000,
  });
  const rewardsQ = useQuery<RewardItem[]>({
    queryKey: ['tg-student-rewards'],
    queryFn: async () => {
      const res = (await request(`/gamification/rewards`)) as { items?: RewardItem[] };
      return itemsOf<RewardItem>(res);
    },
    staleTime: 120_000,
    retry: false,
  });

  const claim = async (reward: RewardItem) => {
    if (claimingId) return;
    setClaimingId(reward.id);
    try {
      await request(`/gamification/rewards/${reward.id}/claim`, { method: 'POST' });
      haptic('success');
      success('Mukofot olindi!', `“${reward.title}” — ${reward.costCoins} M-Coin yechildi`);
      await Promise.all([meQ.refetch(), rewardsQ.refetch()]);
    } catch (e) {
      haptic('error');
      error('Mukofot olishda xatolik', getErrorMessage(e));
    } finally {
      setClaimingId(null);
    }
  };

  if (meQ.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="rounded-[30px]" height={190} />
        <Skeleton className="rounded-[30px]" height={170} />
      </div>
    );
  }
  if (meQ.isError) {
    return (
      <ErrorState
        message="O'quvchi statistikasi yuklab bo'lmadi."
        onRetry={() => {
          meQ.refetch();
          eventsQ.refetch();
        }}
      />
    );
  }

  const me = meQ.data ?? { xp: 0, coins: 0, level: 1, xpToNextLevel: 100, rank: null, rankTotal: 0 };
  const totalForNext = Math.max(1, me.xp + Math.max(0, me.xpToNextLevel));
  const progress = me.xpToNextLevel <= 0 ? 100 : Math.max(4, Math.min(100, Math.round((me.xp / totalForNext) * 100)));
  const events = eventsQ.data ?? [];
  const rewards = rewardsQ.data ?? [];

  return (
    <motion.div variants={STAGGER_CONTAINER} initial="hidden" animate="show" className="space-y-4">
      <Surface
        className="p-6 text-white"
        style={{
          background: 'linear-gradient(135deg, rgba(79,70,229,0.92) 0%, rgba(124,58,237,0.88) 52%, rgba(219,39,119,0.88) 100%)',
          borderColor: 'rgba(255,255,255,0.28)',
          boxShadow: '0 26px 60px -20px rgba(124,58,237,0.65), inset 0 1px 0 0 rgba(255,255,255,0.45)',
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-100/90">
              M-Coins hamyoni
            </p>
            <p className="mt-1 text-[32px] font-black leading-none tracking-tight tabular-nums">
              {me.coins}
              <span className="ml-1.5 text-[13px] font-bold text-indigo-100">M-Coin</span>
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/15 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-md">
                <Icon paths={I.award} size={11} strokeWidth={2.4} />
                {me.rank != null ? `${me.rank}-o'rin` : 'Reytingsiz'}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/15 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-md">
                <Icon paths={I.star} size={11} strokeWidth={2.4} />
                {me.level}-daraja
              </span>
            </div>
          </div>
          <ProgressRing value={progress} center={me.level} sub="Daraja" tone="purple" />
        </div>

        <div className="mt-5 rounded-2xl border border-white/15 bg-black/25 p-3.5 backdrop-blur-md">
          <div className="flex items-center justify-between text-[11.5px] font-semibold">
            <span>{me.xp} XP</span>
            <span className="text-indigo-100">Keyingi darajagacha {me.xpToNextLevel} XP</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/20">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-white via-indigo-100 to-pink-200"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ type: 'spring', stiffness: 75, damping: 18 }}
            />
          </div>
        </div>
      </Surface>

      <Surface tone="purple" className="p-5">
        <CardHead
          icon={I.sparkles}
          tone="purple"
          title="So'nggi yutuqlar"
          meta={
            <span className="text-[11px] font-bold" style={{ color: TONE_COLORS.purple.fg }}>
              {me.xp} XP
            </span>
          }
        />
        {eventsQ.isLoading ? (
          <div className="space-y-2">
            <Skeleton height={46} />
            <Skeleton height={46} />
          </div>
        ) : eventsQ.isError ? (
          <p className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>
            Yutuqlar yuklab bo'lmadi.
          </p>
        ) : events.length === 0 ? (
          <p className="text-[12.5px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
            Hozircha yutuqlar yo'q. Darsga vaqtida kelish va vazifalarni bajarish XP olib keladi!
          </p>
        ) : (
          <div className="space-y-1.5">
            {events.map((ev) => (
              <div key={ev.id} className="liquid-inset flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: TONE_COLORS.purple.bg, color: TONE_COLORS.purple.fg }}
                  >
                    <Icon paths={I.sparkles} size={14} strokeWidth={2.2} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {XP_TYPE_LABELS[ev.type] ?? ev.type.replace(/_/g, ' ')}
                    </p>
                    <p className="text-[10.5px]" style={{ color: 'var(--text-tertiary)' }}>
                      {formatRelative(ev.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {ev.xp > 0 && (
                    <span className="text-[11px] font-bold" style={{ color: '#0A84FF' }}>
                      +{ev.xp} XP
                    </span>
                  )}
                  {ev.coins > 0 && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold"
                      style={{ background: TONE_COLORS.orange.bg, color: TONE_COLORS.orange.fg }}
                    >
                      <Icon paths={I.coins} size={10} strokeWidth={2.6} />+{ev.coins}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Surface>

      <Surface tone="orange" className="p-5">
        <CardHead
          icon={I.gift}
          tone="orange"
          title="M-Coin do'koni"
          meta={
            <span className="inline-flex items-center gap-1 text-[11.5px] font-bold" style={{ color: TONE_COLORS.orange.fg }}>
              <Icon paths={I.coins} size={12} strokeWidth={2.5} />
              {me.coins}
            </span>
          }
        />
        {rewardsQ.isLoading ? (
          <div className="grid grid-cols-2 gap-2.5">
            <Skeleton height={140} />
            <Skeleton height={140} />
          </div>
        ) : rewardsQ.isError ? (
          <div className="liquid-inset p-3.5">
            <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Mukofot do'koni hozircha ochilmagan. Xodimlarga murojaat qiling — tez orada paydo bo'ladi.
            </p>
          </div>
        ) : rewards.length === 0 ? (
          <EmptyState icon={I.gift} tone="orange" title="Sovg'alar tez orada" message="Markaz yangi sovg'alarni qo'shishi bilan shu yerda xarid qilishingiz mumkin." />
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {rewards.map((r) => {
              const affordable = me.coins >= r.costCoins;
              const claiming = claimingId === r.id;
              return (
                <motion.div
                  key={r.id}
                  whileTap={affordable ? { scale: 0.97 } : undefined}
                  className="liquid-inset flex flex-col p-3.5"
                >
                  <span className="text-[28px] leading-none">{r.icon || '🎁'}</span>
                  <p className="mt-2.5 text-[13px] font-bold leading-snug" style={{ color: 'var(--text-primary)' }}>
                    {r.title}
                  </p>
                  <p className="mt-1 line-clamp-2 flex-1 text-[10.5px] leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
                    {r.description}
                  </p>
                  <Btn
                    tone={affordable ? 'primary' : 'ghost'}
                    onClick={() => claim(r)}
                    disabled={!affordable || claiming}
                    className="mt-3 w-full !px-2 py-2 text-[11.5px]"
                  >
                    {claiming ? 'Yuborilmoqda…' : affordable ? `Olish · ${r.costCoins}` : `${r.costCoins} Coin`}
                  </Btn>
                </motion.div>
              );
            })}
          </div>
        )}
      </Surface>
    </motion.div>
  );
}

/* ============================================================================
 * AI COPILOT VIEW (Mobile Apple Liquid Glass AI Interface)
 * ========================================================================== */

interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

const AI_SUGGESTION_CHIPS = [
  { label: "📊 Davomat tahlili", query: "Bugungi davomat bo'yicha batafsil hisobot ber, kimlar kelmadi?" },
  { label: "📅 Dars jadvali va xonalar", query: "Bugun qanday darslar rejalashtirilgan va qaysi xonalarda o'tiladi?" },
  { label: "📝 45 daqiqalik dars rejasi", query: "Zamonaviy Bloom taksonomiyasiga binoan 45 daqiqalik dars rejasi tuzib ber." },
  { label: "💰 Qarzdorlik tahlili", query: "Qarzdor o'quvchilar va kutilayotgan to'lovlar holatini ko'rsat." },
  { label: "⚠️ Xavf ostidagi o'quvchilar", query: "Davomat va baholari pasaygan xavf ostidagi o'quvchilar tahlilini ber." },
];

function AiMarkdownContent({ content }: { content: string }) {
  const lines = content.split('\n');

  return (
    <div className="space-y-1.5 text-[13px] leading-relaxed select-text" style={{ color: 'var(--text-primary)' }}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-1" />;

        if (trimmed.startsWith('### ')) {
          return (
            <h4 key={idx} className="mt-2 text-[14px] font-bold text-emerald-400">
              {trimmed.replace(/^###\s+/, '')}
            </h4>
          );
        }
        if (trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
          return (
            <h3 key={idx} className="mt-2.5 text-[15px] font-black text-emerald-300">
              {trimmed.replace(/^#+\s+/, '')}
            </h3>
          );
        }

        if (trimmed === '---' || trimmed === '***') {
          return <hr key={idx} className="my-2 border-slate-700/50" />;
        }

        if (trimmed.startsWith('• ') || trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const rawBullet = trimmed.replace(/^[•\-*]\s+/, '');
          return (
            <div key={idx} className="flex items-start gap-2 pl-1">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
              <div className="flex-1">
                <AiFormattedText text={rawBullet} />
              </div>
            </div>
          );
        }

        const numMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
        if (numMatch) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-1">
              <span className="font-bold text-[12px] text-emerald-400 shrink-0 tabular-nums">
                {numMatch[1]}.
              </span>
              <div className="flex-1">
                <AiFormattedText text={numMatch[2]} />
              </div>
            </div>
          );
        }

        return (
          <p key={idx} className="leading-relaxed">
            <AiFormattedText text={trimmed} />
          </p>
        );
      })}
    </div>
  );
}

function AiFormattedText({ text }: { text: string }) {
  const parts: Array<{ type: 'text' | 'link'; content?: string; label?: string; url?: string }> = [];

  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.substring(lastIndex, match.index) });
    }
    parts.push({ type: 'link', label: match[1], url: match[2] });
    lastIndex = linkRegex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.substring(lastIndex) });
  }

  return (
    <>
      {parts.map((p, i) => {
        if (p.type === 'link') {
          return (
            <button
              key={i}
              type="button"
              onClick={() => window.location.assign(p.url!)}
              className="inline-flex items-center gap-1 mx-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30 transition-all cursor-pointer"
            >
              {p.label}
              <Icon paths={I.chevronRight} size={11} strokeWidth={2.4} />
            </button>
          );
        }
        const boldSubparts = (p.content || '').split(/(\*\*[^*]+\*\*)/g);
        return (
          <span key={i}>
            {boldSubparts.map((sub, j) => {
              if (sub.startsWith('**') && sub.endsWith('**')) {
                return (
                  <strong key={j} className="font-bold text-white">
                    {sub.slice(2, -2)}
                  </strong>
                );
              }
              return sub;
            })}
          </span>
        );
      })}
    </>
  );
}

function AiCopilotView({
  haptic,
  contactAdmin,
}: {
  haptic: (style: HapticStyle) => void;
  contactAdmin: () => void;
}) {
  const [messages, setMessages] = useState<CopilotMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `### 🧠 M-EDU Executive AI Copilot
Assalomu alaykum! Men ta'lim platformangizning Oliy Bosh Strategik va Analitik AI Copilotiman.

Markaz ma'lumotlar bazasiga to'g'ridan-to'g'ri ulangan holda:
- **Davomat monitoringi:** Real vaqt rejimidagi qatnashuv, kechikishlar va absenteizm
- **Pedagogik dars rejalari:** 45 daqiqalik darslar (Bloom taksonomiyasi, testlar va XP)
- **Moliyaviy tahlil:** Qarzdorliklar, to'lovlar intizomi va kassa hisoboti
- **Retention tahlili:** Kursni tashlab ketish xavfi yuqori bo'lgan o'quvchilar ro'yxati

Quyidagi tayyor savollardan birini bosing yoki savolingizni yozing:`,
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSend = async (queryText?: string) => {
    const text = (queryText || input).trim();
    if (!text || isLoading) return;

    haptic('light');
    const userMsg: CopilotMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    scrollToBottom();

    try {
      const historyPayload = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await aiApi.chat({
        message: text,
        history: historyPayload,
      });

      const assistantMsg: CopilotMessage = {
        id: `ast-${Date.now()}`,
        role: 'assistant',
        content: res.content,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      haptic('success');
    } catch {
      haptic('error');
      const errorMsg: CopilotMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ Xatolik yuz berdi: Ma'lumotlarni qayta ishlashda uzilish bo'ldi. Iltimos qaytadan urinib ko'ring yoki ma'muriyatga murojaat qiling.`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
      scrollToBottom();
    }
  };

  return (
    <motion.div variants={STAGGER_CONTAINER} initial="hidden" animate="show" className="space-y-4">
      <Surface tone="green" className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
              style={{
                background: 'linear-gradient(135deg, rgba(16,185,129,0.3) 0%, rgba(10,132,255,0.2) 100%)',
                border: '1px solid rgba(16,185,129,0.4)',
                color: '#10B981',
              }}
            >
              <Icon paths={I.sparkles} size={22} strokeWidth={2.2} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h4 className="text-[15px] font-bold tracking-tight text-white">AI Copilot Intelligence</h4>
                <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <p className="text-[11.5px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
                Gemini 2.5 Flash • Live Database Sync
              </p>
            </div>
          </div>
          <Btn tone="ghost" className="!px-2.5 !py-1 text-[11px]" onClick={contactAdmin}>
            Admin
          </Btn>
        </div>

        <div className="mt-3.5 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {AI_SUGGESTION_CHIPS.map((chip, i) => (
            <button
              key={i}
              type="button"
              disabled={isLoading}
              onClick={() => handleSend(chip.query)}
              className="liquid-btn shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold text-emerald-300 hover:text-white transition-colors"
              style={{
                background: 'rgba(16,185,129,0.12)',
                borderColor: 'rgba(16,185,129,0.25)',
              }}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </Surface>

      <div className="space-y-3">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={SPRING_SNAPPY}
              className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[92%] rounded-3xl p-4 ${
                  isUser
                    ? 'rounded-tr-md bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-lg'
                    : 'rounded-tl-md liquid-glass border border-slate-700/60'
                }`}
                style={{
                  background: isUser ? undefined : 'color-mix(in srgb, var(--bg-surface) 85%, transparent)',
                }}
              >
                {!isUser && (
                  <div className="mb-2 flex items-center gap-1.5 border-b border-slate-700/40 pb-1.5">
                    <Icon paths={I.sparkles} size={13} strokeWidth={2.4} className="text-emerald-400" />
                    <span className="text-[10.5px] font-bold uppercase tracking-wider text-emerald-400">
                      M-EDU Executive Strategist
                    </span>
                  </div>
                )}
                {isUser ? (
                  <p className="text-[13.5px] font-medium leading-relaxed">{msg.content}</p>
                ) : (
                  <AiMarkdownContent content={msg.content} />
                )}
                <div className="mt-2 flex items-center justify-end">
                  <span className="text-[9.5px] font-medium opacity-60">
                    {new Date(msg.timestamp).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}

        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <div
              className="liquid-glass rounded-3xl rounded-tl-md p-4 border border-emerald-500/30 flex items-center gap-3"
              style={{ background: 'color-mix(in srgb, var(--bg-surface) 90%, transparent)' }}
            >
              <div className="flex space-x-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="h-2 w-2 rounded-full bg-teal-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="h-2 w-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-[12px] font-medium text-emerald-300">
                AI bazani chuqur tahlil qilmoqda...
              </span>
            </div>
          </motion.div>
        )}
        <div ref={scrollRef} />
      </div>

      <div className="sticky bottom-0 pt-2 pb-2 backdrop-blur-md">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="liquid-glass flex items-center gap-2 rounded-full p-1.5 border border-emerald-500/30 shadow-2xl"
          style={{ background: 'color-mix(in srgb, var(--bg-surface) 95%, transparent)' }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="AI Copilotga savol bering..."
            disabled={isLoading}
            className="flex-1 bg-transparent px-4 py-2 text-[13.5px] text-white placeholder-slate-400 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-500 to-teal-500 text-white shadow-md disabled:opacity-40 transition-transform active:scale-95 cursor-pointer"
          >
            <Icon paths={I.send} size={16} strokeWidth={2.4} />
          </button>
        </form>
      </div>
    </motion.div>
  );
}

/* ============================================================================
 * DIGITAL BADGE VIEW (Apple Wallet Passbook Style)
 * ========================================================================== */

function QrCodeMatrix({ value }: { value: string }) {
  const size = 21;
  const hash = useMemo(() => {
    let h = 0;
    for (let i = 0; i < value.length; i++) {
      h = (Math.imul(31, h) + value.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
  }, [value]);

  const grid = useMemo(() => {
    const m: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

    const drawCorner = (startX: number, startY: number) => {
      for (let y = 0; y < 7; y++) {
        for (let x = 0; x < 7; x++) {
          if (
            y === 0 || y === 6 || x === 0 || x === 6 ||
            (y >= 2 && y <= 4 && x >= 2 && x <= 4)
          ) {
            m[startY + y][startX + x] = true;
          }
        }
      }
    };

    drawCorner(0, 0);
    drawCorner(size - 7, 0);
    drawCorner(0, size - 7);

    for (let i = 8; i < size - 8; i++) {
      m[6][i] = i % 2 === 0;
      m[i][6] = i % 2 === 0;
    }

    let seed = hash;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (r < 8 && (c < 8 || c >= size - 8)) continue;
        if (r >= size - 8 && c < 8) continue;
        if (r >= 12 && r <= 16 && c >= 12 && c <= 16) continue;
        if (r === 6 || c === 6) continue;

        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        m[r][c] = (seed % 3) === 0;
      }
    }

    return m;
  }, [hash, size]);

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-48 h-48 rounded-xl bg-white p-2.5 shadow-inner">
      {grid.map((row, r) =>
        row.map((cell, c) =>
          cell ? <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill="#0F172A" /> : null
        )
      )}
    </svg>
  );
}

function DigitalBadgeView({
  appUser,
  haptic,
}: {
  appUser: any;
  haptic: (style: HapticStyle) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(60);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev <= 1 ? 60 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const userId = appUser?.id || 'USR-2026-MEDU';
  const displayId = `EDU-${userId.slice(0, 8).toUpperCase()}`;
  const orgName = appUser?.organizationName || 'M-EDU Xalqaro Ta\'lim Markazi';
  const roleName = ROLE_LABELS[appUser?.role] || appUser?.role || "O'quvchi";
  const fullName = `${appUser?.firstName || ''} ${appUser?.lastName || ''}`.trim() || 'Foydalanuvchi';
  const qrValue = `medu://pass/${userId}?org=${appUser?.organizationId || 'org-1'}&t=${Math.floor(Date.now() / 60000)}`;

  const handleCopyId = () => {
    try {
      navigator.clipboard?.writeText?.(displayId);
      setCopied(true);
      haptic('light');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <motion.div variants={STAGGER_CONTAINER} initial="hidden" animate="show" className="space-y-4">
      <Surface tone="green" className="relative overflow-hidden p-6 !rounded-[32px] border border-emerald-500/40 shadow-2xl">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-x-20 -top-20 h-40 transform rotate-12 opacity-25"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent)' }}
        />

        <div className="flex items-center justify-between border-b border-emerald-500/30 pb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500 text-slate-900 font-black text-[13px]">
              M
            </div>
            <div>
              <p className="text-[12px] font-bold text-white tracking-wide">{orgName}</p>
              <p className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold">SMART CAMPUS PASS</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2.5 py-1 text-[10.5px] font-bold text-emerald-300 border border-emerald-500/30">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
            FAOL
          </div>
        </div>

        <div className="mt-5 flex items-center gap-4">
          <Avatar name={fullName} size={58} active />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[18px] font-extrabold text-white tracking-tight">{fullName}</h3>
            <div className="mt-1 flex items-center gap-2">
              <Pill tone="green">{roleName}</Pill>
              <span className="text-[11px] font-semibold text-slate-400">ID: {displayId}</span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col items-center justify-center">
          <div className="relative p-2 rounded-2xl bg-slate-900/60 border border-slate-700/80 shadow-2xl">
            <QrCodeMatrix value={qrValue} />
            <motion.div
              animate={{ y: [0, 180, 0] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
              className="pointer-events-none absolute inset-x-2 top-2 h-0.5 bg-emerald-400/80 shadow-[0_0_12px_#10B981]"
            />
          </div>
          <p className="mt-3 text-[11px] font-medium text-slate-300">
            Dinamik QR-kod yangilanishiga: <span className="font-bold text-emerald-400 tabular-nums">{secondsLeft}s</span>
          </p>
        </div>

        <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-[10.5px] uppercase tracking-wider text-slate-400 font-semibold">Biometrik Identifikator</p>
            <p className="text-[13px] font-bold text-white tabular-nums tracking-wide">{displayId}</p>
          </div>
          <button
            type="button"
            onClick={handleCopyId}
            className="liquid-btn flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11.5px] font-bold text-emerald-300 hover:text-white cursor-pointer"
          >
            <Icon paths={I.copy} size={14} strokeWidth={2.2} />
            {copied ? 'Nusxalandi!' : 'Nusxa olish'}
          </button>
        </div>
      </Surface>
    </motion.div>
  );
}

/* ============================================================================
 * BOTTOM DOCK (Apple visionOS Floating Dock)
 * ========================================================================== */

const TAB_META: Record<TabId, { label: string; icon: readonly string[] }> = {
  parent: { label: 'Ota-ona', icon: I.heart },
  student: { label: 'O\'quvchi', icon: I.graduationCap },
  teacher: { label: 'O\'qituvchi', icon: I.users },
  ai: { label: 'AI Yordamchi', icon: I.sparkles },
  badge: { label: 'Mening QR', icon: I.qrCode },
};

function BottomDock({
  tabs,
  active,
  onChange,
  reduced,
}: {
  tabs: TabId[];
  active: TabId;
  onChange: (t: TabId) => void;
  reduced: boolean;
}) {
  if (tabs.length < 2) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(env(safe-area-inset-bottom),14px)]">
      <nav
        role="tablist"
        aria-label="Portallar"
        className="liquid-dock pointer-events-auto mx-auto flex max-w-sm items-center justify-around rounded-full p-1.5"
      >
        {tabs.map((id) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={`${TAB_META[id].label} bo'limi`}
              onClick={() => onChange(id)}
              className="relative flex flex-1 flex-col items-center gap-0.5 rounded-full py-2 text-[10.5px] font-bold transition-colors"
              style={{ color: isActive ? '#10B981' : 'var(--text-tertiary)' }}
            >
              {isActive && (
                <motion.span
                  layoutId="dock-liquid-pill"
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: 'linear-gradient(135deg, rgba(16,185,129,0.22) 0%, rgba(10,132,255,0.14) 100%)',
                    border: '1px solid rgba(16,185,129,0.35)',
                    boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.35), 0 4px 14px -4px rgba(16,185,129,0.35)',
                  }}
                  transition={reduced ? { duration: 0 } : SPRING_SNAPPY}
                />
              )}
              <motion.span
                animate={{ scale: isActive ? 1.08 : 1, y: isActive ? -1 : 0 }}
                transition={SPRING_SNAPPY}
                className="relative z-10 flex h-5 items-center"
              >
                <Icon paths={TAB_META[id].icon} size={20} strokeWidth={isActive ? 2.4 : 1.8} />
              </motion.span>
              <span className="relative z-10">{TAB_META[id].label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

/* ============================================================================
 * GATE & ACCESS SCREENS
 * ========================================================================== */

function GateScreen() {
  return (
    <EmptyState
      icon={I.graduationCap}
      tone="blue"
      title="M-EDU Telegram Portali"
      message="Portalda ko'rish uchun M-EDU hisobingizga kiring. Bu sizning va farzandlaringiz ma'lumotlarini himoya qiladi."
    >
      <Btn onClick={() => window.location.assign('/login')}>Hisobga kirish</Btn>
    </EmptyState>
  );
}

function NoAccessScreen({ role }: { role?: string | null }) {
  return (
    <EmptyState
      icon={I.shieldCheck}
      tone="slate"
      title="Bo'lim topilmadi"
      message={`Sizning profilingiz uchun (${ROLE_LABELS[role ?? ''] ?? role ?? 'noma\'lum rol'}) ushbu portalda ochiq bo'lim yo'q. Markaz ma'muriyatiga murojaat qiling.`}
    />
  );
}

/* ============================================================================
 * MAIN PAGE COMPONENT
 * ========================================================================== */

export function TelegramWebAppPage() {
  usePageTitle('M-EDU Telegram Portali');

  const { tg, user: tgUser, colorScheme, haptic, contactAdmin } = useTelegram();
  const { user: appUser, status: authStatus, hasAnyRole } = useAuth();
  const isOnline = useOnlineStatus();
  const reduced = useReducedMotion();

  const tabs = useMemo<TabId[]>(() => {
    const list: TabId[] = [];
    if (hasAnyRole('PARENT')) list.push('parent');
    if (hasAnyRole('STUDENT')) list.push('student');
    if (hasAnyRole('TEACHER', 'ASSISTANT', 'SUPER_ADMIN', 'ORG_ADMIN', 'ADMIN', 'MANAGER')) list.push('teacher');
    if (appUser) {
      list.push('ai');
      list.push('badge');
    }
    return list;
  }, [hasAnyRole, appUser]);

  const [selectedTab, setSelectedTab] = useState<TabId | null>(null);
  const activeTab: TabId = useMemo(() => {
    if (selectedTab && tabs.includes(selectedTab)) return selectedTab;
    return tabs[0] ?? 'parent';
  }, [selectedTab, tabs]);

  const { greeting, icon: greetingIcon } = getTimeGreeting();
  const displayName = tgUser?.first_name ?? appUser?.firstName ?? (appUser ? null : 'Mehmon');
  const appRole = appUser?.role ?? undefined;

  const theme = tgThemeStyle(colorScheme);
  const headerAvatar = tgUser?.photo_url ?? null;
  const avatarName = displayName ?? `${appUser?.lastName ?? ''} ${appUser?.firstName ?? ''}`;

  return (
    <div
      className="relative min-h-screen overflow-x-hidden transition-colors duration-300"
      data-tg-theme={colorScheme}
      style={theme}
    >
      <style>{LIQUID_GLASS_CSS}</style>

      {/* Ambient Liquid Background Orbs */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="ambient-orb-1 absolute -right-20 -top-24 h-80 w-80 rounded-full"
          style={{ background: 'radial-gradient(closest-side, rgba(10,132,255,0.22), transparent)' }}
        />
        <div
          className="ambient-orb-2 absolute -bottom-28 -left-24 h-96 w-96 rounded-full"
          style={{ background: 'radial-gradient(closest-side, rgba(139,92,246,0.18), transparent)' }}
        />
      </div>

      {/* Liquid Glass Sticky Header with safe-area support */}
      <header
        className="sticky top-0 z-30 border-b"
        style={{
          background: 'color-mix(in srgb, var(--bg-page) 72%, transparent)',
          backdropFilter: 'blur(28px) saturate(190%)',
          WebkitBackdropFilter: 'blur(28px) saturate(190%)',
          borderColor: 'var(--glass-border)',
          boxShadow: 'inset 0 -1px 0 0 rgba(255,255,255,0.08)',
          paddingTop: 'max(env(safe-area-inset-top), 8px)',
        }}
      >
        <div className="mx-auto flex w-full max-w-md items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={avatarName} photo={headerAvatar} size={44} active={isOnline} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span style={{ color: TONE_COLORS.orange.fg }}>
                  <Icon paths={greetingIcon} size={14} strokeWidth={2.4} />
                </span>
                <p className="truncate text-[15px] font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                  {displayName ? `${greeting}, ${displayName.split(' ')[0]}!` : `${greeting}!`}
                </p>
              </div>
              <p className="truncate text-[11.5px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
                {appRole ? `${ROLE_LABELS[appRole] ?? appRole} • ` : ''}M-EDU Ta'lim portali
              </p>
            </div>
          </div>

          <div
            className="flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold backdrop-blur-md"
            style={{
              background: isOnline ? TONE_COLORS.green.bg : TONE_COLORS.orange.bg,
              color: isOnline ? TONE_COLORS.green.fg : TONE_COLORS.orange.fg,
              borderColor: isOnline ? TONE_COLORS.green.border : TONE_COLORS.orange.border,
              boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.2)',
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{
                background: isOnline ? '#10B981' : '#F59E0B',
                boxShadow: isOnline ? '0 0 0 3px rgba(16,185,129,0.25)' : 'none',
              }}
            />
            {isOnline ? 'Onlayn' : 'Oflayn'}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 mx-auto w-full max-w-md px-4 pb-[calc(116px+env(safe-area-inset-bottom))] pt-4">
        {authStatus === 'booting' ? (
          <div className="space-y-4">
            <Skeleton className="rounded-[30px]" height={190} />
            <Skeleton className="rounded-[30px]" height={130} />
            <Skeleton className="rounded-[30px]" height={150} />
          </div>
        ) : authStatus === 'unauthenticated' ? (
          <GateScreen />
        ) : tabs.length === 0 ? (
          <NoAccessScreen role={appRole} />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={reduced ? false : { opacity: 0, y: 12, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduced ? undefined : { opacity: 0, y: -8, scale: 0.99 }}
              transition={SPRING_SMOOTH}
            >
              {activeTab === 'parent' && <ParentView contactAdmin={contactAdmin} haptic={haptic} tg={tg} />}
              {activeTab === 'teacher' && <TeacherView haptic={haptic} />}
              {activeTab === 'student' && <StudentView haptic={haptic} />}
              {activeTab === 'ai' && <AiCopilotView haptic={haptic} contactAdmin={contactAdmin} />}
              {activeTab === 'badge' && <DigitalBadgeView appUser={appUser} haptic={haptic} />}
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      <BottomDock
        tabs={tabs}
        active={activeTab}
        reduced={reduced ?? false}
        onChange={(next) => {
          if (next === activeTab) return;
          haptic('light');
          setSelectedTab(next);
          window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
        }}
      />
    </div>
  );
}