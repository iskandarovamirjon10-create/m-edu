/**
 * M-EDU AppLayout — application shell.
 *
 *  · Responsive tiers: phone (drawer + thumb nav) | tablet (icon rail) |
 *    desktop (collapsible sidebar + command bar)
 *  · Sidebar chrome: GlassSurface "sidebar" tone = `--glass-surface-bg` +
 *    `backdrop-blur-xl` + `border-r border-subtle`
 *  · Keyboard: ⌘B collapse · ⌘K palette · ⌘E executive · ⌘/ shortcuts · / search
 *  · Auth redirect, persisted sidebar collapse, skip-link + `<main id="main-content">`
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useAuth } from '@/auth/AuthContext';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { CommandPalette } from '@/components/CommandPalette';
import { GlobalAiCopilot } from '@/components/ai';
import { GlobalCalculator } from '@/components/calculator';
import { QuickLookModal } from '@/components/quicklook';
import { SplitViewSidecar } from '@/components/sidecar';
import { DynamicWallpaper } from '@/components/wallpaper';
import { LiquidGlassStudio } from '@/components/ui';
import { FloatingPiPCamera } from '@/components/camera/FloatingPiPCamera';
import { initials, fullName } from '@/lib/format';
import { cn, usePrefersReducedMotion, SPRING } from '@/lib/design';

import { DeviceProfileProvider, usePersistedState, useMediaQuery } from './core/singletons';
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
import { useAttendanceSocket } from '@/hooks/useAttendanceSocket';

export function AppLayout() {
  return (
    <DeviceProfileProvider>
      <AppLayoutInner />
    </DeviceProfileProvider>
  );
}

/**
 * Space / Home / End belong to the focused control. The layout-level scroll
 * shortcuts must never fire while a link, button, field or menu item holds
 * focus — otherwise Space can no longer activate buttons on the page.
 */
function isInteractiveFocusTarget(target: EventTarget | null): boolean {
  if (typeof Element === 'undefined' || !(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      'a, button, input, textarea, select, summary, label, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="option"], [role="switch"], [contenteditable="true"]',
    ),
  );
}

