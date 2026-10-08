/**
 * M-EDU Sidebar & Navigation Tree — v13 "Artisan Titanium"
 * RBAC filtering · roving tabindex navigation · recent routes · compact rail.
 *
 * Optimizations:
 *  - Per-instance layoutId scoping (multi-sidebar safe)
 *  - Icon registry typed as IconPaths (Icons v13)
 *  - Single-pass nav filtering (primary + secondary in one reduce)
 *  - Memoized leaf components; stable derived labels
 *  - Reduced-motion respected on every animated surface
 *  - Semantic tone tokens shared with TopBar / GlassSurface
 */

import {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  useId,
  memo,
} from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useI18n } from '@/i18n/I18nProvider';
import {
  SPRING,
  ACCENTS,
  navListVariants,
  navItemVariants,
  type AccentKey,
} from '../core/tokens';
import {
  useKeyboardNav,
  usePersistedState,
  useDeviceProfile,
  usePrefersReducedMotion,
} from '../core/singletons';
import { GlassSurface } from './GlassSurface';
import { Brand } from './Brand';
import {
  StaticIcon,
  PremiumIcon,
  Magnetic,
  I,
  type IconPaths,
} from './Icons';

/* ────────────────────────────────────────────────────────────────────────── */
/*  Tone tokens — shared with TopBar / Brand / GlassSurface                   */
/* ────────────────────────────────────────────────────────────────────────── */

const TONE = {
  label: 'text-[#1D1D1F] dark:text-[#F5F5F7]',
  secondary: 'text-[#636366] dark:text-[#98989D]',
  divider: 'border-[#00000010] dark:border-[#ffffff10]',
  hover: 'hover:bg-black/[0.045] dark:hover:bg-white/[0.06]',
  focus:
    'outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF]/55 dark:focus-visible:ring-[#0A84FF]/60',
  danger: 'hover:bg-[#FF3B30]/10 hover:text-[#FF3B30] dark:hover:text-[#FF453A]',
} as const;

const RAINBOW_GRADIENT =
  'conic-gradient(from 0deg, #007AFF, #5856D6, #FF2D55, #FF9500, #34C759, #007AFF)';

/* ────────────────────────────────────────────────────────────────────────── */
/*  Nav registry                                                              */
/* ────────────────────────────────────────────────────────────────────────── */

export interface NavItem {
  to: string;
  labelKey: string;
  label: string;
  iconPath: IconPaths;
  end?: boolean;
  accent?: AccentKey;
}

export const PRIMARY_NAV: readonly NavItem[] = [
  { to: '/', labelKey: 'nav.dashboard', label: 'Dashboard', iconPath: I.dashboard, end: true, accent: 'blue' },
  { to: '/ai-copilot', labelKey: 'nav.aiCopilot', label: 'AI Copilot', iconPath: I.ai, accent: 'rainbow' },
  { to: '/students', labelKey: 'nav.students', label: 'Students', iconPath: I.students, accent: 'blue' },
  { to: '/teachers', labelKey: 'nav.teachers', label: 'Teachers', iconPath: I.teachers, accent: 'purple' },
  { to: '/groups', labelKey: 'nav.groups', label: 'Groups', iconPath: I.groups, accent: 'blue' },
  { to: '/courses', labelKey: 'nav.courses', label: 'Courses', iconPath: I.courses, accent: 'orange' },
  { to: '/attendance', labelKey: 'nav.attendance', label: 'Attendance', iconPath: I.attendance, accent: 'green' },
  { to: '/face', labelKey: 'nav.faceRecognition', label: 'Face Recognition', iconPath: I.face, accent: 'purple' },
  { to: '/library', labelKey: 'nav.library', label: 'Library', iconPath: I.library, accent: 'orange' },
  { to: '/exams', labelKey: 'nav.exams', label: 'Exams', iconPath: I.exams, accent: 'pink' },
  { to: '/payments', labelKey: 'nav.payments', label: 'Payments', iconPath: I.payments, accent: 'green' },
  { to: '/invoices', labelKey: 'nav.invoices', label: 'Invoices', iconPath: I.invoices, accent: 'green' },
  { to: '/reports', labelKey: 'nav.reports', label: 'Reports', iconPath: I.reports, accent: 'blue' },
  { to: '/homework', labelKey: 'nav.homework', label: 'Homework', iconPath: I.homework, accent: 'pink' },
  { to: '/certificates', labelKey: 'nav.certificates', label: 'Certificates', iconPath: I.cert, accent: 'orange' },
  { to: '/chat', labelKey: 'nav.chat', label: 'Chat', iconPath: I.chat, accent: 'blue' },
];

