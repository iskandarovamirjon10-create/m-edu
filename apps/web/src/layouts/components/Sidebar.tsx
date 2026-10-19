/**
 * M-EDU Sidebar & Navigation Registry — Apple Liquid Glass Edition.
 *
 * Visual: Multi-layered liquid glass surface (high-saturation backdrop blur,
 * specular inner top/left rims, ambient light refraction), fluid shared-layout
 * active & hover capsules via Framer Motion (`layoutId`), and spring-animated
 * floating glass tooltips.
 *
 * Behavior kept 100% intact: nav registry (exact export shapes), sections, `/`
 * quick-filter with inline highlight, recent routes, collapsed rail tooltips,
 * keyboard roving focus and RBAC (student) filtering.
 */

import {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  memo,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '@/i18n/I18nProvider';
import { cn, usePrefersReducedMotion, SPRING } from '@/lib/design';
import type { AccentKey } from '../core/tokens';
import {
  useKeyboardNav,
  usePersistedState,
  useMediaQuery,
} from '../core/singletons';
import { Brand } from './Brand';
import { StaticIcon, PremiumIcon, I, type IconPaths } from './Icons';

/* ══════════════════════════════════════════════════════════════════════
 * LIQUID GLASS & SPRING TOKENS
 * ════════════════════════════════════════════════════════════════════ */

const FOCUS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--border-focus)]';

/** Subtle tactile glass hover for standalone buttons */
const GLASS_BTN_HOVER =
  'hover:bg-white/50 dark:hover:bg-white/[0.08] hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.4)] dark:hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)]';

const OVERLINE =
  'px-3 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]/80 select-none';

/** Ultra-smooth liquid spring physics */
const LIQUID_SPRING = {
  type: 'spring' as const,
  stiffness: 420,
  damping: 32,
  mass: 0.75,
};

const HOVER_SPRING = {
  type: 'spring' as const,
  stiffness: 500,
  damping: 35,
  mass: 0.6,
};

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
  { to: '/ai-copilot', labelKey: 'nav.aiCopilot', label: 'AI Copilot', iconPath: I.ai, accent: 'rainbow' },
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

/** Highlights the first case-insensitive match of `query` inside `text`. */
function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded-[4px] bg-brand-500/20 px-1 py-px font-semibold text-brand-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] dark:bg-brand-400/25 dark:text-brand-300">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════
 * RecentRoutes — Liquid Glass Quick Pills
 * ════════════════════════════════════════════════════════════════════ */