function AppLayoutInner() {
  const { user, logout, loading: authLoading } = useAuth();
  const { t } = useSafeI18n();
  const navigate = useNavigate();
  const location = useLocation();
  useAttendanceSocket();

  /**
   * Responsive tiers:
   *  phone   (< 768px)        → top bar + drawer + thumb bottom nav
   *  tablet  (768px – 1279px) → compact icon rail + top bar
   *  desktop (≥ 1280px)       → full sidebar (collapsible) + command bar
   */
  const isWide = useMediaQuery('(min-width: 1280px)');
  const showRail = useMediaQuery('(min-width: 768px)');
  const isPhone = !showRail;
  const reducedMotion = usePrefersReducedMotion();

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
  const headerY = useTransform(scrollY, [0, 80], [0, -3]);

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

  // Scroll to hash target on route change if a hash is present (regular scroll is handled by ScrollToTop)
  useEffect(() => {
    const el = mainRef.current;
    if (!el || !location.hash) return;
    const id = decodeURIComponent(location.hash.slice(1));
    const target = el.querySelector(`#${id}`) || document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [location.hash]);

  // Close mobile navigation drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setMobileSearchOpen(false);
  }, [location.pathname]);

  // Focus main container on mount so keyboard scroll (PageDown, PageUp, ArrowDown) works out of the box
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const raf = requestAnimationFrame(() => {
      if (document.activeElement === document.body || !document.activeElement) {
        el.focus({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  // Forward wheel events from layout chrome (margins, gutters) to <main> without forced reflow
  useEffect(() => {
    const mainEl = mainRef.current;
    if (!mainEl) return;

    const onWheel = (e: WheelEvent) => {
      // If cursor is already inside main, native hardware-accelerated scroll handles it
      if (e.target instanceof Node && mainEl.contains(e.target)) return;

      // Don't forward if interacting with modals, popovers, or form inputs
      const target = e.target as HTMLElement | null;
      if (target?.closest?.('[role="dialog"], [role="menu"], select, textarea, input, [data-scroll-prevent]')) {
        return;
      }

      // If over sidebar, only preserve if sidebar itself is actively scrollable
      const aside = target?.closest?.('aside');
      if (aside && aside.scrollHeight > aside.clientHeight) {
        return;
      }

      // Fast non-blocking scroll forwarding without DOM style recalculations
      if (typeof mainEl.scrollBy === 'function') {
        mainEl.scrollBy({ top: e.deltaY, behavior: 'auto' });
      } else {
        mainEl.scrollTop += e.deltaY;
      }
    };

    window.addEventListener('wheel', onWheel, { passive: true });
    return () => window.removeEventListener('wheel', onWheel);
  }, []);

  // Sequence shortcut tracker (e.g., G then S)
  const lastKeyRef = useRef<{ key: string; time: number } | null>(null);

  // Keyboard shortcuts (⌘B, ⌘K, ⌘E, ⌘//, ?, G->S/F/A/D/G) with input guards
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
      // ? → shortcuts modal (Shift + /)
      if (e.key === '?' && !inInput && !e.metaKey && !e.ctrlKey) {
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
      // ⌘E or Ctrl+E → toggle Executive Suite
      if (e.key.toLowerCase() === 'e' && (e.metaKey || e.ctrlKey) && !e.shiftKey && !inInput) {
        e.preventDefault();
        const isExec = location.pathname.startsWith('/executive');
        navigate(isExec ? '/' : '/executive-dashboard');
        return;
      }
      // ⌘K or Ctrl+K → open command palette
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey) && !inInput) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('medu:open-command-palette'));
        return;
      }
      // / → focus search
      if (e.key === '/' && !inInput && !anyDialogOpen && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }

      // Keyboard-driven smooth page scrolling when not in an input or control
      if (
        !inInput &&
        !anyDialogOpen &&
        !isInteractiveFocusTarget(e.target) &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey
      ) {
        const main = mainRef.current;
        if (main) {
          if (e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)) {
            e.preventDefault();
            main.scrollBy({ top: Math.max(200, main.clientHeight * 0.82), behavior: 'smooth' });
            return;
          }
          if (e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)) {
            e.preventDefault();
            main.scrollBy({ top: -Math.max(200, main.clientHeight * 0.82), behavior: 'smooth' });
            return;
          }
          if (e.key === 'Home') {
            e.preventDefault();
            main.scrollTo({ top: 0, behavior: 'smooth' });
            return;
          }
          if (e.key === 'End') {
            e.preventDefault();
            main.scrollTo({ top: main.scrollHeight, behavior: 'smooth' });
            return;
          }
        }
      }

      // Linear-style Go-to sequence shortcuts (G then S/F/A/D/G)
      if (!inInput && !e.metaKey && !e.ctrlKey && !anyDialogOpen) {
        const now = Date.now();
        const key = e.key.toLowerCase();
        if (lastKeyRef.current && lastKeyRef.current.key === 'g' && now - lastKeyRef.current.time < 1200) {
          lastKeyRef.current = null;
          if (key === 's') {
            e.preventDefault();
            navigate('/students');
            return;
          }
          if (key === 'f') {
            e.preventDefault();
            navigate('/payments');
            return;
          }
          if (key === 'a') {
            e.preventDefault();
            navigate('/attendance');
            return;
          }
          if (key === 'd') {
            e.preventDefault();
            navigate('/');
            return;
          }
          if (key === 'g') {
            e.preventDefault();
            navigate('/groups');
            return;
          }
        }
        if (lastKeyRef.current && lastKeyRef.current.key === 'n' && now - lastKeyRef.current.time < 1200) {
          lastKeyRef.current = null;
          if (key === 'p') {
            e.preventDefault();
            window.dispatchEvent(new CustomEvent('medu:open-quick-payment'));
            return;
          }
          if (key === 'a') {
            e.preventDefault();
            window.dispatchEvent(new CustomEvent('medu:open-quick-attendance'));
            return;
          }
          if (key === 's') {
            e.preventDefault();
            navigate('/students');
            return;
          }
        }
        if (key === 'g' || key === 'n') {
          lastKeyRef.current = { key, time: now };
          return;
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [setCollapsed, mobileMenuOpen, mobileSearchOpen, shortcutsOpen, location.pathname, navigate]);

  const userRole = user?.role || '';
  const userFullName = user ? fullName(user.firstName, user.lastName) : '';
  const userInitials = user ? initials(user.firstName, user.lastName) : '?';
  const orgName = user?.organization?.name || 'Education Center';

  const currentNav = ALL_ITEMS_MAP.get(location.pathname);
  const currentTitle = currentNav ? t(currentNav.labelKey) || currentNav.label : '';
  const isAiCopilot = location.pathname.startsWith('/ai-copilot');

  if (authLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed inset-0 flex items-center justify-center bg-[var(--bg-base)] backdrop-blur-2xl"
      >
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-white/60 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.035] p-8 shadow-2xl backdrop-blur-xl">
          <span
            aria-hidden="true"
            className="h-10 w-10 animate-spin rounded-full border-[3px] border-brand-500/25 border-t-brand-500"
          />
          <p className="text-[13px] font-semibold text-secondary">
            {t('common.loadingSession') || 'Loading session…'}
          </p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;

  const SIDEBAR_W = collapsed ? 84 : 270;
  const mainPaddingLeft = showRail ? SIDEBAR_W : 0;

  return (
    <div
      className="fixed inset-0 flex overflow-hidden bg-[var(--bg-base)] text-primary"
      style={{
        '--sidebar-center-offset': `${showRail ? mainPaddingLeft / 2 : 0}px`,
      } as React.CSSProperties}
    >
      <DynamicWallpaper />
      <OfflineBanner />
      <RouteAnnouncer routeTitle={currentTitle} />
      <AmbientParticles />

      {/* Accessible skip link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-brand-500 focus:px-5 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-white focus:shadow-glow-vivid focus:outline-2 focus:outline-offset-2 focus:outline-[var(--border-focus)]"
      >
        {t('a11y.skipToContent') || 'Skip to content'}
      </a>

      {/* Desktop / Tablet Sidebar (surface = GlassSurface "sidebar" tone) */}
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

      {/* Phone Top Bar */}
      {isPhone && !isAiCopilot && (
        <MobileTopBar
          onOpenSearch={() => setMobileSearchOpen(true)}
          onOpenMenu={() => setMobileMenuOpen(true)}
        />
      )}

      {/* Mobile Drawer */}
      <MobileMenuDrawer
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        role={userRole}
        orgName={orgName}
        userName={userFullName}
        userInitials={userInitials}
        userEmail={user?.email}
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
      <motion.div
        className="relative z-10 flex h-full min-h-0 min-w-0 flex-1 flex-col"
        animate={{ paddingLeft: mainPaddingLeft }}
        transition={reducedMotion ? { duration: 0 } : SPRING.smooth}
      >
        {showRail && (
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
            onCommandPalette={handleCommandPalette}
            onOpenShortcuts={() => setShortcutsOpen(true)}
            onLogout={handleLogout}
            onOpenMenu={() => setMobileMenuOpen(true)}
            user={user}
          />
        )}

        {isPhone && !isSearchFocused && !isAiCopilot && (
          <MobileBottomNav
            role={userRole}
            onOpenMore={() => setMobileMenuOpen(true)}
            scrollContainerRef={mainRef}
          />
        )}

        <main
          ref={mainRef}
          id="main-content"
          role="main"
          tabIndex={-1}
          data-scroll-container
          data-scroll-focus
          className={cn(
            'relative min-h-0 min-w-0 flex-1 outline-none overscroll-y-contain touch-pan-y',
            isAiCopilot
              ? 'flex flex-col min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-0 pt-[env(safe-area-inset-top,0px)] pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] scrollbar-thin md:px-6 md:pt-3 md:pb-8'
              : 'overflow-y-auto overflow-x-hidden pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] pt-[calc(5.25rem+env(safe-area-inset-top,0px))] pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] scrollbar-thin sm:pl-[max(1.5rem,env(safe-area-inset-left,0px))] sm:pr-[max(1.5rem,env(safe-area-inset-right,0px))] md:pt-3 md:pb-8 xl:pl-[max(2rem,env(safe-area-inset-left,0px))] xl:pr-[max(2rem,env(safe-area-inset-right,0px))] xl:pb-10 xl:pt-3',
          )}
          style={{
            WebkitOverflowScrolling: 'touch',
            overscrollBehaviorY: 'contain',
            touchAction: 'pan-y',
          }}
        >
          <ScrollProgress containerRef={mainRef} />
          <ErrorBoundary>
            <AnimatedOutlet />
          </ErrorBoundary>
        </main>
      </motion.div>

      <CommandPalette />
      <ErrorBoundary>
        <GlobalAiCopilot />
      </ErrorBoundary>
      <GlobalCalculator />
      <QuickLookModal />
      <SplitViewSidecar />
      <FloatingPiPCamera />
      <LiquidGlassStudio />
    </div>
  );
}

export default AppLayout;