export const SECONDARY_NAV: readonly NavItem[] = [
  { to: '/executive-dashboard', labelKey: 'nav.executiveDashboard', label: 'Executive Dashboard', iconPath: I.executive, accent: 'purple' },
  { to: '/financial-analytics', labelKey: 'nav.financialAnalytics', label: 'Financial Analytics', iconPath: I.financial, accent: 'green' },
  { to: '/payroll-analytics', labelKey: 'nav.payrollAnalytics', label: 'Payroll Analytics', iconPath: I.payroll, accent: 'green' },
  { to: '/crm-analytics', labelKey: 'nav.crmAnalytics', label: 'CRM Analytics', iconPath: I.leads, accent: 'blue' },
  { to: '/parent-portal', labelKey: 'nav.parentPortal', label: 'Parent Portal', iconPath: I.parentPortal, accent: 'orange' },
  { to: '/hr', labelKey: 'nav.hrPayroll', label: 'HR & Payroll', iconPath: I.hr, accent: 'purple' },
  { to: '/payroll', labelKey: 'nav.payrollRuns', label: 'Payroll Runs', iconPath: I.payroll, accent: 'green' },
  { to: '/automation', labelKey: 'nav.automation', label: 'Automation', iconPath: I.automation, accent: 'orange' },
  { to: '/follow-up-automation', labelKey: 'nav.followUpRules', label: 'Follow-Up Rules', iconPath: I.followUp, accent: 'orange' },
  { to: '/branches', labelKey: 'nav.branches', label: 'Branches', iconPath: I.branches, accent: 'blue' },
  { to: '/inventory', labelKey: 'nav.inventory', label: 'Inventory', iconPath: I.inventory, accent: 'orange' },
  { to: '/expenses', labelKey: 'nav.expenses', label: 'Expenses', iconPath: I.expenses, accent: 'pink' },
  { to: '/leads', labelKey: 'nav.leads', label: 'Leads', iconPath: I.leads, accent: 'blue' },
  { to: '/cameras', labelKey: 'nav.cameras', label: 'Cameras', iconPath: I.cameras, accent: 'purple' },
  { to: '/anomaly-detection', labelKey: 'nav.anomalyDetection', label: 'Anomaly Detection', iconPath: I.anomaly, accent: 'pink' },
  { to: '/data-governance', labelKey: 'nav.dataGovernance', label: 'Data Governance', iconPath: I.governance, accent: 'purple' },
  { to: '/users', labelKey: 'nav.users', label: 'Users', iconPath: I.users, accent: 'blue' },
  { to: '/audit', labelKey: 'nav.audit', label: 'Audit Log', iconPath: I.audit, accent: 'purple' },
  { to: '/settings', labelKey: 'nav.settings', label: 'Settings', iconPath: I.settings, accent: 'purple' },
];

export const HIDDEN_FOR_STUDENT = new Set<string>([
  '/teachers', '/users', '/expenses', '/cameras', '/audit', '/settings',
  '/homework', '/leads', '/hr', '/inventory', '/invoices', '/reports',
  '/executive-dashboard', '/financial-analytics', '/payroll-analytics',
  '/crm-analytics', '/parent-portal', '/payroll', '/automation',
  '/follow-up-automation', '/branches', '/anomaly-detection',
  '/data-governance', '/ai-copilot',
]);

