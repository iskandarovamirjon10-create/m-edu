/**
 * M-EDU Sidebar & Navigation Registry — V2.0 "Liquid Glass Studio — Ultra Edition".
 * ============================================================================
 * Visual & Spatial Upgrades (V2):
 *   • Dynamic Cursor Spotlight Engine: Tracks pointer coordinates (`--sb-spot-x`,
 *     `--sb-spot-y`) to cast a subtle refractive glow across the glass rail.
 *   • Accent-Aware Liquid Capsules: Active pills, luminous left indicator bars,
 *     and Recent Route dots dynamically adapt to each route's `AccentKey`
 *     (including a special prismatic holographic glow for `AI Copilot`).
 *   • Dynamic Scroll Edge Masking: Smooth top/bottom fade masks appear
 *     automatically when the navigation tree overflows.
 *   • Quick-Jump Filter (`Enter` key): Press `Alt + /` to filter, then press
 *     `Enter` to immediately navigate to the top matching module. (Plain `/`
 *     stays reserved for the global command-bar search.)
 *   • Right-Edge Interactive Resize/Toggle Strip: Double-click or click the
 *     specular right border to effortlessly toggle rail collapse.
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
import { StaticIcon, PremiumIcon, I, type IconPaths } from './Icons';
import { usePremiumSound } from '@/hooks/usePremiumSound';

/* ══════════════════════════════════════════════════════════════════════
 * V2 LIQUID GLASS, ACCENT & SPRING TOKENS
 * ════════════════════════════════════════════════════════════════════ */

const FOCUS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--border-focus)]';

/** Subtle tactile 3D glass hover for standalone controls */
const GLASS_BTN_HOVER =
  'hover:bg-white/60 dark:hover:bg-white/[0.08] hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.65),0_2px_8px_-2px_rgba(0,0,0,0.06)] dark:hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),0_2px_8px_-2px_rgba(0,0,0,0.35)]';

const OVERLINE =
  'px-3 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]/80 select-none';

/** Ultra-smooth liquid spring physics */
const LIQUID_SPRING = {
  type: 'spring' as const,
  stiffness: 440,
  damping: 33,
  mass: 0.72,
};

const HOVER_SPRING = {
  type: 'spring' as const,
  stiffness: 520,
  damping: 36,
  mass: 0.58,
};

/** V2 Accent-aware optical styling for active capsules & indicators */
interface AccentVisuals {
  readonly pill: string;
  readonly bar: string;
  readonly text: string;
  readonly dot: string;
}

