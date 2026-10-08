/**
 * M-EDU TopBar & Header Controls — v11 "Titanium"
 * Desktop Liquid Glass header, live clock, user menu, and responsive mobile bar.
 */

import { useState, useRef, useEffect, useCallback, type KeyboardEvent, type RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, type MotionValue } from 'framer-motion';
import { useI18n } from '@/i18n/I18nProvider';
import { NotificationsMenu } from '@/components/NotificationsMenu';
import { LanguageSwitcher } from '@/i18n/LanguageSwitcher';
import { setCalculatorOpen } from '@/stores/ui.store';
import { useTheme } from '@/hooks/useTheme';
import { usePersistSettings } from '@/hooks/usePersistSettings';
import { SPRING, DUR, EASE_APPLE, popoverVariants } from '../core/tokens';
import { useNow, useDeviceProfile, usePageVisible, usePrefersReducedMotion } from '../core/singletons';
import { GlassSurface } from './GlassSurface';
import { Brand } from './Brand';
import { StaticIcon, Magnetic, I } from './Icons';

export function getGreetingKey(now: Date): string {
  const h = now.getHours();
  if (h < 5) return 'nav.greetingNight';
  if (h < 12) return 'nav.greetingMorning';
  if (h < 17) return 'nav.greetingAfternoon';
  if (h < 22) return 'nav.greetingEvening';
  return 'nav.greetingNight';
}

export function LiveClock() {
  const now = useNow();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return (
    <span className="tabular-nums tracking-tight inline-flex items-center gap-1.5 font-medium">
      <span className="medu-pulse-dot inline-block h-1.5 w-1.5 rounded-full" style={{ background: '#34C759' }} aria-hidden />
      {hh}
      <span className="medu-colon-blink mx-[1px]">:</span>
      {mm}
    </span>
  );
}

export function ThemeToggle() {
  const { setTheme, isDark } = useTheme();
  const { t } = useI18n();
  const persist = usePersistSettings();
  const reduced = usePrefersReducedMotion();
  const label = isDark ? t('a11y.switchToLight') : t('a11y.switchToDark');

  const toggle = useCallback(() => {
    const next = isDark ? 'light' : 'dark';
    setTheme(next);
    persist({ theme: next });
  }, [isDark, setTheme, persist]);

  return (
    <Magnetic strength={0.3}>
      <motion.button
        whileHover={reduced ? undefined : { scale: 1.06 }}
        whileTap={reduced ? undefined : { scale: 0.9, rotate: -12 }}
        type="button"
        onClick={toggle}
        aria-label={label}
        title={label}
        className="relative rounded-full p-2.5 text-[#636366] outline-none transition-colors hover:bg-black/5 hover:text-[#1D1D1F] focus-visible:ring-2 focus-visible:ring-[#007AFF]/50 dark:text-[#98989D] dark:hover:bg-white/5 dark:hover:text-[#F5F5F7]"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={isDark ? 'dark' : 'light'}
            initial={{ y: -22, opacity: 0, rotate: -90, scale: 0.7 }}
            animate={{ y: 0, opacity: 1, rotate: 0, scale: 1 }}
            exit={{ y: 22, opacity: 0, rotate: 90, scale: 0.7 }}
            transition={{ duration: DUR.base, ease: EASE_APPLE }}
          >
            {isDark ? (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
              </svg>
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
              </svg>
            )}
          </motion.div>
        </AnimatePresence>
      </motion.button>
    </Magnetic>
  );
}

export interface UserMenuProps {
  fullName: string;
  initialsStr: string;
  role: string;
  onOpenShortcuts: () => void;
  onLogout: () => void;
}