export const ALL_ITEMS_MAP = new Map<string, NavItem>(
  [...PRIMARY_NAV, ...SECONDARY_NAV].map((i) => [i.to, i]),
);

/* ────────────────────────────────────────────────────────────────────────── */
/*  Hooks                                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

export function useRecentRoutes(limit = 3): readonly string[] {
  const [recent, setRecent] = usePersistedState<readonly string[]>(
    'm-edu.recent-routes',
    [],
  );
  const { pathname } = useLocation();

  useEffect(() => {
    setRecent((prev) => {
      if (prev[0] === pathname) return prev;
      return [pathname, ...prev.filter((p) => p !== pathname)].slice(0, limit);
    });
  }, [pathname, limit, setRecent]);

  return recent;
}

/** Normalize a role slug ("SUPER_ADMIN" → "super admin") once per value. */
function useRoleLabel(role: string): string {
  return useMemo(
    () => (role ?? '').replace(/_/g, ' ').toLowerCase(),
    [role],
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  RecentRoutes                                                              */
/* ────────────────────────────────────────────────────────────────────────── */

export const RecentRoutes = memo(function RecentRoutes({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const { t } = useI18n();
  const recent = useRecentRoutes(3);
  const reduced = usePrefersReducedMotion();

  const items = useMemo(
    () =>
      recent
        .map((p) => ALL_ITEMS_MAP.get(p))
        .filter((x): x is NavItem => Boolean(x)),
    [recent],
  );

  if (items.length === 0) return null;

  return (
    <div className={`shrink-0 border-b px-3.5 py-3 ${TONE.divider}`}>
      <p
        className={`mb-2 px-1 text-[10px] font-bold uppercase tracking-widest ${TONE.secondary}`}
      >
        {t('nav.recent') || 'Recent'}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => {
          const c = ACCENTS[item.accent ?? 'blue'];
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={[
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1',
                'text-[11px] font-semibold',
                'border-black/[0.06] bg-black/[0.04]',
                'dark:border-white/[0.10] dark:bg-white/[0.06]',
                TONE.label,
                TONE.focus,
                'transition-all duration-200 ease-out',
                reduced
                  ? ''
                  : 'hover:-translate-y-0.5 hover:bg-black/[0.07] dark:hover:bg-white/[0.09]',
              ].join(' ')}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: c.from }}
                aria-hidden
              />
              {t(item.labelKey) || item.label}
            </NavLink>
          );
        })}
      </div>
    </div>
  );
});

