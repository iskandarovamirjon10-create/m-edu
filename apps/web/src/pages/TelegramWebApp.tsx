/**
 * ============================================================================
 *  M-EDU Telegram WebApp — Premium Ota-ona / O‘qituvchi / O‘quvchi portali
 * ============================================================================
 *
 *  Dizayn qoidalari:
 *   1. Faqat REAL backend kontraktlari — hech qanday soxta/mock ma'lumot yo'q.
 *   2. Har bir holat uchun samimiy EmptyState / ErrorState / Loading.
 *   3. Telegram WebApp tema-parametrlari (light/dark) Bootstrap tokenlariga
 *      ko'prik orqali butun sahifaga, jumladan global .glass-card / tone-*
 *      klasslariga ham sizib chiqadi.
 *   4. Nativ HapticFeedback, Viewport, Telegram SDK dinamik yuklanadi.
 *   5. Premium & Comfort: katta radius, yumshoq glass, keng touch-zonalar,
 *      44px tap-target, safe-area qo'llab-quvvatlash, reduced-motion.
 * ============================================================================
 */

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
  type SVGProps,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import request, {
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
import type { TelegramUser, TelegramWebApp } from '@/types/telegram';

/* ============================================================================
 * TYPES — REAL backend kontraktlariga mos
 * ========================================================================== */

type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
type TabId = 'parent' | 'teacher' | 'student';
type Tone = 'green' | 'red' | 'orange' | 'blue' | 'purple' | 'slate';

interface ChildPermissions {
  grades?: boolean;
  payments?: boolean;
  attendance?: boolean;
}

interface ParentChild {
  studentId: string;
  name: string;
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
 * ICONS (silliq yumaloq zarbalar, SF Symbols nisbatlari)
 * ========================================================================== */

const ICON_STROKE = 1.85;

const I: Record<string, string[]> = {
  checkCircle: ['M22 11.08V12a10 10 0 1 1-5.93-9.14', 'M22 4 12 14.01l-3-3'],
  xCircle: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M15 9l-6 6', 'M9 9l6 6'],
  clock: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 6v6l4 2'],
  alertCircle: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 8v4', 'M12 16h.01'],
  calendar: ['M8 2v4', 'M16 2v4', 'M3 10h18', 'M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z'],
  users: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M22 21v-2a4 4 0 0 0-3-3.9', 'M16 3.1a4 4 0 0 1 0 7.8'],
  wallet: ['M21 12V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4', 'M21 12H17a2 2 0 0 0 0 4h4'],
  shieldCheck: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', 'M9 12l2 2 4-4'],
  graduationCap: ['M22 9 12 4 2 9l10 5z', 'M6 11v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5'],
  sparkles: ['M12 3.5 13.9 9.1 19.5 11 13.9 12.9 12 18.5 10.1 12.9 4.5 11 10.1 9.1z', 'M18.5 3.5v3', 'M20 5h-3', 'M5.5 18v2.5', 'M6.75 19.25h-2.5'],
  heart: ['M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z'],
  messageSquare: ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'],
  bookOpen: ['M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z', 'M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z'],
  chevronRight: ['M9 6l6 6-6 6'],
  star: ['M12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26z'],
  sun: ['M12 1v2', 'M12 21v2', 'M4.22 4.22l1.42 1.42', 'M18.36 18.36l1.42 1.42', 'M1 12h2', 'M21 12h2', 'M4.22 19.78l1.42-1.42', 'M18.36 5.64l1.42-1.42', 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z'],
  moon: ['M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z'],
  refresh: ['M23 4v6h-6', 'M1 20v-6h6', 'M3.51 9a9 9 0 0 1 14.85-3.36L23 10', 'M20.49 15a9 9 0 0 1-14.85 3.36L1 14'],
  coins: ['M12 2v20', 'M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6'],
  gift: ['M20 12v10H4V12', 'M2 7h20v5H2z', 'M12 22V7', 'M7.5 7a2.5 2.5 0 0 1 0-5C10 2 12 7 12 7s2-5 4.5-5a2.5 2.5 0 0 1 0 5'],
  award: ['M12 15a7 7 0 1 0 0-14 7 7 0 0 0 0 14z', 'M8.21 13.89 7 23l5-3 5 3-1.21-9.12'],
  wifiOff: ['M1 1l22 22', 'M16.72 11.06A10.94 10.94 0 0 1 19 12.55', 'M5 12.55a10.94 10.94 0 0 1 5.17-2.39', 'M10.71 5.05A16 16 0 0 1 22.58 9', 'M1.42 9a15.91 15.91 0 0 1 4.7-2.88', 'M8.53 16.11a6 6 0 0 1 6.95 0', 'M12 20h.01'],
  send: ['M22 2 11 13', 'M22 2 15 22 11 13 2 9z'],
};

function Icon({
  paths,
  size = 18,
  className = '',
  strokeWidth = ICON_STROKE,
  ...rest
}: {
  paths: string[];
  size?: number;
  className?: string;
  strokeWidth?: number;
} & SVGProps<SVGSVGElement>) {
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
      className={className}
      aria-hidden
      {...rest}
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

/* ============================================================================
 * TELEGRAM INTEGRATION
 * ========================================================================== */

type HapticStyle = 'light' | 'medium' | 'heavy' | 'success' | 'error';

const TG_SDK_SRC = 'https://telegram.org/js/telegram-web-app.js';
const SUPPORT_TG = 'https://t.me/medu_admin';

function useTelegram() {
  const [tg, setTg] = useState<TelegramWebApp | null>(null);
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [inTelegram, setInTelegram] = useState(false);
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>(() =>
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark',
  );
  const tgRef = useRef<TelegramWebApp | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useLayoutEffect(() => {
    let disposed = false;
    // Mutable holder: the interval id is created in a deferred branch while
    // `teardown` (defined above) must be able to clear it at any time.
    const poll: { id?: number } = {};

    const teardown = () => {
      disposed = true;
      if (poll.id !== undefined) window.clearInterval(poll.id);
      window.clearTimeout(timeout);
      cleanupRef.current?.();
      cleanupRef.current = null;
    };

    const init = (sdk: TelegramWebApp) => {
      if (disposed) return;
      try {
        sdk.ready?.();
        sdk.expand?.();
        sdk.disableVerticalSwipes?.();
      } catch {
        /* ba'zi eski SDK versiyalarida mavjud emas — e'tiborsiz. */
      }
      if (sdk.initDataUnsafe?.user) setUser(sdk.initDataUnsafe.user);
      setInTelegram(Boolean(sdk.initData) || (sdk.platform !== undefined && sdk.platform !== 'unknown'));
      if (sdk.colorScheme) setColorScheme(sdk.colorScheme);
      const onTheme = () => {
        if (sdk.colorScheme) setColorScheme(sdk.colorScheme);
      };
      sdk.onEvent?.('themeChanged', onTheme);
      cleanupRef.current = () => sdk.offEvent?.('themeChanged', onTheme);
      tgRef.current = sdk;
      setTg(sdk);
    };

    const existing = (window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp;
    if (existing) {
      init(existing);
      return teardown;
    }

    // Telegram SDK hech qachon o'zi yuklanmaydi — sahifa qo'shishi shart.
    if (!document.querySelector(`script[src="${TG_SDK_SRC}"]`)) {
      const s = document.createElement('script');
      s.src = TG_SDK_SRC;
      s.async = true;
      document.head.appendChild(s);
    }
    poll.id = window.setInterval(() => {
      const sdk = (window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp;
      if (sdk) {
        teardown();
        init(sdk);
      }
    }, 120);

    // Fallback: SDK topilmasa ham sahifa oddiy brauzerda ishlashda davom etadi.
    const timeout = window.setTimeout(() => teardown(), 2500);

    return teardown;
  }, []);

  const haptic = useCallback((style: HapticStyle) => {
    const hf = tgRef.current?.HapticFeedback;
    if (!hf) return;
    try {
      if (style === 'success' || style === 'error') hf.notificationOccurred(style);
      else hf.impactOccurred(style);
    } catch {
      /* SDK'dagi eski versiyalar ba'zi usullarni qo'llab-quvvatlamaydi. */
    }
  }, []);

  const contactAdmin = useCallback(() => {
    const t = tgRef.current;
    if (t?.openTelegramLink) t.openTelegramLink(SUPPORT_TG);
    else window.open(SUPPORT_TG, '_blank', 'noopener,noreferrer');
  }, []);

  return { tg, user, inTelegram, colorScheme, haptic, contactAdmin };
}

/* ============================================================================
 * FORMATLASH YORDAMCHILARI
 * ========================================================================== */

const DAY_NAMES = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function todayDayOfWeek(): string {
  return DAY_NAMES[new Date().getDay()];
}

function sameDayStr(iso?: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  return !Number.isNaN(d.getTime()) && d.toDateString() === new Date().toDateString();
}

function itemsOf<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  const items = (data as { items?: unknown } | null)?.items;
  return Array.isArray(items) ? (items as T[]) : [];
}

function normalizeChildren(data: unknown): ParentChild[] {
  if (Array.isArray(data)) return data as ParentChild[];
  const nested = (data as { children?: unknown } | null)?.children;
  return Array.isArray(nested) ? (nested as ParentChild[]) : [];
}

function formatUZS(amount: number): string {
  return `${new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 0 }).format(amount)} so'm`;
}

function formatNum(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatDateShort(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short' });
}

function formatDue(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const time = d.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === today.toDateString()) return `Bugun, ${time}`;
  if (d.toDateString() === tomorrow.toDateString()) return `Ertaga, ${time}`;
  return `${d.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short' })}, ${time}`;
}

function formatRelative(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const mins = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (mins < 1) return 'hozirgina';
  if (mins < 60) return `${mins} daq. oldin`;
  const hours = Math.floor(mins / 60);
  if (hours < 24 && d.toDateString() === new Date().toDateString()) return `${hours} soat oldin`;
  return formatDateShort(iso);
}

function getTimeGreeting(): { greeting: string; icon: string[] } {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return { greeting: 'Xayrli tong', icon: I.sun };
  if (hour >= 11 && hour < 18) return { greeting: 'Xayrli kun', icon: I.sun };
  return { greeting: 'Xayrli oqshom', icon: I.moon };
}

function getInitials(name?: string | null): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? '';
  const b = parts[1]?.[0] ?? parts[0]?.[1] ?? '';
  return (a + b).toUpperCase() || 'M';
}

const RELATION_LABELS: Record<string, string> = {
  FATHER: 'Ota',
  MOTHER: 'Ona',
  GUARDIAN: 'Vasiy',
  GRANDMOTHER: 'Buvi',
  GRANDFATHER: 'Buva',
};

const INVOICE_STATUS: Record<string, { label: string; tone: Tone }> = {
  ISSUED: { label: 'Chiqarilgan', tone: 'blue' },
  PARTIALLY_PAID: { label: 'Qisman toʻlangan', tone: 'orange' },
  PAID: { label: 'Toʻlangan', tone: 'green' },
  OVERDUE: { label: 'Muddati oʻtgan', tone: 'red' },
  REFUNDED: { label: 'Qaytarilgan', tone: 'slate' },
};

const ASSIGNMENT_LABELS: Record<string, string> = {
  DRAFT: 'Chizma',
  PUBLISHED: 'Ochiq',
  CLOSED: 'Yopilgan',
  ARCHIVED: 'Arxiv',
};

const XP_TYPE_LABELS: Record<string, string> = {
  ATTENDANCE_ON_TIME: 'Davomat uchun',
  HOMEWORK_ON_TIME_GOOD_GRADE: 'Vazifa yaxshi bahosi',
  EXAM_HIGH_SCORE: 'Imtihonda yuqori natija',
};

const STATUS_META: Record<AttendanceStatus, { label: string; tone: Tone; color: string; icon: string[] }> = {
  PRESENT: { label: 'Keldi', tone: 'green', color: '#34C759', icon: I.checkCircle },
  ABSENT: { label: 'Kelmadi', tone: 'red', color: '#FF3B30', icon: I.xCircle },
  LATE: { label: 'Kechikdi', tone: 'orange', color: '#FF9500', icon: I.clock },
  EXCUSED: { label: 'Sababli', tone: 'blue', color: '#0A84FF', icon: I.shieldCheck },
};

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Bosh administrator',
  PLATFORM_OWNER: 'Platforma egasi',
  ORG_ADMIN: 'Markaz admini',
  MANAGER: 'Menejer',
  TEACHER: 'O‘qituvchi',
  ASSISTANT: 'Yordamchi',
  PARENT: 'Ota-ona',
  STUDENT: 'O‘quvchi',
};

/* ============================================================================
 * TEMA — Telegram parametrlarini dizayn-tokenlarga ko'prik qilish
 * ========================================================================== */

function tgThemeStyle(scheme: 'light' | 'dark'): CSSProperties {
  const light = scheme === 'light';
  return {
    colorScheme: scheme,
    background: 'var(--tg-theme-bg-color, #0E141E)',
    color: 'var(--tg-theme-text-color, #F1F4F9)',
    ['--bg-page' as string]: 'var(--tg-theme-bg-color, #0E141E)',
    ['--bg-surface' as string]: 'var(--tg-theme-secondary-bg-color, #151C2A)',
    ['--bg-elevated' as string]: 'var(--tg-theme-secondary-bg-color, #1A2332)',
    ['--bg-card' as string]: light
      ? 'color-mix(in srgb, var(--tg-theme-secondary-bg-color, #FFFFFF) 76%, transparent)'
      : 'color-mix(in srgb, var(--tg-theme-secondary-bg-color, #151C2A) 62%, transparent)',
    ['--text-primary' as string]: 'var(--tg-theme-text-color, #F1F4F9)',
    ['--text-secondary' as string]: 'var(--tg-theme-hint-color, #9AA4B8)',
    ['--text-tertiary' as string]: 'var(--tg-theme-hint-color, #9AA4B8)',
    ['--text-muted' as string]: 'var(--tg-theme-hint-color, #9AA4B8)',
    ['--border' as string]: light
      ? 'color-mix(in srgb, var(--tg-theme-hint-color, #64748B) 22%, transparent)'
      : 'color-mix(in srgb, var(--tg-theme-hint-color, #8E8E93) 16%, transparent)',
    ['--border-subtle' as string]: light
      ? 'color-mix(in srgb, var(--tg-theme-hint-color, #64748B) 12%, transparent)'
      : 'color-mix(in srgb, var(--tg-theme-hint-color, #8E8E93) 9%, transparent)',
    ['--border-medium' as string]: 'color-mix(in srgb, var(--tg-theme-hint-color, #8E8E93) 26%, transparent)',
    ['--primary' as string]: 'var(--tg-theme-button-color, #2B6BFF)',
    ['--primary-hover' as string]: 'var(--tg-theme-button-color, #2B6BFF)',
  } as CSSProperties;
}

const PRESET_CSS = `
  .glass-card.tg-card { border-radius: 28px; }
  .glass-card.tg-hero-green { background-image: radial-gradient(130% 100% at 12% -10%, rgba(52,199,89,.16), transparent 55%); }
  .glass-card.tg-hero-red { background-image: radial-gradient(130% 100% at 12% -10%, rgba(255,59,48,.14), transparent 55%); }
  .glass-card.tg-hero-orange { background-image: radial-gradient(130% 100% at 12% -10%, rgba(255,149,0,.15), transparent 55%); }
  .glass-card.tg-hero-blue { background-image: radial-gradient(130% 100% at 12% -10%, rgba(0,122,255,.15), transparent 55%); }
  .glass-card.tg-hero-purple { background-image: radial-gradient(130% 100% at 12% -10%, rgba(175,82,222,.15), transparent 55%); }
  .glass-card.tg-hero-slate { background-image: radial-gradient(130% 100% at 12% -10%, rgba(142,142,147,.14), transparent 55%); }
  .tg-dock { background: color-mix(in srgb, var(--tg-theme-bg-color, #0E141E) 86%, transparent); backdrop-filter: blur(22px) saturate(1.5); -webkit-backdrop-filter: blur(22px) saturate(1.5); border: 1px solid var(--border, rgba(142,142,147,.16)); box-shadow: 0 18px 50px -18px rgba(0,0,0,.45), inset 0 1px 0 color-mix(in srgb, #fff 9%, transparent); }
  .tg-note { background: color-mix(in srgb, var(--tg-theme-hint-color, #8E8E93) 8%, transparent); border: 1px solid var(--border-subtle, rgba(142,142,147,.1)); border-radius: 20px; }
  .tg-btn-primary { background: linear-gradient(135deg, #2B6BFF 0%, #6A4DFF 100%); box-shadow: 0 10px 24px -10px rgba(43,107,255,.55), inset 0 1px 0 color-mix(in srgb, #fff 25%, transparent); }
  .tg-btn-ghost { background: color-mix(in srgb, var(--text-primary, #F1F4F9) 6%, transparent); border: 1px solid var(--border-medium, rgba(142,142,147,.26)); }
`;

/* ============================================================================
 * PRIMITIVLAR
 * ========================================================================== */

const TONE_COLORS: Record<Tone, { bg: string; fg: string; border: string; light: string; dark: string }> = {
  green: { bg: 'rgba(52,199,89,.13)', fg: '#34C759', border: 'rgba(52,199,89,.30)', light: 'rgba(52,199,89,.30)', dark: 'rgba(52,199,89,.55)' },
  red: { bg: 'rgba(255,59,48,.12)', fg: '#FF3B30', border: 'rgba(255,59,48,.30)', light: 'rgba(255,59,48,.30)', dark: 'rgba(255,59,48,.55)' },
  orange: { bg: 'rgba(255,149,0,.13)', fg: '#E08A00', border: 'rgba(255,149,0,.30)', light: 'rgba(255,149,0,.30)', dark: 'rgba(255,149,0,.55)' },
  blue: { bg: 'rgba(0,122,255,.12)', fg: '#0A84FF', border: 'rgba(0,122,255,.30)', light: 'rgba(0,122,255,.30)', dark: 'rgba(0,122,255,.55)' },
  purple: { bg: 'rgba(175,82,222,.13)', fg: '#AF52DE', border: 'rgba(175,82,222,.30)', light: 'rgba(175,82,222,.30)', dark: 'rgba(175,82,222,.55)' },
  slate: { bg: 'rgba(142,142,147,.13)', fg: '#8E8E93', border: 'rgba(142,142,147,.30)', light: 'rgba(142,142,147,.30)', dark: 'rgba(142,142,147,.55)' },
};

const RING_GRADIENTS: Record<Tone, [string, string]> = {
  green: ['#34C759', '#5BE08F'],
  red: ['#FF3B30', '#FF8A70'],
  orange: ['#FF9500', '#FFC24B'],
  blue: ['#0A84FF', '#6CC3FF'],
  purple: ['#AF52DE', '#D08BFF'],
  slate: ['#8E8E93', '#B9B9BE'],
};

function Surface({
  children,
  className = '',
  tone,
  interactive = false,
  style,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  tone?: Tone;
  interactive?: boolean;
  style?: CSSProperties;
} & Omit<HTMLAttributes<HTMLDivElement>, 'style'>) {
  return (
    <div
      className={`glass-card glass-card--${interactive ? 'interactive' : ''} tg-card ${
        tone ? `tg-hero-${tone}` : ''
      } ${className}`}
      style={style}
      {...rest}
    >
      {children}
    </div>
  );
}

function Pill({
  tone = 'slate',
  icon,
  children,
  className = '',
}: {
  tone?: Tone;
  icon?: string[];
  children: ReactNode;
  className?: string;
}) {
  const c = TONE_COLORS[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-wide ${className}`}
      style={{ background: c.bg, color: c.fg, borderColor: c.border }}
    >
      {icon && <Icon paths={icon} size={11} strokeWidth={2.4} />}
      <span>{children}</span>
    </span>
  );
}

function Btn({
  children,
  tone = 'primary',
  className = '',
  ...rest
}: {
  children: ReactNode;
  tone?: 'primary' | 'ghost' | 'danger';
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const base = 'tap-target inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-[13px] font-bold transition-all duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40';
  const cls = tone === 'primary' ? 'tg-btn-primary text-white' : tone === 'danger' ? 'tg-btn-ghost text-red-500' : 'tg-btn-ghost';
  return (
    <button className={`${base} ${cls} ${className}`} {...rest}>
      {children}
    </button>
  );
}

function Skeleton({ className = '', height = 80 }: { className?: string; height?: number }) {
  return <div className={`skeleton-shimmer rounded-2xl ${className}`} style={{ height }} />;
}

function EmptyState({
  icon = I.calendar,
  tone = 'blue',
  title,
  message,
  children,
}: {
  icon?: string[];
  tone?: Tone;
  title: string;
  message?: string;
  children?: ReactNode;
}) {
  const c = TONE_COLORS[tone];
  return (
    <div className="flex flex-col items-center px-4 py-10 text-center">
      <div
        className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl"
        style={{ background: c.bg, color: c.fg, border: `1px solid ${c.border}` }}
      >
        <Icon paths={icon} size={28} strokeWidth={2} />
      </div>
      <h3 className="text-[16px] font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
        {title}
      </h3>
      {message && (
        <p className="mx-auto mt-1.5 max-w-xs text-[12.5px] leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
          {message}
        </p>
      )}
      {children && <div className="mt-5 flex flex-col items-center gap-2.5">{children}</div>}
    </div>
  );
}

function ErrorState({
  message = 'Maʼlumot yuklanmadi. Internet aloqasi yoki server holatini tekshiring.',
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <EmptyState icon={I.alertCircle} tone="red" title="Maʼlumot yuklanmadi" message={message}>
      {onRetry && (
        <Btn onClick={onRetry}>
          <Icon paths={I.refresh} size={14} strokeWidth={2.2} />
          Qayta urinish
        </Btn>
      )}
    </EmptyState>
  );
}

function ProgressRing({
  value,
  size = 66,
  stroke = 6.5,
  tone = 'green',
  center,
  sub,
}: {
  value: number;
  size?: number;
  stroke?: number;
  tone?: Tone;
  center?: ReactNode;
  sub?: string;
}) {
  const gid = `ring-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const [from, to] = RING_GRADIENTS[tone];
  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${Math.round(pct)} foiz`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="color-mix(in srgb, var(--text-tertiary, #9AA4B8) 22%, transparent)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gid})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={false}
          animate={{ strokeDashoffset: c * (1 - pct / 100) }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[15px] font-black leading-none tabular-nums" style={{ color: 'var(--text-primary)' }}>
          {center}
        </span>
        {sub && (
          <span className="mt-0.5 text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
            {sub}
          </span>
        )}
      </div>
    </div>
  );
}

function Avatar({
  name,
  photo,
  size = 42,
  active = false,
}: {
  name?: string | null;
  photo?: string | null;
  size?: number;
  active?: boolean;
}) {
  const radius = size * 0.32;
  return (
    <div
      className="relative shrink-0 overflow-hidden"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: active
          ? 'linear-gradient(135deg, #34C759 0%, #2B6BFF 100%)'
          : 'linear-gradient(135deg, #8E8E93 0%, #636366 100%)',
        boxShadow: active ? '0 0 0 2.5px rgba(52,199,89,.35)' : 'none',
      }}
    >
      {photo ? (
        <img src={photo} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-[13px] font-bold text-white">
          {getInitials(name)}
        </span>
      )}
    </div>
  );
}

function CardHead({
  icon,
  tone = 'blue',
  title,
  meta,
}: {
  icon: string[];
  tone?: Tone;
  title: string;
  meta?: ReactNode;
}) {
  return (
    <div className="mb-3.5 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2.5">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{ background: TONE_COLORS[tone].bg, color: TONE_COLORS[tone].fg }}
        >
          <Icon paths={icon} size={17} strokeWidth={2.1} />
        </div>
        <h4 className="text-[14.5px] font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          {title}
        </h4>
      </div>
      {meta}
    </div>
  );
}

/* ============================================================================
 * OTA-ONA: FARZAND STATUS KARTASI
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
          message="Davomat maʼlumotlarini yuklab boʻlmadi."
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
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
            style={{
              background: TONE_COLORS[tone].bg,
              color: TONE_COLORS[tone].fg,
              border: `1px solid ${TONE_COLORS[tone].border}`,
            }}
          >
            <Icon paths={meta?.icon ?? I.calendar} size={25} strokeWidth={2.1} />
          </div>
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
            <h3 className="mt-1.5 text-[16px] font-bold leading-tight tracking-tight" style={{ color: 'var(--text-primary)' }}>
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
            background: 'color-mix(in srgb, #2B6BFF 10%, transparent)',
            border: '1px solid color-mix(in srgb, #2B6BFF 24%, transparent)',
          }}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: 'linear-gradient(135deg, #2B6BFF, #6A4DFF)' }}>
            <Icon paths={I.bookOpen} size={17} strokeWidth={2.1} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10.5px] font-bold uppercase tracking-wider" style={{ color: '#0A84FF' }}>
              {lesson.startTime && `${lesson.startTime}  •  `}Joriy mashgʻulot
            </p>
            <p className="truncate text-[13.5px] font-bold" style={{ color: 'var(--text-primary)' }}>
              {lesson.topic || groupName}
            </p>
          </div>
          <span className="shrink-0 rounded-full px-2 py-1 text-[11px] font-bold" style={{ background: 'color-mix(in srgb, #0A84FF 14%, transparent)', color: '#0A84FF' }}>
            Darsda
          </span>
        </div>
      ) : (
        <div
          className="mt-4 flex items-center gap-3 rounded-2xl p-3 tg-note"
        >
          <Icon paths={I.calendar} size={18} strokeWidth={2.1} style={{ color: TONE_COLORS[tone].fg }} />
          <p className="text-[12.5px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
            Bugungi dars jadvali hali qayd etilmagan.
          </p>
        </div>
      )}

      {today?.note && (
        <div className="mt-3 tg-note px-3.5 py-3">
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
          <Skeleton height={66} className="rounded-full" />
        ) : (
          <ProgressRing value={rate ?? 0} center={rate != null ? `${rate}%` : '—'} sub="Davomat" tone="green" />
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
                Hozircha davomat statistikasi yoʻq.
              </span>
            )}
          </div>
          {total > 0 && (
            <p className="mt-1.5 text-[11.5px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
              Jami {total} kunda qayd etilgan.
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
        <Skeleton height={20} />
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
        <ErrorState message="Baholar yuklab boʻlmadi." onRetry={() => gradesQ.refetch()} />
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
          <span className="text-[11px] font-bold" style={{ color: '#E08A00' }}>
            {child.name.split(' ')[0]} uchun
          </span>
        }
      />
      {grades.length === 0 && exams.length === 0 ? (
        <EmptyState icon={I.star} tone="orange" title="Hozircha baholar yoʻq" message="Ustoz baho qoʻyganida shu yerda koʻrinadi." />
      ) : (
        <div className="space-y-2.5">
          {grades.map((g) => (
            <div
              key={g.id}
              className="flex items-center justify-between gap-3 rounded-2xl p-3"
              style={{ background: 'color-mix(in srgb, var(--text-primary) 4%, transparent)', border: '1px solid var(--border-subtle)' }}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-bold" style={{ color: 'var(--text-primary)' }}>
                  {g.label || g.group?.name || 'Dars'}
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
                className="shrink-0 rounded-xl px-2.5 py-1 text-[12.5px] font-bold tabular-nums"
                style={{ background: TONE_COLORS.orange.bg, color: TONE_COLORS.orange.fg }}
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
                  <div
                    key={ex.id}
                    className="flex items-center justify-between gap-3 rounded-2xl p-3"
                    style={{ background: 'color-mix(in srgb, var(--text-primary) 4%, transparent)', border: '1px solid var(--border-subtle)' }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>
                        {ex.exam.title || ex.exam.subject}
                      </p>
                      <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                        {formatDateShort(ex.exam.examDate)}
                      </p>
                    </div>
                    <Pill tone={ex.isPassed ? 'green' : 'red'} icon={ex.isPassed ? I.checkCircle : I.xCircle}>
                      {ex.isPassed ? 'Topshirildi' : 'Oʻtmagani'} • {formatNum(ex.marksObtained)}
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
      <CardHead icon={I.bookOpen} tone="blue" title="Uyga vazifalar" meta={<span className="text-[11px] font-bold" style={{ color: '#0A84FF' }}>{child.name.split(' ')[0]} uchun</span>} />
      {!groupId ? (
        <EmptyState
          icon={I.bookOpen}
          tone="blue"
          title="Vazifalar topilmadi"
          message="Farzandingiz hali guruh yoki davomat maʼlumotiga ega emas. Vazifalar koʻrsatilganda shu yerda chiqadi."
        />
      ) : assignQ.isLoading ? (
        <div className="space-y-2">
          <Skeleton height={58} />
          <Skeleton height={58} />
        </div>
      ) : assignQ.isError ? (
        <ErrorState message="Vazifalar yuklab boʻlmadi." onRetry={() => assignQ.refetch()} />
      ) : (assignQ.data ?? []).length === 0 ? (
        <EmptyState icon={I.bookOpen} tone="blue" title="Yangi vazifalar yoʻq" message="Ustoz vazifa biriktirganda shu yerda koʻrinadi." />
      ) : (
        <div className="space-y-2">
          {(assignQ.data ?? []).map((a) => {
            const overdue = new Date(a.dueDate).getTime() < Date.now();
            return (
              <div
                key={a.id}
                className="rounded-2xl p-3"
                style={{ background: 'color-mix(in srgb, var(--text-primary) 4%, transparent)', border: '1px solid var(--border-subtle)' }}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 flex-1 truncate text-[13.5px] font-bold" style={{ color: 'var(--text-primary)' }}>
                    {a.title}
                  </p>
                  <Pill tone={overdue ? 'red' : 'green'} icon={overdue ? I.alertCircle : I.clock}>
                    {overdue ? 'Muddati oʻtgan' : ASSIGNMENT_LABELS[a.status] ?? a.status}
                  </Pill>
                </div>
                {a.description && (
                  <p className="mt-1 line-clamp-2 text-[11.5px] leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
                    {a.description}
                  </p>
                )}
                <div className="mt-2 flex items-center justify-between">
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
 * OTA-ONA: TOʻLOV KARTASI VA SHEET
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
        <ErrorState message="Toʻlov holati yuklab boʻlmadi." onRetry={() => invoicesQ.refetch()} />
      </Surface>
    );
  }

  const data = invoicesQ.data;
  const outstanding = data?.outstanding ?? 0;
  const overdue = data?.overdue ?? 0;
  const isClear = outstanding <= 0;

  return (
    <Surface tone={isClear ? 'green' : 'red'} className="p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
            style={{ background: TONE_COLORS[isClear ? 'green' : 'red'].bg, color: TONE_COLORS[isClear ? 'green' : 'red'].fg }}
          >
            <Icon paths={isClear ? I.checkCircle : I.wallet} size={22} strokeWidth={2.1} />
          </div>
          <div>
            <p className="text-[10.5px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
              Oylik toʻlov holati
            </p>
            <h4 className="mt-0.5 text-[15.5px] font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              {isClear ? 'Qarzdorlik yoʻq' : 'Toʻlov kutilmoqda'}
            </h4>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span className="text-[15px] font-black tabular-nums" style={{ color: isClear ? '#34C759' : TONE_COLORS.red.fg }}>
                {isClear ? '0 soʻm' : formatUZS(outstanding)}
              </span>
              {overdue > 0 && (
                <Pill tone="red">{formatUZS(overdue)} muddati oʻtgan</Pill>
              )}
            </div>
          </div>
        </div>
        <Btn tone={isClear ? 'ghost' : 'primary'} onClick={onOpen} className="shrink-0">
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
}: {
  open: boolean;
  onClose: () => void;
  childName: string;
  data?: InvoicesResponse;
  contactAdmin: () => void;
}) {
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const t = window.setTimeout(() => closeBtnRef.current?.focus(), 120);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(t);
    };
  }, [open, onClose]);

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
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md rounded-t-[30px] border-t border-white/10"
            style={{
              background: 'var(--tg-theme-bg-color, #121826)',
              paddingBottom: 'max(env(safe-area-inset-bottom), 20px)',
            }}
          >
            <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-slate-500/30" />
            <div className="flex items-start justify-between px-6 pt-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                  Oylik toʻlovlar
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
                className="tap-target flex h-10 w-10 items-center justify-center rounded-full"
                style={{ background: 'color-mix(in srgb, var(--text-primary) 7%, transparent)', color: 'var(--text-tertiary)' }}
              >
                <Icon paths={[I.xCircle[1]]} size={18} strokeWidth={2.2} />
              </button>
            </div>

            <div className="max-h-[58vh] overflow-y-auto px-6 pt-4">
              <div className="glass-card tg-card flex items-center justify-between p-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                    Qoldiq summa
                  </p>
                  <p className="mt-0.5 text-[20px] font-black tabular-nums" style={{ color: outstanding > 0 ? '#FF3B30' : '#34C759' }}>
                    {outstanding > 0 ? formatUZS(outstanding) : `0 soʻm`}
                  </p>
                </div>
                <Pill tone={outstanding > 0 ? 'red' : 'green'} icon={outstanding > 0 ? I.alertCircle : I.checkCircle}>
                  {outstanding > 0 ? 'Kutilmoqda' : 'Toza'}
                </Pill>
              </div>

              {payments.length > 0 && (
                <p className="mb-1.5 mt-4 text-[10.5px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                  Soʻnggi toʻlovlar
                </p>
              )}
              <div className="space-y-2">
                {payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 rounded-2xl p-3" style={{ background: 'color-mix(in srgb, var(--text-primary) 4%, transparent)', border: '1px solid var(--border-subtle)' }}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-bold" style={{ color: 'var(--text-primary)' }}>
                        {p.receiptNumber || p.method || 'Toʻlov'}
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
                  <div
                    className="flex items-center gap-2.5 rounded-2xl p-3.5 tg-note"
                  >
                    <Icon paths={I.wallet} size={18} strokeWidth={2.1} style={{ color: 'var(--text-tertiary)' }} />
                    <p className="text-[12px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                      Hozircha toʻlovlar qayd etilmagan.
                    </p>
                  </div>
                )}
              </div>

              {invoices.length > 0 && (
                <p className="mb-1.5 mt-4 text-[10.5px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                  Hisob-fakturalar
                </p>
              )}
              <div className="space-y-2">
                {invoices.map((inv) => {
                  const st = INVOICE_STATUS[inv.status] ?? { label: inv.status, tone: 'slate' as Tone };
                  return (
                    <div key={inv.id} className="flex items-center justify-between gap-3 rounded-2xl p-3" style={{ background: 'color-mix(in srgb, var(--text-primary) 4%, transparent)', border: '1px solid var(--border-subtle)' }}>
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

              <div className="mt-4 rounded-2xl p-3.5 tg-note">
                <p className="text-[11.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  Onlayn toʻlov shlyuzi (Payme / Click) hozircha ulanmagan. Toʻlovni markaz kassasi orqali amalga oshirasiz, tafsilot uchun adminstratsiyaga yozing.
                </p>
              </div>

              <div className="mt-3 flex flex-col gap-2.5 pb-2">
                <Btn onClick={contactAdmin}>
                  <Icon paths={I.send} size={14} strokeWidth={2.2} />
                  Markazga yozish
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
 * OTA-ONA: SEKSIYA (bitta farzand ma'lumotlari)
 * ========================================================================== */

function ChildSection({
  child,
  contactAdmin,
  haptic,
}: {
  child: ParentChild;
  contactAdmin: () => void;
  haptic: (s: HapticStyle) => void;
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
    const attRow = (attendanceQ.data ?? []).find((r) => r.group?.id);
    if (attRow?.group?.id) return attRow.group.id;
    return gradesQ.data?.grades.find((g) => g.group?.id)?.group?.id ?? null;
  }, [attendanceQ.data, gradesQ.data]);

  const [payOpen, setPayOpen] = useState(false);

  if (!canAttendance && !canGrades && !canPayments) {
    return (
      <EmptyState
        icon={I.shieldCheck}
        tone="slate"
        title="Koʻrish huquqi yoʻq"
        message="Bu farzand uchun maʼlumotlar markaz tomonidan bloklangan. Ruxsat olish uchun adminstratsiyaga murojaat qiling."
      >
        <Btn onClick={contactAdmin}>
          <Icon paths={I.send} size={14} strokeWidth={2.2} />
          Markazga yozish
        </Btn>
      </EmptyState>
    );
  }

  return (
    <div className="space-y-4">
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
      />
    </div>
  );
}

/* ============================================================================
 * OTA-ONA VIEW
 * ========================================================================== */

function ParentView({ contactAdmin, haptic }: { contactAdmin: () => void; haptic: (s: HapticStyle) => void }) {
  const [idx, setIdx] = useState(0);
  const childrenQ = useQuery<ParentChild[]>({
    queryKey: ['tg-parent-children'],
    queryFn: () => parentPortalApi.children().then(normalizeChildren),
    staleTime: 60_000,
  });

  if (childrenQ.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="rounded-[28px]" height={180} />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="rounded-[24px]" height={96} />
          <Skeleton className="rounded-[24px]" height={96} />
        </div>
        <Skeleton className="rounded-[28px]" height={140} />
      </div>
    );
  }
  if (childrenQ.isError) {
    return (
      <div className="pt-6">
        <ErrorState
          message="Farzandlar roʻyxatini yuklab boʻlmadi."
          onRetry={() => childrenQ.refetch()}
        />
      </div>
    );
  }

  const children = childrenQ.data ?? [];
  if (children.length === 0) {
    return (
      <div className="pt-6">
        <EmptyState
          icon={I.graduationCap}
          tone="blue"
          title="Farzand biriktirilmagan"
          message="Sizning hisobingizga hali oʻquvchi biriktirilmagan. Farzandingizni ulash uchun markaz maʼmuriyatiga murojaat qiling."
        >
          <Btn onClick={contactAdmin}>
            <Icon paths={I.send} size={14} strokeWidth={2.2} />
            Maʼmuriyat bilan bogʻlanish
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
        <div className="medu-scroll-x flex gap-2.5 pb-1">
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
                whileTap={{ scale: 0.97 }}
                aria-pressed={isActive}
                className="relative flex shrink-0 items-center gap-2.5 rounded-2xl border px-3 py-2 text-left transition-all"
                style={{
                  borderColor: isActive ? 'rgba(52,199,89,.40)' : 'var(--border-subtle)',
                  background: isActive ? 'rgba(52,199,89,.08)' : 'color-mix(in srgb, var(--text-primary) 4%, transparent)',
                }}
              >
                <Avatar name={c.name} active={isActive} size={38} />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>
                    {c.name}
                  </span>
                  <span className="block truncate text-[10.5px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
                    {RELATION_LABELS[c.relationship ?? ''] ?? 'Oʻquvchi'}
                  </span>
                </span>
              </motion.button>
            );
          })}
        </div>
      )}
      <ChildSection key={active.studentId} child={active} contactAdmin={contactAdmin} haptic={haptic} />
    </div>
  );
}

/* ============================================================================
 * O‘QITUVCHI VIEW — bugungi jadval + davomat belgilash (REAL)
 * ========================================================================== */

const ATT_CYCLE: (AttendanceStatus | null)[] = [null, 'PRESENT', 'LATE', 'ABSENT', 'EXCUSED'];

function TeacherView({ haptic }: { haptic: (s: HapticStyle) => void }) {
  const { success, error } = useToast();
  const { user } = useAuth();
  const myUserId = user?.id;
  const today = todayKey();
  const [overrides, setOverrides] = useState<Record<string, Record<string, AttendanceStatus>>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const groupsQ = useQuery<GroupSummary[]>({
    queryKey: ['tg-teacher-my-groups', myUserId],
    queryFn: async () => {
      const res = (await groupsApi.list({ limit: 100 })) as { items?: GroupSummary[] };
      return itemsOf<GroupSummary>(res).filter((g) => g.teacher?.userId === myUserId);
    },
    enabled: Boolean(myUserId),
    staleTime: 120_000,
  });

  const teacherId = groupsQ.data?.[0]?.teacherId ?? null;
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

  const statusOf = (lessonId: string, studentId: string, serverStatus: AttendanceStatus | null): AttendanceStatus | null =>
    overrides[lessonId]?.[studentId] ?? serverStatus;

  const toggle = (lessonId: string, studentId: string, current: AttendanceStatus | null) => {
    const cur = overrides[lessonId]?.[studentId] ?? current;
    const next = ATT_CYCLE[(ATT_CYCLE.indexOf(cur) + 1) % ATT_CYCLE.length];
    haptic(next ? 'medium' : 'light');
    setOverrides((prev) => {
      const lessonOv: Record<string, AttendanceStatus> = { ...prev[lessonId] };
      if (next === null) delete lessonOv[studentId];
      else lessonOv[studentId] = next;
      return { ...prev, [lessonId]: lessonOv };
    });
  };

  const markAllPresent = (lessonId: string, students: GroupEnrollment[]) => {
    haptic('light');
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
      success('Davomat saqlandi', `${group.name} — ${records.length} oʻquvchi belgilandi`);
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

  if (groupsQ.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="rounded-[28px]" height={200} />
        <Skeleton className="rounded-[28px]" height={200} />
      </div>
    );
  }
  if (groupsQ.isError) {
    return <ErrorState message="Guruhlar roʻyxatini yuklab boʻlmadi." onRetry={() => groupsQ.refetch()} />;
  }
  if ((groupsQ.data ?? []).length === 0) {
    return (
      <EmptyState
        icon={I.users}
        tone="blue"
        title="Guruhlar topilmadi"
        message="Hisobingizga biriktirilgan guruhlar aniqlanmadi. Agar bu xato boʻlsa, markaz adminiga murojaat qiling."
      />
    );
  }
  if (schedQ.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="rounded-[28px]" height={180} />
        <Skeleton className="rounded-[28px]" height={180} />
      </div>
    );
  }
  if (schedQ.isError) {
    return <ErrorState message="Bugungi darslar yuklab boʻlmadi." onRetry={() => schedQ.refetch()} />;
  }
  if (lessons.length === 0) {
    return (
      <EmptyState
        icon={I.calendar}
        tone="blue"
        title="Bugun darslar yoʻq"
        message={new Date().toLocaleDateString('uz-UZ', { weekday: 'long', day: 'numeric', month: 'long' })}
      />
    );
  }

  const groupLoading = detailsQ.isLoading || attTodayQ.isLoading;

  return (
    <div className="space-y-4">
      {lessons.map((lesson, li) => {
        const group = groupMap.get(lesson.groupId);
        const students = group?.enrollments ?? [];
        const serverRows = attMap.get(lesson.groupId) ?? [];
        const serverByStudent = new Map(serverRows.map((r) => [r.studentId ?? '', r]));
        const markedCount = students.filter((s) => statusOf(lesson.id, s.student.id, serverByStudent.get(s.student.id)?.status ?? null) != null).length;
        const isSaving = savingId === lesson.id;

        return (
          <Surface key={lesson.id} className={`p-5 slide-up stagger-${(li % 4) + 1}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: TONE_COLORS.blue.bg, color: TONE_COLORS.blue.fg }}>
                  <Icon paths={I.calendar} size={18} strokeWidth={2.1} />
                </div>
                <div>
                  <span className="text-[10.5px] font-bold uppercase tracking-wider" style={{ color: '#0A84FF' }}>
                    {lesson.startTime}{lesson.endTime ? ` – ${lesson.endTime}` : ''}
                  </span>
                  <h3 className="text-[15px] font-bold leading-tight tracking-tight" style={{ color: 'var(--text-primary)' }}>
                    {lesson.group.name}
                  </h3>
                  {lesson.room && (
                    <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                      {lesson.room}
                    </p>
                  )}
                </div>
              </div>
              <Pill tone="blue">
                {groupLoading ? '…' : `${students.length} oʻquvchi`}
              </Pill>
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
                    const current = statusOf(lesson.id, st.student.id, serverByStudent.get(st.student.id)?.status ?? null);
                    const row = serverByStudent.get(st.student.id);
                    const isBiometric = Boolean(row?.source && row.source !== 'MANUAL' && row.source !== 'EXCUSED');
                    const name = `${st.student.user?.firstName ?? ''} ${st.student.user?.lastName ?? ''}`.trim() || 'Oʻquvchi';
                    return (
                      <button
                        key={st.student.id}
                        type="button"
                        onClick={() => toggle(lesson.id, st.student.id, serverByStudent.get(st.student.id)?.status ?? null)}
                        className="flex w-full items-center justify-between gap-3 py-2.5 text-left transition-all active:scale-[0.99]"
                      >
                        <span className="flex min-w-0 items-center gap-2.5">
                          <Avatar name={name} size={32} />
                          <span className="min-w-0">
                            <span className="block truncate text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                              {name}
                            </span>
                            {isBiometric && (
                              <span className="mt-0.5 flex items-center gap-1 text-[10px] font-bold" style={{ color: '#34C759' }}>
                                <Icon paths={I.shieldCheck} size={10} strokeWidth={2.6} />
                                {row?.source === 'FACE' ? 'Face ID' : 'Biometrik'}
                              </span>
                            )}
                          </span>
                        </span>
                        {current ? (
                          <span
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11.5px] font-bold transition-all"
                            style={{ background: TONE_COLORS[STATUS_META[current].tone].bg, color: TONE_COLORS[STATUS_META[current].tone].fg, border: `1px solid ${TONE_COLORS[STATUS_META[current].tone].border}` }}
                          >
                            <Icon paths={STATUS_META[current].icon} size={12} strokeWidth={2.4} />
                            {STATUS_META[current].label}
                          </span>
                        ) : (
                          <span className="inline-flex shrink-0 items-center rounded-xl px-3 py-1.5 text-[11.5px] font-semibold" style={{ background: 'color-mix(in srgb, var(--text-primary) 6%, transparent)', color: 'var(--text-tertiary)' }}>
                            Belgilash
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 flex items-center justify-between gap-2.5 border-t pt-4" style={{ borderColor: 'var(--border-subtle)' }}>
                  <Btn tone="ghost" onClick={() => markAllPresent(lesson.id, students)} className="px-3.5">
                    Hammasi keldi
                  </Btn>
                  <Btn onClick={() => saveLesson(lesson, group!, students)} disabled={markedCount === 0 || isSaving}>
                    {isSaving ? 'Saqlanmoqda…' : `Saqlash${markedCount ? ` (${markedCount})` : ''}`}
                  </Btn>
                </div>
              </>
            )}
          </Surface>
        );
      })}
    </div>
  );
}