export function UserMenu({ fullName: name, initialsStr, role, onOpenShortcuts, onLogout }: UserMenuProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const profile = useDeviceProfile();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const visible = usePageVisible();

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const first = menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]');
    first?.focus({ preventScroll: true });
  }, [open]);

  const handleProfile = useCallback(() => { setOpen(false); navigate('/settings'); }, [navigate]);
  const handleShortcuts = useCallback(() => { setOpen(false); onOpenShortcuts(); }, [onOpenShortcuts]);
  const handleLogout = useCallback(() => { setOpen(false); onLogout(); }, [onLogout]);

  const onMenuKeyDown = useCallback((e: KeyboardEvent) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    if (!items.length) return;
    e.preventDefault();
    const i = items.indexOf(document.activeElement as HTMLElement);
    let next = i;
    if (e.key === 'ArrowDown') next = i < 0 ? 0 : (i + 1) % items.length;
    else if (e.key === 'ArrowUp') next = i < 0 ? items.length - 1 : (i - 1 + items.length) % items.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = items.length - 1;
    items[next]?.focus();
  }, []);

  return (
    <div ref={ref} className="relative">
      <motion.button
        type="button"
        onClick={() => setOpen((o) => !o)}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={name}
        className="flex items-center gap-3 rounded-full py-1 pl-1 pr-3 outline-none transition-colors hover:bg-black/[0.04] focus-visible:ring-2 focus-visible:ring-[#007AFF]/50 dark:hover:bg-white/[0.06]"
      >
        <div className="relative">
          <motion.div
            className="relative h-10 w-10 rounded-full p-[2px]"
            animate={!profile.reduced && visible ? { rotate: 360 } : undefined}
            transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
          >
            <span
              className="absolute inset-0 rounded-full"
              style={{ background: 'conic-gradient(from 0deg, #007AFF, #5856D6, #FF2D55, #FF9500, #34C759, #007AFF)' }}
              aria-hidden
            />
            <div className="relative flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-[#007AFF] to-[#5856D6] text-[14px] font-bold text-white ring-2 ring-white/60 dark:ring-black/50">
              <span className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-b from-white/40 to-transparent" aria-hidden />
              <span className="relative">{initialsStr}</span>
            </div>
          </motion.div>
          <span
            className="medu-pulse-dot absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white dark:ring-[#1c1c1e]"
            style={{ background: '#34C759' }}
            aria-hidden
          />
        </div>
        <div className="hidden flex-col text-left xl:flex">
          <span className="text-[13px] font-semibold leading-tight tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">{name}</span>
          <span className="mt-1 text-[10px] font-semibold uppercase leading-none tracking-wider text-[#636366] dark:text-[#98989D]">
            {role.replace(/_/g, ' ')}
          </span>
        </div>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={menuRef}
            role="menu"
            onKeyDown={onMenuKeyDown}
            variants={popoverVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[260px] overflow-hidden rounded-[1.25rem] border border-[#00000010] bg-white/90 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-2xl dark:border-[#ffffff15] dark:bg-[#1c1c1ee6] dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.08)]"
          >
            <div className="border-b border-[#00000010] px-4 py-3.5 dark:border-[#ffffff10]">
              <p className="truncate text-[14px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">{name}</p>
              <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-[#636366] dark:text-[#98989D]">
                {role.replace(/_/g, ' ')}
              </p>
            </div>
            <div className="p-1.5">
              <MenuButton icon={I.user} label={t('nav.profile') || 'Profile'} onClick={handleProfile} />
              <MenuButton icon={I.keyboard} label={t('nav.shortcuts') || 'Keyboard shortcuts'} shortcut="⌘/" onClick={handleShortcuts} />
              <div className="my-1 h-px bg-[#00000010] dark:bg-[#ffffff10]" />
              <MenuButton icon={I.logout} label={t('nav.logout') || 'Sign out'} onClick={handleLogout} danger />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuButton({
  icon, label, shortcut, onClick, danger = false,
}: {
  icon: string[]; label: string; shortcut?: string; onClick: () => void; danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={[
        'flex w-full items-center gap-3 rounded-[0.75rem] px-3 py-2.5 text-left text-[13px] font-medium tracking-tight outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#007AFF]/50',
        danger
          ? 'text-[#FF3B30] hover:bg-[#FF3B30]/10 focus-visible:ring-[#FF3B30]/50'
          : 'text-[#1D1D1F] hover:bg-black/[0.05] dark:text-[#F5F5F7] dark:hover:bg-white/[0.06]',
      ].join(' ')}
    >
      <StaticIcon paths={icon} className="h-[1.05rem] w-[1.05rem] shrink-0 opacity-80" />
      <span className="flex-1 truncate">{label}</span>
      {shortcut && (
        <kbd className="shrink-0 rounded-md border border-[#00000015] bg-[#00000005] px-1.5 py-0.5 text-[10px] font-bold text-[#636366] dark:border-[#ffffff20] dark:bg-[#ffffff10] dark:text-[#98989D]">
          {shortcut}
        </kbd>
      )}
    </button>
  );
}

export interface TopBarProps {
  search: string;
  setSearch: (v: string) => void;
  searchRef: RefObject<HTMLInputElement>;
  isSearchFocused: boolean;
  setIsSearchFocused: (v: boolean) => void;
  onSearchKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  userFullName: string;
  userInitials: string;
  userRole: string;
  orgName: string;
  headerY: MotionValue<number>;
  headerScale: MotionValue<number>;
  onCommandPalette: () => void;
  onOpenShortcuts: () => void;
  onLogout: () => void;
}

export function TopBar({
  search, setSearch, searchRef, isSearchFocused, setIsSearchFocused,
  onSearchKeyDown, userFullName, userInitials, userRole, orgName,
  headerY, headerScale, onCommandPalette, onOpenShortcuts, onLogout,
}: TopBarProps) {
  const { t } = useI18n();
  const now = useNow();
  const greeting = t(getGreetingKey(now)) || 'Welcome';
  const profile = useDeviceProfile();

  return (
    <motion.header
      style={{ y: headerY, scale: headerScale, transformOrigin: 'top center' }}
      className="mx-4 mb-3 mt-4 hidden shrink-0 xl:flex"
    >
      <GlassSurface
        tone="topbar"
        className="w-full border border-[#ffffff70] shadow-[0_8px_32px_rgba(0,0,0,0.06),0_2px_8px_rgba(0,0,0,0.03)] dark:border-[#ffffff12] dark:shadow-[0_10px_40px_rgba(0,0,0,0.4)]"
        radius="1.75rem"
        spotlight={profile.allowCursorFx}
      >
        <div className="flex w-full items-center gap-4 px-5 py-3">
          <div className="hidden min-w-[200px] flex-col xl:flex">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#636366] dark:text-[#98989D]">
              <LiveClock /> · {greeting}
            </span>
            <span className="mt-0.5 truncate text-[14px] font-semibold leading-tight tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
              {orgName}
            </span>
          </div>

          <span className="hidden h-8 w-px bg-[#00000012] dark:bg-[#ffffff12] xl:block" aria-hidden />

          <motion.form
            className="relative flex-1"
            style={{ maxWidth: 560 }}
            animate={{ maxWidth: isSearchFocused ? 680 : 560 }}
            transition={SPRING.smooth}
            role="search"
            onSubmit={(e) => e.preventDefault()}
          >
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#636366] dark:text-[#98989D]">
              <StaticIcon paths={I.search} className="h-[18px] w-[18px]" />
            </span>
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={onSearchKeyDown}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              type="search"
              placeholder={t('nav.searchPlaceholder') || 'Search anything…'}
              className="w-full rounded-full border border-transparent bg-[#00000008] py-2.5 pl-11 pr-20 text-[14px] font-medium tracking-tight text-[#1D1D1F] outline-none transition-all placeholder:text-[#636366] focus:border-[#007AFF]/30 focus:bg-white focus:shadow-[0_0_0_4px_rgba(0,122,255,0.1)] dark:bg-[#ffffff10] dark:text-[#F5F5F7] dark:placeholder:text-[#98989D] dark:focus:border-[#0A84FF]/40 dark:focus:bg-[#1C1C1E]"
              aria-label={t('nav.searchPlaceholder') || 'Search'}
            />
            <button
              type="button"
              onClick={onCommandPalette}
              className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-1 overflow-hidden rounded-md border border-[#00000015] bg-[#00000005] px-2 py-1 text-[11px] font-bold text-[#636366] transition-colors hover:bg-[#00000010] focus-visible:ring-2 focus-visible:ring-[#007AFF]/50 dark:border-[#ffffff20] dark:bg-[#ffffff10] dark:text-[#98989D] dark:hover:bg-[#ffffff18]"
              aria-label={t('commandPalette.open')}
              title="Open command palette (⌘K)"
            >
              ⌘K
              {!profile.reduced && (
                <motion.span
                  className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/70 to-transparent"
                  initial={{ x: '-100%' }}
                  animate={{ x: '200%' }}
                  transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 4, ease: 'easeInOut' }}
                  aria-hidden
                />
              )}
            </button>
          </motion.form>

          <div className="ml-auto flex items-center gap-1.5">
            <Magnetic strength={0.4}>
              <motion.button
                type="button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setCalculatorOpen(true)}
                className="rounded-full p-2.5 text-[#636366] transition-colors hover:bg-black/5 hover:text-[#1D1D1F] focus-visible:ring-2 focus-visible:ring-[#007AFF]/50 dark:text-[#98989D] dark:hover:bg-white/5 dark:hover:text-[#F5F5F7]"
                title={t('nav.calculator') || 'Calculator'}
                aria-label={t('nav.calculator') || 'Calculator'}
              >
                <StaticIcon paths={I.calculator} className="h-[18px] w-[18px]" />
              </motion.button>
            </Magnetic>

            <LanguageSwitcher />
            <ThemeToggle />
            <NotificationsMenu />

            <span className="mx-2 h-8 w-px bg-[#00000015] dark:bg-[#ffffff15]" aria-hidden />

            <UserMenu
              fullName={userFullName}
              initialsStr={userInitials}
              role={userRole}
              onOpenShortcuts={onOpenShortcuts}
              onLogout={onLogout}
            />
          </div>
        </div>
      </GlassSurface>
    </motion.header>
  );
}

export function MobileTopBar({
  onOpenSearch,
  onOpenMenu,
}: {
  onOpenSearch: () => void;
  onOpenMenu: () => void;
}) {
  const { t } = useI18n();

  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-[calc(4rem+env(safe-area-inset-top,0px))] items-center pt-[env(safe-area-inset-top,0px)] xl:hidden">
      <GlassSurface
        tone="topbar"
        className="m-2.5 flex h-full w-full items-center justify-between border border-[#ffffff70] px-5 shadow-[0_4px_24px_rgba(0,0,0,0.06)] dark:border-[#ffffff15] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)]"
        radius="1.5rem"
        spotlight={false}
      >
        <Brand size="sm" />
        <div className="flex items-center gap-1.5">
          <Magnetic strength={0.4}>
            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={onOpenSearch}
              className="rounded-full p-2 text-[#636366] outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF]/50 dark:text-[#98989D]"
              aria-label={t('nav.searchPlaceholder') || 'Search'}
            >
              <StaticIcon paths={I.search} />
            </motion.button>
          </Magnetic>
          <Magnetic strength={0.4}>
            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={() => setCalculatorOpen(true)}
              className="rounded-full p-2 text-[#636366] outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF]/50 dark:text-[#98989D]"
              aria-label={t('nav.calculator') || 'Calculator'}
            >
              <StaticIcon paths={I.calculator} />
            </motion.button>
          </Magnetic>
          <ThemeToggle />
          <NotificationsMenu />
          <Magnetic strength={0.4}>
            <motion.button
              type="button"
              whileTap={{ scale: 0.9, rotate: -8 }}
              onClick={onOpenMenu}
              className="rounded-full p-2 text-[#1D1D1F] outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF]/50 dark:text-[#F5F5F7]"
              aria-label={t('a11y.openMenu') || 'Open menu'}
            >
              <StaticIcon paths={I.menu} className="h-6 w-6" />
            </motion.button>
          </Magnetic>
        </div>
      </GlassSurface>
    </header>
  );
}
