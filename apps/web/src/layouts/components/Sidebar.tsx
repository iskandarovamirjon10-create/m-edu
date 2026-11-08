'use client';

/**
 * ============================================================================
 * M-EDU Sidebar & Navigation Registry — iOS 27 "Liquid Glass Studio — Ultra"
 * ============================================================================
 *
 * True iOS 27 / visionOS Spatial Upgrades:
 *  • Cached Zero-Layout-Thrash Pointer Spotlight + 1px Specular Rail Rim
 *  • Accent-Aware Convex Liquid Capsules with corner catchlights & meniscus
 *  • ResizeObserver-driven Scroll Edge Masking (-webkit-mask-image + mask-image)
 *  • Working ⌘B / Ctrl+B rail toggle + Alt+/ quick filter + Enter quick-jump
 *  • Prefix-aware route matching for nested paths in More Modules & RecentRoutes
 *  • Stable sound ref + inert/aria-hidden protection on collapsed trees
 *
 * Contract Guarantee: 100% backwards-compatible exports, types, RBAC student
 * shielding, roving keyboard focus, and sound effects.
 * ============================================================================
 */

import {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  memo,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { cn, usePrefersReducedMotion, SPRING } from '@/lib/design';
import type { AccentKey } from '../core/tokens';
import {
  useKeyboardNav,
  usePersistedState,
  useMediaQuery,
} from '../core/singletons';
import { Brand } from './Brand';
import { MeduAiLogo } from '@/components/brand/MeduAiLogo';
import { StaticIcon, PremiumIcon, I, type IconPaths } from './Icons';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { preloadRoute } from '@/routes/index';

/* ══════════════════════════════════════════════════════════════════════
 * iOS 27 LIQUID GLASS, ACCENT & SPRING TOKENS
 * ════════════════════════════════════════════════════════════════════ */

const FOCUS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--border-focus)]';

/** Subtle tactile 3D glass hover for standalone controls */
const GLASS_BTN_HOVER =
  'hover:bg-white/65 dark:hover:bg-white/[0.09] hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.75),0_2px_8px_-2px_rgba(0,0,0,0.06)] dark:hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.16),0_2px_8px_-2px_rgba(0,0,0,0.4)]';

const OVERLINE =
  'px-3 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-tertiary/80 select-none';

/** Ultra-smooth liquid spring physics */
const LIQUID_SPRING = {
  type: 'spring' as const,
  stiffness: 460,
  damping: 34,
  mass: 0.68,
  restDelta: 0.001,
};

const HOVER_SPRING = {
  type: 'spring' as const,
  stiffness: 540,
  damping: 36,
  mass: 0.55,
};

const GEL_SPRING = {
  type: 'spring' as const,
  stiffness: 740,
  damping: 25,
  mass: 0.34,
};

function triggerHaptic(pattern: number | number[] = 6) {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    /* blocked by browser policy */
  }
}

/** Guards against empty-string translations */
function tr(
  t: (key: string, fallback?: string) => string,
  key: string,
  fallback: string,
): string {
  const val = t(key, fallback);
  return typeof val === 'string' && val.trim().length > 0 ? val : fallback;
}

/** Stable ref wrapper so sound hooks never invalidate memoized item callbacks */
function useStableSound() {
  const sound = usePremiumSound();
  const ref = useRef(sound);
  useEffect(() => {
    ref.current = sound;
  }, [sound]);
  return ref;
}