/* ============================================================================
 * O‘QUVCHI VIEW — gamification (REAL)
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
      await meQ.refetch();
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
        <Skeleton className="rounded-[28px]" height={190} />
        <Skeleton className="rounded-[28px]" height={170} />
      </div>
    );
  }
  if (meQ.isError) {
    return (
      <ErrorState
        message="Oʻquvchi statistikasi yuklab boʻlmadi."
        onRetry={() => {
          meQ.refetch();
          eventsQ.refetch();
        }}
      />
    );
  }

  const me = meQ.data ?? { xp: 0, coins: 0, level: 1, xpToNextLevel: 100, rank: null, rankTotal: 0 };
  const progress = Math.max(2, Math.min(100, 100 - me.xpToNextLevel));
  const events = eventsQ.data ?? [];
  const rewards = rewardsQ.data ?? [];

  return (
    <div className="space-y-4">
      {/* Wallet / Level */}
      <Surface
        className="p-6 text-white"
        style={{
          background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 55%, #DB2777 100%)',
          borderColor: 'rgba(255,255,255,.16)',
          boxShadow: '0 24px 60px -24px rgba(124,58,237,.55)',
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-200">
              M-Coins hamyoni
            </p>
            <p className="mt-1 text-[30px] font-black leading-none tracking-tight tabular-nums">
              {me.coins}
              <span className="ml-1.5 text-[13px] font-bold text-indigo-100">M-Coin</span>
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <Pill tone="blue" icon={I.award}>
                {me.rank != null ? `${me.rank}-oʻrin` : 'Reytingsiz'}
              </Pill>
              <Pill tone="purple" icon={I.star}>
                {me.level}-daraja
              </Pill>
            </div>
          </div>
          <ProgressRing value={progress} center={me.level} sub="Daraja" tone="purple" />
        </div>
        <div className="mt-5 rounded-2xl bg-black/25 p-3">
          <div className="flex items-center justify-between text-[11.5px] font-semibold">
            <span>{me.xp} XP</span>
            <span className="text-indigo-100">Keyingi darajagacha {me.xpToNextLevel} XP</span>
          </div>
          <div className="mt-2 h-[7px] overflow-hidden rounded-full bg-white/20">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-white to-indigo-200"
              initial={false}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </div>
      </Surface>

      {/* XP feed */}
      <Surface className="p-5 slide-up stagger-1">
        <CardHead icon={I.sparkles} tone="purple" title="Soʻnggi yutuqlar" meta={<span className="text-[11px] font-bold" style={{ color: '#AF52DE' }}>{me.xp} XP</span>} />
        {eventsQ.isLoading ? (
          <div className="space-y-2">
            <Skeleton height={46} />
            <Skeleton height={46} />
          </div>
        ) : eventsQ.isError ? (
          <p className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>
            Yutuqlar yuklab boʻlmadi.
          </p>
        ) : events.length === 0 ? (
          <p className="text-[12.5px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
            Hozircha yutuqlar yoʻq. Darsga vaqtida kelish va vazifalarni bajarish XP olib keladi!
          </p>
        ) : (
          <div className="space-y-1">
            {events.map((ev) => (
              <div key={ev.id} className="flex items-center justify-between gap-3 rounded-2xl px-2 py-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: TONE_COLORS.purple.bg, color: TONE_COLORS.purple.fg }}>
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
                <div className="flex shrink-0 items-center gap-1">
                  {ev.xp > 0 && (
                    <span className="text-[11px] font-bold" style={{ color: '#0A84FF' }}>+{ev.xp} XP</span>
                  )}
                  {ev.coins > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: TONE_COLORS.orange.bg, color: TONE_COLORS.orange.fg }}>
                      <Icon paths={I.coins} size={10} strokeWidth={2.6} />
                      +{ev.coins}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Surface>

      {/* Reward shop */}
      <Surface className="p-5 slide-up stagger-2">
        <CardHead icon={I.gift} tone="orange" title="M-Coin doʻkoni" meta={<span className="inline-flex items-center gap-1 text-[11.5px] font-bold" style={{ color: '#E08A00' }}><Icon paths={I.coins} size={12} strokeWidth={2.5} />{me.coins}</span>} />
        {rewardsQ.isError ? (
          <div className="tg-note rounded-2xl p-3.5">
            <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Mukofot doʻkoni hozircha ochilmagan. Xodimlarga murojaat qiling — tez orada paydo boʻladi.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {rewards.map((r) => {
              const affordable = me.coins >= r.costCoins;
              const claiming = claimingId === r.id;
              return (
                <div
                  key={r.id}
                  className="flex flex-col rounded-2xl p-3"
                  style={{ background: 'color-mix(in srgb, var(--text-primary) 4%, transparent)', border: '1px solid var(--border-subtle)' }}
                >
                  <span className="text-[26px] leading-none">{r.icon || '🎁'}</span>
                  <p className="mt-2 text-[12.5px] font-bold leading-snug" style={{ color: 'var(--text-primary)' }}>
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
                    {claiming ? 'Yuborilmoqda…' : affordable ? `Olish · ${r.costCoins}` : 'Yetarli emas'}
                  </Btn>
                </div>
              );
            })}
          </div>
        )}
      </Surface>
    </div>
  );
}

/* ============================================================================
 * BOTTOM DOCK (Apple-style glass dock)
 * ========================================================================== */

const TAB_META: Record<TabId, { label: string; icon: string[] }> = {
  parent: { label: 'Ota-ona', icon: I.heart },
  student: { label: 'Oʻquvchi', icon: I.graduationCap },
  teacher: { label: 'Oʻqituvchi', icon: I.users },
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
    <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(env(safe-area-inset-bottom),14px)]">
      <nav
        role="tablist"
        aria-label="Portallar"
        className="tg-dock mx-auto flex max-w-sm items-center justify-around rounded-full p-1.5"
      >
        {tabs.map((id) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={`${TAB_META[id].label} boʻlimi`}
              onClick={() => onChange(id)}
              className="relative flex flex-1 flex-col items-center gap-0.5 rounded-full py-2 text-[10.5px] font-bold transition-colors"
              style={{ color: isActive ? '#34C759' : 'var(--text-tertiary)' }}
            >
              {isActive && (
                <motion.span
                  layoutId="dock-pill"
                  className="absolute inset-0 rounded-full"
                  style={{ background: 'rgba(52,199,89,.16)', border: '1px solid rgba(52,199,89,.28)' }}
                  transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }}
                />
              )}
              <span className="relative z-10 flex h-5 items-center">
                <Icon paths={TAB_META[id].icon} size={20} strokeWidth={isActive ? 2.4 : 1.8} />
              </span>
              <span className="relative z-10">{TAB_META[id].label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

/* ============================================================================
 * MAXSUS HOLATLAR
 * ========================================================================== */

function GateScreen() {
  return (
    <EmptyState
      icon={I.graduationCap}
      tone="blue"
      title="M-EDU Telegram Portali"
      message="Portalda koʻrish uchun M-EDU hisobingizga kiring. Bu sizning va farzandlaringiz maʼlumotlarini himoya qiladi."
    >
      <Btn onClick={() => window.location.assign('/login')}>
        Hisobga kirish
      </Btn>
    </EmptyState>
  );
}

function NoAccessScreen({ role }: { role?: string | null }) {
  return (
    <EmptyState
      icon={I.shieldCheck}
      tone="slate"
      title="Boʻlim topilmadi"
      message={`Sizning profilingiz uchun (${ROLE_LABELS[role ?? ''] ?? role ?? 'nomaʼlum rol'}) ushbu portalda ochiq boʻlim yoʻq. Markaz adminstratsiyasiga murojaat qiling.`}
    />
  );
}

/* ============================================================================
 * SAHIFA
 * ========================================================================== */

export function TelegramWebAppPage() {
  usePageTitle('M-EDU Telegram Portali');

  const { user: tgUser, colorScheme, haptic, contactAdmin } = useTelegram();
  const { user: appUser, status: authStatus, hasAnyRole } = useAuth();
  const isOnline = useOnlineStatus();
  const reduced = useReducedMotion();
  const [tab, setTab] = useState<TabId>('parent');

  const tabs = useMemo<TabId[]>(() => {
    const list: TabId[] = [];
    if (hasAnyRole('PARENT')) list.push('parent');
    if (hasAnyRole('STUDENT')) list.push('student');
    if (hasAnyRole('TEACHER', 'ASSISTANT', 'SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER')) list.push('teacher');
    return list;
  }, [hasAnyRole]);

  useEffect(() => {
    if (tabs.length > 0 && !tabs.includes(tab)) setTab(tabs[0]);
  }, [tabs, tab]);

  const { greeting, icon: greetingIcon } = getTimeGreeting();
  const displayName =
    tgUser?.first_name ?? appUser?.firstName ?? (appUser ? null : 'Mehmon');
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
      <style>{PRESET_CSS}</style>

      {/* Ambient orbs */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -right-20 -top-24 h-72 w-72 rounded-full"
          style={{ background: 'radial-gradient(closest-side, rgba(76,128,255,.20), transparent)' }}
        />
        <div
          className="absolute -bottom-28 -left-24 h-80 w-80 rounded-full"
          style={{ background: 'radial-gradient(closest-side, rgba(175,122,255,.16), transparent)' }}
        />
      </div>

      {/* Header */}
      <header
        className="sticky top-0 z-30 border-b"
        style={{
          background: 'color-mix(in srgb, var(--tg-theme-bg-color, #0E141E) 84%, transparent)',
          backdropFilter: 'blur(20px) saturate(1.5)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.5)',
          borderColor: 'var(--border-subtle)',
          paddingTop: 'max(env(safe-area-inset-top), 0px)',
        }}
      >
        <div className="mx-auto flex w-full max-w-md items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={avatarName} photo={headerAvatar} size={44} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span style={{ color: TONE_COLORS.orange.fg }}>
                  <Icon paths={greetingIcon} size={14} strokeWidth={2.4} />
                </span>
                <p className="truncate text-[14.5px] font-bold tracking-tight">
                  {displayName
                    ? `${greeting}, ${displayName.split(' ')[0]}!`
                    : `${greeting}!`}
                </p>
              </div>
              <p className="truncate text-[11.5px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
                {appRole ? `${ROLE_LABELS[appRole] ?? appRole} • ` : ''}M-EDU Taʼlim portali
              </p>
            </div>
          </div>
          <div
            className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold"
            style={{
              background: isOnline ? 'rgba(52,199,89,.13)' : 'rgba(255,149,0,.13)',
              color: isOnline ? '#34C759' : '#E08A00',
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{
                background: isOnline ? '#34C759' : '#FF9500',
                boxShadow: isOnline ? '0 0 0 3px rgba(52,199,89,.2)' : 'none',
              }}
            />
            {isOnline ? 'Onlayn' : 'Oflayn'}
          </div>
        </div>
      </header>

      {!isOnline && (
        <div className="relative z-10 mx-auto w-full max-w-md px-4 pb-1 pt-2">
          <div
            className="flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-[12px] font-semibold"
            style={{ background: 'rgba(255,149,0,.10)', borderColor: 'rgba(255,149,0,.28)', color: '#B86A00' }}
          >
            <Icon paths={I.wifiOff} size={15} strokeWidth={2.2} />
            Internet aloqasi yoʻq — maʼlumotlar yangilanmaydi.
          </div>
        </div>
      )}

      {/* Content */}
      <main className="relative z-10 mx-auto w-full max-w-md px-4 pb-[calc(112px+env(safe-area-inset-bottom))] pt-4">
        {authStatus === 'booting' ? (
          <div className="space-y-4">
            <Skeleton className="rounded-[28px]" height={190} />
            <Skeleton className="rounded-[28px]" height={130} />
            <Skeleton className="rounded-[28px]" height={150} />
          </div>
        ) : authStatus === 'unauthenticated' ? (
          <GateScreen />
        ) : tabs.length === 0 ? (
          <NoAccessScreen role={appRole} />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={reduced ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              {tab === 'parent' && <ParentView contactAdmin={contactAdmin} haptic={haptic} />}
              {tab === 'teacher' && <TeacherView haptic={haptic} />}
              {tab === 'student' && <StudentView haptic={haptic} />}
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      <BottomDock
        tabs={tabs}
        active={tab}
        reduced={reduced ?? false}
        onChange={(next) => {
          haptic('light');
          setTab(next);
          window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
        }}
      />
    </div>
  );
}