const ACCENT_VISUAL_MAP: Record<string, AccentVisuals> = {
  blue: {
    pill: 'from-brand-500/[0.17] via-brand-500/[0.10] to-brand-500/[0.05] dark:from-brand-400/[0.22] dark:via-brand-500/[0.14] dark:to-brand-500/[0.07] border-brand-500/25 dark:border-brand-400/30 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.6),0_4px_14px_-3px_rgba(10,132,255,0.22)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.22),0_4px_16px_-3px_rgba(10,132,255,0.35)]',
    bar: 'from-brand-400 to-brand-600 shadow-[0_0_10px_rgba(10,132,255,0.85)]',
    text: 'text-brand-600 dark:text-brand-300',
    dot: 'bg-brand-500 shadow-[0_0_6px_rgba(10,132,255,0.75)]',
  },
  purple: {
    pill: 'from-purple-500/[0.17] via-purple-500/[0.10] to-purple-500/[0.05] dark:from-purple-400/[0.22] dark:via-purple-500/[0.14] dark:to-purple-500/[0.07] border-purple-500/25 dark:border-purple-400/30 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.6),0_4px_14px_-3px_rgba(175,82,222,0.22)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.22),0_4px_16px_-3px_rgba(191,90,242,0.35)]',
    bar: 'from-purple-400 to-purple-600 shadow-[0_0_10px_rgba(191,90,242,0.85)]',
    text: 'text-purple-600 dark:text-purple-300',
    dot: 'bg-purple-500 shadow-[0_0_6px_rgba(191,90,242,0.75)]',
  },
  pink: {
    pill: 'from-rose-500/[0.17] via-rose-500/[0.10] to-rose-500/[0.05] dark:from-rose-400/[0.22] dark:via-rose-500/[0.14] dark:to-rose-500/[0.07] border-rose-500/25 dark:border-rose-400/30 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.6),0_4px_14px_-3px_rgba(255,55,95,0.22)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.22),0_4px_16px_-3px_rgba(255,55,95,0.36)]',
    bar: 'from-rose-400 to-rose-600 shadow-[0_0_10px_rgba(255,55,95,0.85)]',
    text: 'text-rose-600 dark:text-rose-300',
    dot: 'bg-rose-500 shadow-[0_0_6px_rgba(255,55,95,0.75)]',
  },
  green: {
    pill: 'from-emerald-500/[0.16] via-emerald-500/[0.10] to-emerald-500/[0.05] dark:from-emerald-400/[0.22] dark:via-emerald-500/[0.14] dark:to-emerald-500/[0.07] border-emerald-500/25 dark:border-emerald-400/30 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.6),0_4px_14px_-3px_rgba(52,199,89,0.22)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.22),0_4px_16px_-3px_rgba(48,209,88,0.34)]',
    bar: 'from-emerald-400 to-emerald-600 shadow-[0_0_10px_rgba(52,199,89,0.85)]',
    text: 'text-emerald-600 dark:text-emerald-300',
    dot: 'bg-emerald-500 shadow-[0_0_6px_rgba(52,199,89,0.75)]',
  },
  orange: {
    pill: 'from-amber-500/[0.17] via-amber-500/[0.10] to-amber-500/[0.05] dark:from-amber-400/[0.22] dark:via-amber-500/[0.14] dark:to-amber-500/[0.07] border-amber-500/25 dark:border-amber-400/30 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.6),0_4px_14px_-3px_rgba(255,149,0,0.22)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.22),0_4px_16px_-3px_rgba(255,159,10,0.35)]',
    bar: 'from-amber-400 to-orange-500 shadow-[0_0_10px_rgba(255,149,0,0.85)]',
    text: 'text-amber-600 dark:text-amber-300',
    dot: 'bg-amber-500 shadow-[0_0_6px_rgba(255,149,0,0.75)]',
  },
  rainbow: {
    pill: 'from-brand-500/[0.18] via-purple-500/[0.14] to-rose-500/[0.12] dark:from-brand-400/[0.24] dark:via-purple-500/[0.18] dark:to-rose-500/[0.14] border-purple-500/30 dark:border-purple-400/35 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.65),0_4px_16px_-3px_rgba(175,82,222,0.28)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.24),0_4px_18px_-3px_rgba(191,90,242,0.42)]',
    bar: 'from-brand-400 via-purple-500 to-rose-500 shadow-[0_0_12px_rgba(191,90,242,0.9)]',
    text: 'text-purple-600 dark:text-purple-300',
    dot: 'bg-gradient-to-tr from-brand-500 via-purple-500 to-rose-500 shadow-[0_0_8px_rgba(191,90,242,0.8)]',
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

export const HIDDEN_FOR_STUDENT = new Set<string>([
  '/teacher-cockpit',
  '/teachers', '/users', '/expenses', '/cameras', '/audit', '/settings',
  '/homework', '/leads', '/hr', '/inventory', '/invoices', '/reports',
  '/executive-dashboard', '/financial-analytics', '/payroll-analytics',
  '/crm-analytics', '/parent-portal', '/payroll', '/automation',
  '/follow-up-automation', '/branches', '/anomaly-detection',
  '/data-governance', '/ai-copilot', '/early-warning', '/telegram',
]);

export const ALL_ITEMS_MAP = new Map<string, NavItem>(
  [...PRIMARY_NAV, ...SECONDARY_NAV].map((i) => [i.to, i]),
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
    if (!ALL_ITEMS_MAP.has(pathname)) return;
    setRecent((prev) => {
      if (prev[0] === pathname) return prev;
      return [pathname, ...prev.filter((p) => p !== pathname)].slice(0, limit);
    });
  }, [pathname, limit, setRecent]);

  return recent;
}