/** Checks if a pathname belongs to a NavItem route (exact or nested sub-route) */
function isRouteMatching(pathname: string, item: NavItem): boolean {
  if (item.end || item.to === '/') {
    return pathname === item.to;
  }
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

/** iOS 27 Accent-aware optical styling for active capsules & indicators */
interface AccentVisuals {
  readonly pill: string;
  readonly bar: string;
  readonly text: string;
  readonly dot: string;
  readonly meniscus: string;
}

const ACCENT_VISUAL_MAP: Record<string, AccentVisuals> = {
  blue: {
    pill: 'from-white/50 via-brand-500/[0.14] to-brand-500/[0.06] dark:from-white/[0.12] dark:via-brand-400/[0.22] dark:to-brand-500/[0.08] border-brand-500/30 dark:border-brand-400/35 shadow-[inset_0_1.5px_0_0_rgba(255,255,255,0.85),inset_0_-1px_0_0_rgba(10,132,255,0.2),0_4px_14px_-3px_rgba(10,132,255,0.24)] dark:shadow-[inset_0_1.5px_0_0_rgba(255,255,255,0.26),inset_0_-1px_0_0_rgba(90,200,250,0.25),0_4px_16px_-3px_rgba(10,132,255,0.38)]',
    bar: 'from-brand-400 to-brand-600 shadow-[0_0_10px_rgba(10,132,255,0.85)]',
    text: 'text-brand-600 dark:text-brand-300',
    dot: 'bg-brand-500 shadow-[0_0_6px_rgba(10,132,255,0.75)]',
    meniscus: 'via-brand-500/45 dark:via-brand-400/55',
  },
  purple: {
    pill: 'from-white/50 via-purple-500/[0.14] to-purple-500/[0.06] dark:from-white/[0.12] dark:via-purple-400/[0.22] dark:to-purple-500/[0.08] border-purple-500/30 dark:border-purple-400/35 shadow-[inset_0_1.5px_0_0_rgba(255,255,255,0.85),inset_0_-1px_0_0_rgba(175,82,222,0.2),0_4px_14px_-3px_rgba(175,82,222,0.24)] dark:shadow-[inset_0_1.5px_0_0_rgba(255,255,255,0.26),inset_0_-1px_0_0_rgba(191,90,242,0.25),0_4px_16px_-3px_rgba(191,90,242,0.38)]',
    bar: 'from-purple-400 to-purple-600 shadow-[0_0_10px_rgba(191,90,242,0.85)]',
    text: 'text-purple-600 dark:text-purple-300',
    dot: 'bg-purple-500 shadow-[0_0_6px_rgba(191,90,242,0.75)]',
    meniscus: 'via-purple-500/45 dark:via-purple-400/55',
  },
  pink: {
    pill: 'from-white/50 via-rose-500/[0.14] to-rose-500/[0.06] dark:from-white/[0.12] dark:via-rose-400/[0.22] dark:to-rose-500/[0.08] border-rose-500/30 dark:border-rose-400/35 shadow-[inset_0_1.5px_0_0_rgba(255,255,255,0.85),inset_0_-1px_0_0_rgba(255,55,95,0.2),0_4px_14px_-3px_rgba(255,55,95,0.24)] dark:shadow-[inset_0_1.5px_0_0_rgba(255,255,255,0.26),inset_0_-1px_0_0_rgba(255,55,95,0.25),0_4px_16px_-3px_rgba(255,55,95,0.38)]',
    bar: 'from-rose-400 to-rose-600 shadow-[0_0_10px_rgba(255,55,95,0.85)]',
    text: 'text-rose-600 dark:text-rose-300',
    dot: 'bg-rose-500 shadow-[0_0_6px_rgba(255,55,95,0.75)]',
    meniscus: 'via-rose-500/45 dark:via-rose-400/55',
  },
  green: {
    pill: 'from-white/50 via-emerald-500/[0.14] to-emerald-500/[0.06] dark:from-white/[0.12] dark:via-emerald-400/[0.22] dark:to-emerald-500/[0.08] border-emerald-500/30 dark:border-emerald-400/35 shadow-[inset_0_1.5px_0_0_rgba(255,255,255,0.85),inset_0_-1px_0_0_rgba(52,199,89,0.2),0_4px_14px_-3px_rgba(52,199,89,0.24)] dark:shadow-[inset_0_1.5px_0_0_rgba(255,255,255,0.26),inset_0_-1px_0_0_rgba(48,209,88,0.25),0_4px_16px_-3px_rgba(48,209,88,0.36)]',
    bar: 'from-emerald-400 to-emerald-600 shadow-[0_0_10px_rgba(52,199,89,0.85)]',
    text: 'text-emerald-600 dark:text-emerald-300',
    dot: 'bg-emerald-500 shadow-[0_0_6px_rgba(52,199,89,0.75)]',
    meniscus: 'via-emerald-500/45 dark:via-emerald-400/55',
  },
  orange: {
    pill: 'from-white/50 via-amber-500/[0.14] to-amber-500/[0.06] dark:from-white/[0.12] dark:via-amber-400/[0.22] dark:to-amber-500/[0.08] border-amber-500/30 dark:border-amber-400/35 shadow-[inset_0_1.5px_0_0_rgba(255,255,255,0.85),inset_0_-1px_0_0_rgba(255,149,0,0.2),0_4px_14px_-3px_rgba(255,149,0,0.24)] dark:shadow-[inset_0_1.5px_0_0_rgba(255,255,255,0.26),inset_0_-1px_0_0_rgba(255,159,10,0.25),0_4px_16px_-3px_rgba(255,159,10,0.38)]',
    bar: 'from-amber-400 to-orange-500 shadow-[0_0_10px_rgba(255,149,0,0.85)]',
    text: 'text-amber-600 dark:text-amber-300',
    dot: 'bg-amber-500 shadow-[0_0_6px_rgba(255,149,0,0.75)]',
    meniscus: 'via-amber-500/45 dark:via-amber-400/55',
  },
  rainbow: {
    pill: 'from-brand-500/[0.20] via-purple-500/[0.15] to-rose-500/[0.12] dark:from-brand-400/[0.26] dark:via-purple-500/[0.20] dark:to-rose-500/[0.15] border-purple-500/35 dark:border-purple-400/40 shadow-[inset_0_1.5px_0_0_rgba(255,255,255,0.88),inset_0_-1px_0_0_rgba(191,90,242,0.28),0_4px_16px_-3px_rgba(175,82,222,0.3)] dark:shadow-[inset_0_1.5px_0_0_rgba(255,255,255,0.28),inset_0_-1px_0_0_rgba(191,90,242,0.35),0_4px_18px_-3px_rgba(191,90,242,0.45)]',
    bar: 'from-brand-400 via-purple-500 to-rose-500 shadow-[0_0_12px_rgba(191,90,242,0.9)]',
    text: 'text-purple-600 dark:text-purple-300',
    dot: 'bg-gradient-to-tr from-brand-500 via-purple-500 to-rose-500 shadow-[0_0_8px_rgba(191,90,242,0.8)]',
    meniscus: 'via-purple-500/55 dark:via-purple-400/65',
  },
};

function getAccentVisuals(accent?: AccentKey): AccentVisuals {
  return ACCENT_VISUAL_MAP[accent ?? 'blue'] ?? ACCENT_VISUAL_MAP.blue;
}

/* ══════════════════════════════════════════════════════════════════════
 * NAVIGATION REGISTRY (100% API compatible)
 * ════════════════════════════════════════════════════════════════════ */

export interface NavItem {
  to: string;
  labelKey: string;
  label: string;
  iconPath: IconPaths;
  end?: boolean;
  accent?: AccentKey;
}

export const MANAGEMENT_NAV: readonly NavItem[] = [
  { to: '/', labelKey: 'nav.dashboard', label: 'Dashboard', iconPath: I.dashboard, end: true, accent: 'blue' },
  { to: '/ai-copilot', labelKey: 'nav.aiCopilot', label: 'AI Copilot', iconPath: I.ai, accent: 'rainbow' },
  { to: '/reports', labelKey: 'nav.reports', label: 'Reports', iconPath: I.reports, accent: 'blue' },
  { to: '/early-warning', labelKey: 'nav.earlyWarning', label: 'At-Risk Students', iconPath: I.earlyWarning, accent: 'pink' },
];

export const ACADEMIC_NAV: readonly NavItem[] = [
  { to: '/students', labelKey: 'nav.students', label: 'Students', iconPath: I.students, accent: 'blue' },
  { to: '/teachers', labelKey: 'nav.teachers', label: 'Teachers', iconPath: I.teachers, accent: 'purple' },
  { to: '/groups', labelKey: 'nav.groups', label: 'Groups', iconPath: I.groups, accent: 'blue' },
  { to: '/courses', labelKey: 'nav.courses', label: 'Courses', iconPath: I.courses, accent: 'orange' },
  { to: '/schedule', labelKey: 'nav.schedule', label: 'Schedule', iconPath: I.schedule, accent: 'blue' },
  { to: '/attendance', labelKey: 'nav.attendance', label: 'Attendance', iconPath: I.attendance, accent: 'green' },
  { to: '/face', labelKey: 'nav.faceRecognition', label: 'Face Recognition', iconPath: I.face, accent: 'purple' },
  { to: '/homework', labelKey: 'nav.homework', label: 'Homework', iconPath: I.homework, accent: 'pink' },
  { to: '/grades', labelKey: 'nav.grades', label: 'Grades', iconPath: I.grades, accent: 'purple' },
];

export const FINANCE_NAV: readonly NavItem[] = [
  { to: '/payments', labelKey: 'nav.payments', label: 'Payments', iconPath: I.payments, accent: 'green' },
  { to: '/invoices', labelKey: 'nav.invoices', label: 'Invoices', iconPath: I.invoices, accent: 'green' },
  { to: '/expenses', labelKey: 'nav.expenses', label: 'Expenses', iconPath: I.expenses, accent: 'pink' },
  { to: '/payroll', labelKey: 'nav.payrollRuns', label: 'Payroll Runs', iconPath: I.payroll, accent: 'green' },
];

export const COMMUNICATION_NAV: readonly NavItem[] = [
  { to: '/leads', labelKey: 'nav.leads', label: 'Leads', iconPath: I.leads, accent: 'blue' },
  { to: '/telegram', labelKey: 'nav.telegram', label: 'Telegram Integration', iconPath: I.telegram, accent: 'blue' },
  { to: '/chat', labelKey: 'nav.chat', label: 'Chat', iconPath: I.chat, accent: 'blue' },
  { to: '/notifications', labelKey: 'nav.notifications', label: 'Notifications', iconPath: I.notifications, accent: 'orange' },
];

export const ADMINISTRATION_NAV: readonly NavItem[] = [
  { to: '/users', labelKey: 'nav.users', label: 'Users', iconPath: I.users, accent: 'blue' },
  { to: '/branches', labelKey: 'nav.branches', label: 'Branches', iconPath: I.branches, accent: 'blue' },
  { to: '/cameras', labelKey: 'nav.cameras', label: 'Cameras', iconPath: I.cameras, accent: 'purple' },
  { to: '/audit', labelKey: 'nav.audit', label: 'Audit Log', iconPath: I.audit, accent: 'purple' },
  { to: '/settings', labelKey: 'nav.settings', label: 'Settings', iconPath: I.settings, accent: 'purple' },
];

export const MORE_NAV: readonly NavItem[] = [
  { to: '/teacher-cockpit', labelKey: 'nav.teacherCockpit', label: 'Teacher Cockpit', iconPath: I.attendance, accent: 'blue' },
  { to: '/executive-dashboard', labelKey: 'nav.executiveDashboard', label: 'Executive Dashboard', iconPath: I.executive, accent: 'purple' },
  { to: '/financial-analytics', labelKey: 'nav.financialAnalytics', label: 'Financial Analytics', iconPath: I.financial, accent: 'green' },
  { to: '/payroll-analytics', labelKey: 'nav.payrollAnalytics', label: 'Payroll Analytics', iconPath: I.payroll, accent: 'green' },
  { to: '/crm-analytics', labelKey: 'nav.crmAnalytics', label: 'CRM Analytics', iconPath: I.leads, accent: 'blue' },
  { to: '/parent-portal', labelKey: 'nav.parentPortal', label: 'Parent Portal', iconPath: I.parentPortal, accent: 'orange' },
  { to: '/hr', labelKey: 'nav.hrPayroll', label: 'HR & Payroll', iconPath: I.hr, accent: 'purple' },
  { to: '/automation', labelKey: 'nav.automation', label: 'Automation', iconPath: I.automation, accent: 'orange' },
  { to: '/follow-up-automation', labelKey: 'nav.followUpRules', label: 'Follow-Up Rules', iconPath: I.followUp, accent: 'orange' },
  { to: '/inventory', labelKey: 'nav.inventory', label: 'Inventory', iconPath: I.inventory, accent: 'orange' },
  { to: '/library', labelKey: 'nav.library', label: 'Library', iconPath: I.library, accent: 'orange' },
  { to: '/exams', labelKey: 'nav.exams', label: 'Exams', iconPath: I.exams, accent: 'pink' },
  { to: '/certificates', labelKey: 'nav.certificates', label: 'Certificates', iconPath: I.cert, accent: 'orange' },
  { to: '/anomaly-detection', labelKey: 'nav.anomalyDetection', label: 'Anomaly Detection', iconPath: I.anomaly, accent: 'pink' },
  { to: '/data-governance', labelKey: 'nav.dataGovernance', label: 'Data Governance', iconPath: I.governance, accent: 'purple' },
];

export const PRIMARY_NAV: readonly NavItem[] = [
  ...MANAGEMENT_NAV,
  ...ACADEMIC_NAV,
  ...FINANCE_NAV,
  ...COMMUNICATION_NAV,
];

export const SECONDARY_NAV: readonly NavItem[] = [
  ...ADMINISTRATION_NAV,
  ...MORE_NAV,
];

export interface NavSectionDef {
  readonly id: string;
  readonly titleKey: string;
  readonly title: string;
  readonly items: readonly NavItem[];
}

export const CORE_SECTIONS: readonly NavSectionDef[] = [
  { id: 'management', titleKey: 'nav.sectionManagement', title: 'Management', items: MANAGEMENT_NAV },
  { id: 'academics', titleKey: 'nav.sectionAcademics', title: 'Academics', items: ACADEMIC_NAV },
  { id: 'finance', titleKey: 'nav.sectionFinance', title: 'Finance', items: FINANCE_NAV },
  { id: 'communication', titleKey: 'nav.sectionCommunication', title: 'Communication & CRM', items: COMMUNICATION_NAV },
];

export const TEACHER_DEDICATED_NAV: readonly NavItem[] = [
  { to: '/teacher-cockpit', labelKey: 'nav.teacherCockpit', label: 'Teacher Cockpit', iconPath: I.attendance, end: true, accent: 'blue' },
  { to: '/ai-copilot', labelKey: 'nav.aiCopilot', label: 'AI Copilot', iconPath: I.ai, accent: 'rainbow' },
];

export const PARENT_DEDICATED_NAV: readonly NavItem[] = [
  { to: '/parent-portal', labelKey: 'nav.parentPortal', label: 'Parent Portal', iconPath: I.parentPortal, end: true, accent: 'orange' },
];

export const STUDENT_DEDICATED_NAV: readonly NavItem[] = [
  { to: '/schedule', labelKey: 'nav.schedule', label: 'Schedule', iconPath: I.schedule, end: true, accent: 'blue' },
  { to: '/ai-copilot', labelKey: 'nav.aiCopilot', label: 'AI Copilot', iconPath: I.ai, accent: 'rainbow' },
];

export const TEACHER_ALLOWED_ROUTES = new Set<string>([
  '/teacher-cockpit',
  '/attendance',
  '/groups',
  '/schedule',
  '/grades',
  '/homework',
  '/assignments',
  '/subjects',
  '/chat',
  '/notifications',
  '/settings',
  '/ai-copilot',
]);

export const STUDENT_ALLOWED_ROUTES = new Set<string>([
  '/',
  '/schedule',
  '/grades',
  '/homework',
  '/attendance',
  '/chat',
  '/notifications',
  '/settings',
  '/ai-copilot',
]);

export const PARENT_ALLOWED_ROUTES = new Set<string>([
  '/parent-portal',
  '/chat',
  '/notifications',
  '/settings',
]);

export const FINANCE_ALLOWED_ROUTES = new Set<string>([
  '/',
  '/payments',
  '/invoices',
  '/expenses',
  '/payroll',
  '/reconciliation',
  '/financial-analytics',
  '/payroll-analytics',
  '/reports',
  '/chat',
  '/notifications',
  '/settings',
]);

export const RECEPTIONIST_ALLOWED_ROUTES = new Set<string>([
  '/',
  '/students',
  '/attendance',
  '/leads',
  '/schedule',
  '/payments',
  '/chat',
  '/notifications',
  '/settings',
]);

export function isRouteAllowedForRole(to: string, role: string | null | undefined): boolean {
  const r = (role ?? '').toUpperCase();
  if (
    r.includes('ADMIN') ||
    r === 'MANAGER' ||
    r === 'DIRECTOR' ||
    r === 'OWNER' ||
    r === 'PLATFORM_OWNER'
  ) {
    return true;
  }

  const basePath = to.split('?')[0].split('#')[0].replace(/\/$/, '') || '/';

  if (r === 'TEACHER' || r === 'ASSISTANT') {
    return TEACHER_ALLOWED_ROUTES.has(basePath);
  }
  if (r === 'STUDENT') {
    return STUDENT_ALLOWED_ROUTES.has(basePath);
  }
  if (r === 'PARENT') {
    return PARENT_ALLOWED_ROUTES.has(basePath);
  }
  if (r === 'ACCOUNTANT' || r === 'FINANCE' || r === 'FINANCE_MANAGER') {
    return FINANCE_ALLOWED_ROUTES.has(basePath);
  }
  if (r === 'RECEPTIONIST') {
    return RECEPTIONIST_ALLOWED_ROUTES.has(basePath);
  }

  return false;
}

const ALL_NAV_LIST: readonly NavItem[] = [
  ...PRIMARY_NAV,
  ...SECONDARY_NAV,
  ...TEACHER_DEDICATED_NAV,
  ...PARENT_DEDICATED_NAV,
  ...STUDENT_DEDICATED_NAV,
];

export const HIDDEN_FOR_TEACHER = new Set<string>(
  ALL_NAV_LIST.map((i) => i.to).filter((to) => !TEACHER_ALLOWED_ROUTES.has(to)),
);

export const HIDDEN_FOR_STUDENT = new Set<string>(
  ALL_NAV_LIST.map((i) => i.to).filter((to) => !STUDENT_ALLOWED_ROUTES.has(to)),
);

export const HIDDEN_FOR_PARENT = new Set<string>(
  ALL_NAV_LIST.map((i) => i.to).filter((to) => !PARENT_ALLOWED_ROUTES.has(to)),
);

export const ALL_ITEMS_MAP = new Map<string, NavItem>(
  ALL_NAV_LIST.map((i) => [i.to, i]),
);

/* ══════════════════════════════════════════════════════════════════════
 * HOOKS & HELPERS
 * ════════════════════════════════════════════════════════════════════ */

export function useRecentRoutes(limit = 3): readonly string[] {
  const [recent, setRecent] = usePersistedState<readonly string[]>(
    'm-edu.recent-routes',
    [],
  );
  const { pathname } = useLocation();

  useEffect(() => {
    // Support both exact routes and nested sub-routes (e.g. /students/42 -> /students)
    const matched =
      ALL_ITEMS_MAP.get(pathname) ??
      ALL_NAV_LIST.find((item) => isRouteMatching(pathname, item));

    if (!matched) return;
    const baseRoute = matched.to;

    setRecent((prev) => {
      if (prev[0] === baseRoute) return prev;
      return [baseRoute, ...prev.filter((p) => p !== baseRoute)].slice(0, limit);
    });
  }, [pathname, limit, setRecent]);

  return recent;
}

function useRoleLabel(role: string): string {
  return useMemo(() => (role ?? '').replace(/_/g, ' ').toLowerCase(), [role]);
}

/** Highlights case-insensitive match of `query` inside `text`. */
function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded-[5px] bg-brand-500/20 px-1 py-px font-semibold text-brand-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] dark:bg-brand-400/25 dark:text-brand-300">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════
 * RecentRoutes — iOS 27 Liquid Glass Quick Pills (Accent-Synchronized)
 * ════════════════════════════════════════════════════════════════════ */