/* ────────────────────────────────────────────────────────────────────────── */
/*  NavItems                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

export interface NavItemsProps {
  role: string;
  onNavigate?: () => void;
  collapsed?: boolean;
  filter?: string;
}

export const NavItems = memo(function NavItems({
  role,
  onNavigate,
  collapsed = false,
  filter = '',
}: NavItemsProps) {
  const { t } = useI18n();
  const reduced = usePrefersReducedMotion();
  const navRef = useRef<HTMLElement | null>(null);

  /** Scope the active pill per sidebar instance (multi-sidebar safe). */
  const layoutScope = useId();

  useKeyboardNav(navRef, !collapsed);

  const normalizedRole = role?.toUpperCase() ?? '';
  const isStudent = normalizedRole === 'STUDENT';
  const lowered = filter.trim().toLowerCase();

  /** Single-pass filter → partition into primary/secondary. */
  const { primary, secondary, isEmpty } = useMemo(() => {
    const match = (item: NavItem) => {
      if (isStudent && HIDDEN_FOR_STUDENT.has(item.to)) return false;
      if (!lowered) return true;
      const label = (t(item.labelKey) || item.label).toLowerCase();
      return label.includes(lowered);
    };

    const p: NavItem[] = [];
    const s: NavItem[] = [];
    for (const item of PRIMARY_NAV) if (match(item)) p.push(item);
    for (const item of SECONDARY_NAV) if (match(item)) s.push(item);

    return { primary: p, secondary: s, isEmpty: p.length === 0 && s.length === 0 };
  }, [isStudent, lowered, t]);

  const renderItem = useCallback(
    (item: NavItem) => {
      const accent = item.accent ?? 'blue';
      const c = ACCENTS[accent];
      const isAi = accent === 'rainbow';

      return (
        <motion.div key={item.to} variants={navItemVariants}>
          <NavLink
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            title={collapsed ? t(item.labelKey) || item.label : undefined}
            className={({ isActive }) =>
              [
                'group relative flex items-center',
                collapsed
                  ? 'justify-center px-2 py-2.5'
                  : 'gap-3.5 px-3.5 py-2.5',
                'rounded-[0.875rem] text-[14px] tracking-tight',
                TONE.focus,
                'transition-colors duration-300 ease-out',
                isActive
                  ? `font-bold ${TONE.label} dark:text-white`
                  : `font-medium ${TONE.secondary} hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]`,
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                {/* Active pill — scoped per instance */}
                {isActive && (
                  <>
                    <motion.span
                      layoutId={`${layoutScope}-nav-pill`}
                      className="absolute inset-0 rounded-[0.875rem]"
                      style={{
                        background: `linear-gradient(135deg, ${c.from}22 0%, ${c.to}22 100%)`,
                        boxShadow: `0 8px 24px -8px ${c.glow}, inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -1px 0 ${c.from}15`,
                        border: `1px solid ${c.from}33`,
                      }}
                      transition={reduced ? { duration: 0 } : SPRING.layout}
                      aria-hidden
                    />
                    <motion.span
                      layoutId={`${layoutScope}-nav-specular`}
                      className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-[0.875rem]"
                      style={{
                        background:
                          'linear-gradient(180deg, rgba(255,255,255,0.6), transparent)',
                      }}
                      transition={reduced ? { duration: 0 } : SPRING.layout}
                      aria-hidden
                    />
                  </>
                )}

                {/* Hover wash — inactive only */}
                {!isActive && (
                  <span
                    className={[
                      'pointer-events-none absolute inset-0 rounded-[0.875rem]',
                      'bg-transparent transition-colors duration-300',
                      'group-hover:bg-black/[0.045] dark:group-hover:bg-white/[0.06]',
                    ].join(' ')}
                  />
                )}

                <Magnetic strength={0.18}>
                  <span className="relative z-10 flex flex-shrink-0 items-center justify-center">
                    {isAi && !reduced && (
                      <motion.span
                        className="absolute -inset-1 -z-10 rounded-full blur-md"
                        style={{ background: RAINBOW_GRADIENT }}
                        animate={{ rotate: 360 }}
                        transition={{
                          duration: 6,
                          repeat: Infinity,
                          ease: 'linear',
                        }}
                        aria-hidden
                      />
                    )}
                    {/* No `id` prop — PremiumIcon uses useId() → collision-free */}
                    <PremiumIcon
                      paths={item.iconPath}
                      isActive={isActive}
                      accent={accent}
                    />
                  </span>
                </Magnetic>

                {!collapsed && (
                  <span className="relative z-10 flex-1 truncate">
                    {t(item.labelKey) || item.label}
                  </span>
                )}

                {isAi && !isActive && !collapsed && !reduced && (
                  <motion.span
                    className="relative z-10 h-1.5 w-1.5 rounded-full"
                    style={{ background: c.from }}
                    animate={{ opacity: [0.4, 1, 0.4], scale: [0.9, 1.2, 0.9] }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                    aria-hidden
                  />
                )}
              </>
            )}
          </NavLink>
        </motion.div>
      );
    },
    [collapsed, onNavigate, t, layoutScope, reduced],
  );

  return (
    <nav
      ref={navRef}
      aria-label={t('a11y.mainNav')}
      className={[
        'flex-1 min-h-0 overflow-y-auto scrollbar-thin',
        collapsed ? 'px-2 py-4' : 'px-3.5 py-4',
      ].join(' ')}
      style={{
        WebkitOverflowScrolling: 'touch',
        transform: 'translateZ(0)',
        maskImage:
          'linear-gradient(to bottom, transparent, black 16px, black calc(100% - 16px), transparent)',
        WebkitMaskImage:
          'linear-gradient(to bottom, transparent, black 16px, black calc(100% - 16px), transparent)',
      }}
    >
      {isEmpty ? (
        <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
          <StaticIcon
            paths={I.search}
            className={`h-5 w-5 opacity-40 ${TONE.secondary}`}
          />
          <p className={`text-[12px] font-medium ${TONE.secondary}`}>
            {t('nav.noMatches') || 'No matches'}
          </p>
        </div>
      ) : (
        <motion.div
          variants={navListVariants}
          initial="hidden"
          animate="visible"
          className="space-y-1"
        >
          {primary.map(renderItem)}
          {secondary.length > 0 && (
            <div className={`mt-6 border-t pt-5 ${TONE.divider}`}>
              {!collapsed && (
                <p
                  className={`mb-2.5 px-3.5 text-[11px] font-bold uppercase tracking-widest ${TONE.secondary}`}
                >
                  {t('nav.administration')}
                </p>
              )}
              {secondary.map(renderItem)}
            </div>
          )}
        </motion.div>
      )}
    </nav>
  );
});