function useRoleLabel(role: string): string {
  return useMemo(() => (role ?? '').replace(/_/g, ' ').toLowerCase(), [role]);
}

/** Highlights all case-insensitive occurrences or first match of `query` inside `text`. */
function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded-[4px] bg-brand-500/20 px-1 py-px font-semibold text-brand-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] dark:bg-brand-400/25 dark:text-brand-300">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════
 * RecentRoutes — V2 Liquid Glass Quick Pills (Accent-Synchronized)
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
  const isStudent = role.toUpperCase() === 'STUDENT';

  const items = useMemo(
    () =>
      recent
        .filter((p) => !(isStudent && HIDDEN_FOR_STUDENT.has(p)))
        .map((p) => ALL_ITEMS_MAP.get(p))
        .filter((x): x is NavItem => Boolean(x)),
    [recent, isStudent],
  );

  const sound = usePremiumSound();

  if (items.length === 0) return null;

  return (
    <div className="relative z-10 shrink-0 border-b border-black/[0.05] px-4 py-2.5 dark:border-white/[0.06]">
      <div className="mb-1.5 flex items-center justify-between px-0.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]/80">
          {t('nav.recent', 'Recent')}
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
              onClick={() => {
                sound.playTick();
                onNavigate?.();
              }}
              className={({ isActive }) =>
                cn(
                  'group relative inline-flex max-w-[146px] items-center gap-1.5 rounded-full px-2.5 py-1 min-h-[28px]',
                  'text-[11px] font-medium transition-all duration-200 active:scale-[0.95]',
                  'backdrop-blur-md',
                  FOCUS,
                  isActive
                    ? cn(
                        'border bg-gradient-to-b font-semibold',
                        visuals.pill,
                        visuals.text,
                      )
                    : cn(
                        'border border-black/[0.06] bg-white/45 text-[var(--text-secondary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]',
                        'dark:border-white/[0.08] dark:bg-white/[0.04] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]',
                        'hover:border-black/[0.12] hover:bg-white/75 hover:text-[var(--text-primary)] dark:hover:bg-white/[0.09]',
                      ),
                )
              }
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 shrink-0 rounded-full transition-transform duration-200 group-hover:scale-125',
                  visuals.dot,
                )}
                aria-hidden="true"
              />
              <span className="truncate">{t(item.labelKey, item.label)}</span>
            </NavLink>
          );
        })}
      </div>
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════════════
 * NavItems — V2 Fluid Sectioned Tree + Shared Layout Liquid Capsules
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
  const navRef = useRef<HTMLElement | null>(null);

  useKeyboardNav(navRef, !collapsed && !isMobile);

  const isStudent = (role?.toUpperCase() ?? '') === 'STUDENT';
  const trimmedFilter = filter.trim();
  const lowered = trimmedFilter.toLowerCase();
  const sound = usePremiumSound();

  const [moreExpanded, setMoreExpanded] = usePersistedState<boolean>(
    'm-edu.sidebar-more-expanded',
    false,
  );
  const [railTip, setRailTip] = useState<RailTooltipState | null>(null);
  const [scrollMask, setScrollMask] = useState<'none' | 'bottom' | 'top' | 'both'>('bottom');

  const tipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setRailTip(null);
    return () => {
      if (tipTimeoutRef.current) clearTimeout(tipTimeoutRef.current);
    };
  }, [collapsed, location.pathname]);

  const isMoreRouteActive = useMemo(
    () => MORE_NAV.some((item) => item.to === location.pathname),
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
      if (isStudent && HIDDEN_FOR_STUDENT.has(item.to)) return false;
      if (!lowered) return true;
      const localized = t(item.labelKey, item.label).toLowerCase();
      return (
        localized.includes(lowered) ||
        item.label.toLowerCase().includes(lowered) ||
        item.to.toLowerCase().includes(lowered)
      );
    };

    const m = MANAGEMENT_NAV.filter(match);
    const ac = ACADEMIC_NAV.filter(match);
    const fn = FINANCE_NAV.filter(match);
    const cm = COMMUNICATION_NAV.filter(match);
    const ad = ADMINISTRATION_NAV.filter(match);
    const mr = MORE_NAV.filter(match);
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
  }, [isStudent, lowered, t]);

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

  const hideTip = useCallback(() => {
    if (tipTimeoutRef.current) clearTimeout(tipTimeoutRef.current);
    setRailTip(null);
  }, []);

  /** Dynamic Scroll Mask calculation + Tooltip hide on scroll */
  const handleNavScroll = useCallback(() => {
    hideTip();
    const el = navRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const canScrollUp = scrollTop > 8;
    const canScrollDown = scrollTop + clientHeight < scrollHeight - 8;

    if (canScrollUp && canScrollDown) setScrollMask('both');
    else if (canScrollUp) setScrollMask('top');
    else if (canScrollDown) setScrollMask('bottom');
    else setScrollMask('none');
  }, [hideTip]);

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
      const label = t(item.labelKey, item.label);
      const visuals = getAccentVisuals(item.accent);
      const isAiCopilot = item.to === '/ai-copilot';

      return (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={() => {
            sound.playTick();
            onNavigate?.();
          }}
          onMouseEnter={(e) => showTip(e, label, item.accent)}
          onMouseLeave={hideTip}
          onFocus={(e) => showTip(e, label, item.accent)}
          onBlur={hideTip}
          aria-label={collapsed ? label : undefined}
          className={({ isActive }) =>
            cn(
              'group relative flex items-center rounded-xl transition-transform duration-150 ease-out active:scale-[0.97]',
              collapsed
                ? 'min-h-[44px] min-w-[44px] justify-center px-2 py-2.5'
                : 'min-h-[40px] gap-3 px-3 py-2',
              FOCUS,
              isActive
                ? cn('font-semibold', visuals.text)
                : 'font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
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
                  'bg-gradient-to-b from-white/65 to-white/25 dark:from-white/[0.08] dark:to-white/[0.025]',
                  'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.75),0_1px_3px_rgba(0,0,0,0.03)]',
                  'dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12),0_1px_3px_rgba(0,0,0,0.22)]',
                  isActive ? 'opacity-0' : 'opacity-0 group-hover:opacity-100',
                )}
              />

              {/* ── 2. Liquid Floating Active Glass Pill (Accent-Adaptive) ── */}
              {isActive && (
                <motion.span
                  layoutId={isMobile ? undefined : 'sidebar-liquid-active'}
                  layoutDependency={location.pathname}
                  transition={reduced ? { duration: 0 } : LIQUID_SPRING}
                  aria-hidden="true"
                  className={cn(
                    'pointer-events-none absolute inset-0 z-0 rounded-xl border bg-gradient-to-b',
                    visuals.pill,
                  )}
                />
              )}

              {/* ── 3. Luminous Left Laser Indicator ── */}
              {isActive && (
                <motion.span
                  layoutId={isMobile ? undefined : 'sidebar-liquid-bar'}
                  layoutDependency={location.pathname}
                  transition={reduced ? { duration: 0 } : LIQUID_SPRING}
                  aria-hidden="true"
                  className={cn(
                    'pointer-events-none absolute left-0 top-1/2 z-10 h-5 w-[3px] -translate-y-1/2 rounded-full bg-gradient-to-b',
                    visuals.bar,
                  )}
                />
              )}

              {/* ── 4. Icon with Magnetic Lift ── */}
              <span className="relative z-10 flex shrink-0 items-center justify-center transition-transform duration-200 ease-out group-hover:scale-[1.07]">
                <PremiumIcon
                  paths={item.iconPath}
                  isActive={isActive}
                  accent={item.accent}
                  size={18}
                />
              </span>

              {/* ── 5. Label + Optional AI Studio Shimmer Badge ── */}
              {!collapsed && (
                <span className="relative z-10 flex min-w-0 flex-1 items-center justify-between gap-2">
                  <span className="truncate text-[13.5px] tracking-[-0.01em]">
                    <HighlightMatch text={label} query={trimmedFilter} />
                  </span>
                  {isAiCopilot && (
                    <span
                      aria-hidden="true"
                      className="shrink-0 rounded-full border border-purple-500/25 bg-gradient-to-r from-brand-500/15 via-purple-500/15 to-rose-500/15 px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wider text-purple-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] dark:border-purple-400/30 dark:text-purple-300"
                    >
                      AI
                    </span>
                  )}
                </span>
              )}
            </>
          )}
        </NavLink>
      );
    },
    [
      collapsed,
      isMobile,
      location.pathname,
      onNavigate,
      reduced,
      sound,
      t,
      trimmedFilter,
      showTip,
      hideTip,
    ],
  );

  return (
    <LayoutGroup id={layoutGroupId}>
      <nav
        ref={navRef}
        onScroll={handleNavScroll}
        aria-label={t('a11y.mainNav', 'Main navigation')}
        className={cn(
          'min-h-0 flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin',
          isMobile
            ? 'overscroll-y-contain touch-pan-y [-webkit-overflow-scrolling:touch]'
            : 'scroll-smooth',
          '[scrollbar-width:thin] [scrollbar-color:rgba(150,150,150,0.2)_transparent]',
          collapsed ? 'px-2 pt-3 pb-8' : isMobile ? 'px-3 pt-3 pb-12' : 'px-3 pt-3 pb-8',
          scrollMask === 'both' &&
            '[mask-image:linear-gradient(to_bottom,transparent_0%,black_16px,black_calc(100%-20px),transparent_100%)]',
          scrollMask === 'top' &&
            '[mask-image:linear-gradient(to_bottom,transparent_0%,black_16px,black_100%)]',
          scrollMask === 'bottom' &&
            '[mask-image:linear-gradient(to_bottom,black_0%,black_calc(100%-20px),transparent_100%)]',
        )}
        style={
          isMobile
            ? { WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }
            : undefined
        }
      >
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
                className="text-[var(--text-tertiary)]"
              />
            </span>
            <p className="text-xs font-medium text-[var(--text-secondary)]">
              {t('nav.noMatches', 'No matches')}
            </p>
          </motion.div>
        ) : (
          <>
            {/* Filter Match Counter Banner when searching */}
            {!collapsed && lowered && (
              <div className="mb-2 flex items-center justify-between px-3 text-[10.5px] font-medium text-[var(--text-tertiary)]">
                <span>
                  {totalMatches} {t('nav.resultsFound', 'found')}
                </span>
                <span className="text-[10px] opacity-75">↵ Enter</span>
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
                      {t(sec.titleKey, sec.title)}
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
                    {t('nav.administration', 'Administration')}
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
                      sound.playPop();
                      setMoreExpanded((v) => !v);
                    }}
                    aria-expanded={showMore}
                    className={cn(
                      'group flex w-full min-h-[40px] items-center justify-between rounded-xl px-3 py-2 text-[10.5px] font-semibold uppercase tracking-[0.08em]',
                      'text-[var(--text-tertiary)] transition-all duration-200',
                      GLASS_BTN_HOVER,
                      'hover:text-[var(--text-primary)]',
                      FOCUS,
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span>{t('nav.sectionMore', 'More Modules')}</span>
                      <span className="inline-flex min-w-5 items-center justify-center rounded-full border border-black/[0.06] bg-white/55 px-1.5 py-px text-[10px] font-semibold tabular-nums text-[var(--text-secondary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] dark:border-white/[0.1] dark:bg-white/[0.06]">
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
              'text-xs font-semibold tracking-tight text-[var(--text-primary)]',
              'border border-white/45 bg-white/85 backdrop-blur-2xl backdrop-saturate-[200%]',
              'dark:border-white/[0.16] dark:bg-[#18181B]/90',
              'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.75),0_10px_28px_-6px_rgba(0,0,0,0.18)]',
              'dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.16),0_10px_30px_-6px_rgba(0,0,0,0.58)]',
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

/* ══════════════════════════════════════════════════════════════════════
 * Sidebar — V2 Apple Liquid Glass Studio Rail
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
  const sound = usePremiumSound();
  const reduced = usePrefersReducedMotion();
  const reducedTransparency = useMediaQuery(
    '(prefers-reduced-transparency: reduce)',
  );

  const [navFilter, setNavFilter] = useState('');
  const filterInputRef = useRef<HTMLInputElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const roleLabel = useRoleLabel(userRole);
  const isStudent = (userRole?.toUpperCase() ?? '') === 'STUDENT';

  /* ── V2 Interactive Cursor Spotlight Tracker ── */
  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (reduced || reducedTransparency) return;
      const node = surfaceRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      node.style.setProperty('--sb-spot-x', `${(e.clientX - rect.left).toFixed(0)}px`);
      node.style.setProperty('--sb-spot-y', `${(e.clientY - rect.top).toFixed(0)}px`);
    },
    [reduced, reducedTransparency],
  );

  /* ── Compute First Matching Route for Quick-Jump (`Enter` in filter) ── */
  const firstMatchingRoute = useMemo(() => {
    const q = navFilter.trim().toLowerCase();
    if (!q) return null;
    const all = [...PRIMARY_NAV, ...SECONDARY_NAV];
    return (
      all.find((item) => {
        if (isStudent && HIDDEN_FOR_STUDENT.has(item.to)) return false;
        const localized = t(item.labelKey, item.label).toLowerCase();
        return (
          localized.includes(q) ||
          item.label.toLowerCase().includes(q) ||
          item.to.toLowerCase().includes(q)
        );
      }) ?? null
    );
  }, [navFilter, isStudent, t]);

  /* ── Press `Alt + /` outside text fields/modals to focus the nav filter ──
   * Plain `/` is owned by the global command-bar search in AppLayout, so the
   * sidebar uses a modifier to avoid two competing focus handlers. */
  useEffect(() => {
    if (collapsed) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== '/' || !e.altKey || e.metaKey || e.ctrlKey) return;
      const el = e.target as HTMLElement | null;
      if (
        el?.tagName === 'INPUT' ||
        el?.tagName === 'TEXTAREA' ||
        el?.tagName === 'SELECT' ||
        el?.isContentEditable ||
        Boolean(
          document.querySelector(
            '[role="dialog"][data-state="open"], [role="dialog"]:not([aria-hidden="true"])',
          ),
        )
      ) {
        return;
      }
      e.preventDefault();
      filterInputRef.current?.focus();
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
        sound.playTick();
        navigate(firstMatchingRoute.to);
        setNavFilter('');
        filterInputRef.current?.blur();
      }
    },
    [navFilter, clearFilter, firstMatchingRoute, navigate, sound],
  );

  const logoutLabel = t('nav.logout', 'Log out');
  const placeholder = t('nav.filterPlaceholder', 'Filter…');

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarWidth }}
      transition={reduced ? { duration: 0 } : SPRING.smooth}
      className="fixed inset-y-0 left-0 z-[35] hidden flex-col select-none md:flex"
    >
      <div
        ref={surfaceRef}
        onPointerMove={handlePointerMove}
        className={cn(
          'group/sidebar relative flex h-full min-h-0 flex-col overflow-hidden',
          'border-r border-black/[0.07] dark:border-white/[0.09]',
          reducedTransparency
            ? 'bg-[var(--bg-card)]'
            : cn(
                'bg-[var(--glass-surface-bg)] backdrop-blur-3xl backdrop-saturate-[195%]',
                'shadow-[inset_-1px_0_0_0_rgba(255,255,255,0.38),inset_0_1px_0_0_rgba(255,255,255,0.5),8px_0_32px_-12px_rgba(0,0,0,0.08)]',
                'dark:shadow-[inset_-1px_0_0_0_rgba(255,255,255,0.07),inset_0_1px_0_0_rgba(255,255,255,0.12),12px_0_36px_-12px_rgba(0,0,0,0.48)]',
              ),
        )}
      >
        {/* ── 1. V2 Dynamic Cursor Spotlight Refraction Layer ── */}
        {!reducedTransparency && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-500 group-hover/sidebar:opacity-100"
            style={{
              background:
                'radial-gradient(320px circle at var(--sb-spot-x, 50%) var(--sb-spot-y, 20%), rgba(10, 132, 255, 0.065), transparent 70%)',
            }}
          />
        )}

        {/* ── 2. Top Liquid Specular Rim Highlight ── */}
        {!reducedTransparency && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 z-20 h-px bg-gradient-to-r from-transparent via-white/75 to-transparent dark:via-white/22"
          />
        )}

        {/* ── 3. Interactive Right-Edge Specular Collapse Strip ── */}
        {isWide && (
          <div
            role="separator"
            aria-orientation="vertical"
            title={
              collapsed
                ? t('nav.expand', 'Expand sidebar')
                : t('nav.collapse', 'Collapse sidebar')
            }
            onDoubleClick={() => {
              sound.playPop();
              setCollapsed((prev) => !prev);
            }}
            className="absolute inset-y-0 right-0 z-30 w-1 cursor-ew-resize transition-colors duration-200 hover:bg-brand-500/35 active:bg-brand-500/60"
          />
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
            <button
              type="button"
              onClick={() => {
                sound.playPop();
                setCollapsed(true);
              }}
              aria-label={t('nav.collapse', 'Collapse sidebar')}
              aria-keyshortcuts="Meta+B Control+B"
              title={`${t('nav.collapse', 'Collapse sidebar')} (⌘B)`}
              className={cn(
                'flex h-9 w-9 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[var(--text-secondary)]',
                'transition-all duration-200 active:scale-[0.92]',
                GLASS_BTN_HOVER,
                'hover:text-[var(--text-primary)]',
                FOCUS,
              )}
            >
              <StaticIcon paths={I.collapse} size={16} />
            </button>
          )}
        </div>

        {/* ── 5. Collapsed Rail: Liquid Expand Handle ── */}
        {collapsed && isWide && (
          <div className="relative z-10 shrink-0 px-2 pt-2.5">
            <button
              type="button"
              onClick={() => {
                sound.playPop();
                setCollapsed(false);
              }}
              aria-label={t('nav.expand', 'Expand sidebar')}
              aria-keyshortcuts="Meta+B Control+B"
              title={`${t('nav.expand', 'Expand sidebar')} (⌘B)`}
              className={cn(
                'flex min-h-[44px] w-full items-center justify-center rounded-xl border border-black/[0.06] bg-white/45 py-2 text-[var(--text-secondary)]',
                'shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-md',
                'dark:border-white/[0.08] dark:bg-white/[0.04] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]',
                'transition-all duration-200 active:scale-[0.95]',
                GLASS_BTN_HOVER,
                'hover:text-[var(--text-primary)]',
                FOCUS,
              )}
            >
              <StaticIcon paths={I.expand} size={16} />
            </button>
          </div>
        )}

        {/* ── 6. Org Identity Card + Recessed Search Well + Recent Routes ── */}
        {!collapsed && (
          <>
            <div className="relative z-10 shrink-0 border-b border-black/[0.05] px-4 py-3 dark:border-white/[0.06]">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-semibold tracking-tight text-[var(--text-primary)]">
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
                <span className="inline-flex items-center rounded-md border border-black/[0.06] bg-black/[0.03] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--text-tertiary)] dark:border-white/[0.08] dark:bg-white/[0.04]">
                  {roleLabel || 'member'}
                </span>
              </div>
            </div>

            {/* ── Recessed Liquid Glass Filter Input ── */}
            <div className="relative z-10 shrink-0 px-3 pt-3">
              <div className="group relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] transition-colors duration-200 group-focus-within:text-brand-500">
                  <StaticIcon paths={I.search} size={15} />
                </span>
                <input
                  ref={filterInputRef}
                  value={navFilter}
                  onChange={(e) => setNavFilter(e.target.value)}
                  onKeyDown={handleFilterKeyDown}
                  placeholder={placeholder}
                  aria-label={placeholder}
                  className={cn(
                    'h-9 w-full rounded-xl pl-9 pr-9',
                    'border border-black/[0.07] bg-black/[0.035] dark:border-white/[0.09] dark:bg-white/[0.045]',
                    'shadow-[inset_0_1px_2px_rgba(0,0,0,0.04),0_1px_0_rgba(255,255,255,0.65)]',
                    'dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.28),0_1px_0_rgba(255,255,255,0.06)]',
                    'text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)]',
                    'outline-none backdrop-blur-md transition-all duration-200',
                    'focus:border-brand-500/50 focus:bg-white/80 focus:shadow-[inset_0_1px_1px_rgba(0,0,0,0.02),0_0_0_3.5px_var(--focus-ring)]',
                    'dark:focus:bg-white/[0.09]',
                  )}
                />
                {navFilter ? (
                  <button
                    type="button"
                    onClick={clearFilter}
                    aria-label={t('common.clear', 'Clear')}
                    className={cn(
                      'absolute right-1.5 top-1/2 flex h-7 w-7 min-h-[32px] min-w-[32px] -translate-y-1/2 items-center justify-center rounded-full',
                      'text-[var(--text-tertiary)] transition-all duration-150 active:scale-90',
                      GLASS_BTN_HOVER,
                      'hover:text-[var(--text-primary)]',
                      FOCUS,
                    )}
                  >
                    <StaticIcon paths={I.close} size={12} strokeWidth={2} />
                  </button>
                ) : (
                  <kbd
                    aria-hidden="true"
                    className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md border border-black/[0.07] bg-white/65 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[var(--text-tertiary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_1px_2px_rgba(0,0,0,0.04)] dark:border-white/[0.1] dark:bg-white/[0.07] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
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
          <button
            type="button"
            onClick={() => {
              sound.playTick();
              onLogout();
            }}
            aria-label={collapsed ? logoutLabel : undefined}
            title={collapsed ? logoutLabel : undefined}
            className={cn(
              'group flex w-full min-h-[44px] items-center rounded-xl font-medium transition-all duration-200 active:scale-[0.97]',
              collapsed
                ? 'min-w-[44px] justify-center px-2 py-2.5'
                : 'gap-3 px-3 py-2 text-[13.5px]',
              'text-[var(--text-secondary)]',
              'hover:bg-gradient-to-b hover:from-apple-red/15 hover:to-apple-red/5 hover:text-apple-red',
              'hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_2px_8px_-2px_rgba(255,59,48,0.22)]',
              'dark:hover:from-apple-red/20 dark:hover:to-apple-red/10',
              FOCUS,
            )}
          >
            <span className="transition-transform duration-200 group-hover:-translate-x-0.5">
              <StaticIcon paths={I.logout} size={18} />
            </span>
            {!collapsed && <span>{logoutLabel}</span>}
          </button>
        </div>
      </div>
    </motion.aside>
  );
});