export const RecentRoutes = memo(function RecentRoutes({
  role = '',
  onNavigate,
}: {
  role?: string;
  onNavigate?: () => void;
}) {
  const { t } = useSafeI18n();
  const recent = useRecentRoutes(3);
  const reduced = usePrefersReducedMotion();
  const soundRef = useStableSound();

  const items = useMemo(
    () =>
      recent
        .filter((p) => isRouteAllowedForRole(p, role))
        .map((p) => ALL_ITEMS_MAP.get(p))
        .filter((x): x is NavItem => Boolean(x)),
    [recent, role],
  );

  if (items.length === 0) return null;

  return (
    <div className="relative z-10 shrink-0 border-b border-black/[0.05] px-4 py-2.5 dark:border-white/[0.06]">
      <div className="mb-1.5 flex items-center justify-between px-0.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-tertiary/80">
          {tr(t, 'nav.recent', 'Recent')}
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => {
          const visuals = getAccentVisuals(item.accent);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onMouseEnter={() => preloadRoute(item.to)}
              onFocus={() => preloadRoute(item.to)}
              onClick={() => {
                triggerHaptic(5);
                soundRef.current?.playTick?.();
                onNavigate?.();
              }}
              className={({ isActive }) =>
                cn(
                  'group relative inline-flex min-h-[28px] max-w-[148px] items-center gap-1.5 rounded-full px-2.5 py-1',
                  'text-[11px] font-medium transition-colors duration-200',
                  'backdrop-blur-md',
                  FOCUS,
                  isActive
                    ? cn('border bg-gradient-to-b font-semibold', visuals.pill, visuals.text)
                    : cn(
                        'border border-black/[0.06] bg-white/50 text-secondary shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]',
                        'dark:border-white/[0.08] dark:bg-white/[0.045] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]',
                        'hover:border-black/[0.12] hover:bg-white/80 hover:text-primary dark:hover:bg-white/[0.1]',
                      ),
                )
              }
            >
              <motion.span
                whileTap={reduced ? undefined : { scaleX: 1.06, scaleY: 0.9 }}
                transition={GEL_SPRING}
                className="flex min-w-0 items-center gap-1.5"
              >
                <span
                  className={cn(
                    'h-1.5 w-1.5 shrink-0 rounded-full transition-transform duration-200 group-hover:scale-125',
                    visuals.dot,
                  )}
                  aria-hidden="true"
                />
                <span className="truncate">{tr(t, item.labelKey, item.label)}</span>
              </motion.span>
            </NavLink>
          );
        })}
      </div>
    </div>
  );
});
RecentRoutes.displayName = 'RecentRoutes';