export const RecentRoutes = memo(function RecentRoutes({
  role = '',
  onNavigate,
}: {
  role?: string;
  onNavigate?: () => void;
}) {
  const { t } = useI18n();
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

  if (items.length === 0) return null;

  return (
    <div className="shrink-0 border-b border-black/[0.05] px-4 py-3 dark:border-white/[0.06]">
      <p className="mb-2 px-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]/80">
        {t('nav.recent', 'Recent')}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'group relative inline-flex max-w-[144px] items-center gap-1.5 rounded-full px-2.5 py-1',
                'text-[11px] font-medium transition-all duration-200 active:scale-[0.96]',
                'backdrop-blur-md',
                FOCUS,
                isActive
                  ? 'border border-brand-500/35 bg-gradient-to-b from-brand-500/20 to-brand-500/10 text-brand-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_2px_6px_-1px_rgba(0,122,255,0.18)] dark:text-brand-300'
                  : cn(
                      'border border-black/[0.06] bg-white/40 text-[var(--text-secondary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]',
                      'dark:border-white/[0.08] dark:bg-white/[0.04] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]',
                      'hover:border-black/[0.1] hover:bg-white/70 hover:text-[var(--text-primary)] dark:hover:bg-white/[0.09]',
                    ),
              )
            }
          >
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500 shadow-[0_0_6px_rgba(0,122,255,0.7)] transition-transform duration-200 group-hover:scale-125"
              aria-hidden="true"
            />
            <span className="truncate">{t(item.labelKey, item.label)}</span>
          </NavLink>
        ))}
      </div>
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════════════
 * NavItems — Fluid Sectioned Tree + Shared Layout Liquid Capsules
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
  const { t } = useI18n();
  const location = useLocation();
  const reduced = usePrefersReducedMotion();
  const navRef = useRef<HTMLElement | null>(null);

  useKeyboardNav(navRef, !collapsed && !isMobile);

  const isStudent = (role?.toUpperCase() ?? '') === 'STUDENT';
  const trimmedFilter = filter.trim();
  const lowered = trimmedFilter.toLowerCase();

  const [moreExpanded, setMoreExpanded] = useState(false);
  const [hoveredTo, setHoveredTo] = useState<string | null>(null);
  const [railTip, setRailTip] = useState<RailTooltipState | null>(null);

  useEffect(() => {
    setRailTip(null);
    setHoveredTo(null);
  }, [collapsed, location.pathname]);

  const isMoreRouteActive = useMemo(
    () => MORE_NAV.some((item) => item.to === location.pathname),
    [location.pathname],
  );

  const { management, academics, finance, communication, administration, more, isEmpty } =
    useMemo(() => {
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

      return {
        management: m,
        academics: ac,
        finance: fn,
        communication: cm,
        administration: ad,
        more: mr,
        isEmpty:
          m.length + ac.length + fn.length + cm.length + ad.length + mr.length === 0,
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

  /** Collapsed rail: pin a viewport-fixed label next to the focused/hovered row. */
  const showTip = useCallback(
    (e: { currentTarget: HTMLElement }, label: string) => {
      if (!collapsed) return;
      const rect = e.currentTarget.getBoundingClientRect();
      setRailTip({
        label,
        top: rect.top + rect.height / 2,
        left: rect.right + 14,
      });
    },
    [collapsed],
  );

  const hideTip = useCallback(() => setRailTip(null), []);

  const renderItem = useCallback(
    (item: NavItem) => {
      const label = t(item.labelKey, item.label);
      const isHovered = hoveredTo === item.to;

      return (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          onMouseEnter={(e) => {
            setHoveredTo(item.to);
            showTip(e, label);
          }}
          onMouseLeave={() => {
            setHoveredTo((prev) => (prev === item.to ? null : prev));
            hideTip();
          }}
          onFocus={(e) => {
            setHoveredTo(item.to);
            showTip(e, label);
          }}
          onBlur={() => {
            setHoveredTo((prev) => (prev === item.to ? null : prev));
            hideTip();
          }}
          aria-label={collapsed ? label : undefined}
          className={({ isActive }) =>
            cn(
              'group relative flex items-center rounded-xl transition-transform duration-150 ease-out active:scale-[0.97]',
              collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2',
              FOCUS,
              isActive
                ? 'font-semibold text-brand-600 dark:text-brand-300'
                : 'font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
            )
          }
        >
          {({ isActive }) => (
            <>
              {/* ── Liquid Floating Hover Capsule ── */}
              {isHovered && !isActive && (
                <motion.span
                  layoutId={isMobile ? undefined : "sidebar-liquid-hover"}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={reduced ? { duration: 0 } : HOVER_SPRING}
                  aria-hidden="true"
                  className={cn(
                    'pointer-events-none absolute inset-0 z-0 rounded-xl',
                    'bg-gradient-to-b from-white/60 to-white/25 dark:from-white/[0.08] dark:to-white/[0.03]',
                    'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.65),0_1px_3px_rgba(0,0,0,0.03)]',
                    'dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12),0_1px_3px_rgba(0,0,0,0.2)]',
                  )}
                />
              )}

              {/* ── Liquid Floating Active Glass Pill ── */}
              {isActive && (
                <motion.span
                  layoutId={isMobile ? undefined : "sidebar-liquid-active"}
                  transition={reduced ? { duration: 0 } : LIQUID_SPRING}
                  aria-hidden="true"
                  className={cn(
                    'pointer-events-none absolute inset-0 z-0 rounded-xl',
                    'bg-gradient-to-b from-brand-500/[0.16] via-brand-500/[0.10] to-brand-500/[0.06]',
                    'dark:from-brand-400/[0.22] dark:via-brand-500/[0.14] dark:to-brand-500/[0.08]',
                    'border border-brand-500/25 dark:border-brand-400/30',
                    'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.55),0_4px_14px_-3px_rgba(0,122,255,0.22)]',
                    'dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.22),0_4px_16px_-3px_rgba(0,122,255,0.35)]',
                  )}
                />
              )}

              {/* ── Luminous Left Accent Indicator ── */}
              {isActive && (
                <motion.span
                  layoutId={isMobile ? undefined : "sidebar-liquid-bar"}
                  transition={reduced ? { duration: 0 } : LIQUID_SPRING}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-0 top-1/2 z-10 h-5 w-[3px] -translate-y-1/2 rounded-full bg-gradient-to-b from-brand-400 to-brand-600 shadow-[0_0_10px_rgba(0,122,255,0.85)]"
                />
              )}

              {/* ── Icon with subtle magnetic lift ── */}
              <span className="relative z-10 flex shrink-0 items-center justify-center transition-transform duration-200 ease-out group-hover:scale-[1.06]">
                <PremiumIcon
                  paths={item.iconPath}
                  isActive={isActive}
                  accent={item.accent}
                  size={18}
                />
              </span>

              {/* ── Label ── */}
              {!collapsed && (
                <span className="relative z-10 min-w-0 flex-1 truncate text-[13.5px] tracking-[-0.01em]">
                  <HighlightMatch text={label} query={trimmedFilter} />
                </span>
              )}
            </>
          )}
        </NavLink>
      );
    },
    [collapsed, hoveredTo, onNavigate, reduced, t, trimmedFilter, showTip, hideTip],
  );

  return (
    <>
      <nav
        ref={navRef}
        onMouseLeave={() => setHoveredTo(null)}
        aria-label={t('a11y.mainNav', 'Main navigation')}
        className={cn(
          'min-h-0 flex-1 overflow-y-auto overflow-x-hidden scroll-smooth',
          '[scrollbar-width:thin] [scrollbar-color:rgba(150,150,150,0.2)_transparent]',
          collapsed ? 'px-2 pt-3 pb-8' : 'px-3 pt-3 pb-8',
        )}
      >
        {isEmpty ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={LIQUID_SPRING}
            className="flex flex-col items-center gap-2.5 px-3 py-12 text-center"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-black/[0.06] bg-gradient-to-b from-white/70 to-white/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_4px_12px_rgba(0,0,0,0.04)] backdrop-blur-md dark:border-white/[0.1] dark:from-white/[0.1] dark:to-white/[0.03]">
              <StaticIcon paths={I.search} size={18} className="text-[var(--text-tertiary)]" />
            </span>
            <p className="text-xs font-medium text-[var(--text-secondary)]">
              {t('nav.noMatches', 'No matches')}
            </p>
          </motion.div>
        ) : (
          <>
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
                    <p className={cn('mb-1.5', OVERLINE)}>{t(sec.titleKey, sec.title)}</p>
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
                <div className="space-y-0.5">{administration.map(renderItem)}</div>
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
                    onClick={() => setMoreExpanded((v) => !v)}
                    aria-expanded={showMore}
                    className={cn(
                      'group flex w-full items-center justify-between rounded-xl px-3 py-2 text-[10.5px] font-semibold uppercase tracking-[0.08em]',
                      'text-[var(--text-tertiary)] transition-all duration-200',
                      GLASS_BTN_HOVER,
                      'hover:text-[var(--text-primary)]',
                      FOCUS,
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span>{t('nav.sectionMore', 'More Modules')}</span>
                      <span className="inline-flex min-w-5 items-center justify-center rounded-full border border-black/[0.06] bg-white/50 px-1.5 py-px text-[10px] font-semibold tabular-nums text-[var(--text-secondary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] dark:border-white/[0.1] dark:bg-white/[0.06]">
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
              'pointer-events-none fixed z-[100] -translate-y-1/2 rounded-xl px-3 py-1.5',
              'text-xs font-semibold tracking-tight text-[var(--text-primary)]',
              'border border-white/40 bg-white/75 backdrop-blur-2xl backdrop-saturate-[190%]',
              'dark:border-white/[0.14] dark:bg-neutral-900/75',
              'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.7),0_10px_28px_-6px_rgba(0,0,0,0.18)]',
              'dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.16),0_10px_30px_-6px_rgba(0,0,0,0.55)]',
            )}
            role="tooltip"
          >
            {railTip.label}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});

/* ══════════════════════════════════════════════════════════════════════
 * Sidebar — Apple Liquid Glass Rail
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
  const { t } = useI18n();
  const reduced = usePrefersReducedMotion();
  const reducedTransparency = useMediaQuery('(prefers-reduced-transparency: reduce)');
  const [navFilter, setNavFilter] = useState('');
  const filterInputRef = useRef<HTMLInputElement | null>(null);
  const roleLabel = useRoleLabel(userRole);

  // Press `/` anywhere outside a text field → focus the sidebar quick-filter.
  useEffect(() => {
    if (collapsed) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (
        el?.tagName === 'INPUT' ||
        el?.tagName === 'TEXTAREA' ||
        el?.isContentEditable
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
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      if (navFilter) clearFilter();
      else filterInputRef.current?.blur();
    },
    [navFilter, clearFilter],
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
        className={cn(
          'relative flex h-full min-h-0 flex-col overflow-hidden',
          'border-r border-black/[0.07] dark:border-white/[0.09]',
          reducedTransparency
            ? 'bg-[var(--bg-card)]'
            : cn(
                'bg-[var(--glass-surface-bg)] backdrop-blur-3xl backdrop-saturate-[190%]',
                'shadow-[inset_-1px_0_0_0_rgba(255,255,255,0.35),inset_0_1px_0_0_rgba(255,255,255,0.45),8px_0_32px_-12px_rgba(0,0,0,0.08)]',
                'dark:shadow-[inset_-1px_0_0_0_rgba(255,255,255,0.07),inset_0_1px_0_0_rgba(255,255,255,0.12),12px_0_36px_-12px_rgba(0,0,0,0.45)]',
              ),
        )}
      >
        {/* ── Top Liquid Specular Rim Highlight ── */}
        {!reducedTransparency && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent dark:via-white/20"
          />
        )}

        {/* ── Header: Brand + Collapse ── */}
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
              onClick={() => setCollapsed(true)}
              aria-label={t('nav.collapse', 'Collapse sidebar')}
              title={t('nav.collapse', 'Collapse sidebar')}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-xl text-[var(--text-secondary)]',
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

        {/* ── Collapsed Rail: Liquid Expand Handle ── */}
        {collapsed && isWide && (
          <div className="relative z-10 shrink-0 px-2 pt-2.5">
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              aria-label={t('nav.expand', 'Expand sidebar')}
              title={t('nav.expand', 'Expand sidebar')}
              className={cn(
                'flex w-full items-center justify-center rounded-xl border border-black/[0.06] bg-white/40 py-2 text-[var(--text-secondary)]',
                'shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-md',
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

        {/* ── Org Identity + Liquid Search Well + Recent Routes ── */}
        {!collapsed && (
          <>
            <div className="relative z-10 shrink-0 border-b border-black/[0.05] px-4 py-3 dark:border-white/[0.06]">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-semibold tracking-tight text-[var(--text-primary)]">
                  {orgName || 'M-EDU Academy'}
                </p>
                <span className="relative flex h-2.5 w-2.5 shrink-0 items-center justify-center" aria-hidden="true">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-apple-green opacity-60 motion-safe:animate-ping" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-apple-green shadow-[0_0_8px_rgba(52,199,89,0.8)]" />
                </span>
              </div>
              <p className="mt-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]/85">
                {roleLabel}
              </p>
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
                    'shadow-[inset_0_1px_2px_rgba(0,0,0,0.04),0_1px_0_rgba(255,255,255,0.6)]',
                    'dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.25),0_1px_0_rgba(255,255,255,0.06)]',
                    'text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)]',
                    'outline-none backdrop-blur-md transition-all duration-200',
                    'focus:border-brand-500/50 focus:bg-white/75 focus:shadow-[inset_0_1px_1px_rgba(0,0,0,0.02),0_0_0_3.5px_var(--focus-ring)]',
                    'dark:focus:bg-white/[0.08]',
                  )}
                />
                {navFilter ? (
                  <button
                    type="button"
                    onClick={clearFilter}
                    aria-label={t('common.clear', 'Clear')}
                    className={cn(
                      'absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full',
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
                    className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md border border-black/[0.07] bg-white/60 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-tertiary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_1px_2px_rgba(0,0,0,0.04)] dark:border-white/[0.1] dark:bg-white/[0.07] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
                  >
                    /
                  </kbd>
                )}
              </div>
            </div>

            {!navFilter && <RecentRoutes role={userRole} />}
          </>
        )}

        {/* ── Navigation Tree ── */}
        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          <NavItems role={userRole} collapsed={collapsed} filter={navFilter} />
        </div>

        {/* ── Footer: Liquid Tactile Log Out ── */}
        <div className="relative z-10 shrink-0 border-t border-black/[0.05] p-3 dark:border-white/[0.06]">
          <button
            type="button"
            onClick={onLogout}
            aria-label={collapsed ? logoutLabel : undefined}
            title={collapsed ? logoutLabel : undefined}
            className={cn(
              'group flex w-full items-center rounded-xl font-medium transition-all duration-200 active:scale-[0.97]',
              collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2 text-[13.5px]',
              'text-[var(--text-secondary)]',
              'hover:bg-gradient-to-b hover:from-apple-red/15 hover:to-apple-red/5 hover:text-apple-red',
              'hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_2px_8px_-2px_rgba(255,59,48,0.2)]',
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