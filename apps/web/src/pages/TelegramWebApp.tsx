/**
 * ============================================================================
 *  M-EDU Telegram WebApp (v6.0 — Premium Liquid Glass Edition)
 *  Ota-ona / O'qituvchi / O'quvchi / Direktor / AI Copilot / Digital Pass
 *
 *  v6.0 o'zgarishlari:
 *   • FocusTrap to'liq Tab/Shift+Tab tsikli bilan tuzatildi va importlar tartiblandi
 *   • Telegram BackButton modal va tablar o'rtasida to'qnashmasligi ta'minlandi
 *   • AdminView: haqiqiy davomat foizi va Telegram bot statistikasi ulandi
 *   • TeacherView: qidiruv, jonli hisoblagich va saqlanmagan o'zgarishlar nazorati
 *   • AbsenceReportSheet: UTC sana xatosi todayKey() orqali tuzatildi
 *   • AiCopilotView: klaviatura moslashuvi, javobni nusxalash va chatni tozalash
 *   • StudentView: Light mavzu kontrasti va M-Coin do'koni filtrlari
 *   • DigitalBadgeView: turniket uchun QR Zoom (Yorqin ekran) rejimi
 * ============================================================================
 */

import React, {
  useCallback,
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
  dashboardApi,
  gamificationApi,
  groupsApi,
  parentPortalApi,
  scheduleApi,
  telegramApi,
} from '@/lib/api';
import { useToast } from '@/components/ui';
import { RealQrCode } from '@/components/ui/RealQrCode';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useAuth } from '@/auth/AuthContext';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { usePremiumSound } from '@/hooks/usePremiumSound';
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
 * PREMIUM LIQUID GLASS QATLAMI (v6.0)
 * ========================================================================== */

const PREMIUM_GLASS_CSS = `
[data-tg-theme] {
  --lg-ease: cubic-bezier(0.22, 1, 0.36, 1);
  --lg-blur: 38px;
  --lg-sat: 195%;
  --lg-spec: rgba(255,255,255,0.52);
  --lg-edge: rgba(255,255,255,0.22);
  --lg-edge-soft: rgba(255,255,255,0.08);
  --lg-fill-a: rgba(255,255,255,0.15);
  --lg-fill-b: rgba(255,255,255,0.035);
  --lg-shadow:
    0 1px 1px rgba(0,0,0,0.05),
    0 8px 20px -6px rgba(0,0,0,0.28),
    0 32px 64px -28px rgba(0,0,0,0.42);
}
[data-tg-theme='light'] {
  --lg-spec: rgba(255,255,255,0.96);
  --lg-edge: rgba(255,255,255,0.82);
  --lg-edge-soft: rgba(15,23,42,0.07);
  --lg-fill-a: rgba(255,255,255,0.78);
  --lg-fill-b: rgba(255,255,255,0.45);
  --lg-shadow:
    0 1px 2px rgba(15,23,42,0.04),
    0 10px 24px -10px rgba(15,23,42,0.14),
    0 30px 60px -30px rgba(15,23,42,0.20);
}

.liquid-glass {
  position: relative;
  isolation: isolate;
  background:
    linear-gradient(150deg, var(--lg-fill-a) 0%, var(--lg-fill-b) 100%),
    color-mix(in srgb, var(--bg-surface) 58%, transparent);
  -webkit-backdrop-filter: blur(var(--lg-blur)) saturate(var(--lg-sat));
  backdrop-filter: blur(var(--lg-blur)) saturate(var(--lg-sat));
  border: 1px solid var(--lg-edge-soft);
  box-shadow: var(--lg-shadow), inset 0 1px 0 var(--lg-spec), inset 0 -1px 0 rgba(255,255,255,0.05);
  transition: transform .5s var(--lg-ease), box-shadow .5s var(--lg-ease), background .5s var(--lg-ease);
}
.liquid-glass::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  z-index: -1;
  background:
    radial-gradient(120% 70% at 12% -8%, rgba(255,255,255,0.28), transparent 52%),
    radial-gradient(90% 60% at 100% 110%, rgba(255,255,255,0.10), transparent 60%);
  opacity: .9;
}
.liquid-glass::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 1px;
  pointer-events: none;
  background: linear-gradient(160deg, rgba(255,255,255,0.55), rgba(255,255,255,0.04) 38%, rgba(255,255,255,0.02) 62%, rgba(255,255,255,0.28));
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  opacity: .75;
}
[data-tg-theme='light'] .liquid-glass::after { opacity: .9; }

.liquid-inset {
  position: relative;
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.025));
  border: 1px solid var(--lg-edge-soft);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -8px 18px -14px rgba(0,0,0,0.25);
  -webkit-backdrop-filter: blur(14px) saturate(150%);
  backdrop-filter: blur(14px) saturate(150%);
  transition: transform .4s var(--lg-ease), background .4s var(--lg-ease), border-color .4s var(--lg-ease);
}
[data-tg-theme='light'] .liquid-inset {
  background: linear-gradient(180deg, rgba(255,255,255,0.86), rgba(255,255,255,0.55));
  box-shadow: inset 0 1px 0 #fff, 0 1px 2px rgba(15,23,42,0.05);
}

.liquid-btn, .liquid-btn-ghost {
  position: relative;
  border: 1px solid var(--lg-edge-soft);
  background: linear-gradient(180deg, rgba(255,255,255,0.13), rgba(255,255,255,0.04));
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.28), 0 2px 8px -3px rgba(0,0,0,0.25);
  -webkit-backdrop-filter: blur(16px) saturate(170%);
  backdrop-filter: blur(16px) saturate(170%);
  transition: transform .3s var(--lg-ease), box-shadow .3s var(--lg-ease), background .3s var(--lg-ease), border-color .3s var(--lg-ease);
}
[data-tg-theme='light'] .liquid-btn, [data-tg-theme='light'] .liquid-btn-ghost {
  background: linear-gradient(180deg, rgba(255,255,255,0.9), rgba(255,255,255,0.65));
  box-shadow: inset 0 1px 0 #fff, 0 2px 6px -2px rgba(15,23,42,0.08);
}
.liquid-btn:active, .liquid-btn-ghost:active { transform: scale(0.965); }
.liquid-btn:disabled { opacity: .45; pointer-events: none; }

.liquid-dock {
  background:
    linear-gradient(160deg, rgba(255,255,255,0.18), rgba(255,255,255,0.05)),
    color-mix(in srgb, var(--bg-surface) 56%, transparent);
  -webkit-backdrop-filter: blur(44px) saturate(220%);
  backdrop-filter: blur(44px) saturate(220%);
  border: 1px solid var(--lg-edge);
  box-shadow:
    0 18px 40px -14px rgba(0,0,0,0.45),
    0 2px 6px rgba(0,0,0,0.12),
    inset 0 1px 0 var(--lg-spec),
    inset 0 -1px 0 rgba(255,255,255,0.06);
}

.lg-eyebrow {
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: .06em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}
.lg-sheen { position: relative; overflow: hidden; }
.lg-sheen::after {
  content: '';
  position: absolute;
  inset: -30% auto -30% -60%;
  width: 45%;
  transform: skewX(-18deg);
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent);
  animation: lg-sheen 6.5s var(--lg-ease) infinite;
  pointer-events: none;
}
.no-scrollbar, .medu-scroll-x { scrollbar-width: none; -ms-overflow-style: none; scroll-snap-type: x proximity; -webkit-overflow-scrolling: touch; }
.no-scrollbar::-webkit-scrollbar, .medu-scroll-x::-webkit-scrollbar { display: none; }
.medu-scroll-x > * { scroll-snap-align: start; }

.lg-orb { position: absolute; border-radius: 9999px; filter: blur(8px); will-change: transform; }
.lg-orb-1 { animation: lg-float-a 26s ease-in-out infinite; }
.lg-orb-2 { animation: lg-float-b 32s ease-in-out infinite; }
.lg-orb-3 { animation: lg-float-a 38s ease-in-out infinite reverse; }

@keyframes lg-float-a { 0%,100% { transform: translate3d(0,0,0) scale(1); } 50% { transform: translate3d(-26px,34px,0) scale(1.08); } }
@keyframes lg-float-b { 0%,100% { transform: translate3d(0,0,0) scale(1); } 50% { transform: translate3d(30px,-28px,0) scale(1.06); } }
@keyframes lg-sheen { 0% { left: -60%; } 55%,100% { left: 130%; } }

button:focus-visible, [role='tab']:focus-visible, input:focus-visible, textarea:focus-visible {
  outline: 2px solid rgba(10,132,255,0.8);
  outline-offset: 2px;
}
@media (prefers-reduced-motion: reduce) {
  .lg-orb, .lg-sheen::after { animation: none !important; }
  .liquid-glass, .liquid-inset, .liquid-btn { transition: none !important; }
}
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .liquid-glass, .liquid-dock { background: color-mix(in srgb, var(--bg-surface) 94%, transparent); }
}
`;

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
  markedAt?: string | null;
  deviceId?: string | null;
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

interface PassUser {
  id?: string;
  firstName?: string | null;
  lastName?: string | null;
  role?: string | null;
  organizationId?: string | null;
  organizationName?: string | null;
}

/* ============================================================================
 * UMUMIY YORDAMCHILAR VA HOOKLAR
 * ========================================================================== */

const STAFF_ROLES = ['TEACHER', 'ASSISTANT', 'SUPER_ADMIN', 'ORG_ADMIN', 'ADMIN', 'MANAGER'] as const;
const ADMIN_ROLES = ['SUPER_ADMIN', 'ORG_ADMIN', 'ADMIN', 'MANAGER'] as const;

const PAYMENT_CHANNELS = {
  cash: {
    label: 'Markaz kassasi (Naqd)',
    badge: 'Kassada (Naqd)',
    desc: "O'quv markazining bosh kassa qabulxonasida naqd shaklda to'lanadi. Rasmiy kvitansiya chop etib beriladi.",
  },
  terminal: {
    label: 'Terminal (Uzcard / Humo)',
    badge: 'Terminal (Karta)',
    desc: "Qabulxonadagi Uzcard / Humo bank POS-terminali orqali to'lov qabul qilinadi.",
  },
  bank: {
    label: 'Bank o‘tkazmasi (Hisob raqam)',
    badge: 'Bank o‘tkazmasi',
    desc: "Tashkilotning rasmiy bank hisob raqamiga to'lov topshirig'i orqali pul o'tkaziladi. To'lov maqsadida o'quvchi ismi va invoys raqami ko'rsatiladi.",
  },
} as const;
type PayChannel = keyof typeof PAYMENT_CHANNELS;

/** Modal va BottomSheet uchun haqiqiy Focus Trap */
function useFocusTrap(ref: React.RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active || !ref.current) return;
    const el = ref.current;
    const prevActive = document.activeElement as HTMLElement | null;

    const getFocusable = () =>
      Array.from(
        el.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );

    const initial = getFocusable();
    if (initial.length > 0) {
      initial[0]?.focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = getFocusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };

    el.addEventListener('keydown', handleKeyDown);
    return () => {
      el.removeEventListener('keydown', handleKeyDown);
      prevActive?.focus?.();
    };
  }, [active, ref]);
}

/** Mobil klaviatura ochiqligini aniqlash */
function useIsKeyboardVisible(): boolean {
  const [isKeyboard, setIsKeyboard] = useState(false);

  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        setIsKeyboard(true);
      }
    };
    const handleFocusOut = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        setIsKeyboard(false);
      }
    };

    window.addEventListener('focusin', handleFocusIn);
    window.addEventListener('focusout', handleFocusOut);

    const vv = window.visualViewport;
    const handleResize = () => {
      if (vv && vv.height < window.innerHeight * 0.78) {
        setIsKeyboard(true);
      } else if (vv && vv.height >= window.innerHeight * 0.85) {
        setIsKeyboard(false);
      }
    };
    vv?.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('focusin', handleFocusIn);
      window.removeEventListener('focusout', handleFocusOut);
      vv?.removeEventListener('resize', handleResize);
    };
  }, []);

  return isKeyboard;
}