/* ══════════════════════════════════════════════════════════════════════
 * NavItems — iOS 27 Fluid Sectioned Tree + Convex Liquid Capsules
 * ════════════════════════════════════════════════════════════════════ */

export interface NavItemsProps {
  role: string;
  onNavigate?: () => void;
  collapsed?: boolean;
  filter?: string;
  isMobile?: boolean;
}

interface RailTooltipState {
  label: string;
  accent?: AccentKey;
  top: number;
  left: number;
}

const MASK_STYLES: Record<'none' | 'bottom' | 'top' | 'both', CSSProperties | undefined> = {
  none: undefined,
  bottom: {
    maskImage: 'linear-gradient(to bottom, black 0%, black calc(100% - 22px), transparent 100%)',
    WebkitMaskImage:
      'linear-gradient(to bottom, black 0%, black calc(100% - 22px), transparent 100%)',
  },
  top: {
    maskImage: 'linear-gradient(to bottom, transparent 0%, black 18px, black 100%)',
    WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 18px, black 100%)',
  },
  both: {
    maskImage:
      'linear-gradient(to bottom, transparent 0%, black 18px, black calc(100% - 22px), transparent 100%)',
    WebkitMaskImage:
      'linear-gradient(to bottom, transparent 0%, black 18px, black calc(100% - 22px), transparent 100%)',
  },
};