/* ────────────────────────────────────────────────────────────────────────── */
/*  Sidebar                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

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
  const profile = useDeviceProfile();
  const reduced = usePrefersReducedMotion();
  const [navFilter, setNavFilter] = useState('');
  const roleLabel = useRoleLabel(userRole);

  const logoutHover = reduced ? undefined : { scale: 1.02 };
  const logoutTap = reduced ? undefined : { scale: 0.98 };

  const clearFilter = useCallback(() => setNavFilter(''), []);

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarWidth }}
      transition={SPRING.smooth}
      className="fixed inset-y-0 left-0 z-40 hidden flex-col p-2.5 md:flex md:p-3.5"
      style={{ willChange: 'width' }}
    >
      <GlassSurface
        tone="sidebar"
        radius="2rem"
        spotlight={profile.allowCursorFx}
        className={[
          'flex min-h-0 flex-1 flex-col overflow-hidden border',
          'border-black/[0.06] dark:border-white/[0.08]',
          'shadow-[0_1px_0_rgba(255,255,255,0.85)_inset,0_0_0_0.5px_rgba(0,0,0,0.04),0_10px_40px_-12px_rgba(0,0,0,0.10)]',
          'dark:shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_0_0_0.5px_rgba(255,255,255,0.05),0_10px_40px_-12px_rgba(0,0,0,0.5)]',
        ].join(' ')}
      >
        {/* ── Header (brand + collapse) ─────────────────────────────── */}
        <div
          className={[
            'flex h-[4.5rem] shrink-0 items-center border-b',
            TONE.divider,
            collapsed ? 'justify-center px-2' : 'justify-between px-6',
          ].join(' ')}
        >
          <Brand compact={collapsed} />
          {!collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              aria-label={t('nav.collapse') || 'Collapse sidebar'}
              title={t('nav.collapse') || 'Collapse (⌘B)'}
              className={[
                'rounded-full p-1.5 transition-colors',
                TONE.secondary,
                'hover:bg-black/[0.05] hover:text-[#1D1D1F]',
                'dark:hover:bg-white/[0.08] dark:hover:text-[#F5F5F7]',
                TONE.focus,
              ].join(' ')}
            >
              <StaticIcon paths={I.collapse} className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* ── Collapsed expand handle ───────────────────────────────── */}
        {collapsed && isWide && (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            aria-label={t('nav.expand') || 'Expand sidebar'}
            title={t('nav.expand') || 'Expand (⌘B)'}
            className={[
              'mx-2 mt-2 flex items-center justify-center rounded-xl py-2',
              'transition-colors',
              TONE.secondary,
              'hover:bg-black/[0.05] hover:text-[#1D1D1F]',
              'dark:hover:bg-white/[0.08] dark:hover:text-[#F5F5F7]',
              TONE.focus,
            ].join(' ')}
          >
            <StaticIcon paths={I.expand} className="h-4 w-4" />
          </button>
        )}

        {/* ── Org identity + filter + recent ────────────────────────── */}
        {!collapsed && (
          <>
            <div className={`shrink-0 border-b px-6 py-4 ${TONE.divider}`}>
              <p className={`truncate text-[15px] font-semibold tracking-tight ${TONE.label}`}>
                {orgName}
              </p>
              <p
                className={`mt-0.5 text-[12px] font-medium capitalize ${TONE.secondary}`}
              >
                {roleLabel}
              </p>
            </div>

            <div className="shrink-0 px-3.5 pt-3">
              <div className="relative">
                <span
                  className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${TONE.secondary}`}
                >
                  <StaticIcon paths={I.search} className="h-3.5 w-3.5" />
                </span>
                <input
                  value={navFilter}
                  onChange={(e) => setNavFilter(e.target.value)}
                  placeholder={t('nav.filterPlaceholder') || 'Filter…'}
                  aria-label={t('nav.filterPlaceholder') || 'Filter nav'}
                  className={[
                    'w-full rounded-full border py-2 pl-8 pr-8',
                    'text-[12px] tracking-tight',
                    'border-black/[0.08] bg-black/[0.04]',
                    TONE.label,
                    'placeholder:text-[#8E8E93] dark:placeholder:text-[#8E8E93]',
                    'outline-none transition-all duration-200',
                    'focus:border-[#007AFF]/35 focus:bg-white',
                    'focus:shadow-[0_0_0_3px_rgba(0,122,255,0.10)]',
                    'dark:border-white/[0.12] dark:bg-white/[0.06]',
                    'dark:focus:border-[#0A84FF]/45 dark:focus:bg-[#1C1C1E]',
                    'dark:focus:shadow-[0_0_0_3px_rgba(10,132,255,0.14)]',
                  ].join(' ')}
                />
                {navFilter && (
                  <button
                    type="button"
                    onClick={clearFilter}
                    aria-label={t('common.clear') || 'Clear'}
                    className={[
                      'absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1',
                      'transition-colors',
                      TONE.secondary,
                      'hover:bg-black/[0.06] dark:hover:bg-white/[0.08]',
                      TONE.focus,
                    ].join(' ')}
                  >
                    <StaticIcon paths={I.close} className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>

            {!navFilter && <RecentRoutes />}
          </>
        )}

        {/* ── Nav tree ──────────────────────────────────────────────── */}
        <NavItems role={userRole} collapsed={collapsed} filter={navFilter} />

        {/* ── Logout ────────────────────────────────────────────────── */}
        <div className={`shrink-0 border-t p-3.5 ${TONE.divider}`}>
          <motion.button
            type="button"
            whileHover={logoutHover}
            whileTap={logoutTap}
            transition={SPRING.snappy}
            onClick={onLogout}
            className={[
              'group flex w-full items-center rounded-[1rem] font-semibold tracking-tight',
              'transition-colors',
              TONE.secondary,
              TONE.danger,
              TONE.focus,
              collapsed
                ? 'justify-center px-2 py-2.5'
                : 'gap-3.5 px-3.5 py-2.5 text-[14px]',
            ].join(' ')}
          >
            <StaticIcon
              paths={I.logout}
              className={
                reduced
                  ? ''
                  : 'transition-transform group-hover:-translate-x-1'
              }
            />
            {!collapsed && <span>{t('nav.logout')}</span>}
          </motion.button>
        </div>
      </GlassSurface>
    </motion.aside>
  );
});