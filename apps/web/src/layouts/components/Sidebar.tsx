/**
 * M-EDU Sidebar & Navigation Tree — v11 "Titanium"
 * Complete RBAC filtering, roving tabindex navigation, recent routes, and compact rail.
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useI18n } from '@/i18n/I18nProvider';
import { SPRING, ACCENTS, navListVariants, navItemVariants, type AccentKey } from '../core/tokens';
import { useKeyboardNav, usePersistedState, useDeviceProfile } from '../core/singletons';
import { GlassSurface } from './GlassSurface';
import { Brand } from './Brand';
import { StaticIcon, PremiumIcon, Magnetic, I } from './Icons';

export interface NavItem {
  to: string;
  labelKey: string;
  label: string;
  iconPath: string[];
  end?: boolean;
  accent?: AccentKey;
}

export const PRIMARY_NAV: NavItem[] = [
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

export const SECONDARY_NAV: NavItem[] = [
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

export const HIDDEN_FOR_STUDENT = new Set([
  '/teachers','/users','/expenses','/cameras','/audit','/settings','/homework','/leads','/hr','/inventory',
  '/invoices','/reports','/executive-dashboard','/financial-analytics','/payroll-analytics','/crm-analytics',
  '/parent-portal','/payroll','/automation','/follow-up-automation','/branches','/anomaly-detection','/data-governance',
  '/ai-copilot',
]);

export const ALL_ITEMS_MAP = new Map<string, NavItem>(
  [...PRIMARY_NAV, ...SECONDARY_NAV].map((i) => [i.to, i]),
);

export function useRecentRoutes(limit = 3) {
  const [recent, setRecent] = usePersistedState<string[]>('m-edu.recent-routes', []);
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;
    setRecent((prev) => {
      if (prev[0] === path) return prev;
      return [path, ...prev.filter((p) => p !== path)].slice(0, limit);
    });
  }, [location.pathname, limit, setRecent]);

  return recent;
}

export function RecentRoutes({ onNavigate }: { onNavigate?: () => void }) {
  const recent = useRecentRoutes(3);
  const { t } = useI18n();
  const items = useMemo(
    () => recent.map((p) => ALL_ITEMS_MAP.get(p)).filter((x): x is NavItem => Boolean(x)),
    [recent],
  );

  if (items.length === 0) return null;

  return (
    <div className="shrink-0 border-b border-[#00000010] px-3.5 py-3 dark:border-[#ffffff10]">
      <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-widest text-[#636366] dark:text-[#98989D]">
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
              className="inline-flex items-center gap-1.5 rounded-full border border-[#00000010] bg-[#00000005] px-2.5 py-1 text-[11px] font-semibold text-[#1D1D1F] transition-all hover:-translate-y-0.5 hover:bg-[#00000008] dark:border-[#ffffff15] dark:bg-[#ffffff08] dark:text-[#F5F5F7]"
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.from }} aria-hidden />
              {t(item.labelKey) || item.label}
            </NavLink>
          );
        })}
      </div>
    </div>
  );
}

export function NavItems({
  role,
  onNavigate,
  collapsed = false,
  filter = '',
}: {
  role: string;
  onNavigate?: () => void;
  collapsed?: boolean;
  filter?: string;
}) {
  const { t } = useI18n();
  const navRef = useRef<HTMLElement | null>(null);
  const normalizedRole = role?.toUpperCase() ?? '';
  const lowered = filter.trim().toLowerCase();

  useKeyboardNav(navRef, !collapsed);

  const matches = useCallback(
    (item: NavItem) => {
      if (!lowered) return true;
      const label = (t(item.labelKey) || item.label).toLowerCase();
      return label.includes(lowered);
    },
    [lowered, t],
  );

  const visiblePrimary = useMemo(
    () =>
      PRIMARY_NAV.filter(
        (item) => !(normalizedRole === 'STUDENT' && HIDDEN_FOR_STUDENT.has(item.to)) && matches(item),
      ),
    [normalizedRole, matches],
  );
  const visibleSecondary = useMemo(
    () =>
      SECONDARY_NAV.filter(
        (item) => !(normalizedRole === 'STUDENT' && HIDDEN_FOR_STUDENT.has(item.to)) && matches(item),
      ),
    [normalizedRole, matches],
  );

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
            className={({ isActive }) => [
              'group relative flex items-center',
              collapsed ? 'justify-center px-2 py-2.5' : 'gap-3.5 px-3.5 py-2.5',
              'rounded-[0.875rem] text-[14px] tracking-tight outline-none',
              'transition-colors duration-300 ease-out',
              'focus-visible:ring-2 focus-visible:ring-[#007AFF]/50',
              isActive
                ? 'text-[#1D1D1F] font-bold dark:text-white'
                : 'text-[#636366] font-medium hover:text-[#1D1D1F] dark:text-[#98989D] dark:hover:text-[#F5F5F7]',
            ].join(' ')}
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <>
                    <motion.span
                      layoutId="activeNavPill"
                      className="absolute inset-0 rounded-[0.875rem]"
                      style={{
                        background: `linear-gradient(135deg, ${c.from}22 0%, ${c.to}22 100%)`,
                        boxShadow: `0 8px 24px -8px ${c.glow}, inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -1px 0 ${c.from}15`,
                        border: `1px solid ${c.from}33`,
                      }}
                      transition={SPRING.layout}
                      aria-hidden
                    />
                    <motion.span
                      layoutId="activeNavSpecular"
                      className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-[0.875rem]"
                      style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.6), transparent)' }}
                      transition={SPRING.layout}
                      aria-hidden
                    />
                  </>
                )}
                {!isActive && (
                  <span className="pointer-events-none absolute inset-0 rounded-[0.875rem] bg-transparent transition-colors duration-300 group-hover:bg-black/[0.045] dark:group-hover:bg-white/[0.06]" />
                )}

                <Magnetic strength={0.18}>
                  <span className="relative z-10 flex-shrink-0 flex items-center justify-center">
                    {isAi && (
                      <motion.span
                        className="absolute -inset-1 -z-10 rounded-full blur-md"
                        style={{ background: 'conic-gradient(from 0deg, #007AFF, #5856D6, #FF2D55, #FF9500, #34C759, #007AFF)' }}
                        animate={{ rotate: 360 }}
                        transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
                        aria-hidden
                      />
                    )}
                    <PremiumIcon paths={item.iconPath} isActive={isActive} accent={accent} id={item.to.replace(/\W/g, '')} />
                  </span>
                </Magnetic>

                {!collapsed && (
                  <span className="relative z-10 flex-1 truncate">{t(item.labelKey) || item.label}</span>
                )}

                {isAi && !isActive && !collapsed && (
                  <motion.span
                    className="relative z-10 h-1.5 w-1.5 rounded-full"
                    style={{ background: c.from }}
                    animate={{ opacity: [0.4, 1, 0.4], scale: [0.9, 1.2, 0.9] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    aria-hidden
                  />
                )}
              </>
            )}
          </NavLink>
        </motion.div>
      );
    },
    [collapsed, onNavigate, t],
  );

  const empty = visiblePrimary.length === 0 && visibleSecondary.length === 0;

  return (
    <nav
      ref={navRef}
      className={[
        'flex-1 min-h-0 overflow-y-auto scrollbar-thin',
        collapsed ? 'px-2 py-4' : 'px-3.5 py-4',
      ].join(' ')}
      style={{
        WebkitOverflowScrolling: 'touch',
        transform: 'translateZ(0)',
        maskImage: 'linear-gradient(to bottom, transparent, black 16px, black calc(100% - 16px), transparent)',
        WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 16px, black calc(100% - 16px), transparent)',
      }}
      aria-label={t('a11y.mainNav')}
    >
      {empty ? (
        <p className="px-3 py-6 text-center text-[12px] text-[#636366] dark:text-[#98989D]">
          {t('nav.noMatches') || 'No matches'}
        </p>
      ) : (
        <motion.div variants={navListVariants} initial="hidden" animate="visible" className="space-y-1">
          {visiblePrimary.map(renderItem)}
          {visibleSecondary.length > 0 && (
            <div className="mt-6 border-t border-[#00000010] pt-5 dark:border-[#ffffff10]">
              {!collapsed && (
                <p className="mb-2.5 px-3.5 text-[11px] font-bold uppercase tracking-widest text-[#636366] dark:text-[#98989D]">
                  {t('nav.administration')}
                </p>
              )}
              {visibleSecondary.map(renderItem)}
            </div>
          )}
        </motion.div>
      )}
    </nav>
  );
}

export interface SidebarProps {
  sidebarWidth: number;
  collapsed: boolean;
  setCollapsed: (v: boolean | ((p: boolean) => boolean)) => void;
  isWide: boolean;
  orgName: string;
  userRole: string;
  onLogout: () => void;
}

export function Sidebar({
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
  const [navFilter, setNavFilter] = useState('');

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarWidth }}
      transition={SPRING.smooth}
      className="fixed inset-y-0 left-0 z-40 hidden flex-col p-2.5 md:flex md:p-3.5"
      style={{ willChange: 'width' }}
      aria-label={t('a11y.mainNav') || 'Navigation sidebar'}
    >
      <GlassSurface
        tone="sidebar"
        className="flex min-h-0 flex-1 flex-col overflow-hidden border border-[#ffffff70] shadow-[0_8px_40px_rgba(0,0,0,0.05)] dark:border-[#ffffff12] dark:shadow-[0_10px_50px_rgba(0,0,0,0.45)]"
        radius="2rem"
        spotlight={profile.allowCursorFx}
      >
        <div
          className={[
            'flex h-[4.5rem] shrink-0 items-center border-b border-[#00000010] dark:border-[#ffffff10]',
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
              className="rounded-full p-1.5 text-[#636366] transition-colors hover:bg-black/5 hover:text-[#1D1D1F] focus-visible:ring-2 focus-visible:ring-[#007AFF]/50 dark:text-[#98989D] dark:hover:bg-white/10 dark:hover:text-[#F5F5F7]"
            >
              <StaticIcon paths={I.collapse} className="h-4 w-4" />
            </button>
          )}
        </div>

        {collapsed && isWide && (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            aria-label={t('nav.expand') || 'Expand sidebar'}
            title={t('nav.expand') || 'Expand (⌘B)'}
            className="mx-2 mt-2 flex items-center justify-center rounded-xl py-2 text-[#636366] transition-colors hover:bg-black/5 hover:text-[#1D1D1F] focus-visible:ring-2 focus-visible:ring-[#007AFF]/50 dark:text-[#98989D] dark:hover:bg-white/10 dark:hover:text-[#F5F5F7]"
          >
            <StaticIcon paths={I.expand} className="h-4 w-4" />
          </button>
        )}

        {!collapsed && (
          <>
            <div className="shrink-0 border-b border-[#00000010] px-6 py-4 dark:border-[#ffffff10]">
              <p className="truncate text-[15px] font-semibold tracking-tight">{orgName}</p>
              <p className="mt-0.5 text-[12px] font-medium capitalize text-[#636366] dark:text-[#98989D]">
                {userRole.replace(/_/g, ' ').toLowerCase()}
              </p>
            </div>

            <div className="shrink-0 px-3.5 pt-3">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#636366] dark:text-[#98989D]">
                  <StaticIcon paths={I.search} className="h-3.5 w-3.5" />
                </span>
                <input
                  value={navFilter}
                  onChange={(e) => setNavFilter(e.target.value)}
                  placeholder={t('nav.filterPlaceholder') || 'Filter…'}
                  className="w-full rounded-full border border-[#00000010] bg-[#00000005] py-2 pl-8 pr-8 text-[12px] outline-none placeholder:text-[#636366] focus:border-[#007AFF]/30 focus:bg-white dark:border-[#ffffff15] dark:bg-[#ffffff08] dark:placeholder:text-[#98989D] dark:focus:bg-[#1c1c1e]"
                  aria-label={t('nav.filterPlaceholder') || 'Filter nav'}
                />
                {navFilter && (
                  <button
                    type="button"
                    onClick={() => setNavFilter('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-[#636366] hover:bg-black/5 dark:text-[#98989D] dark:hover:bg-white/10"
                    aria-label={t('common.clear') || 'Clear'}
                  >
                    <StaticIcon paths={I.close} className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>

            {!navFilter && <RecentRoutes />}
          </>
        )}

        <NavItems role={userRole} collapsed={collapsed} filter={navFilter} />

        <div className="shrink-0 border-t border-[#00000010] p-3.5 dark:border-[#ffffff10]">
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onLogout}
            className={[
              'group flex w-full items-center rounded-[1rem] font-semibold tracking-tight text-[#636366] outline-none transition-colors hover:bg-[#FF3B30]/10 hover:text-[#FF3B30] focus-visible:ring-2 focus-visible:ring-[#FF3B30]/50 dark:text-[#98989D]',
              collapsed ? 'justify-center px-2 py-2.5' : 'gap-3.5 px-3.5 py-2.5 text-[14px]',
            ].join(' ')}
          >
            <StaticIcon paths={I.logout} className="transition-transform group-hover:-translate-x-1" />
            {!collapsed && <span>{t('nav.logout')}</span>}
          </motion.button>
        </div>
      </GlassSurface>
    </motion.aside>
  );
}