export const NavItems = memo(function NavItems({
  role,
  onNavigate,
  collapsed = false,
  filter = '',
  isMobile = false,
}: NavItemsProps) {
  const { t } = useSafeI18n();
  const location = useLocation();
  const reduced = usePrefersReducedMotion();
  const reducedTransparency = useMediaQuery('(prefers-reduced-transparency: reduce)');
  const navRef = useRef<HTMLElement | null>(null);
  const soundRef = useStableSound();

  useKeyboardNav(navRef, !collapsed && !isMobile);

  const trimmedFilter = filter.trim();
  const lowered = trimmedFilter.toLowerCase();

  const [moreExpanded, setMoreExpanded] = usePersistedState<boolean>(
    'm-edu.sidebar-more-expanded',
    false,
  );

  /** Pinned shortcuts — owner-level quick access, per user, no backend needed. */
  const [pinnedRoutes, setPinnedRoutes] = usePersistedState<readonly string[]>(
    'm-edu.sidebar-pinned',
    [],
  );
  const [railTip, setRailTip] = useState<RailTooltipState | null>(null);
  const [scrollMask, setScrollMask] = useState<'none' | 'bottom' | 'top' | 'both'>('none');

  const tipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setRailTip(null);
    return () => {
      if (tipTimeoutRef.current) clearTimeout(tipTimeoutRef.current);
    };
  }, [collapsed, location.pathname]);

  // Prefix-aware check so nested routes (e.g., /exams/123) keep More Modules open
  const isMoreRouteActive = useMemo(
    () => MORE_NAV.some((item) => isRouteMatching(location.pathname, item)),
    [location.pathname],
  );

  const {
    management,
    academics,
    finance,
    communication,
    administration,
    more,
    totalMatches,
    isEmpty,
  } = useMemo(() => {
    const match = (item: NavItem) => {
      if (!isRouteAllowedForRole(item.to, role)) return false;
      if (!lowered) return true;
      const localized = tr(t, item.labelKey, item.label).toLowerCase();
      return (
        localized.includes(lowered) ||
        item.label.toLowerCase().includes(lowered) ||
        item.to.toLowerCase().includes(lowered)
      );
    };

    const normRole = (role ?? '').toUpperCase();
    const isAdmin =
      normRole.includes('ADMIN') ||
      normRole === 'MANAGER' ||
      normRole === 'PLATFORM_OWNER' ||
      normRole === 'OWNER';

    let baseManagement = MANAGEMENT_NAV;
    if (normRole === 'TEACHER' || normRole === 'ASSISTANT') {
      baseManagement = TEACHER_DEDICATED_NAV;
    } else if (normRole === 'PARENT') {
      baseManagement = PARENT_DEDICATED_NAV;
    } else if (normRole === 'STUDENT') {
      baseManagement = STUDENT_DEDICATED_NAV;
    }

    const m = baseManagement.filter(match);
    const mPaths = new Set(m.map((i) => i.to));
    const ac = ACADEMIC_NAV.filter(match).filter((i) => !mPaths.has(i.to));
    const fn = FINANCE_NAV.filter(match).filter((i) => !mPaths.has(i.to));
    const cm = COMMUNICATION_NAV.filter(match).filter((i) => !mPaths.has(i.to));
    const ad = isAdmin ? ADMINISTRATION_NAV.filter(match).filter((i) => !mPaths.has(i.to)) : [];
    const mr = isAdmin ? MORE_NAV.filter(match).filter((i) => !mPaths.has(i.to)) : [];
    const count = m.length + ac.length + fn.length + cm.length + ad.length + mr.length;

    return {
      management: m,
      academics: ac,
      finance: fn,
      communication: cm,
      administration: ad,
      more: mr,
      totalMatches: count,
      isEmpty: count === 0,
    };
  }, [role, lowered, t]);

  const coreSections = useMemo(
    () => [
      { id: 'management', titleKey: 'nav.sectionManagement', title: 'Management', items: management },
      { id: 'academics', titleKey: 'nav.sectionAcademics', title: 'Academics', items: academics },
      { id: 'finance', titleKey: 'nav.sectionFinance', title: 'Finance', items: finance },
      { id: 'communication', titleKey: 'nav.sectionCommunication', title: 'Communication & CRM', items: communication },
    ],
    [management, academics, finance, communication],
  );

  const showMore = moreExpanded || Boolean(lowered) || isMoreRouteActive || collapsed;

  const pinnedSet = useMemo(() => new Set(pinnedRoutes), [pinnedRoutes]);

  const pinnedItems = useMemo(
    () =>
      lowered
        ? []
        : pinnedRoutes
            .map((route) => ALL_ITEMS_MAP.get(route))
            .filter((item): item is NavItem => Boolean(item))
            .filter((item) => isRouteAllowedForRole(item.to, role)),
    [pinnedRoutes, lowered, role],
  );

  const togglePin = useCallback(
    (route: string) => {
      triggerHaptic(6);
      soundRef.current?.playPop?.();
      setPinnedRoutes((prev) =>
        prev.includes(route) ? prev.filter((r) => r !== route) : [...prev, route],
      );
    },
    [setPinnedRoutes, soundRef],
  );

  const hideTip = useCallback(() => {
    if (tipTimeoutRef.current) clearTimeout(tipTimeoutRef.current);
    setRailTip(null);
  }, []);

  /** Recalculate scroll edge mask whenever scroll position or content height changes */
  const updateScrollMask = useCallback(() => {
    const el = navRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const canScrollUp = scrollTop > 8;
    const canScrollDown = scrollTop + clientHeight < scrollHeight - 8;

    if (canScrollUp && canScrollDown) setScrollMask('both');
    else if (canScrollUp) setScrollMask('top');
    else if (canScrollDown) setScrollMask('bottom');
    else setScrollMask('none');
  }, []);

  const handleNavScroll = useCallback(() => {
    hideTip();
    updateScrollMask();
  }, [hideTip, updateScrollMask]);

  // Keep scroll mask accurate across filter changes, More Modules toggle, and viewport resize
  useEffect(() => {
    updateScrollMask();
    const el = navRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => updateScrollMask());
    ro.observe(el);
    if (el.firstElementChild) {
      ro.observe(el.firstElementChild);
    }
    return () => ro.disconnect();
  }, [updateScrollMask, totalMatches, showMore, collapsed]);

  /** Collapsed rail: pin a viewport-clamped floating glass tooltip next to the hovered icon. */
  const showTip = useCallback(
    (e: { currentTarget: HTMLElement }, label: string, accent?: AccentKey) => {
      if (!collapsed) return;
      if (tipTimeoutRef.current) clearTimeout(tipTimeoutRef.current);
      const rect = e.currentTarget.getBoundingClientRect();
      const rawTop = rect.top + rect.height / 2;
      const safeViewportTop =
        typeof window !== 'undefined'
          ? Math.max(18, Math.min(window.innerHeight - 36, rawTop))
          : rawTop;

      setRailTip({
        label,
        accent,
        top: safeViewportTop,
        left: rect.right + 12,
      });

      tipTimeoutRef.current = setTimeout(() => {
        setRailTip(null);
      }, 2400);
    },
    [collapsed],
  );

  const layoutGroupId = isMobile ? 'mobile-sidebar-nav' : 'desktop-sidebar-nav';

  const renderItem = useCallback(
    (item: NavItem) => {
      const label = tr(t, item.labelKey, item.label);
      const visuals = getAccentVisuals(item.accent);
      const isAiCopilot = item.to === '/ai-copilot';

      const isPinned = pinnedSet.has(item.to);

      return (
        <div key={item.to} className="group/pin relative">
        <NavLink
          to={item.to}
          end={item.end}
          onClick={() => {
            triggerHaptic(6);
            soundRef.current?.playTick?.();
            onNavigate?.();
          }}
          onMouseEnter={(e) => {
            preloadRoute(item.to);
            showTip(e, label, item.accent);
          }}
          onMouseLeave={hideTip}
          onFocus={(e) => {
            preloadRoute(item.to);
            showTip(e, label, item.accent);
          }}
          onBlur={hideTip}
          aria-label={collapsed ? label : undefined}
          className={({ isActive }) =>
            cn(
              'group relative flex items-center rounded-xl transition-colors duration-150 ease-out',
              collapsed
                ? 'min-h-[44px] min-w-[44px] justify-center px-2 py-2'
                : 'min-h-[39px] gap-2.5 px-3 py-1.5',
              FOCUS,
              isActive
                ? cn('font-semibold', visuals.text)
                : 'font-medium text-secondary hover:text-primary',
            )
          }
        >
          {({ isActive }) => (
            <>
              {/* ── 1. Zero-Latency Specular Hover Capsule ── */}
              <span
                aria-hidden="true"
                className={cn(
                  'pointer-events-none absolute inset-0 z-0 rounded-xl transition-opacity duration-150',
                  'bg-gradient-to-b from-white/70 to-white/25 dark:from-white/[0.085] dark:to-white/[0.025]',
                  'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.8),0_1px_3px_rgba(0,0,0,0.03)]',
                  'dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),0_1px_3px_rgba(0,0,0,0.25)]',
                  isActive ? 'opacity-0' : 'opacity-0 group-hover:opacity-100',
                )}
              />

              {/* ── 2. iOS 27 Convex Liquid Active Pill (Works on both Desktop & Mobile Drawer) ── */}
              {isActive && (
                <motion.span
                  layoutId={`${layoutGroupId}-active-pill`}
                  layoutDependency={location.pathname}
                  transition={reduced ? { duration: 0 } : LIQUID_SPRING}
                  aria-hidden="true"
                  className={cn(
                    'pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-xl border bg-gradient-to-b',
                    visuals.pill,
                  )}
                >
                  {!reducedTransparency && (
                    <>
                      {/* Corner caustic catchlights */}
                      <span
                        aria-hidden="true"
                        className="absolute -left-px -top-px h-3.5 w-4 rounded-tl-xl bg-gradient-to-br from-white/80 via-white/15 to-transparent dark:from-white/30"
                      />
                      <span
                        aria-hidden="true"
                        className="absolute -right-px -top-px h-3.5 w-4 rounded-tr-xl bg-gradient-to-bl from-white/55 via-white/10 to-transparent dark:from-white/20"
                      />
                      {/* Bottom meniscus bounce */}
                      <span
                        aria-hidden="true"
                        className={cn(
                          'absolute inset-x-3 bottom-0 h-px bg-gradient-to-r from-transparent to-transparent',
                          visuals.meniscus,
                        )}
                      />
                    </>
                  )}
                </motion.span>
              )}

              {/* ── 3. Luminous Left Laser Indicator ── */}
              {isActive && (
                <motion.span
                  layoutId={`${layoutGroupId}-active-bar`}
                  layoutDependency={location.pathname}
                  transition={reduced ? { duration: 0 } : LIQUID_SPRING}
                  aria-hidden="true"
                  className={cn(
                    'pointer-events-none absolute left-0 top-1/2 z-10 h-5 w-[3.5px] -translate-y-1/2 rounded-full bg-gradient-to-b',
                    visuals.bar,
                  )}
                />
              )}

              {/* ── 4. Tactile Gel Content Wrapper (Icon + Label) ── */}
              <motion.span
                whileTap={
                  reduced
                    ? undefined
                    : collapsed
                      ? { scaleX: 1.08, scaleY: 0.88 }
                      : { scaleX: 1.02, scaleY: 0.96 }
                }
                transition={GEL_SPRING}
                className={cn(
                  'relative z-10 flex min-w-0 flex-1 items-center',
                  collapsed ? 'justify-center' : 'gap-2.5',
                )}
              >
                <span className="relative flex shrink-0 items-center justify-center transition-transform duration-200 ease-out group-hover:scale-[1.08]">
                  {isAiCopilot ? (
                    <MeduAiLogo size="xs" glow={isActive} />
                  ) : (
                    <PremiumIcon
                      paths={item.iconPath}
                      isActive={isActive}
                      accent={item.accent}
                      size={17}
                    />
                  )}
                </span>

                {!collapsed && (
                  <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                    <span className="truncate text-[13px] tracking-[-0.01em]">
                      <HighlightMatch text={label} query={trimmedFilter} />
                    </span>
                    {isAiCopilot && (
                      <span
                        aria-hidden="true"
                        className="shrink-0 rounded-full border border-purple-500/25 bg-gradient-to-r from-brand-500/15 via-purple-500/15 to-rose-500/15 px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wider text-purple-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] dark:border-purple-400/30 dark:text-purple-300"
                      >
                        AI
                      </span>
                    )}
                  </span>
                )}
              </motion.span>
            </>
          )}
        </NavLink>

        {!collapsed && !isMobile && (
          <button
            type="button"
            onClick={() => togglePin(item.to)}
            aria-pressed={isPinned}
            aria-label={`${isPinned ? tr(t, 'nav.unpin', 'Unpin') : tr(t, 'nav.pin', 'Pin')} — ${label}`}
            title={isPinned ? tr(t, 'nav.unpin', 'Unpin') : tr(t, 'nav.pin', 'Pin')}
            className={cn(
              'absolute right-1 top-1/2 z-20 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md',
              'transition-all duration-150',
              'opacity-0 focus-visible:opacity-100 group-hover/pin:opacity-100',
              isPinned
                ? 'text-brand-500 opacity-100'
                : 'text-tertiary/70 hover:text-brand-500',
              FOCUS,
            )}
          >
            <StaticIcon paths={I.pin} size={12} />
          </button>
        )}
        </div>
      );
    },
    [
      collapsed,
      location.pathname,
      onNavigate,
      reduced,
      reducedTransparency,
      soundRef,
      t,
      trimmedFilter,
      showTip,
      hideTip,
      isMobile,
      pinnedSet,
      togglePin,
    ],
  );

  const navStyle: CSSProperties = {
    ...(isMobile ? { WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' } : undefined),
    ...MASK_STYLES[scrollMask],
  };

  return (
    <LayoutGroup id={layoutGroupId}>
      <nav
        ref={navRef}
        onScroll={handleNavScroll}
        aria-label={tr(t, 'a11y.mainNav', 'Main navigation')}
        className={cn(
          'min-h-0 flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin',
          isMobile
            ? 'overscroll-y-contain touch-pan-y [-webkit-overflow-scrolling:touch]'
            : 'scroll-smooth',
          '[scrollbar-width:thin] [scrollbar-color:rgba(150,150,150,0.2)_transparent]',
          collapsed ? 'px-2 pb-8 pt-3' : isMobile ? 'px-3 pb-12 pt-3' : 'px-3 pb-8 pt-3',
        )}
        style={navStyle}
      >
        <div>
          {isEmpty ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={LIQUID_SPRING}
              className="flex flex-col items-center gap-2.5 px-3 py-12 text-center"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-black/[0.06] bg-gradient-to-b from-white/75 to-white/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_4px_12px_rgba(0,0,0,0.04)] backdrop-blur-md dark:border-white/[0.1] dark:from-white/[0.1] dark:to-white/[0.03]">
                <StaticIcon
                  paths={I.search}
                  size={18}
                  className="text-tertiary"
                />
              </span>
              <p className="text-xs font-medium text-secondary">
                {tr(t, 'nav.noMatches', 'No matches')}
              </p>
            </motion.div>
          ) : (
            <>
              {/* Filter Match Counter Banner when searching */}
              {!collapsed && lowered && (
                <div className="mb-2 flex items-center justify-between px-3 text-[10.5px] font-medium text-tertiary">
                  <span>
                    {totalMatches} {tr(t, 'nav.resultsFound', 'found')}
                  </span>
                  <span className="text-[10px] opacity-75">↵ Enter</span>
                </div>
              )}

              {!collapsed && !isMobile && pinnedItems.length > 0 && (
                <div className="mb-3.5">
                  <p className={cn('mb-1.5', OVERLINE)}>
                    {tr(t, 'nav.pinned', 'Pinned')}
                  </p>
                  <div className="flex flex-wrap gap-1.5 px-1">
                    {pinnedItems.map((item) => {
                      const visuals = getAccentVisuals(item.accent);
                      return (
                        <NavLink
                          key={`pinned-${item.to}`}
                          to={item.to}
                          end={item.end}
                          onMouseEnter={() => preloadRoute(item.to)}
                          onFocus={() => preloadRoute(item.to)}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            togglePin(item.to);
                          }}
                          title={tr(t, 'nav.pinHint', 'Right-click to unpin')}
                          onClick={() => {
                            triggerHaptic(5);
                            soundRef.current?.playTick?.();
                            onNavigate?.();
                          }}
                          className={({ isActive }) =>
                            cn(
                              'group inline-flex min-h-[30px] max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1',
                              'text-[11.5px] font-medium tracking-tight transition-colors duration-200',
                              FOCUS,
                              isActive
                                ? cn('bg-gradient-to-b font-semibold', visuals.pill, visuals.text)
                                : cn(
                                    'border-black/[0.07] bg-white/55 text-secondary',
                                    'hover:bg-white/80 hover:text-primary',
                                    'dark:border-white/[0.1] dark:bg-white/[0.06] dark:hover:bg-white/[0.1]',
                                  ),
                            )
                          }
                        >
                          <span className={cn('shrink-0', visuals.text)}>
                            <StaticIcon paths={item.iconPath} size={12} />
                          </span>
                          <span className="truncate">
                            {tr(t, item.labelKey, item.label)}
                          </span>
                        </NavLink>
                      );
                    })}
                  </div>
                </div>
              )}

              {coreSections.map((sec, secIdx) => {
                if (sec.items.length === 0) return null;
                return (
                  <div key={sec.id} className={cn(secIdx > 0 && 'mt-4')}>
                    {collapsed ? (
                      secIdx > 0 && (
                        <div
                          className="mx-2.5 my-2.5 h-px bg-gradient-to-r from-transparent via-black/[0.08] to-transparent dark:via-white/[0.1]"
                          aria-hidden="true"
                        />
                      )
                    ) : (
                      <p className={cn('mb-1.5', OVERLINE)}>
                        {tr(t, sec.titleKey, sec.title)}
                      </p>
                    )}
                    <div className="space-y-0.5">{sec.items.map(renderItem)}</div>
                  </div>
                );
              })}

              {administration.length > 0 && (
                <div
                  className={cn(
                    'mt-4',
                    !collapsed &&
                      'border-t border-black/[0.05] pt-3 dark:border-white/[0.06]',
                  )}
                >
                  {collapsed ? (
                    <div
                      className="mx-2.5 my-2.5 h-px bg-gradient-to-r from-transparent via-black/[0.08] to-transparent dark:via-white/[0.1]"
                      aria-hidden="true"
                    />
                  ) : (
                    <p className={cn('mb-1.5', OVERLINE)}>
                      {tr(t, 'nav.administration', 'Administration')}
                    </p>
                  )}
                  <div className="space-y-0.5">
                    {administration.map(renderItem)}
                  </div>
                </div>
              )}

              {more.length > 0 && (
                <div
                  className={cn(
                    'mt-4',
                    !collapsed &&
                      'border-t border-black/[0.05] pt-2.5 dark:border-white/[0.06]',
                  )}
                >
                  {collapsed ? (
                    <div
                      className="mx-2.5 my-2.5 h-px bg-gradient-to-r from-transparent via-black/[0.08] to-transparent dark:via-white/[0.1]"
                      aria-hidden="true"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic(6);
                        soundRef.current?.playPop?.();
                        setMoreExpanded((v) => !v);
                      }}
                      aria-expanded={showMore}
                      className={cn(
                        'group flex min-h-[40px] w-full items-center justify-between rounded-xl px-3 py-2 text-[10.5px] font-semibold uppercase tracking-[0.08em]',
                        'text-tertiary transition-all duration-200 active:scale-[0.98]',
                        GLASS_BTN_HOVER,
                        'hover:text-primary',
                        FOCUS,
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <span>{tr(t, 'nav.sectionMore', 'More Modules')}</span>
                        <span className="inline-flex min-w-5 items-center justify-center rounded-full border border-black/[0.06] bg-white/60 px-1.5 py-px text-[10px] font-semibold tabular-nums text-secondary shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] dark:border-white/[0.1] dark:bg-white/[0.06]">
                          {more.length}
                        </span>
                      </span>
                      <StaticIcon
                        paths={I.chevronDown}
                        size={14}
                        className={cn(
                          'transition-transform duration-300 ease-out motion-reduce:transition-none',
                          showMore && 'rotate-180 text-brand-500',
                        )}
                      />
                    </button>
                  )}

                  <div
                    aria-hidden={!showMore}
                    {...(!showMore ? { inert: '' } : {})}
                    className={cn(
                      'grid transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
                      showMore
                        ? 'grid-rows-[1fr] opacity-100'
                        : 'invisible grid-rows-[0fr] opacity-0',
                    )}
                  >
                    <div className="overflow-hidden">
                      <div className="mt-1 space-y-0.5">{more.map(renderItem)}</div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </nav>

      {/* ── Liquid Glass Floating Tooltip (Collapsed Rail) ── */}
      <AnimatePresence>
        {collapsed && railTip && (
          <motion.div
            key={railTip.label}
            initial={{ opacity: 0, x: -6, scale: 0.94 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -4, scale: 0.96 }}
            transition={reduced ? { duration: 0 } : HOVER_SPRING}
            style={{ top: railTip.top, left: railTip.left }}
            className={cn(
              'pointer-events-none fixed z-[100] flex -translate-y-1/2 items-center gap-2 rounded-xl px-3 py-1.5',
              'text-xs font-semibold tracking-tight text-primary',
              'border border-white/55 bg-white/85 backdrop-blur-2xl backdrop-saturate-[200%]',
              'dark:border-white/[0.16] dark:bg-[#18181B]/90',
              'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.85),0_10px_28px_-6px_rgba(0,0,0,0.18)]',
              'dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.18),0_10px_30px_-6px_rgba(0,0,0,0.58)]',
            )}
            role="tooltip"
          >
            <span
              aria-hidden="true"
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                getAccentVisuals(railTip.accent).dot,
              )}
            />
            {railTip.label}
          </motion.div>
        )}
      </AnimatePresence>
    </LayoutGroup>
  );
});
NavItems.displayName = 'NavItems';