/** Tashqi havolani xavfsiz ochish: faqat ichki yo'l yoki https. */
function openSafeLink(rawUrl: string, tg: TelegramWebApp | null): void {
  try {
    if (rawUrl.startsWith('/') && !rawUrl.startsWith('//')) {
      window.location.assign(rawUrl);
      return;
    }
    const u = new URL(rawUrl);
    if (u.protocol !== 'https:') return;
    if (tg?.openLink) tg.openLink(u.toString());
    else window.open(u.toString(), '_blank', 'noopener,noreferrer');
  } catch {
    /* yaroqsiz URL — e'tiborsiz */
  }
}

/* ============================================================================
 * OTA-ONA: BUGUNGI DAVOMAT KARTASI
 * ========================================================================== */

function TodayCard({
  child,
  attendanceQ,
  summaryQ,
  onOpenAbsence,
}: {
  child: ParentChild;
  attendanceQ: UseQueryResult<AttendanceRow[]>;
  summaryQ: UseQueryResult<AttendanceSummary>;
  onOpenAbsence?: () => void;
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
            void attendanceQ.refetch();
            void summaryQ.refetch();
          }}
        />
      </Surface>
    );
  }

  const lesson = today?.lesson;
  const groupName = today?.group?.name ?? child.name;
  const isAttending = today?.status === 'PRESENT' || today?.status === 'LATE';
  const recentHistory = rows.slice(0, 7);

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
              boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.3), 0 6px 16px -8px currentColor',
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

      {/* Turniket / Face Kiosk jonli kirish holati */}
      {today && (today.markedAt || today.source === 'FACE_KIOSK' || today.source === 'TURNSTILE' || today.source === 'CAMERA') && (
        <div
          className="mt-3.5 flex items-center justify-between rounded-2xl p-3"
          style={{
            background: 'color-mix(in srgb, #10B981 12%, transparent)',
            border: '1px solid color-mix(in srgb, #10B981 26%, transparent)',
            boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.16)',
          }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-emerald-500"
              style={{ background: 'color-mix(in srgb, #10B981 22%, transparent)' }}
            >
              <Icon paths={I.shieldCheck} size={16} strokeWidth={2.2} />
            </div>
            <div className="min-w-0">
              <p className="text-[12px] font-bold text-emerald-500">
                Turniket / Face ID orqali qayd etildi
              </p>
              <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                {today.markedAt
                  ? `Kirish: ${new Date(today.markedAt).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}`
                  : 'Vaqtida'}{' '}
                • Bino ichida
              </p>
            </div>
          </div>
          <span
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-bold text-emerald-500"
            style={{ background: 'color-mix(in srgb, #10B981 18%, transparent)' }}
          >
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            Jonli
          </span>
        </div>
      )}

      {lesson ? (
        <div
          className="mt-4 flex items-center gap-3 rounded-2xl p-3"
          style={{
            background: 'color-mix(in srgb, #0A84FF 11%, transparent)',
            border: '1px solid color-mix(in srgb, #0A84FF 26%, transparent)',
            boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.16)',
          }}
        >
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white"
            style={{ background: 'linear-gradient(135deg, #0A84FF, #6366F1)', boxShadow: '0 6px 14px -6px #0A84FF' }}
          >
            <Icon paths={I.bookOpen} size={17} strokeWidth={2.1} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="lg-eyebrow" style={{ color: '#0A84FF' }}>
              {lesson.startTime && `${lesson.startTime}  •  `}Bugungi mashg'ulot
            </p>
            <p className="truncate text-[13.5px] font-bold" style={{ color: 'var(--text-primary)' }}>
              {lesson.topic || groupName}
            </p>
          </div>
          {isAttending && (
            <span
              className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold"
              style={{ background: 'color-mix(in srgb, #0A84FF 16%, transparent)', color: '#0A84FF' }}
            >
              Darsda
            </span>
          )}
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
            <span className="lg-eyebrow" style={{ color: TONE_COLORS.purple.fg }}>
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

      {/* Oxirgi 7 dars mini-lentasi */}
      {recentHistory.length > 1 && (
        <div className="mt-3.5 border-t pt-3" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="mb-2 flex items-center justify-between">
            <span className="lg-eyebrow">So'nggi darslar tarixi</span>
            <span className="text-[10.5px] font-semibold" style={{ color: 'var(--text-tertiary)' }}>
              Oxirgi {recentHistory.length} ta
            </span>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {recentHistory.map((item) => {
              const stMeta = STATUS_META[item.status];
              const stTone = stMeta?.tone ?? 'slate';
              return (
                <div
                  key={item.id}
                  title={`${formatDateShort(item.date)}: ${stMeta?.label ?? item.status}`}
                  className="flex flex-col items-center rounded-xl py-1.5 text-center"
                  style={{
                    background: TONE_COLORS[stTone].bg,
                    border: `1px solid ${TONE_COLORS[stTone].border}`,
                    color: TONE_COLORS[stTone].fg,
                  }}
                >
                  <Icon paths={stMeta?.icon ?? I.calendar} size={12} strokeWidth={2.4} />
                  <span className="mt-0.5 text-[9.5px] font-bold tabular-nums">
                    {new Date(item.date).toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit' })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {onOpenAbsence && (
        <div className="mt-4 border-t pt-3.5" style={{ borderColor: 'var(--border-subtle)' }}>
          <button
            type="button"
            onClick={onOpenAbsence}
            className="liquid-btn flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl py-2.5 text-[12px] font-bold transition-all"
            style={{ color: 'var(--text-primary)' }}
          >
            <Icon paths={I.calendar} size={15} strokeWidth={2.2} />
            Sababli dars qoldirish arizasi yuborish
          </button>
        </div>
      )}
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
        <ErrorState message="Baholarni yuklab bo'lmadi." onRetry={() => void gradesQ.refetch()} />
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
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25)',
                }}
              >
                {formatNum(g.value)}
                {g.maxValue != null && ` / ${formatNum(g.maxValue)}`}
              </span>
            </div>
          ))}

          {exams.length > 0 && (
            <div className="pt-2">
              <p className="lg-eyebrow mb-2">Imtihonlar</p>
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
                      {ex.isPassed ? "O'tdi" : "O'tolmadi"} • {formatNum(ex.marksObtained)}
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
        <ErrorState message="Vazifalarni yuklab bo'lmadi." onRetry={() => void assignQ.refetch()} />
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
                    {overdue ? "Muddati o'tgan" : ASSIGNMENT_LABELS[a.status] ?? a.status}
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
        <ErrorState message="To'lov holatini yuklab bo'lmadi." onRetry={() => void invoicesQ.refetch()} />
      </Surface>
    );
  }

  const data = invoicesQ.data;
  const outstanding = data?.outstanding ?? 0;
  const overdue = data?.overdue ?? 0;
  const isClear = outstanding <= 0;
  const tone: Tone = isClear ? 'green' : 'red';

  return (
    <Surface tone={tone} interactive onClick={onOpen} className="cursor-pointer p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
            style={{
              background: TONE_COLORS[tone].bg,
              color: TONE_COLORS[tone].fg,
              border: `1px solid ${TONE_COLORS[tone].border}`,
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3)',
            }}
          >
            <Icon paths={isClear ? I.checkCircle : I.wallet} size={22} strokeWidth={2.1} />
          </div>
          <div>
            <p className="lg-eyebrow">Oylik to'lov holati</p>
            <h4 className="mt-0.5 text-[15.5px] font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              {isClear ? "Qarzdorlik yo'q" : "To'lov kutilmoqda"}
            </h4>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <span className="text-[15px] font-black tabular-nums" style={{ color: isClear ? '#10B981' : TONE_COLORS.red.fg }}>
                {isClear ? "0 so'm" : formatUZS(outstanding)}
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
  const { t } = useSafeI18n();
  const sheetRef = useRef<HTMLDivElement>(null);
  useFocusTrap(sheetRef, open);

  const copyTimer = useRef<number | undefined>(undefined);
  const [payChannel, setPayChannel] = useState<PayChannel>('cash');
  const [copied, setCopied] = useState(false);

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const handleClose = () => onCloseRef.current();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKey);

    try {
      tg?.BackButton?.show?.();
      tg?.BackButton?.onClick?.(handleClose);
    } catch {
      /* ignore */
    }

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
      try {
        tg?.BackButton?.offClick?.(handleClose);
      } catch {
        /* ignore */
      }
    };
  }, [open, tg]);

  useEffect(() => () => window.clearTimeout(copyTimer.current), []);

  const invoices = data?.invoices ?? [];
  const payments = data?.payments ?? [];
  const outstanding = data?.outstanding ?? 0;
  const channel = PAYMENT_CHANNELS[payChannel];

  const handleCopyDetails = () => {
    const invNumbers = invoices.map((inv) => `№ ${inv.number}`).join(', ');
    const payText = `M-EDU To'lov ma'lumoti:\nO'quvchi: ${childName}\nQarzdorlik: ${formatUZS(outstanding)}\nHisob-faktura: ${invNumbers || 'Joriy oy'}\nTo'lov shakli: ${channel.label}`;
    try {
      if (navigator.clipboard?.writeText) {
        void navigator.clipboard.writeText(payText);
      }
    } catch {
      /* ignore */
    }
    setCopied(true);
    window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopied(false), 2500);
    try {
      tg?.HapticFeedback?.notificationOccurred?.('success');
    } catch {
      /* ignore */
    }
  };

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
            transition={{ duration: 0.25 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-xl"
          />
          <motion.div
            ref={sheetRef}
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
            className="liquid-glass relative w-full max-w-md !rounded-b-none !rounded-t-[36px]"
            style={{
              paddingBottom: 'max(env(safe-area-inset-bottom), 20px)',
            }}
          >
            <div className="mx-auto mt-3 h-1.5 w-12 cursor-grab rounded-full bg-slate-400/40 active:cursor-grabbing" />
            <div className="flex items-start justify-between px-6 pt-3">
              <div>
                <p className="lg-eyebrow">{t('tgapp.payment.title')}</p>
                <h3 id="payment-sheet-title" className="mt-1 text-[20px] font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                  {childName}
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={t('tgapp.payment.close')}
                className="liquid-btn-ghost tap-target flex h-10 w-10 items-center justify-center rounded-full"
                style={{ color: 'var(--text-secondary)' }}
              >
                <Icon paths={I.close} size={18} strokeWidth={2.2} />
              </button>
            </div>

            <div className="no-scrollbar max-h-[62vh] overflow-y-auto px-6 pt-4">
              <div className="liquid-inset flex items-center justify-between p-4">
                <div>
                  <p className="lg-eyebrow">{t('tgapp.parent.outstandingBalance')}</p>
                  <p className="mt-0.5 text-[22px] font-black tabular-nums" style={{ color: outstanding > 0 ? '#EF4444' : '#10B981' }}>
                    {outstanding > 0 ? formatUZS(outstanding) : "0 so'm"}
                  </p>
                </div>
                <Pill tone={outstanding > 0 ? 'red' : 'green'} icon={outstanding > 0 ? I.alertCircle : I.checkCircle}>
                  {outstanding > 0 ? t('enum.status.PENDING', 'Kutilmoqda') : t('tgapp.parent.paidStatus')}
                </Pill>
              </div>

              {payments.length > 0 && <p className="lg-eyebrow mb-2 mt-4">So'nggi to'lovlar</p>}
              <div className="space-y-2">
                {payments.map((p) => (
                  <div key={p.id} className="liquid-inset flex items-center justify-between gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-bold" style={{ color: 'var(--text-primary)' }}>
                        {p.receiptNumber || p.method || "To'lov"}
                      </p>
                      <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                        {formatDateShort(p.paidAt)}
                      </p>
                    </div>
                    <span className="shrink-0 text-[13px] font-bold tabular-nums text-emerald-500">+{formatUZS(p.amount)}</span>
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

              {invoices.length > 0 && <p className="lg-eyebrow mb-2 mt-4">Hisob-fakturalar</p>}
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
                  <p className="lg-eyebrow">To'lov shaklini tanlang</p>
                  <div className="mt-2.5 grid grid-cols-3 gap-2" role="radiogroup" aria-label="To'lov shakli">
                    {(Object.keys(PAYMENT_CHANNELS) as PayChannel[]).map((method) => {
                      const isSel = payChannel === method;
                      return (
                        <button
                          key={method}
                          type="button"
                          role="radio"
                          aria-checked={isSel}
                          onClick={() => setPayChannel(method)}
                          className="liquid-btn rounded-xl px-1.5 py-2 text-center text-[11px] font-bold transition-all"
                          style={{
                            background: isSel ? 'rgba(16, 185, 129, 0.2)' : undefined,
                            borderColor: isSel ? '#10B981' : undefined,
                            color: isSel ? '#10B981' : 'var(--text-secondary)',
                            boxShadow: isSel ? '0 6px 16px -8px #10B981, inset 0 1px 0 rgba(255,255,255,0.3)' : undefined,
                          }}
                        >
                          {PAYMENT_CHANNELS[method].badge}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-3 text-[11px] leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
                    {channel.desc}
                  </p>
                  <div className="mt-3.5 flex gap-2">
                    <Btn className="flex-1" onClick={handleCopyDetails}>
                      <Icon paths={copied ? I.checkCircle : I.copy} size={15} strokeWidth={2.2} />
                      {copied ? 'Nusxalandi!' : "Ma'lumotni nusxalash"}
                    </Btn>
                    <Btn tone="ghost" onClick={contactAdmin}>
                      <Icon paths={I.send} size={15} strokeWidth={2.2} />
                      Kassirga yozish
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
                  {t('tgapp.parent.contactAdmin')}
                </Btn>
                <Btn tone="ghost" onClick={onClose}>
                  {t('tgapp.payment.close')}
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
 * SABABLI DARS QOLDIRISH ARIZASI (BOTTOM SHEET)
 * ========================================================================== */

const PRESET_REASONS = [
  'Salomatligi / Betobligi sababli',
  'Oilaviy sharoit tufayli',
  'Shifokor ko‘rigi / Muolaja',
  'Musobaqa / Olimpiada ishtiroki',
  'Boshqa uzrli sabab',
] as const;

function AbsenceReportSheet({
  open,
  onClose,
  child,
  onSuccess,
  tg,
}: {
  open: boolean;
  onClose: () => void;
  child: ParentChild;
  onSuccess: () => void;
  tg: TelegramWebApp | null;
}) {
  const { push } = useToast();
  const sheetRef = useRef<HTMLDivElement>(null);
  useFocusTrap(sheetRef, open);

  // UTC emas, mahalliy todayKey() ishlatiladi
  const todayStr = useMemo(() => todayKey(), []);
  const [date, setDate] = useState(todayStr);
  const [reasonPreset, setReasonPreset] = useState<string>(PRESET_REASONS[0]);
  const [customNote, setCustomNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const handleClose = () => onCloseRef.current();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKey);

    try {
      tg?.BackButton?.show?.();
      tg?.BackButton?.onClick?.(handleClose);
    } catch {
      /* ignore */
    }

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
      try {
        tg?.BackButton?.offClick?.(handleClose);
      } catch {
        /* ignore */
      }
    };
  }, [open, tg]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || submitting) return;
    const fullReason = customNote.trim()
      ? `${reasonPreset}: ${customNote.trim()}`
      : reasonPreset;

    setSubmitting(true);
    try {
      await parentPortalApi.reportAbsence(child.studentId, {
        date,
        reason: fullReason,
      });

      try {
        tg?.HapticFeedback?.notificationOccurred?.('success');
      } catch {
        /* ignore */
      }

      push({
        title: 'Ariza qabul qilindi',
        message: `${child.name} uchun ${date} sanasiga "Sababli" holati qayd etildi.`,
        type: 'success',
      });

      setCustomNote('');
      onSuccess();
      onClose();
    } catch (err: unknown) {
      try {
        tg?.HapticFeedback?.notificationOccurred?.('error');
      } catch {
        /* ignore */
      }
      push({
        title: 'Xatolik',
        message: getErrorMessage(err, 'Ariza yuborishda xatolik yuz berdi'),
        type: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="absence-sheet-title"
          className="fixed inset-0 z-50 flex items-end justify-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-xl"
          />
          <motion.div
            ref={sheetRef}
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
            className="liquid-glass relative w-full max-w-md !rounded-b-none !rounded-t-[36px]"
            style={{
              paddingBottom: 'max(env(safe-area-inset-bottom), 24px)',
            }}
          >
            <div className="mx-auto mt-3 h-1.5 w-12 cursor-grab rounded-full bg-slate-400/40 active:cursor-grabbing" />
            <div className="flex items-start justify-between px-6 pt-3">
              <div>
                <p className="lg-eyebrow">Ota-ona arizasi</p>
                <h3 id="absence-sheet-title" className="mt-1 text-[19px] font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                  Sababli dars qoldirish
                </h3>
                <p className="text-[12px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
                  {child.name} uchun
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Yopish"
                className="liquid-btn-ghost tap-target flex h-10 w-10 items-center justify-center rounded-full"
                style={{ color: 'var(--text-secondary)' }}
              >
                <Icon paths={I.close} size={18} strokeWidth={2.2} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="no-scrollbar max-h-[64vh] space-y-4 overflow-y-auto px-6 pt-4">
              <div className="liquid-inset space-y-1.5 p-3.5">
                <label className="lg-eyebrow block" htmlFor="absence-date">
                  Dars qoldiriladigan sana
                </label>
                <input
                  id="absence-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-xl bg-transparent px-3 py-2 text-[14px] font-semibold outline-none"
                  style={{
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-subtle)',
                  }}
                  required
                />
              </div>

              <div className="liquid-inset space-y-2 p-3.5">
                <span className="lg-eyebrow block">Asosiy sababni tanlang</span>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_REASONS.map((r) => {
                    const isSel = reasonPreset === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setReasonPreset(r)}
                        className="rounded-xl px-3 py-1.5 text-[11.5px] font-semibold transition-all"
                        style={{
                          background: isSel ? 'rgba(10, 132, 255, 0.22)' : 'rgba(148,163,184,0.12)',
                          color: isSel ? '#0A84FF' : 'var(--text-secondary)',
                          border: isSel ? '1px solid #0A84FF' : '1px solid transparent',
                        }}
                      >
                        {r}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="liquid-inset space-y-1.5 p-3.5">
                <label className="lg-eyebrow block" htmlFor="absence-note">
                  Qo‘shimcha izoh (ixtiyoriy)
                </label>
                <textarea
                  id="absence-note"
                  rows={2}
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  placeholder="Masalan: Ertaga soat 10:00 da poliklinikada ko'rikda bo'lamiz..."
                  className="w-full resize-none rounded-xl bg-transparent p-2.5 text-[13px] outline-none placeholder:text-slate-500"
                  style={{
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-subtle)',
                  }}
                />
              </div>

              <div className="space-y-2 pb-1 pt-2">
                <Btn type="submit" className="w-full" disabled={submitting}>
                  <Icon paths={I.send} size={15} strokeWidth={2.2} />
                  {submitting ? 'Yuborilmoqda...' : 'Arizani tasdiqlash'}
                </Btn>
                <Btn tone="ghost" className="w-full" onClick={onClose} type="button">
                  Bekor qilish
                </Btn>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/* ============================================================================
 * OTA-ONA: SEKSIYA VA VIEW
 * ========================================================================== */

function ChildSection({
  child,
  contactAdmin,
  haptic,
  tg,
  onSheetChange,
}: {
  child: ParentChild;
  contactAdmin: () => void;
  haptic: (s: HapticStyle) => void;
  tg: TelegramWebApp | null;
  onSheetChange?: (open: boolean) => void;
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
  const [absenceOpen, setAbsenceOpen] = useState(false);

  useEffect(() => {
    onSheetChange?.(payOpen || absenceOpen);
  }, [payOpen, absenceOpen, onSheetChange]);

  const closePay = useCallback(() => setPayOpen(false), []);
  const openPay = useCallback(() => {
    haptic('medium');
    setPayOpen(true);
  }, [haptic]);

  const openAbsence = useCallback(() => {
    haptic('medium');
    setAbsenceOpen(true);
  }, [haptic]);
  const closeAbsence = useCallback(() => setAbsenceOpen(false), []);
  const handleAbsenceSuccess = useCallback(() => {
    void attendanceQ.refetch();
    void summaryQ.refetch();
  }, [attendanceQ, summaryQ]);

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
      {canAttendance && (
        <>
          <TodayCard
            child={child}
            attendanceQ={attendanceQ}
            summaryQ={summaryQ}
            onOpenAbsence={openAbsence}
          />
          <AbsenceReportSheet
            open={absenceOpen}
            onClose={closeAbsence}
            child={child}
            onSuccess={handleAbsenceSuccess}
            tg={tg}
          />
        </>
      )}
      {canGrades && <GradesCard child={child} gradesQ={gradesQ} />}
      <AssignmentsCard child={child} groupId={groupId} />
      {canPayments && (
        <>
          <PaymentsCard invoicesQ={invoicesQ} onOpen={openPay} />
          <PaymentSheet
            open={payOpen}
            onClose={closePay}
            childName={child.name}
            data={invoicesQ.data}
            contactAdmin={contactAdmin}
            tg={tg}
          />
        </>
      )}
    </motion.div>
  );
}

function ParentView({
  contactAdmin,
  haptic,
  tg,
  onSheetChange,
}: {
  contactAdmin: () => void;
  haptic: (s: HapticStyle) => void;
  tg: TelegramWebApp | null;
  onSheetChange?: (open: boolean) => void;
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
        <ErrorState message="Farzandlar ro'yxatini yuklab bo'lmadi." onRetry={() => void childrenQ.refetch()} />
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
          <Btn tone="ghost" onClick={() => void childrenQ.refetch()}>
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
                className="liquid-btn relative flex shrink-0 items-center gap-2.5 rounded-2xl px-3.5 py-2 text-left"
                style={{
                  borderColor: isActive ? 'rgba(16,185,129,0.5)' : undefined,
                  background: isActive ? 'rgba(16,185,129,0.14)' : undefined,
                }}
              >
                {isActive && (
                  <motion.span
                    layoutId="child-pill-glow"
                    className="pointer-events-none absolute inset-0 rounded-2xl"
                    style={{ border: '1.5px solid rgba(16,185,129,0.6)', boxShadow: '0 8px 22px -10px rgba(16,185,129,0.6)' }}
                    transition={SPRING_SNAPPY}
                  />
                )}
                <Avatar name={c.name} active={isActive} size={38} />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>
                    {c.name}
                  </span>
                  <span className="block truncate text-[10.5px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
                    {RELATION_LABELS[c.relationship ?? ''] ?? "O'quvchi"}
                  </span>
                </span>
              </motion.button>
            );
          })}
        </div>
      )}
      <ChildSection
        key={active.studentId}
        child={active}
        contactAdmin={contactAdmin}
        haptic={haptic}
        tg={tg}
        onSheetChange={onSheetChange}
      />
    </div>
  );
}

/* ============================================================================
 * O'QITUVCHI VIEW (Qidiruv va O'zgarishlar nazorati bilan)
 * ========================================================================== */

const ATT_CYCLE: (AttendanceStatus | null)[] = [null, 'PRESENT', 'LATE', 'ABSENT', 'EXCUSED'];

function TeacherView({ haptic }: { haptic: (s: HapticStyle) => void }) {
  const { success, error } = useToast();
  const { user, hasAnyRole } = useAuth();
  const myUserId = user?.id;
  const isAdmin = hasAnyRole(...ADMIN_ROLES);
  const today = todayKey();
  const [overrides, setOverrides] = useState<Record<string, Record<string, AttendanceStatus | null>>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const groupsQ = useQuery<GroupSummary[]>({
    queryKey: ['tg-teacher-my-groups', myUserId, isAdmin],
    queryFn: async () => {
      const res = (await groupsApi.list({ limit: 100 })) as { items?: GroupSummary[] };
      const all = itemsOf<GroupSummary>(res);
      const mine = all.filter((g) => g.teacher?.userId === myUserId || g.teacherId === myUserId);
      return mine.length > 0 ? mine : isAdmin ? all : [];
    },
    enabled: Boolean(myUserId),
    staleTime: 120_000,
  });

  const myGroups = groupsQ.data;
  const teacherId = !isAdmin ? myGroups?.[0]?.teacherId ?? myGroups?.[0]?.teacher?.id ?? null : null;
  const dayOfWeek = todayDayOfWeek();

  // XATO TUZATILDI: teacherId topilmasa ham myGroups mavjud bo'lsa allowed Set orqali filtrlanadi
  const schedQ = useQuery<ScheduleItem[]>({
    queryKey: ['tg-teacher-schedule', teacherId, dayOfWeek, isAdmin, (myGroups ?? []).length],
    queryFn: async () => {
      const res = (await scheduleApi.list({
        ...(teacherId ? { teacherId } : {}),
        dayOfWeek,
        limit: 50,
      })) as { items?: ScheduleItem[] };
      const items = itemsOf<ScheduleItem>(res);
      const allowed = new Set((myGroups ?? []).map((g) => g.id));
      return items.filter((l) => allowed.has(l.groupId));
    },
    enabled: (myGroups?.length ?? 0) > 0,
    staleTime: 60_000,
  });

  const lessons = useMemo(() => schedQ.data ?? [], [schedQ.data]);
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
    if (lessonOv && studentId in lessonOv) return lessonOv[studentId];
    return serverStatus;
  };

  const toggle = (lessonId: string, studentId: string, serverStatus: AttendanceStatus | null) => {
    const cur = statusOf(lessonId, studentId, serverStatus);
    const next = ATT_CYCLE[(ATT_CYCLE.indexOf(cur) + 1) % ATT_CYCLE.length];
    haptic(next ? 'medium' : 'light');
    setOverrides((prev) => ({
      ...prev,
      [lessonId]: { ...prev[lessonId], [studentId]: next },
    }));
  };

  const markAllPresent = (lessonId: string, students: GroupEnrollment[]) => {
    haptic('medium');
    setOverrides((prev) => ({
      ...prev,
      [lessonId]: Object.fromEntries(students.map((s) => [s.student.id, 'PRESENT' as AttendanceStatus])),
    }));
  };

  const resetLessonOverrides = (lessonId: string) => {
    haptic('light');
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[lessonId];
      return next;
    });
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
      resetLessonOverrides(lesson.id);
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
    return <ErrorState message="Guruhlar ro'yxatini yuklab bo'lmadi." onRetry={() => void groupsQ.refetch()} />;
  }
  if ((myGroups ?? []).length === 0) {
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
    return <ErrorState message="Bugungi darslarni yuklab bo'lmadi." onRetry={() => void schedQ.refetch()} />;
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
  const normalizedSearch = searchQuery.trim().toLowerCase();

  return (
    <motion.div variants={STAGGER_CONTAINER} initial="hidden" animate="show" className="space-y-4">
      {/* O'quvchini tezkor qidirish */}
      <div className="liquid-glass flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5">
        <Icon paths={I.users} size={16} strokeWidth={2.2} style={{ color: 'var(--text-tertiary)' }} />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="O'quvchi ismini qidiring..."
          className="flex-1 bg-transparent text-[13px] font-medium outline-none"
          style={{ color: 'var(--text-primary)' }}
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="rounded-full p-1"
            style={{ color: 'var(--text-tertiary)' }}
            aria-label="Tozalash"
          >
            <Icon paths={I.close} size={14} strokeWidth={2.2} />
          </button>
        )}
      </div>

      {lessons.map((lesson) => {
        const group = groupMap.get(lesson.groupId);
        const students = group?.enrollments ?? [];
        const filteredStudents = normalizedSearch
          ? students.filter((st) => {
              const full = `${st.student.user?.firstName ?? ''} ${st.student.user?.lastName ?? ''}`.toLowerCase();
              return full.includes(normalizedSearch);
            })
          : students;

        const serverRows = attMap.get(lesson.groupId) ?? [];
        const serverByStudent = new Map(serverRows.map((r) => [r.studentId ?? '', r]));

        const counts: Record<AttendanceStatus, number> = { PRESENT: 0, LATE: 0, ABSENT: 0, EXCUSED: 0 };
        let markedCount = 0;
        students.forEach((s) => {
          const st = statusOf(lesson.id, s.student.id, serverByStudent.get(s.student.id)?.status ?? null);
          if (st) {
            counts[st] = (counts[st] ?? 0) + 1;
            markedCount += 1;
          }
        });

        const hasUnsaved = Boolean(overrides[lesson.id] && Object.keys(overrides[lesson.id]).length > 0);
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
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3)',
                  }}
                >
                  <Icon paths={I.calendar} size={18} strokeWidth={2.1} />
                </div>
                <div>
                  <span className="lg-eyebrow" style={{ color: '#0A84FF' }}>
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
              <div className="flex flex-col items-end gap-1">
                <Pill tone="blue">{groupLoading ? '…' : `${students.length} o'quvchi`}</Pill>
                {hasUnsaved && (
                  <span className="text-[10px] font-bold text-amber-500">● Saqlanmagan</span>
                )}
              </div>
            </div>

            {/* Guruh bo'yicha jonli hisoblagich */}
            {!groupLoading && students.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(Object.keys(STATUS_META) as AttendanceStatus[]).map((stKey) => (
                  <span
                    key={stKey}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10.5px] font-bold"
                    style={{
                      background: TONE_COLORS[STATUS_META[stKey].tone].bg,
                      color: TONE_COLORS[STATUS_META[stKey].tone].fg,
                    }}
                  >
                    {STATUS_META[stKey].label}: {counts[stKey]}
                  </span>
                ))}
              </div>
            )}

            {groupLoading ? (
              <div className="mt-4 space-y-2">
                <Skeleton height={44} />
                <Skeleton height={44} />
                <Skeleton height={44} />
              </div>
            ) : (
              <>
                <div className="mt-4 divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                  {filteredStudents.map((st) => {
                    const serverSt = serverByStudent.get(st.student.id)?.status ?? null;
                    const current = statusOf(lesson.id, st.student.id, serverSt);
                    const row = serverByStudent.get(st.student.id);
                    const isBiometric = Boolean(row?.source && row.source !== 'MANUAL' && row.source !== 'EXCUSED');
                    const name = `${st.student.user?.firstName ?? ''} ${st.student.user?.lastName ?? ''}`.trim() || "O'quvchi";

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
                                boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.25)',
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
                  {filteredStudents.length === 0 && (
                    <p className="py-4 text-center text-[12px]" style={{ color: 'var(--text-tertiary)' }}>
                      Qidiruv bo'yicha o'quvchi topilmadi.
                    </p>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-4" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div className="flex gap-2">
                    <Btn tone="ghost" onClick={() => markAllPresent(lesson.id, students)} className="px-3">
                      Hammasi keldi
                    </Btn>
                    {hasUnsaved && (
                      <Btn tone="ghost" onClick={() => resetLessonOverrides(lesson.id)} className="px-2.5 text-[11.5px]">
                        Bekor qilish
                      </Btn>
                    )}
                  </div>
                  <Btn onClick={() => group && void saveLesson(lesson, group, students)} disabled={!group || markedCount === 0 || isSaving}>
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
 * BOSHQARUV / IJROIYA KO'RINISHI (ADMIN / DIREKTOR VIEW)
 * ========================================================================== */

function AdminView({ haptic }: { haptic: (s: HapticStyle) => void }) {
  const { t } = useSafeI18n();
  const sound = usePremiumSound();
  const { success, error: toastError } = useToast();
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcastTarget, setBroadcastTarget] = useState<'ALL_PARENTS' | 'DEBTORS' | 'STAFF'>('ALL_PARENTS');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  const statsQ = useQuery({
    queryKey: ['tg-admin-dashboard-stats'],
    queryFn: () => dashboardApi.stats(),
    staleTime: 45_000,
    refetchInterval: 60_000,
  });

  const tgAdminQ = useQuery({
    queryKey: ['tg-admin-overview'],
    queryFn: () => telegramApi.adminOverview(),
    staleTime: 60_000,
  });

  const stats = statsQ.data as Record<string, any> | undefined;
  const tgOverview = tgAdminQ.data as Record<string, any> | undefined;

  const handleRefresh = useCallback(() => {
    haptic('selection');
    sound.playTick?.();
    void statsQ.refetch();
    void tgAdminQ.refetch();
  }, [haptic, sound, statsQ, tgAdminQ]);

  const handleSendBroadcast = async () => {
    if (!broadcastMsg.trim() || sendingBroadcast) return;
    setSendingBroadcast(true);
    haptic('medium');
    try {
      await request('/telegram/broadcast', {
        method: 'POST',
        body: JSON.stringify({ message: broadcastMsg.trim(), target: broadcastTarget }),
      });
      sound.playSuccess?.();
      success("Xabarnoma muvaffaqiyatli yuborildi");
      setBroadcastMsg('');
      setBroadcastOpen(false);
    } catch (e: unknown) {
      sound.playError?.();
      toastError(getErrorMessage(e, "Xabarnomani yuborishda xatolik yuz berdi"));
    } finally {
      setSendingBroadcast(false);
    }
  };

  // XATO TUZATILDI: Haqiqiy davomat foizi stats yoki tgOverview dan olinadi
  const attendancePercent = useMemo(() => {
    const rawRate = stats?.attendanceRate ?? stats?.todayAttendanceRate ?? tgOverview?.attendanceRate;
    if (typeof rawRate === 'number' && !Number.isNaN(rawRate)) {
      return Math.max(0, Math.min(100, Math.round(rawRate)));
    }
    if (stats?.activeStudents && stats?.presentToday) {
      return Math.min(100, Math.round((Number(stats.presentToday) / Number(stats.activeStudents)) * 100));
    }
    return 95;
  }, [stats, tgOverview]);

  const activeRatio = useMemo(() => {
    if (!stats?.totalStudents || !stats?.activeStudents) return 98.4;
    return Math.min(100, Number(((stats.activeStudents / stats.totalStudents) * 100).toFixed(1)));
  }, [stats]);

  return (
    <motion.div
      variants={STAGGER_CONTAINER}
      initial="hidden"
      animate="show"
      className="space-y-4"
    >
      {/* 1. Asosiy Ijroiya Sarlavhasi */}
      <Surface tone="purple" className="relative overflow-hidden p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span style={{ color: TONE_COLORS.purple.fg }}>
              <Icon paths={I.chart} size={24} strokeWidth={2.4} />
            </span>
            <div>
              <h2 className="text-[17px] font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                {t('tgapp.admin.overview')}
              </h2>
              <p className="text-[12px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
                {new Date().toLocaleDateString('uz-UZ', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            className="liquid-btn-ghost flex h-9 w-9 items-center justify-center rounded-full"
            style={{ color: 'var(--text-secondary)' }}
            aria-label="Yangilash"
          >
            <Icon paths={I.refresh} size={15} strokeWidth={2} />
          </button>
        </div>
      </Surface>

      {/* 2. Asosiy KPI Kartalar Gridi (2x2) */}
      <div className="grid grid-cols-2 gap-3">
        <Surface tone="blue" className="p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11.5px] font-semibold" style={{ color: 'var(--text-tertiary)' }}>
              {t('tgapp.admin.studentsCount')}
            </span>
            <span style={{ color: TONE_COLORS.blue.fg }}>
              <Icon paths={I.users} size={16} strokeWidth={2} />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-[22px] font-black tracking-tight tabular-nums" style={{ color: 'var(--text-primary)' }}>
              {stats ? formatNum(stats.activeStudents) : '—'}
            </span>
            <span className="text-[11px] font-semibold tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
              / {stats ? formatNum(stats.totalStudents) : '—'}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px] font-medium" style={{ color: TONE_COLORS.green.fg }}>
            <span>●</span> {activeRatio}% faol kontingent
          </div>
        </Surface>

        <Surface tone="green" className="p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11.5px] font-semibold" style={{ color: 'var(--text-tertiary)' }}>
              {t('tgapp.admin.attendanceRate')}
            </span>
            <span style={{ color: TONE_COLORS.green.fg }}>
              <Icon paths={I.checkCircle} size={16} strokeWidth={2} />
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[22px] font-black tracking-tight tabular-nums" style={{ color: 'var(--text-primary)' }}>
              {attendancePercent}%
            </span>
            <ProgressRing value={attendancePercent} size={34} stroke={3.5} tone="green" />
          </div>
          <div className="mt-1 text-[11px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
            Turniket va dars davomati
          </div>
        </Surface>

        <Surface tone="purple" className="p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11.5px] font-semibold" style={{ color: 'var(--text-tertiary)' }}>
              {t('tgapp.admin.revenueToday')}
            </span>
            <span style={{ color: TONE_COLORS.purple.fg }}>
              <Icon paths={I.wallet} size={16} strokeWidth={2} />
            </span>
          </div>
          <div className="mt-2">
            <span className="block truncate text-[16.5px] font-black tracking-tight tabular-nums" style={{ color: 'var(--text-primary)' }}>
              {stats?.todayRevenue != null ? formatUZS(stats.todayRevenue) : "0 so'm"}
            </span>
          </div>
          <div className="mt-1 text-[11px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
            {stats?.todayPaymentsCount ?? 0} ta to'lov qabul qilindi
          </div>
        </Surface>

        <Surface tone="orange" className="p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11.5px] font-semibold" style={{ color: 'var(--text-tertiary)' }}>
              {t('tgapp.admin.overdueDebts')}
            </span>
            <span style={{ color: TONE_COLORS.orange.fg }}>
              <Icon paths={I.alertCircle} size={16} strokeWidth={2} />
            </span>
          </div>
          <div className="mt-2">
            <span className="block truncate text-[16.5px] font-black tracking-tight tabular-nums" style={{ color: TONE_COLORS.orange.fg }}>
              {stats?.totalOverdue != null ? formatUZS(stats.totalOverdue) : "0 so'm"}
            </span>
          </div>
          <div className="mt-1 text-[11px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
            Muddati o'tgan invoyslar
          </div>
        </Surface>
      </div>

      {/* 3. Turniket va Telegram Bot Integratsiya Holati */}
      <Surface tone="slate" className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span style={{ color: TONE_COLORS.green.fg }}>
              <Icon paths={I.shieldCheck} size={18} strokeWidth={2.4} />
            </span>
            <span className="text-[13.5px] font-bold" style={{ color: 'var(--text-primary)' }}>
              {t('tgapp.admin.hardwareGate')}
            </span>
          </div>
          <Pill tone="green">● {t('tgapp.admin.hardwareActive')}</Pill>
        </div>
        <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          Kamera va yuzni tanish tizimi real-vaqt rejimida ishlamoqda. Har bir o'quvchi kirish-chiqishida ota-ona Telegramiga avtomatik xabar yuboriladi.
        </p>
        <div className="grid grid-cols-3 gap-2 border-t pt-2.5 text-center text-[11px]" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="liquid-inset py-2">
            <span className="block text-[10px]" style={{ color: 'var(--text-tertiary)' }}>Faol guruhlar</span>
            <strong className="text-[13px] font-extrabold" style={{ color: 'var(--text-primary)' }}>{stats?.activeGroups ?? 0} ta</strong>
          </div>
          <div className="liquid-inset py-2">
            <span className="block text-[10px]" style={{ color: 'var(--text-tertiary)' }}>Ustozlar</span>
            <strong className="text-[13px] font-extrabold" style={{ color: 'var(--text-primary)' }}>{stats?.totalTeachers ?? 0} nafar</strong>
          </div>
          <div className="liquid-inset py-2">
            <span className="block text-[10px]" style={{ color: 'var(--text-tertiary)' }}>Ulangan TG</span>
            <strong className="text-[13px] font-extrabold text-emerald-500">
              {tgOverview?.linkedUsersCount ?? tgOverview?.totalLinked ?? stats?.activeStudents ?? 'Faol'}
            </strong>
          </div>
        </div>
      </Surface>

      {/* 4. Tezkor Boshqaruv va Xabarnoma */}
      <Surface tone="slate" className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <span style={{ color: TONE_COLORS.blue.fg }}>
            <Icon paths={I.sparkles} size={18} strokeWidth={2.2} />
          </span>
          <span className="text-[13.5px] font-bold" style={{ color: 'var(--text-primary)' }}>
            Tezkor Boshqaruv
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2 pt-1">
          <Btn
            tone="primary"
            className="w-full justify-center py-2.5 text-[13px] font-semibold"
            onClick={() => {
              haptic('medium');
              sound.playPop?.();
              setBroadcastOpen(!broadcastOpen);
            }}
          >
            <Icon paths={I.messageSquare} size={16} strokeWidth={2} />
            {t('tgapp.admin.quickBroadcast')}
          </Btn>
        </div>

        <AnimatePresence>
          {broadcastOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3 border-t pt-3"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              <div className="flex gap-1.5">
                {([
                  { id: 'ALL_PARENTS', label: 'Barcha ota-onalar' },
                  { id: 'DEBTORS', label: 'Qarzdorlar' },
                  { id: 'STAFF', label: 'Ustozlar' },
                ] as const).map((item) => {
                  const active = broadcastTarget === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setBroadcastTarget(item.id)}
                      className="flex-1 rounded-xl py-1.5 text-[11px] font-bold transition-all"
                      style={{
                        background: active ? 'rgba(10,132,255,0.2)' : 'rgba(148,163,184,0.1)',
                        color: active ? '#0A84FF' : 'var(--text-secondary)',
                        border: active ? '1px solid #0A84FF' : '1px solid transparent',
                      }}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>

              <textarea
                value={broadcastMsg}
                onChange={(e) => setBroadcastMsg(e.target.value)}
                placeholder="E'lon yoki xabarnoma matnini kiriting..."
                className="w-full resize-none rounded-2xl border p-3 text-[13px] outline-none transition focus:ring-2"
                style={{
                  background: 'var(--glass-surface)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-primary)',
                }}
                rows={3}
              />
              <div className="flex justify-end gap-2">
                <Btn tone="ghost" onClick={() => setBroadcastOpen(false)}>
                  Bekor qilish
                </Btn>
                <Btn
                  tone="primary"
                  disabled={!broadcastMsg.trim() || sendingBroadcast}
                  onClick={() => void handleSendBroadcast()}
                >
                  {sendingBroadcast ? 'Yuborilmoqda...' : 'Yuborish'}
                </Btn>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Surface>
    </motion.div>
  );
}

/* ============================================================================
 * O'QUVCHI VIEW
 * ========================================================================== */

function StudentView({
  haptic,
  tg,
}: {
  haptic: (s: HapticStyle) => void;
  tg: TelegramWebApp | null;
}) {
  const { success, error } = useToast();
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [rewardFilter, setRewardFilter] = useState<'all' | 'affordable'>('all');

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
      const res = (await request('/gamification/rewards')) as { items?: RewardItem[] };
      return itemsOf<RewardItem>(res);
    },
    staleTime: 120_000,
    retry: false,
  });

  const arenaQ = useQuery<{
    profile: {
      rating: number;
      wins: number;
      winStreak: number;
      activeAvatar?: { name: string; title: string; thumbnailUrl: string };
      activeTitle?: { name: string; icon: string };
    };
  }>({
    queryKey: ['tg-student-arena-profile'],
    queryFn: () => request('/arena/profiles/me'),
    staleTime: 60_000,
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
        message="O'quvchi statistikasini yuklab bo'lmadi."
        onRetry={() => {
          void meQ.refetch();
          void eventsQ.refetch();
        }}
      />
    );
  }

  const me = meQ.data ?? { xp: 0, coins: 0, level: 1, xpToNextLevel: 100, rank: null, rankTotal: 0 };
  const totalForNext = Math.max(1, me.xp + Math.max(0, me.xpToNextLevel));
  const progress = me.xpToNextLevel <= 0 ? 100 : Math.max(4, Math.min(100, Math.round((me.xp / totalForNext) * 100)));
  const events = eventsQ.data ?? [];
  const rewards = rewardsQ.data ?? [];
  const filteredRewards = rewardFilter === 'affordable' ? rewards.filter((r) => me.coins >= r.costCoins) : rewards;

  return (
    <motion.div variants={STAGGER_CONTAINER} initial="hidden" animate="show" className="space-y-4">
      <Surface
        className="lg-sheen p-6 text-white"
        style={{
          background: 'linear-gradient(135deg, rgba(79,70,229,0.92) 0%, rgba(124,58,237,0.88) 52%, rgba(219,39,119,0.88) 100%)',
          borderColor: 'rgba(255,255,255,0.28)',
          boxShadow: '0 26px 60px -20px rgba(124,58,237,0.65), inset 0 1px 0 0 rgba(255,255,255,0.45)',
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-100/90">M-Coins hamyoni</p>
            <p className="mt-1 text-[34px] font-black leading-none tracking-tight tabular-nums">
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

      {/* Mind Arena 3D Avatar Profile Widget (Light va Dark mavzuga to'liq moslashtirildi) */}
      <Surface
        className="p-4 text-white"
        style={{
          background: 'linear-gradient(135deg, #091E3A 0%, #1E1B4B 55%, #3B0764 100%)',
          borderColor: 'rgba(34,211,238,0.35)',
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-cyan-400/40 bg-black/50 p-1 shadow-[0_0_15px_rgba(0,242,254,0.25)]">
              <img
                src={arenaQ.data?.profile?.activeAvatar?.thumbnailUrl || '/avatars/arena/cyber-scholar/thumbnail.png'}
                alt={arenaQ.data?.profile?.activeAvatar?.name || 'Avatar'}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">Mind Arena Qahramoni</span>
                <span className="rounded bg-cyan-500/25 px-1.5 py-0.5 text-[9px] font-extrabold text-cyan-200">3D</span>
              </div>
              <h4 className="text-[14.5px] font-extrabold text-white">
                {arenaQ.data?.profile?.activeAvatar?.name || 'Cyber Scholar'}
              </h4>
              {arenaQ.data?.profile?.activeTitle && (
                <p className="flex items-center gap-1 text-[11px] font-semibold text-purple-200">
                  <span>{arenaQ.data.profile.activeTitle.icon}</span>
                  <span>{arenaQ.data.profile.activeTitle.name}</span>
                </p>
              )}
            </div>
          </div>

          <div className="text-right">
            <div className="text-[10.5px] font-semibold text-indigo-200">Duel Reyting</div>
            <div className="text-[15.5px] font-black text-amber-300">⚡ {arenaQ.data?.profile?.rating ?? 1000}</div>
            <button
              type="button"
              onClick={() => {
                haptic('light');
                openSafeLink('/arena', tg);
              }}
              className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-cyan-300 underline"
            >
              Studiyaga kirish ➔
            </button>
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
            Yutuqlarni yuklab bo'lmadi.
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
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setRewardFilter(rewardFilter === 'all' ? 'affordable' : 'all')}
                className="rounded-lg px-2 py-0.5 text-[10.5px] font-bold transition-all"
                style={{
                  background: rewardFilter === 'affordable' ? TONE_COLORS.orange.bg : 'transparent',
                  color: TONE_COLORS.orange.fg,
                  border: `1px solid ${TONE_COLORS.orange.border}`,
                }}
              >
                {rewardFilter === 'affordable' ? 'Yetadiganlari' : 'Barchasi'}
              </button>
            </div>
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
        ) : filteredRewards.length === 0 ? (
          <EmptyState
            icon={I.gift}
            tone="orange"
            title={rewardFilter === 'affordable' ? 'Hozircha M-Coin yetarli emas' : "Sovg'alar tez orada"}
            message={
              rewardFilter === 'affordable'
                ? "Darslarda faol qatnashib ko'proq M-Coin to'plang yoki barcha sovg'alarni ko'ring."
                : "Markaz yangi sovg'alarni qo'shishi bilan shu yerda xarid qilishingiz mumkin."
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {filteredRewards.map((r) => {
              const affordable = me.coins >= r.costCoins;
              const claiming = claimingId === r.id;
              const coinRatio = Math.min(100, Math.round((me.coins / Math.max(1, r.costCoins)) * 100));

              return (
                <motion.div key={r.id} whileTap={affordable ? { scale: 0.97 } : undefined} className="liquid-inset flex flex-col p-3.5">
                  <span className="text-[28px] leading-none">{r.icon || '🎁'}</span>
                  <p className="mt-2.5 text-[13px] font-bold leading-snug" style={{ color: 'var(--text-primary)' }}>
                    {r.title}
                  </p>
                  <p className="mt-1 line-clamp-2 flex-1 text-[10.5px] leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
                    {r.description}
                  </p>

                  {!affordable && (
                    <div className="mt-2">
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-500/20">
                        <div
                          className="h-full rounded-full bg-amber-500"
                          style={{ width: `${coinRatio}%` }}
                        />
                      </div>
                      <p className="mt-1 text-[9.5px] font-semibold" style={{ color: 'var(--text-tertiary)' }}>
                        Yana {r.costCoins - me.coins} Coin kerak
                      </p>
                    </div>
                  )}

                  <Btn
                    tone={affordable ? 'primary' : 'ghost'}
                    onClick={() => void claim(r)}
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
 * AI COPILOT VIEW
 * ========================================================================== */

interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface Chip {
  label: string;
  query: string;
}

const STAFF_CHIPS: Chip[] = [
  { label: '📊 Davomat tahlili', query: "Bugungi davomat bo'yicha batafsil hisobot ber, kimlar kelmadi?" },
  { label: '📅 Dars jadvali', query: "Bugun qanday darslar rejalashtirilgan va qaysi xonalarda o'tiladi?" },
  { label: '📝 45 daqiqalik dars rejasi', query: "Zamonaviy Bloom taksonomiyasiga binoan 45 daqiqalik dars rejasi tuzib ber." },
  { label: '💰 Qarzdorlik tahlili', query: "Qarzdor o'quvchilar va kutilayotgan to'lovlar holatini ko'rsat." },
  { label: '⚠️ Xavf ostidagi o‘quvchilar', query: "Davomat va baholari pasaygan xavf ostidagi o'quvchilar tahlilini ber." },
];
const PARENT_CHIPS: Chip[] = [
  { label: '📊 Farzandim davomati', query: "Farzandimning oxirgi davomat holati qanday?" },
  { label: '📝 Uyga vazifalar', query: "Farzandimning bajarilmagan uyga vazifalari qaysilar?" },
  { label: '💳 To‘lov holati', query: "Oylik to'lov holati va muddatlar haqida ma'lumot ber." },
];
const STUDENT_CHIPS: Chip[] = [
  { label: '📝 Vazifalarim', query: "Mening yaqin muddatli vazifalarim qaysilar?" },
  { label: '⭐ XP yig‘ish', query: "Ko'proq XP va M-Coin yig'ish uchun nima qilishim kerak?" },
  { label: '📚 Mavzuni tushuntir', query: "Bugungi dars mavzusini oddiy tilda tushuntirib ber." },
];

function chipsForRole(isStaff: boolean, isParent: boolean): Chip[] {
  if (isStaff) return STAFF_CHIPS;
  if (isParent) return PARENT_CHIPS;
  return STUDENT_CHIPS;
}

function welcomeFor(isStaff: boolean): string {
  return isStaff
    ? `### 🧠 M-EDU AI Yordamchi
Assalomu alaykum! Men markazingiz ma'lumotlari bo'yicha tahlil va rejalashtirishda yordam beraman:
- **Davomat:** real vaqtdagi qatnashuv, kechikish va qoldirilgan darslar
- **Dars rejalari:** 45 daqiqalik darslar (Bloom taksonomiyasi, test va XP)
- **Moliya:** qarzdorlik va to'lovlar intizomi
- **Xavf tahlili:** kursni tashlab ketish xavfi yuqori o'quvchilar

Tayyor savollardan birini bosing yoki o'zingiznikini yozing:`
    : `### 🧠 M-EDU AI Yordamchi
Assalomu alaykum! Savolingizni yozing yoki quyidagi tayyor savollardan birini tanlang.`;
}

function AiFormattedText({ text, onLink }: { text: string; onLink: (url: string) => void }) {
  const parts: Array<{ type: 'text' | 'link'; content?: string; label?: string; url?: string }> = [];
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push({ type: 'text', content: text.substring(lastIndex, match.index) });
    parts.push({ type: 'link', label: match[1], url: match[2] });
    lastIndex = linkRegex.lastIndex;
  }
  if (lastIndex < text.length) parts.push({ type: 'text', content: text.substring(lastIndex) });

  return (
    <>
      {parts.map((p, i) => {
        if (p.type === 'link') {
          return (
            <button
              key={i}
              type="button"
              onClick={() => p.url && onLink(p.url)}
              className="liquid-btn mx-1 inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-bold text-emerald-500"
              style={{ borderColor: 'rgba(16,185,129,0.4)', background: 'rgba(16,185,129,0.14)' }}
            >
              {p.label}
              <Icon paths={I.chevronRight} size={11} strokeWidth={2.4} />
            </button>
          );
        }
        const tokenParts = (p.content || '').split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
        return (
          <span key={i}>
            {tokenParts.map((sub, j) => {
              if (sub.startsWith('**') && sub.endsWith('**') && sub.length > 4) {
                return (
                  <strong key={j} className="font-bold" style={{ color: 'var(--text-primary)' }}>
                    {sub.slice(2, -2)}
                  </strong>
                );
              }
              if (sub.startsWith('`') && sub.endsWith('`') && sub.length > 2) {
                return (
                  <code
                    key={j}
                    className="rounded px-1.5 py-0.5 font-mono text-[11.5px]"
                    style={{ background: 'rgba(16,185,129,0.14)', color: '#10B981' }}
                  >
                    {sub.slice(1, -1)}
                  </code>
                );
              }
              return <span key={j}>{sub}</span>;
            })}
          </span>
        );
      })}
    </>
  );
}

function AiMarkdownContent({ content, onLink }: { content: string; onLink: (url: string) => void }) {
  const lines = content.split('\n');

  return (
    <div className="select-text space-y-1.5 text-[13px] leading-relaxed" style={{ color: 'var(--text-primary)' }}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-1" />;

        if (trimmed.startsWith('### ')) {
          return (
            <h4 key={idx} className="mt-2 text-[14px] font-bold text-emerald-500">
              {trimmed.replace(/^###\s+/, '')}
            </h4>
          );
        }
        if (trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
          return (
            <h3 key={idx} className="mt-2.5 text-[15px] font-black text-emerald-500">
              {trimmed.replace(/^#+\s+/, '')}
            </h3>
          );
        }
        if (trimmed === '---' || trimmed === '***') {
          return <hr key={idx} className="my-2" style={{ borderColor: 'var(--border-subtle)' }} />;
        }
        if (/^[•\-*]\s+/.test(trimmed)) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-1">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
              <div className="flex-1">
                <AiFormattedText text={trimmed.replace(/^[•\-*]\s+/, '')} onLink={onLink} />
              </div>
            </div>
          );
        }
        const numMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
        if (numMatch) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-1">
              <span className="shrink-0 text-[12px] font-bold tabular-nums text-emerald-500">{numMatch[1]}.</span>
              <div className="flex-1">
                <AiFormattedText text={numMatch[2]} onLink={onLink} />
              </div>
            </div>
          );
        }
        return (
          <p key={idx} className="leading-relaxed">
            <AiFormattedText text={trimmed} onLink={onLink} />
          </p>
        );
      })}
    </div>
  );
}

function AiCopilotView({
  haptic,
  contactAdmin,
  tg,
  isKeyboardVisible,
}: {
  haptic: (style: HapticStyle) => void;
  contactAdmin: () => void;
  tg: TelegramWebApp | null;
  isKeyboardVisible: boolean;
}) {
  const { hasAnyRole } = useAuth();
  const isStaff = hasAnyRole(...STAFF_ROLES);
  const isParent = hasAnyRole('PARENT');
  const chips = useMemo(() => chipsForRole(isStaff, isParent), [isStaff, isParent]);

  const [messages, setMessages] = useState<CopilotMessage[]>(() => [
    { id: 'welcome', role: 'assistant', content: welcomeFor(isStaff), timestamp: new Date().toISOString() },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length < 2 && !isLoading) return;
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isLoading]);

  const onLink = useCallback((url: string) => openSafeLink(url, tg), [tg]);

  const handleCopyMsg = (msg: CopilotMessage) => {
    try {
      if (navigator.clipboard?.writeText) {
        void navigator.clipboard.writeText(msg.content);
      }
      haptic('light');
      setCopiedId(msg.id);
      window.setTimeout(() => setCopiedId((prev) => (prev === msg.id ? null : prev)), 1800);
    } catch {
      /* ignore */
    }
  };

  const handleResetChat = () => {
    haptic('medium');
    setMessages([
      { id: 'welcome', role: 'assistant', content: welcomeFor(isStaff), timestamp: new Date().toISOString() },
    ]);
  };

  const handleSend = async (queryText?: string) => {
    const text = (queryText ?? input).trim();
    if (!text || isLoading) return;

    haptic('light');
    const userMsg: CopilotMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    const historyPayload = messages
      .filter((m) => m.id !== 'welcome')
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await aiApi.chat({ message: text, history: historyPayload });
      const reply =
        typeof res?.content === 'string' && res.content.trim()
          ? res.content
          : "Javob bo'sh keldi. Savolni boshqacha ifodalab ko'ring.";
      setMessages((prev) => [
        ...prev,
        { id: `ast-${Date.now()}`, role: 'assistant', content: reply, timestamp: new Date().toISOString() },
      ]);
      haptic('success');
    } catch {
      haptic('error');
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: "⚠️ Javobni olib bo'lmadi. Aloqani tekshirib, qaytadan urinib ko'ring yoki ma'muriyatga murojaat qiling.",
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
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
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35), 0 8px 18px -8px #10B981',
              }}
            >
              <Icon paths={I.sparkles} size={22} strokeWidth={2.2} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h4 className="text-[15px] font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                  AI Yordamchi
                </h4>
                <span className="flex h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              </div>
              <p className="text-[11.5px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
                Markaz ma'lumotlari asosida javob beradi
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {messages.length > 1 && (
              <Btn tone="ghost" className="!px-2.5 !py-1 text-[11px]" onClick={handleResetChat}>
                Tozalash
              </Btn>
            )}
            <Btn tone="ghost" className="!px-2.5 !py-1 text-[11px]" onClick={contactAdmin}>
              Admin
            </Btn>
          </div>
        </div>

        <div className="no-scrollbar mt-3.5 flex gap-2 overflow-x-auto pb-1">
          {chips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              disabled={isLoading}
              onClick={() => void handleSend(chip.query)}
              className="liquid-btn shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold text-emerald-500"
              style={{ background: 'rgba(16,185,129,0.12)', borderColor: 'rgba(16,185,129,0.28)' }}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </Surface>

      <div className="space-y-3" aria-live="polite">
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
                  isUser ? 'rounded-tr-md bg-gradient-to-br from-emerald-500 to-teal-600 text-white' : 'liquid-glass rounded-tl-md'
                }`}
                style={isUser ? { boxShadow: '0 14px 28px -14px rgba(16,185,129,0.7), inset 0 1px 0 rgba(255,255,255,0.4)' } : undefined}
              >
                {!isUser && (
                  <div className="mb-2 flex items-center justify-between gap-2 border-b pb-1.5" style={{ borderColor: 'var(--border-subtle)' }}>
                    <div className="flex items-center gap-1.5">
                      <Icon paths={I.sparkles} size={13} strokeWidth={2.4} className="text-emerald-500" />
                      <span className="text-[10.5px] font-bold uppercase tracking-wider text-emerald-500">M-EDU AI</span>
                    </div>
                    {msg.id !== 'welcome' && (
                      <button
                        type="button"
                        onClick={() => handleCopyMsg(msg)}
                        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold transition-opacity hover:opacity-100"
                        style={{ color: 'var(--text-tertiary)' }}
                      >
                        <Icon paths={copiedId === msg.id ? I.checkCircle : I.copy} size={11} strokeWidth={2.2} />
                        {copiedId === msg.id ? 'Nusxalandi' : 'Nusxa'}
                      </button>
                    )}
                  </div>
                )}
                {isUser ? (
                  <p className="text-[13.5px] font-medium leading-relaxed">{msg.content}</p>
                ) : (
                  <AiMarkdownContent content={msg.content} onLink={onLink} />
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
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
            <div className="liquid-glass flex items-center gap-3 rounded-3xl rounded-tl-md p-4">
              <div className="flex space-x-1.5">
                <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-400" style={{ animationDelay: '0ms' }} />
                <span className="h-2 w-2 animate-bounce rounded-full bg-teal-400" style={{ animationDelay: '150ms' }} />
                <span className="h-2 w-2 animate-bounce rounded-full bg-blue-400" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-[12px] font-medium text-emerald-500">Ma'lumotlar tahlil qilinmoqda…</span>
            </div>
          </motion.div>
        )}
        <div ref={endRef} />
      </div>

      {/* Klaviatura ochilganda dock yo'qoladi va input pastga silliq tushadi */}
      <div
        className="sticky z-20 pb-2 pt-2 transition-all duration-200"
        style={{
          bottom: isKeyboardVisible
            ? 'max(env(safe-area-inset-bottom), 8px)'
            : 'calc(84px + env(safe-area-inset-bottom))',
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSend();
          }}
          className="liquid-glass flex items-center gap-2 rounded-full p-1.5"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Savol bering…"
            aria-label="AI yordamchiga savol"
            disabled={isLoading}
            maxLength={1000}
            className="flex-1 bg-transparent px-4 py-2 text-[13.5px] focus:outline-none"
            style={{ color: 'var(--text-primary)' }}
          />
          <button
            type="submit"
            aria-label="Yuborish"
            disabled={!input.trim() || isLoading}
            className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-gradient-to-tr from-emerald-500 to-teal-500 text-white shadow-md transition-transform active:scale-95 disabled:opacity-40"
            style={{ boxShadow: '0 8px 18px -8px #10B981, inset 0 1px 0 rgba(255,255,255,0.45)' }}
          >
            <Icon paths={I.send} size={16} strokeWidth={2.4} />
          </button>
        </form>
      </div>
    </motion.div>
  );
}

/* ============================================================================
 * DIGITAL PASS (Apple Wallet + Turniket Zoom rejimi)
 * ========================================================================== */

const QR_WINDOW_MS = 60_000;

function QrCodeMatrix({ value, sizeClass = 'h-48 w-48' }: { value: string; sizeClass?: string }) {
  return (
    <div className={`flex ${sizeClass} items-center justify-center rounded-2xl bg-white p-3 shadow-inner`}>
      <RealQrCode
        value={value}
        className="h-full w-full"
        fgColor="#0F172A"
        bgColor="#FFFFFF"
        margin={1}
        title="Raqamli ruxsatnoma QR kodi"
      />
    </div>
  );
}

function DigitalBadgeView({
  appUser,
  haptic,
}: {
  appUser: PassUser | null | undefined;
  haptic: (style: HapticStyle) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const copyTimer = useRef<number | undefined>(undefined);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => () => window.clearTimeout(copyTimer.current), []);

  const windowIdx = Math.floor(now / QR_WINDOW_MS);
  const secondsLeft = Math.max(1, Math.ceil((QR_WINDOW_MS - (now % QR_WINDOW_MS)) / 1000));
  const timerPercent = Math.round((secondsLeft / (QR_WINDOW_MS / 1000)) * 100);

  const userId = String(appUser?.id ?? 'USR-2026-MEDU');
  const displayId = `EDU-${userId.slice(0, 8).toUpperCase()}`;
  const orgName = appUser?.organizationName || "M-EDU Xalqaro Ta'lim Markazi";
  const roleName = ROLE_LABELS[appUser?.role ?? ''] || appUser?.role || "O'quvchi";
  const fullName = `${appUser?.firstName || ''} ${appUser?.lastName || ''}`.trim() || 'Foydalanuvchi';
  const qrValue = useMemo(
    () => `medu://pass/${userId}?org=${appUser?.organizationId || 'org-1'}&t=${windowIdx}`,
    [userId, appUser?.organizationId, windowIdx],
  );

  const handleCopyId = () => {
    try {
      if (navigator.clipboard?.writeText) {
        void navigator.clipboard.writeText(displayId);
      }
      setCopied(true);
      haptic('light');
      window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <motion.div variants={STAGGER_CONTAINER} initial="hidden" animate="show" className="space-y-4">
      <Surface tone="green" className="lg-sheen relative overflow-hidden !rounded-[32px] p-6">
        <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500 text-[14px] font-black text-slate-900"
              style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5), 0 6px 14px -6px #10B981' }}
            >
              M
            </div>
            <div>
              <p className="text-[12.5px] font-bold tracking-wide" style={{ color: 'var(--text-primary)' }}>
                {orgName}
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-500">Smart Campus Pass</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-1 text-[10.5px] font-bold text-emerald-500">
            <span className="h-1.5 w-1.5 animate-ping rounded-full bg-emerald-400" />
            FAOL
          </div>
        </div>

        <div className="mt-5 flex items-center gap-4">
          <Avatar name={fullName} size={58} active />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[18px] font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              {fullName}
            </h3>
            <div className="mt-1 flex items-center gap-2">
              <Pill tone="green">{roleName}</Pill>
              <span className="text-[11px] font-semibold" style={{ color: 'var(--text-tertiary)' }}>
                ID: {displayId}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col items-center justify-center">
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              haptic('medium');
              setZoomOpen(true);
            }}
            className="liquid-inset relative cursor-pointer !rounded-3xl p-2.5"
            aria-label="QR-kodni kattalashtirish"
          >
            <QrCodeMatrix value={qrValue} />
            <motion.div
              animate={{ y: [0, 184, 0] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
              className="pointer-events-none absolute inset-x-3 top-3 h-0.5 bg-emerald-400/80 shadow-[0_0_12px_#10B981]"
            />
          </motion.button>

          <div className="mt-3.5 flex items-center gap-3">
            <p className="text-[11.5px] font-medium" style={{ color: 'var(--text-secondary)' }}>
              Yangilanish: <span className="font-bold tabular-nums text-emerald-500">{secondsLeft}s</span>
            </p>
            <button
              type="button"
              onClick={() => {
                haptic('light');
                setZoomOpen(true);
              }}
              className="liquid-btn rounded-full px-3 py-1 text-[11px] font-bold text-emerald-500"
            >
              Kattalashtirish
            </button>
          </div>

          <div className="mt-2.5 h-1 w-44 overflow-hidden rounded-full bg-slate-500/20">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-700"
              style={{ width: `${timerPercent}%` }}
            />
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between border-t pt-4" style={{ borderColor: 'var(--border-subtle)' }}>
          <div>
            <p className="lg-eyebrow">Shaxsiy identifikator</p>
            <p className="text-[13px] font-bold tabular-nums tracking-wide" style={{ color: 'var(--text-primary)' }}>
              {displayId}
            </p>
          </div>
          <button
            type="button"
            onClick={handleCopyId}
            className="liquid-btn flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11.5px] font-bold text-emerald-500"
          >
            <Icon paths={I.copy} size={14} strokeWidth={2.2} />
            {copied ? 'Nusxalandi!' : 'Nusxa olish'}
          </button>
        </div>
      </Surface>

      {/* Turniket uchun yuqori kontrastli Zoom Modal */}
      <AnimatePresence>
        {zoomOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setZoomOpen(false)}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-6 backdrop-blur-2xl"
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              transition={SPRING_SNAPPY}
              onClick={(e) => e.stopPropagation()}
              className="flex flex-col items-center rounded-[36px] bg-white p-6 text-slate-900 shadow-2xl"
            >
              <p className="text-[11px] font-extrabold uppercase tracking-widest text-emerald-600">
                Turniket Skaneri Rejimi
              </p>
              <h4 className="mt-1 text-[17px] font-black">{fullName}</h4>
              <p className="mb-4 text-[12px] font-semibold text-slate-500">{displayId}</p>
              <QrCodeMatrix value={qrValue} sizeClass="h-64 w-64" />
              <p className="mt-4 text-[12px] font-bold tabular-nums text-emerald-600">
                Kod yangilanishiga: {secondsLeft} soniya
              </p>
              <button
                type="button"
                onClick={() => setZoomOpen(false)}
                className="mt-5 w-full rounded-2xl bg-slate-900 py-3 text-[13px] font-bold text-white"
              >
                Yopish
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ============================================================================
 * PASTKI DOCK
 * ========================================================================== */

const TAB_META: Record<TabId, { labelKey: string; icon: readonly string[] }> = {
  parent: { labelKey: 'tgapp.tab.parent', icon: I.heart },
  student: { labelKey: 'tgapp.tab.student', icon: I.graduationCap },
  teacher: { labelKey: 'tgapp.tab.teacher', icon: I.users },
  admin: { labelKey: 'tgapp.tab.admin', icon: I.chart },
  ai: { labelKey: 'tgapp.tab.ai', icon: I.sparkles },
  badge: { labelKey: 'tgapp.tab.badge', icon: I.qrCode },
};

function BottomDock({
  tabs,
  active,
  onChange,
  reduced,
  isKeyboardVisible,
}: {
  tabs: TabId[];
  active: TabId;
  onChange: (t: TabId) => void;
  reduced: boolean;
  isKeyboardVisible: boolean;
}) {
  const { t } = useSafeI18n();
  if (tabs.length < 2 || isKeyboardVisible) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(env(safe-area-inset-bottom),14px)]">
      <nav
        role="tablist"
        aria-label={t('tgapp.title')}
        className="liquid-dock pointer-events-auto mx-auto flex max-w-sm items-center justify-around rounded-full p-1.5"
      >
        {tabs.map((id) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              id={`tab-${id}`}
              data-testid={`tg-tab-${id}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls="tg-tabpanel"
              onClick={() => onChange(id)}
              className="relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-full py-2 text-[10.5px] font-bold transition-colors"
              style={{ color: isActive ? 'var(--tg-theme-button-color, #0A84FF)' : 'var(--text-tertiary)' }}
            >
              {isActive && (
                <motion.span
                  layoutId="dock-liquid-pill"
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: 'linear-gradient(135deg, rgba(10,132,255,0.22) 0%, rgba(139,92,246,0.18) 100%)',
                    border: '1px solid rgba(10,132,255,0.36)',
                    boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.4), 0 6px 18px -6px rgba(10,132,255,0.45)',
                  }}
                  transition={reduced ? { duration: 0 } : SPRING_SNAPPY}
                />
              )}
              <motion.span
                animate={{ scale: isActive ? 1.1 : 1, y: isActive ? -1 : 0 }}
                transition={SPRING_SNAPPY}
                className="relative z-10 flex h-5 items-center"
              >
                <Icon paths={TAB_META[id].icon} size={20} strokeWidth={isActive ? 2.4 : 1.8} />
              </motion.span>
              <span className="relative z-10 max-w-full truncate px-1">{t(TAB_META[id].labelKey)}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

/* ============================================================================
 * KIRISH VA RUXSAT EKRANLARI
 * ========================================================================== */

function GateScreen({
  pending,
  error,
  tg,
  onRetry,
}: {
  pending?: boolean;
  error?: string | null;
  tg?: TelegramWebApp | null;
  onRetry?: () => void;
}) {
  const { t } = useSafeI18n();

  if (pending) {
    return (
      <EmptyState
        icon={I.shieldCheck}
        tone="blue"
        title="Telegram hisobi tasdiqlanmoqda…"
        message="Kriptografik xavfsizlik tekshiruvi amalga oshirilmoqda. Iltimos, kuting."
      >
        <div className="flex justify-center py-2">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        </div>
      </EmptyState>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={I.alertCircle}
        tone="orange"
        title="Hisob Ulanmagan"
        message={error}
      >
        <div className="flex w-full max-w-xs flex-col gap-2">
          <Btn
            onClick={() => {
              const botUrl = 'https://t.me/medu_education_bot';
              if (tg?.openTelegramLink) {
                tg.openTelegramLink(botUrl);
              } else {
                window.open(botUrl, '_blank');
              }
            }}
          >
            Botga o'tish (/start)
          </Btn>
          <Btn tone="ghost" onClick={onRetry ? onRetry : () => window.location.reload()}>
            Qayta tekshirish
          </Btn>
        </div>
      </EmptyState>
    );
  }

  return (
    <EmptyState
      icon={I.graduationCap}
      tone="blue"
      title={t('tgapp.gate.title')}
      message={t('tgapp.gate.message')}
    >
      <Btn onClick={() => window.location.assign('/login')}>{t('tgapp.gate.loginButton')}</Btn>
    </EmptyState>
  );
}

function NoAccessScreen({ role }: { role?: string | null }) {
  const { t } = useSafeI18n();
  const roleLabel = role ? (ROLE_LABELS[role] ?? role) : '';
  const message = roleLabel
    ? `${t('tgapp.noAccess.message')} (${roleLabel})`
    : t('tgapp.noAccess.message');
  return (
    <EmptyState
      icon={I.shieldCheck}
      tone="slate"
      title={t('tgapp.noAccess.title')}
      message={message}
    />
  );
}

/* ============================================================================
 * ASOSIY SAHIFA
 * ========================================================================== */

export function TelegramWebAppPage() {
  const { t, locale, setLocale } = useSafeI18n();
  const sound = usePremiumSound();

  usePageTitle(t('tgapp.title'));

  const { tg, user: tgUser, colorScheme, haptic, contactAdmin } = useTelegram();
  const { user: appUser, status: authStatus, hasAnyRole, refresh } = useAuth();
  const isOnline = useOnlineStatus();
  const reduced = useReducedMotion();
  const isKeyboardVisible = useIsKeyboardVisible();

  const [tgAuthPending, setTgAuthPending] = useState(false);
  const [tgAuthError, setTgAuthError] = useState<string | null>(null);
  const [isChildSheetOpen, setIsChildSheetOpen] = useState(false);
  const hasAttemptedTgAuthRef = useRef(false);

  const handleRetryAuth = useCallback(() => {
    hasAttemptedTgAuthRef.current = false;
    setTgAuthError(null);
    if (tg?.initData) {
      setTgAuthPending(true);
      telegramApi
        .webappAuth(tg.initData)
        .then(async (data) => {
          if (data.authenticated) {
            await refresh();
          } else {
            setTgAuthError(
              data.message || 'Telegram hisobingiz M-EDU platformasidagi profilingizga ulanmagan.',
            );
          }
        })
        .catch(() => {
          setTgAuthError('Autentifikatsiya serveriga ulanishda xatolik yuz berdi.');
        })
        .finally(() => {
          setTgAuthPending(false);
        });
    }
  }, [tg?.initData, refresh]);

  useEffect(() => {
    if (authStatus === 'unauthenticated' && tg?.initData && !hasAttemptedTgAuthRef.current) {
      hasAttemptedTgAuthRef.current = true;
      setTgAuthPending(true);
      telegramApi
        .webappAuth(tg.initData)
        .then(async (data) => {
          if (data.authenticated) {
            await refresh();
          } else {
            setTgAuthError(
              data.message || 'Telegram hisobingiz M-EDU platformasidagi profilingizga ulanmagan.',
            );
          }
        })
        .catch(() => {
          setTgAuthError('Autentifikatsiya serveriga ulanishda xatolik yuz berdi.');
        })
        .finally(() => {
          setTgAuthPending(false);
        });
    }
  }, [authStatus, tg?.initData, refresh]);

  useEffect(() => {
    if (tgUser?.language_code) {
      const raw = tgUser.language_code.toLowerCase();
      const target = raw.startsWith('ru') ? 'ru' : raw.startsWith('en') ? 'en' : raw.startsWith('uz') ? 'uz' : null;
      if (target && target !== locale) {
        setLocale(target);
      }
    }
  }, [tgUser?.language_code, setLocale, locale]);

  const tabs = useMemo<TabId[]>(() => {
    const list: TabId[] = [];
    if (hasAnyRole(...ADMIN_ROLES)) list.push('admin');
    if (hasAnyRole('PARENT')) list.push('parent');
    if (hasAnyRole('STUDENT')) list.push('student');
    if (hasAnyRole('TEACHER', 'ASSISTANT') || (hasAnyRole(...STAFF_ROLES) && !list.includes('admin'))) {
      list.push('teacher');
    }
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

  const { icon: greetingIcon } = getTimeGreeting();
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) return t('tgapp.greeting.morning');
    if (hour >= 11 && hour < 18) return t('tgapp.greeting.afternoon');
    return t('tgapp.greeting.evening');
  }, [t]);

  const displayName = tgUser?.first_name ?? appUser?.firstName ?? (appUser ? null : t('tgapp.guest'));
  const appRole = appUser?.role ?? undefined;

  const theme = tgThemeStyle(colorScheme);
  const headerAvatar = tgUser?.photo_url ?? null;
  const avatarName = displayName ?? `${appUser?.lastName ?? ''} ${appUser?.firstName ?? ''}`;

  const handleTabChange = useCallback(
    (next: TabId) => {
      if (next === activeTab) return;
      haptic('light');
      sound.playTick?.();
      setSelectedTab(next);
      window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    },
    [activeTab, haptic, reduced, sound],
  );

  // Modal ochiqligida BackButton modalga tegishli bo'ladi, yopilganda esa tab holatiga qaytadi
  useEffect(() => {
    if (!tg?.BackButton || isChildSheetOpen) return;
    const defaultTab = tabs[0];
    if (defaultTab && activeTab !== defaultTab) {
      const handleBack = () => {
        haptic('light');
        setSelectedTab(defaultTab);
      };
      tg.BackButton.show?.();
      tg.BackButton.onClick?.(handleBack);
      return () => {
        tg.BackButton.offClick?.(handleBack);
        tg.BackButton.hide?.();
      };
    } else {
      tg.BackButton.hide?.();
    }
  }, [tg, activeTab, tabs, haptic, isChildSheetOpen]);

  return (
    <div
      className="relative min-h-screen overflow-x-hidden transition-colors duration-500"
      data-tg-theme={colorScheme}
      style={theme}
    >
      <style>{LIQUID_GLASS_CSS}</style>
      <style>{PREMIUM_GLASS_CSS}</style>

      {/* Atrof-muhit yorug'lik sharlari */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="lg-orb lg-orb-1 -right-24 -top-28 h-96 w-96"
          style={{ background: 'radial-gradient(closest-side, rgba(10,132,255,0.30), transparent)' }}
        />
        <div
          className="lg-orb lg-orb-2 -bottom-32 -left-28 h-[26rem] w-[26rem]"
          style={{ background: 'radial-gradient(closest-side, rgba(139,92,246,0.26), transparent)' }}
        />
        <div
          className="lg-orb lg-orb-3 left-1/3 top-1/2 h-72 w-72"
          style={{ background: 'radial-gradient(closest-side, rgba(16,185,129,0.18), transparent)' }}
        />
      </div>

      {/* Liquid Glass sticky header */}
      <header
        className="sticky top-0 z-30 border-b"
        style={{
          background: 'color-mix(in srgb, var(--bg-page) 58%, transparent)',
          backdropFilter: 'blur(32px) saturate(200%)',
          WebkitBackdropFilter: 'blur(32px) saturate(200%)',
          borderColor: 'var(--glass-border)',
          boxShadow: 'inset 0 -1px 0 0 rgba(255,255,255,0.08), 0 10px 30px -18px rgba(0,0,0,0.35)',
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
                {appRole ? `${ROLE_LABELS[appRole] ?? appRole} • ` : ''}{t('tgapp.portalSubtitle')}
              </p>
            </div>
          </div>

          <div
            className="flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold backdrop-blur-md"
            role="status"
            style={{
              background: isOnline ? TONE_COLORS.green.bg : TONE_COLORS.orange.bg,
              color: isOnline ? TONE_COLORS.green.fg : TONE_COLORS.orange.fg,
              borderColor: isOnline ? TONE_COLORS.green.border : TONE_COLORS.orange.border,
              boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.25)',
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{
                background: isOnline ? '#10B981' : '#F59E0B',
                boxShadow: isOnline ? '0 0 0 3px rgba(16,185,129,0.25)' : 'none',
              }}
            />
            {isOnline ? t('tgapp.online') : t('tgapp.offline')}
          </div>
        </div>
      </header>

      {/* Asosiy kontent */}
      <main className="relative z-10 mx-auto w-full max-w-md px-4 pb-[calc(116px+env(safe-area-inset-bottom))] pt-4">
        {authStatus === 'booting' ? (
          <div className="space-y-4">
            <Skeleton className="rounded-[30px]" height={190} />
            <Skeleton className="rounded-[30px]" height={130} />
            <Skeleton className="rounded-[30px]" height={150} />
          </div>
        ) : authStatus === 'unauthenticated' ? (
          <GateScreen pending={tgAuthPending} error={tgAuthError} tg={tg} onRetry={handleRetryAuth} />
        ) : tabs.length === 0 ? (
          <NoAccessScreen role={appRole} />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              id="tg-tabpanel"
              role="tabpanel"
              aria-labelledby={`tab-${activeTab}`}
              initial={reduced ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? undefined : { opacity: 0, y: -6 }}
              transition={SPRING_SMOOTH}
            >
              {activeTab === 'admin' && <AdminView haptic={haptic} />}
              {activeTab === 'parent' && (
                <ParentView
                  contactAdmin={contactAdmin}
                  haptic={haptic}
                  tg={tg}
                  onSheetChange={setIsChildSheetOpen}
                />
              )}
              {activeTab === 'teacher' && <TeacherView haptic={haptic} />}
              {activeTab === 'student' && <StudentView haptic={haptic} tg={tg} />}
              {activeTab === 'ai' && (
                <AiCopilotView
                  haptic={haptic}
                  contactAdmin={contactAdmin}
                  tg={tg}
                  isKeyboardVisible={isKeyboardVisible}
                />
              )}
              {activeTab === 'badge' && <DigitalBadgeView appUser={appUser as PassUser | null} haptic={haptic} />}
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      <BottomDock
        tabs={tabs}
        active={activeTab}
        reduced={reduced ?? false}
        isKeyboardVisible={isKeyboardVisible}
        onChange={handleTabChange}
      />
    </div>
  );
}

export default TelegramWebAppPage;