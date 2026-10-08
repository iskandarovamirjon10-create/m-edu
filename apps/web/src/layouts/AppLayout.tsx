/**
 * M-EDU AppLayout — v11 "Titanium"
 *
 * Production-Grade Education Management System Shell:
 *  ✅ Modular clean architecture (core tokens, singletons, dedicated components)
 *  ✅ Zero-rerender Liquid Glass spotlight (CSS vars + GPU compositor)
 *  ✅ 3-tier presentation: Desktop (270px/84px rail) | Tablet (compact rail) | Phone (bottom thumb-nav)
 *  ✅ Strict UX-level student RBAC (routes pruned before rendering)
 *  ✅ Full WCAG AA accessibility compliance (color contrast, skip-to-content, roving tabindex, ARIA live)
 *  ✅ Power & battery intelligence (pauses CPU/GPU intensive ambient fx on low battery/low-end devices)
 *  ✅ Centralized z-index layering (zero collision between copilot, drawers, modals, and content)
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useAuth } from '@/auth/AuthContext';
import { useI18n } from '@/i18n/I18nProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { CommandPalette } from '@/components/CommandPalette';
import { GlobalAiCopilot } from '@/components/ai';
import { GlobalCalculator } from '@/components/calculator';
import { initials, fullName } from '@/lib/format';

import {
  DeviceProfileProvider,
  useDeviceProfile,
  useGlobalCursor,
  usePersistedState,
  useMediaQuery,
} from './core/singletons';

import { Sidebar, ALL_ITEMS_MAP } from './components/Sidebar';
import { TopBar, MobileTopBar } from './components/TopBar';
import {
  MobileBottomNav,
  MobileMenuDrawer,
  MobileSearchSheet,
} from './components/MobileNav';
import { ShortcutsModal } from './components/ShortcutsModal';
import {
  AmbientParticles,
  OfflineBanner,
  RouteAnnouncer,
  ScrollProgress,
  AnimatedOutlet,
} from './components/LayoutDecorations';

export function AppLayout() {
  return (
    <DeviceProfileProvider>
      <AppLayoutInner />
    </DeviceProfileProvider>
  );
}

function AppLayoutInner() {
  const { user, logout, loading: authLoading } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();

  /**
   * Responsive tiers:
   *  phone   (< 768px)        → glass top bar + drawer + thumb bottom nav
   *  tablet  (768px – 1279px) → compact icon rail + top bar
   *  desktop (≥ 1280px)       → full sidebar (collapsible) + command bar
   */
  const isWide = useMediaQuery('(min-width: 1280px)');
  const showRail = useMediaQuery('(min-width: 768px)');
  const isPhone = !showRail;
  const profile = useDeviceProfile();
  const cursor = useGlobalCursor(profile.allowCursorFx);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [rawCollapsed, setCollapsed] = usePersistedState<boolean>('m-edu.sidebar-collapsed', false);
  const collapsed = isWide ? rawCollapsed : true;

  const [search, setSearch] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);
  const mainRef = useRef<HTMLElement | null>(null);

  const { scrollY } = useScroll({ container: mainRef });
  const headerY = useTransform(scrollY, [0, 80], [0, -6]);
  const headerScale = useTransform(scrollY, [0, 80], [1, 0.985]);

  const orb1X = useTransform(cursor.x, (v) => v * -0.008);
  const orb1Y = useTransform(cursor.y, (v) => v * -0.008);
  const orb2X = useTransform(cursor.x, (v) => v * 0.006);
  const orb2Y = useTransform(cursor.y, (v) => v * 0.006);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
    } finally {
      navigate('/login');
    }
  }, [logout, navigate]);

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const q = search.trim();
        if (!q) {
          searchRef.current?.focus();
          return;
        }
        navigate(`/search?q=${encodeURIComponent(q)}`);
        setSearch('');
        searchRef.current?.blur();
      } else if (e.key === 'Escape') {
        setSearch('');
        searchRef.current?.blur();
      }
    },
    [search, navigate],
  );

  const handleCommandPalette = useCallback(() => {
    window.dispatchEvent(new CustomEvent('medu:open-command-palette'));
  }, []);

  const handleMobileSearchSubmit = useCallback(
    (q: string) => navigate(`/search?q=${encodeURIComponent(q)}`),
    [navigate],
  );

  // Scroll to top on route change
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    if (typeof el.scrollTo === 'function') el.scrollTo({ top: 0, behavior: 'auto' });
    else el.scrollTop = 0;
  }, [location.pathname]);

  // Keyboard Shortcuts (⌘B, ⌘/, /) with input guards
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inInput = /INPUT|TEXTAREA|SELECT/.test(target.tagName) || target.isContentEditable;
      const anyDialogOpen = mobileMenuOpen || mobileSearchOpen || shortcutsOpen;

      // ⌘/ or Ctrl+/ → shortcuts
      if (e.key === '/' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setShortcutsOpen((v) => !v);
        return;
      }
      // ⌘B or Ctrl+B → toggle sidebar (no shift)
      if (e.key.toLowerCase() === 'b' && (e.metaKey || e.ctrlKey) && !e.shiftKey && !inInput) {
        e.preventDefault();
        setCollapsed((prev) => !prev);
        return;
      }
      // / → focus search
      if (e.key === '/' && !inInput && !anyDialogOpen) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [setCollapsed, mobileMenuOpen, mobileSearchOpen, shortcutsOpen]);

  const userRole = user?.role || '';
  const userFullName = user ? fullName(user.firstName, user.lastName) : '';
  const userInitials = user ? initials(user.firstName, user.lastName) : '?';
  const orgName = user?.organization?.name || 'Education Center';

  const currentNav = ALL_ITEMS_MAP.get(location.pathname);
  const currentTitle = currentNav ? t(currentNav.labelKey) || currentNav.label : '';

  if (authLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#F5F5F7] dark:bg-[#000000]">
        <div className="flex flex-col items-center gap-4">
          <motion.div
            className="h-12 w-12 rounded-full border-4 border-[#007AFF]/20 border-t-[#007AFF]"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
          <p className="text-[13px] font-medium text-[#636366] dark:text-[#98989D]">
            {t('common.loadingSession') || 'Loading session…'}
          </p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;

  const SIDEBAR_W = collapsed ? 84 : 270;
  const SIDEBAR_GAP = 20;
  const mainPaddingLeft = showRail ? SIDEBAR_W + SIDEBAR_GAP : 0;

  return (
    <div
      className="fixed inset-0 flex bg-[#F5F5F7] text-[#1D1D1F] dark:bg-[#000000] dark:text-[#F5F5F7]"
      style={{ overflow: 'hidden' }}
    >
      <OfflineBanner />
      <RouteAnnouncer routeTitle={currentTitle} />
      <AmbientParticles />

      {/* Global cursor halo */}
      {profile.allowCursorFx && (
        <motion.div
          aria-hidden
          className="pointer-events-none fixed -z-10 h-[36rem] w-[36rem] rounded-full opacity-[0.06] dark:opacity-[0.10]"
          style={{
            left: '-18rem',
            top: '-18rem',
            x: cursor.x,
            y: cursor.y,
            background: 'radial-gradient(circle, #007AFF 0%, #5856D6 40%, transparent 70%)',
            willChange: 'transform',
          }}
        />
      )}

      {/* Ambient orbs */}
      {profile.allowAmbient && (
        <div
          className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
          aria-hidden
          style={{ contain: 'strict' }}
        >
          <motion.div
            style={{ x: orb1X, y: orb1Y }}
            animate={{ opacity: [0.3, 0.6, 0.3], scale: [0.95, 1.05, 0.95], rotate: [0, 5, -5, 0] }}
            transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -left-[10%] -top-[10%] h-[40rem] w-[40rem] rounded-full bg-gradient-to-tr from-[#007AFF]/10 to-[#5856D6]/10 blur-[100px] dark:from-[#0A84FF]/15 dark:to-[#5E5CE6]/15"
          />
          <motion.div
            style={{ x: orb2X, y: orb2Y }}
            animate={{ opacity: [0.3, 0.6, 0.3], scale: [0.95, 1.05, 0.95], rotate: [0, -5, 5, 0] }}
            transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
            className="absolute right-[5%] top-[20%] h-[35rem] w-[35rem] rounded-full bg-gradient-to-bl from-[#32ADE6]/10 to-[#34C759]/10 blur-[120px] dark:from-[#64D2FF]/10 dark:to-[#30D158]/10"
          />
        </div>
      )}

      {/* Accessible Skip Link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-[1rem] focus:bg-[#007AFF] focus:px-5 focus:py-2.5 focus:text-[14px] focus:font-semibold focus:text-white focus:shadow-[0_8px_30px_rgba(0,122,255,0.4)] focus:outline-none"
      >
        {t('a11y.skipToContent') || 'Skip to content'}
      </a>

      {/* Desktop / Tablet Sidebar */}
      {showRail && (
        <Sidebar
          sidebarWidth={SIDEBAR_W}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          isWide={isWide}
          orgName={orgName}
          userRole={userRole}
          onLogout={handleLogout}
        />
      )}

      {/* Phone / Tablet Top Bar */}
      <MobileTopBar
        onOpenSearch={() => setMobileSearchOpen(true)}
        onOpenMenu={() => setMobileMenuOpen(true)}
      />

      {/* Mobile Drawer */}
      <MobileMenuDrawer
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        role={userRole}
        orgName={orgName}
        onLogout={handleLogout}
      />

      {/* Modals & Dialogs */}
      <MobileSearchSheet
        open={mobileSearchOpen}
        onClose={() => setMobileSearchOpen(false)}
        onSubmit={handleMobileSearchSubmit}
      />

      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      {/* Main Content Column */}
      <div
        className="relative z-10 flex h-full min-h-0 min-w-0 flex-1 flex-col"
        style={{
          paddingLeft: mainPaddingLeft,
          transition: 'padding-left 320ms cubic-bezier(0.22, 1, 0.36, 1)',
          willChange: 'padding-left',
        }}
      >
        <TopBar
          search={search}
          setSearch={setSearch}
          searchRef={searchRef}
          isSearchFocused={isSearchFocused}
          setIsSearchFocused={setIsSearchFocused}
          onSearchKeyDown={handleSearchKeyDown}
          userFullName={userFullName}
          userInitials={userInitials}
          userRole={userRole}
          orgName={orgName}
          headerY={headerY}
          headerScale={headerScale}
          onCommandPalette={handleCommandPalette}
          onOpenShortcuts={() => setShortcutsOpen(true)}
          onLogout={handleLogout}
        />

        {isPhone && <MobileBottomNav role={userRole} onOpenMore={() => setMobileMenuOpen(true)} />}

        <main
          ref={mainRef}
          id="main-content"
          tabIndex={-1}
          className="relative min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pt-[calc(5.25rem+env(safe-area-inset-top,0px))] pb-[calc(6rem+env(safe-area-inset-bottom,0px))] outline-none scrollbar-thin sm:px-6 md:px-6 md:pb-10 xl:px-8 xl:pb-10 xl:pt-2"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <ScrollProgress containerRef={mainRef} />
          <ErrorBoundary>
            <AnimatedOutlet />
          </ErrorBoundary>
        </main>
      </div>

      <CommandPalette />
      <GlobalAiCopilot />
      <GlobalCalculator />
    </div>
  );
}

export default AppLayout;