/* ══════════════════════════════════════════════════════════════════════
 * Sidebar — iOS 27 Apple Liquid Glass Studio Rail
 * ════════════════════════════════════════════════════════════════════ */

export interface SidebarProps {
  sidebarWidth: number;
  collapsed: boolean;
  setCollapsed: (v: boolean | ((p: boolean) => boolean)) => void;
  isWide: boolean;
  orgName: string;
  userRole: string;
  onLogout: () => void;
}

interface CachedSidebarRect {
  left: number;
  top: number;
}

export const Sidebar = memo(function Sidebar({
  sidebarWidth,
  collapsed,
  setCollapsed,
  isWide,
  orgName,
  userRole,
  onLogout,
}: SidebarProps) {
  const { t } = useSafeI18n();
  const navigate = useNavigate();
  const soundRef = useStableSound();
  const reduced = usePrefersReducedMotion();
  const reducedTransparency = useMediaQuery(
    '(prefers-reduced-transparency: reduce)',
  );

  const [navFilter, setNavFilter] = useState('');
  const filterInputRef = useRef<HTMLInputElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const rectRef = useRef<CachedSidebarRect | null>(null);
  const spotRafRef = useRef<number | null>(null);
  const spotPointRef = useRef<{ x: number; y: number } | null>(null);

  const roleLabel = useRoleLabel(userRole);

  // Invalidate cached bounding rect when sidebar width/collapsed state or window changes
  useEffect(() => {
    rectRef.current = null;
    const invalidate = () => {
      rectRef.current = null;
    };
    window.addEventListener('resize', invalidate, { passive: true });
    return () => {
      window.removeEventListener('resize', invalidate);
      if (spotRafRef.current !== null) cancelAnimationFrame(spotRafRef.current);
    };
  }, [collapsed, sidebarWidth]);

  /* ── Zero-Layout-Thrash Cursor Spotlight & Specular Rail Edge Tracker ── */
  const handlePointerEnter = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (reduced || reducedTransparency || !surfaceRef.current) return;
      const r = surfaceRef.current.getBoundingClientRect();
      rectRef.current = { left: r.left, top: r.top };
      surfaceRef.current.style.setProperty('--sb-spot-x', `${(e.clientX - r.left).toFixed(0)}px`);
      surfaceRef.current.style.setProperty('--sb-spot-y', `${(e.clientY - r.top).toFixed(0)}px`);
      surfaceRef.current.style.setProperty('--sb-spot-opacity', '1');
    },
    [reduced, reducedTransparency],
  );

  /** Write the spotlight once per animation frame — never per pointermove. */
  const applySpotlight = useCallback(() => {
    spotRafRef.current = null;
    const node = surfaceRef.current;
    const point = spotPointRef.current;
    if (!node || !point) return;
    if (!rectRef.current) {
      const r = node.getBoundingClientRect();
      rectRef.current = { left: r.left, top: r.top };
    }
    const { left, top } = rectRef.current;
    node.style.setProperty('--sb-spot-x', `${Math.round(point.x - left)}px`);
    node.style.setProperty('--sb-spot-y', `${Math.round(point.y - top)}px`);
    node.style.setProperty('--sb-spot-opacity', '1');
  }, []);

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (reduced || reducedTransparency) return;
      spotPointRef.current = { x: e.clientX, y: e.clientY };
      if (spotRafRef.current !== null) return;
      spotRafRef.current = requestAnimationFrame(applySpotlight);
    },
    [reduced, reducedTransparency, applySpotlight],
  );

  const handlePointerLeave = useCallback(() => {
    surfaceRef.current?.style.setProperty('--sb-spot-opacity', '0');
  }, []);

  /* ── Compute First Matching Route for Quick-Jump (`Enter` in filter) ── */
  const firstMatchingRoute = useMemo(() => {
    const q = navFilter.trim().toLowerCase();
    if (!q) return null;
    return (
      ALL_NAV_LIST.find((item) => {
        if (!isRouteAllowedForRole(item.to, userRole)) return false;
        const localized = tr(t, item.labelKey, item.label).toLowerCase();
        return (
          localized.includes(q) ||
          item.label.toLowerCase().includes(q) ||
          item.to.toLowerCase().includes(q)
        );
      }) ?? null
    );
  }, [navFilter, userRole, t]);

  /* ── Global Sidebar Keyboard Shortcuts: `⌘B` / `Ctrl+B` (toggle) & `Alt + /` (filter) ── */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const hasOpenModal = Boolean(
        document.querySelector(
          '[role="dialog"][data-state="open"], [role="dialog"]:not([aria-hidden="true"])',
        ),
      );
      if (hasOpenModal) return;

      // ⌘B lives in AppLayout — the shell must own the collapse state.
      // (Two handlers on the same functional setter used to cancel each other
      // out, so ⌘B silently did nothing.)
      //
      // Alt + / focuses the sidebar filter input when expanded
      if (!collapsed && e.key === '/' && e.altKey && !e.metaKey && !e.ctrlKey) {
        const el = e.target as HTMLElement | null;
        if (
          el?.tagName === 'INPUT' ||
          el?.tagName === 'TEXTAREA' ||
          el?.tagName === 'SELECT' ||
          el?.isContentEditable
        ) {
          return;
        }
        e.preventDefault();
        filterInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [collapsed]);

  const clearFilter = useCallback(() => {
    setNavFilter('');
    filterInputRef.current?.focus();
  }, []);

  const handleFilterKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (navFilter) clearFilter();
        else filterInputRef.current?.blur();
        return;
      }
      if (e.key === 'Enter' && firstMatchingRoute) {
        e.preventDefault();
        triggerHaptic(8);
        soundRef.current?.playTick?.();
        navigate(firstMatchingRoute.to);
        setNavFilter('');
        filterInputRef.current?.blur();
      }
    },
    [navFilter, clearFilter, firstMatchingRoute, navigate, soundRef],
  );

  const toggleRail = useCallback(() => {
    triggerHaptic(6);
    soundRef.current?.playPop?.();
    setCollapsed((prev) => !prev);
  }, [setCollapsed, soundRef]);

  const logoutLabel = tr(t, 'nav.logout', 'Log out');
  const placeholder = tr(t, 'nav.filterPlaceholder', 'Filter…');

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarWidth }}
      transition={reduced ? { duration: 0 } : SPRING.smooth}
      className="fixed inset-y-0 left-0 z-[35] hidden flex-col select-none md:flex"
    >
      <div
        ref={surfaceRef}
        onPointerEnter={handlePointerEnter}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        style={
          {
            '--sb-spot-x': '50%',
            '--sb-spot-y': '20%',
            '--sb-spot-opacity': '0',
          } as CSSProperties
        }
        className={cn(
          'group/sidebar relative isolate flex h-full min-h-0 flex-col overflow-hidden',
          'border-r border-black/[0.07] dark:border-white/[0.09]',
          reducedTransparency
            ? 'bg-[var(--bg-card)]'
            : cn(
                'bg-[var(--glass-surface-bg)] backdrop-blur-3xl backdrop-saturate-[205%]',
                'shadow-[inset_-1px_0_0_0_rgba(255,255,255,0.45),inset_0_1px_0_0_rgba(255,255,255,0.6),8px_0_32px_-12px_rgba(0,0,0,0.08)]',
                'dark:shadow-[inset_-1px_0_0_0_rgba(255,255,255,0.09),inset_0_1px_0_0_rgba(255,255,255,0.14),12px_0_36px_-12px_rgba(0,0,0,0.52)]',
              ),
        )}
      >
        {/* ── 1. iOS 27 Dynamic Cursor Caustic Spotlight + Specular Right Rail Edge ── */}
        {!reducedTransparency && (
          <>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 -z-10 transition-opacity duration-500"
              style={{
                opacity: 'var(--sb-spot-opacity, 0)',
                background:
                  'radial-gradient(340px circle at var(--sb-spot-x, 50%) var(--sb-spot-y, 20%), rgba(10, 132, 255, 0.08), rgba(94, 92, 230, 0.035) 45%, transparent 75%)',
              }}
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 z-20 w-px transition-opacity duration-300"
              style={{
                opacity: 'var(--sb-spot-opacity, 0)',
                background:
                  'radial-gradient(180px circle at 100% var(--sb-spot-y, 20%), rgba(255, 255, 255, 0.95), rgba(90, 200, 250, 0.55) 45%, transparent 85%)',
              }}
            />
          </>
        )}

        {/* ── 2. Top Liquid Specular Rim Highlight ── */}
        {!reducedTransparency && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 z-20 h-px bg-gradient-to-r from-transparent via-white/85 to-transparent dark:via-white/28"
          />
        )}

        {/* ── 3. Interactive Right-Edge Specular Collapse Strip (Click, Double-Click or Keyboard) ── */}
        {isWide && (
          <div
            role="separator"
            tabIndex={0}
            aria-orientation="vertical"
            aria-expanded={!collapsed}
            aria-label={
              collapsed
                ? tr(t, 'nav.expand', 'Expand sidebar')
                : tr(t, 'nav.collapse', 'Collapse sidebar')
            }
            title={
              collapsed
                ? `${tr(t, 'nav.expand', 'Expand sidebar')} (⌘B)`
                : `${tr(t, 'nav.collapse', 'Collapse sidebar')} (⌘B)`
            }
            onClick={toggleRail}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleRail();
              }
            }}
            className={cn(
              'group/strip absolute inset-y-0 right-0 z-30 flex w-2 cursor-ew-resize items-center justify-end outline-none',
              'focus-visible:bg-brand-500/30',
            )}
          >
            <span
              aria-hidden="true"
              className="h-full w-[2px] bg-transparent transition-colors duration-200 group-hover/strip:bg-brand-500/45 group-active/strip:bg-brand-500/75"
            />
          </div>
        )}

        {/* ── 4. Header: Brand + Collapse Button ── */}
        <div
          className={cn(
            'relative z-10 flex h-16 shrink-0 items-center border-b border-black/[0.05] dark:border-white/[0.06]',
            collapsed ? 'justify-center px-2' : 'justify-between px-4',
          )}
        >
          <Brand compact={collapsed} />
          {!collapsed && (
            <motion.button
              type="button"
              whileTap={reduced ? undefined : { scaleX: 1.06, scaleY: 0.9 }}
              transition={GEL_SPRING}
              onClick={() => {
                triggerHaptic(6);
                soundRef.current?.playPop?.();
                setCollapsed(true);
              }}
              aria-label={tr(t, 'nav.collapse', 'Collapse sidebar')}
              aria-keyshortcuts="Meta+B Control+B"
              title={`${tr(t, 'nav.collapse', 'Collapse sidebar')} (⌘B)`}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-xl text-secondary',
                'transition-colors duration-200',
                GLASS_BTN_HOVER,
                'hover:text-primary',
                FOCUS,
              )}
            >
              <StaticIcon paths={I.collapse} size={16} />
            </motion.button>
          )}
        </div>

        {/* ── 5. Collapsed Rail: Liquid Expand Handle ── */}
        {collapsed && isWide && (
          <div className="relative z-10 shrink-0 px-2 pt-2.5">
            <motion.button
              type="button"
              whileTap={reduced ? undefined : { scaleX: 1.06, scaleY: 0.9 }}
              transition={GEL_SPRING}
              onClick={() => {
                triggerHaptic(6);
                soundRef.current?.playPop?.();
                setCollapsed(false);
              }}
              aria-label={tr(t, 'nav.expand', 'Expand sidebar')}
              aria-keyshortcuts="Meta+B Control+B"
              title={`${tr(t, 'nav.expand', 'Expand sidebar')} (⌘B)`}
              className={cn(
                'flex min-h-[44px] w-full items-center justify-center rounded-xl border border-black/[0.06] bg-white/50 py-2 text-secondary',
                'shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-md',
                'dark:border-white/[0.08] dark:bg-white/[0.045] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]',
                'transition-colors duration-200',
                GLASS_BTN_HOVER,
                'hover:text-primary',
                FOCUS,
              )}
            >
              <StaticIcon paths={I.expand} size={16} />
            </motion.button>
          </div>
        )}

        {/* ── 6. Org Identity Card + Recessed Search Well + Recent Routes ── */}
        {!collapsed && (
          <>
            <div className="relative z-10 shrink-0 border-b border-black/[0.05] px-4 py-3 dark:border-white/[0.06]">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-semibold tracking-tight text-primary">
                  {orgName || 'M-EDU Academy'}
                </p>
                <span
                  className="relative flex h-2.5 w-2.5 shrink-0 items-center justify-center"
                  aria-hidden="true"
                >
                  <span className="absolute inline-flex h-full w-full rounded-full bg-apple-green opacity-60 motion-safe:animate-ping" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-apple-green shadow-[0_0_8px_rgba(52,199,89,0.85)]" />
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="inline-flex items-center rounded-full border border-black/[0.06] bg-black/[0.03] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.07em] text-tertiary dark:border-white/[0.08] dark:bg-white/[0.04]">
                  {roleLabel || 'member'}
                </span>
              </div>
            </div>

            {/* ── Recessed Liquid Glass Filter Input ── */}
            <div className="relative z-10 shrink-0 px-3 pt-3">
              <div className="group relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tertiary transition-colors duration-200 group-focus-within:text-brand-500">
                  <StaticIcon paths={I.search} size={15} />
                </span>
                <input
                  ref={filterInputRef}
                  type="text"
                  role="searchbox"
                  value={navFilter}
                  onChange={(e) => setNavFilter(e.target.value)}
                  onKeyDown={handleFilterKeyDown}
                  placeholder={placeholder}
                  aria-label={placeholder}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  className={cn(
                    'h-9 w-full rounded-xl pl-9 pr-9',
                    'border border-black/[0.07] bg-black/[0.035] dark:border-white/[0.09] dark:bg-white/[0.045]',
                    'shadow-[inset_0_1px_2px_rgba(0,0,0,0.04),0_1px_0_rgba(255,255,255,0.65)]',
                    'dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.28),0_1px_0_rgba(255,255,255,0.06)]',
                    'text-[13px] text-primary placeholder:text-placeholder',
                    'outline-none backdrop-blur-md transition-all duration-200',
                    'focus:border-brand-500/50 focus:bg-white/85 focus:shadow-[inset_0_1px_1px_rgba(0,0,0,0.02),0_0_0_3.5px_var(--focus-ring)]',
                    'dark:focus:bg-white/[0.1]',
                  )}
                />
                {navFilter ? (
                  <button
                    type="button"
                    onClick={clearFilter}
                    aria-label={tr(t, 'common.clear', 'Clear')}
                    className={cn(
                      'absolute right-1.5 top-1/2 flex h-7 w-7 min-h-[32px] min-w-[32px] -translate-y-1/2 items-center justify-center rounded-full',
                      'text-tertiary transition-all duration-150 active:scale-90',
                      GLASS_BTN_HOVER,
                      'hover:text-primary',
                      FOCUS,
                    )}
                  >
                    <StaticIcon paths={I.close} size={12} strokeWidth={2} />
                  </button>
                ) : (
                  <kbd
                    aria-hidden="true"
                    className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg border border-black/[0.07] bg-white/65 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-tertiary shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_1px_2px_rgba(0,0,0,0.04)] dark:border-white/[0.1] dark:bg-white/[0.07] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
                  >
                    ⌥/
                  </kbd>
                )}
              </div>
            </div>

            {!navFilter && <RecentRoutes role={userRole} />}
          </>
        )}

        {/* ── 7. Navigation Tree ── */}
        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          <NavItems
            role={userRole}
            collapsed={collapsed}
            filter={navFilter}
          />
        </div>

        {/* ── 8. Footer: Liquid Tactile Log Out ── */}
        <div className="relative z-10 shrink-0 border-t border-black/[0.05] p-3 dark:border-white/[0.06]">
          <motion.button
            type="button"
            whileTap={reduced ? undefined : { scaleX: 1.03, scaleY: 0.95 }}
            transition={GEL_SPRING}
            onClick={() => {
              triggerHaptic([8, 24, 12]);
              soundRef.current?.playTick?.();
              onLogout();
            }}
            aria-label={collapsed ? logoutLabel : undefined}
            title={collapsed ? logoutLabel : undefined}
            className={cn(
              'group flex min-h-[44px] w-full items-center rounded-xl font-medium transition-colors duration-200',
              collapsed
                ? 'min-w-[44px] justify-center px-2 py-2.5'
                : 'gap-3 px-3 py-2 text-[13.5px]',
              'text-secondary',
              'hover:bg-gradient-to-b hover:from-apple-red/15 hover:to-apple-red/5 hover:text-apple-red',
              'hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_2px_8px_-2px_rgba(255,59,48,0.24)]',
              'dark:hover:from-apple-red/20 dark:hover:to-apple-red/10',
              FOCUS,
            )}
          >
            <span className="transition-transform duration-200 group-hover:-translate-x-0.5">
              <StaticIcon paths={I.logout} size={18} />
            </span>
            {!collapsed && <span>{logoutLabel}</span>}
          </motion.button>
        </div>
      </div>
    </motion.aside>
  );
});
Sidebar.displayName = 'Sidebar';
