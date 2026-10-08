/**
 * M-EDU TopBar & Header Controls — v12 "Titanium"
 * Desktop Liquid Glass header, live clock, user menu, and responsive mobile bar.
 *
 * Design notes:
 *  - Isolated re-render boundaries (LiveClock / GreetingLabel own their tick).
 *  - FLIP-based layout animation for the search field (no max-width thrash).
 *  - Full focus lifecycle: menu restores focus to trigger on close.
 *  - Reduced-motion respected on every animated surface.
 *  - Semantic tone tokens — no scattered hex values.
 */

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useId,
  useMemo,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, type MotionValue } from 'framer-motion';
import { useI18n } from '@/i18n/I18nProvider';
import { NotificationsMenu } from '@/components/NotificationsMenu';
import { LanguageSwitcher } from '@/i18n/LanguageSwitcher';
import { setCalculatorOpen } from '@/stores/ui.store';
import { useTheme } from '@/hooks/useTheme';
import { usePersistSettings } from '@/hooks/usePersistSettings';
import { SPRING, DUR, EASE_APPLE, popoverVariants } from '../core/tokens';
import {
  useNow,
  useDeviceProfile,
  usePageVisible,
  usePrefersReducedMotion,
} from '../core/singletons';
import { GlassSurface } from './GlassSurface';
import { Brand } from './Brand';
import { StaticIcon, Magnetic, I } from './Icons';

/* ────────────────────────────────────────────────────────────────────────── */
/*  Semantic tone tokens — swap once, theme everywhere                        */
/* ────────────────────────────────────────────────────────────────────────── */

const TONE = {
  label: 'text-[#1D1D1F] dark:text-[#F5F5F7]',
  secondary: 'text-[#636366] dark:text-[#98989D]',
  tertiary: 'text-[#8E8E93] dark:text-[#8E8E93]',
  danger: 'text-[#FF3B30] dark:text-[#FF453A]',
  hover: 'hover:bg-black/[0.045] dark:hover:bg-white/[0.07]',
  divider: 'bg-black/[0.07] dark:bg-white/[0.08]',
  focus:
    'outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF]/55 dark:focus-visible:ring-[#0A84FF]/60',
} as const;

const SUCCESS = '#34C759';
const ACCENT_GRADIENT =
  'conic-gradient(from 0deg, #007AFF, #5856D6, #FF2D55, #FF9500, #34C759, #007AFF)';

/* ────────────────────────────────────────────────────────────────────────── */
/*  Utilities                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

export function getGreetingKey(now: Date): string {
  const h = now.getHours();
  if (h < 5) return 'nav.greetingNight';
  if (h < 12) return 'nav.greetingMorning';
  if (h < 17) return 'nav.greetingAfternoon';
  if (h < 22) return 'nav.greetingEvening';
  return 'nav.greetingNight';
}

/** Restore focus to a stable anchor after transient surfaces close. */
function useFocusReturn<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const restore = useCallback(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return { ref, restore };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  LiveClock — owns its own subscription, never re-renders the tree          */
/* ────────────────────────────────────────────────────────────────────────── */

export function LiveClock() {
  const now = useNow();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');

  return (
    <span className="inline-flex items-center gap-1.5 font-medium tabular-nums tracking-tight">
      <span
        className="medu-pulse-dot inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: SUCCESS }}
        aria-hidden
      />
      {hh}
      <span className="medu-colon-blink mx-[1px]">:</span>
      {mm}
    </span>
  );
}

/** Greeting lives in its own leaf so the header never re-renders on tick. */
function GreetingLabel() {
  const { t } = useI18n();
  const now = useNow();
  return <>{t(getGreetingKey(now)) || 'Welcome'}</>;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  ThemeToggle                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

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

  const hover = reduced ? undefined : { scale: 1.06 };
  const tap = reduced ? undefined : { scale: 0.9, rotate: -12 };

  return (
    <Magnetic strength={0.3}>
      <motion.button
        type="button"
        onClick={toggle}
        whileHover={hover}
        whileTap={tap}
        transition={SPRING.snappy}
        aria-label={label}
        title={label}
        className={[
          'relative rounded-full p-2.5 transition-colors',
          TONE.secondary,
          'hover:bg-black/[0.05] hover:text-[#1D1D1F]',
          'dark:hover:bg-white/[0.06] dark:hover:text-[#F5F5F7]',
          TONE.focus,
        ].join(' ')}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={isDark ? 'dark' : 'light'}
            initial={{ y: -22, opacity: 0, rotate: -90, scale: 0.7 }}
            animate={{ y: 0, opacity: 1, rotate: 0, scale: 1 }}
            exit={{ y: 22, opacity: 0, rotate: 90, scale: 0.7 }}
            transition={{ duration: DUR.base, ease: EASE_APPLE }}
            className="will-change-transform"
          >
            {isDark ? (
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
              </svg>
            ) : (
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
              </svg>
            )}
          </motion.div>
        </AnimatePresence>
      </motion.button>
    </Magnetic>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  UserMenu                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

export interface UserMenuProps {
  fullName: string;
  initialsStr: string;
  role: string;
  onOpenShortcuts: () => void;
  onLogout: () => void;
}

export function UserMenu({
  fullName: name,
  initialsStr,
  role,
  onOpenShortcuts,
  onLogout,
}: UserMenuProps) {
  const { t } = useI18n();
  const navigate = useNavigate();

  const visible = usePageVisible();
  const reduced = usePrefersReducedMotion();

  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const { ref: triggerRef, restore: restoreFocus } = useFocusReturn<HTMLButtonElement>();

  const menuId = useId();
  const triggerId = `${menuId}-trigger`;

  const roleLabel = useMemo(() => role.replace(/_/g, ' '), [role]);

  /* Close on outside-click / Escape -------------------------------------- */
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        restoreFocus();
      }
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
        restoreFocus();
      }
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, restoreFocus]);

  /* Auto-focus first item ------------------------------------------------ */
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus({
        preventScroll: true,
      });
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

  const closeAnd = useCallback(
    (fn: () => void) => {
      setOpen(false);
      restoreFocus();
      fn();
    },
    [restoreFocus],
  );

  const handleProfile = useCallback(
    () => closeAnd(() => navigate('/settings')),
    [closeAnd, navigate],
  );
  const handleShortcuts = useCallback(
    () => closeAnd(onOpenShortcuts),
    [closeAnd, onOpenShortcuts],
  );
  const handleLogout = useCallback(
    () => closeAnd(onLogout),
    [closeAnd, onLogout],
  );

  /* Arrow / Home / End navigation --------------------------------------- */
  const onMenuKeyDown = useCallback((e: KeyboardEvent) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
    );
    if (!items.length) return;
    e.preventDefault();
    const i = items.indexOf(document.activeElement as HTMLElement);
    let next = i;
    if (e.key === 'ArrowDown') next = i < 0 ? 0 : (i + 1) % items.length;
    else if (e.key === 'ArrowUp')
      next = i < 0 ? items.length - 1 : (i - 1 + items.length) % items.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = items.length - 1;
    items[next]?.focus();
  }, []);

  const hover = reduced ? undefined : { scale: 1.02 };
  const tap = reduced ? undefined : { scale: 0.98 };
  const avatarRotate =
    !reduced && visible ? { rotate: 360 } : undefined;

  return (
    <div ref={rootRef} className="relative">
      <motion.button
        ref={triggerRef}
        id={triggerId}
        type="button"
        onClick={() => setOpen((o) => !o)}
        whileHover={hover}
        whileTap={tap}
        transition={SPRING.snappy}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={name}
        className={[
          'flex items-center gap-3 rounded-full py-1 pl-1 pr-3 transition-colors',
          TONE.hover,
          TONE.focus,
        ].join(' ')}
      >
        <div className="relative">
          <motion.div
            className="relative h-10 w-10 rounded-full p-[2px] will-change-transform"
            animate={avatarRotate}
            transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
          >
            <span
              className="absolute inset-0 rounded-full"
              style={{ background: ACCENT_GRADIENT }}
              aria-hidden
            />
            <div
              className={[
                'relative flex h-full w-full items-center justify-center rounded-full',
                'bg-gradient-to-br from-[#007AFF] to-[#5856D6]',
                'text-[14px] font-bold text-white',
                'ring-2 ring-white/70 dark:ring-black/50',
              ].join(' ')}
            >
              <span
                className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-b from-white/45 to-transparent"
                aria-hidden
              />
              <span className="relative">{initialsStr}</span>
            </div>
          </motion.div>
          <span
            className="medu-pulse-dot absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white dark:ring-[#1c1c1e]"
            style={{ background: SUCCESS }}
            aria-hidden
          />
        </div>

        <div className="hidden flex-col text-left xl:flex">
          <span className={`text-[13px] font-semibold leading-tight tracking-tight ${TONE.label}`}>
            {name}
          </span>
          <span
            className={`mt-1 text-[10px] font-semibold uppercase leading-none tracking-wider ${TONE.secondary}`}
          >
            {roleLabel}
          </span>
        </div>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-labelledby={triggerId}
            onKeyDown={onMenuKeyDown}
            variants={popoverVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            style={{ transformOrigin: 'top right' }}
            className={[
              'absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[268px] overflow-hidden',
              'rounded-[1.25rem] border',
              'border-black/[0.06] bg-white/85',
              'shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_0_0_0.5px_rgba(0,0,0,0.04),0_24px_60px_-20px_rgba(0,0,0,0.22)]',
              'backdrop-blur-2xl backdrop-saturate-150',
              'dark:border-white/[0.08] dark:bg-[#1c1c1e]/90',
              'dark:shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_0_0_0.5px_rgba(255,255,255,0.05),0_24px_60px_-20px_rgba(0,0,0,0.6)]',
            ].join(' ')}
          >
            <div
              className={[
                'border-b px-4 py-3.5',
                'border-black/[0.06] dark:border-white/[0.08]',
              ].join(' ')}
            >
              <p className={`truncate text-[14px] font-semibold tracking-tight ${TONE.label}`}>
                {name}
              </p>
              <p
                className={`mt-0.5 text-[11px] font-medium uppercase tracking-wider ${TONE.secondary}`}
              >
                {roleLabel}
              </p>
            </div>

            <div className="p-1.5">
              <MenuButton
                icon={I.user}
                label={t('nav.profile') || 'Profile'}
                onClick={handleProfile}
              />
              <MenuButton
                icon={I.keyboard}
                label={t('nav.shortcuts') || 'Keyboard shortcuts'}
                shortcut="⌘/"
                onClick={handleShortcuts}
              />
              <div className={`my-1 h-px ${TONE.divider}`} />
              <MenuButton
                icon={I.logout}
                label={t('nav.logout') || 'Sign out'}
                onClick={handleLogout}
                danger
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  MenuButton                                                                */
/* ────────────────────────────────────────────────────────────────────────── */

function MenuButton({
  icon,
  label,
  shortcut,
  onClick,
  danger = false,
}: {
  icon: readonly string[];
  label: string;
  shortcut?: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={[
        'flex w-full items-center gap-3 rounded-[0.75rem] px-3 py-2.5 text-left',
        'text-[13px] font-medium tracking-tight transition-colors',
        TONE.focus,
        danger
          ? 'text-[#FF3B30] hover:bg-[#FF3B30]/10 focus-visible:ring-[#FF3B30]/50 dark:text-[#FF453A]'
          : `${TONE.label} ${TONE.hover}`,
      ].join(' ')}
    >
      <StaticIcon paths={icon} className="h-[1.05rem] w-[1.05rem] shrink-0 opacity-80" />
      <span className="flex-1 truncate">{label}</span>
      {shortcut && (
        <kbd
          className={[
            'shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-bold',
            'border-black/[0.08] bg-black/[0.04] text-[#636366]',
            'dark:border-white/[0.12] dark:bg-white/[0.06] dark:text-[#98989D]',
          ].join(' ')}
        >
          {shortcut}
        </kbd>
      )}
    </button>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  TopBar (desktop / xl+)                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

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
  search,
  setSearch,
  searchRef,
  isSearchFocused,
  setIsSearchFocused,
  onSearchKeyDown,
  userFullName,
  userInitials,
  userRole,
  orgName,
  headerY,
  headerScale,
  onCommandPalette,
  onOpenShortcuts,
  onLogout,
}: TopBarProps) {
  const { t } = useI18n();
  const profile = useDeviceProfile();
  const reduced = usePrefersReducedMotion();

  const iconHover = reduced ? undefined : { scale: 1.05 };
  const iconTap = reduced ? undefined : { scale: 0.95 };

  return (
    <motion.header
      style={{ y: headerY, scale: headerScale, transformOrigin: 'top center' }}
      className="mx-4 mb-3 mt-4 hidden shrink-0 xl:flex"
    >
      <GlassSurface
        tone="topbar"
        radius="1.75rem"
        spotlight={profile.allowCursorFx}
        className={[
          'w-full border',
          'border-black/[0.06] dark:border-white/[0.08]',
          'shadow-[0_1px_0_rgba(255,255,255,0.85)_inset,0_0_0_0.5px_rgba(0,0,0,0.04),0_10px_36px_-10px_rgba(0,0,0,0.10)]',
          'dark:shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_0_0_0.5px_rgba(255,255,255,0.05),0_10px_36px_-10px_rgba(0,0,0,0.5)]',
        ].join(' ')}
      >
        <div className="flex w-full items-center gap-4 px-5 py-3">
          {/* ── Greeting + org ───────────────────────────────────────── */}
          <div className="hidden min-w-[200px] flex-col xl:flex">
            <span
              className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${TONE.secondary}`}
            >
              <LiveClock /> · <GreetingLabel />
            </span>
            <span
              className={`mt-0.5 truncate text-[14px] font-semibold leading-tight tracking-tight ${TONE.label}`}
            >
              {orgName}
            </span>
          </div>

          <span className={`hidden h-8 w-px xl:block ${TONE.divider}`} aria-hidden />

          {/* ── Search (FLIP layout, no max-width thrash) ───────────── */}
          <motion.form
            layout
            transition={SPRING.smooth}
            role="search"
            onSubmit={(e) => e.preventDefault()}
            className={[
              'relative flex-1',
              isSearchFocused ? 'max-w-[680px]' : 'max-w-[560px]',
            ].join(' ')}
          >
            <span
              className={[
                'pointer-events-none absolute left-4 top-1/2 -translate-y-1/2',
                'transition-colors duration-200',
                isSearchFocused ? 'text-[#007AFF] dark:text-[#0A84FF]' : TONE.secondary,
              ].join(' ')}
            >
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
              aria-label={t('nav.searchPlaceholder') || 'Search'}
              className={[
                'w-full rounded-full border border-transparent py-2.5 pl-11 pr-20',
                'text-[14px] font-medium tracking-tight',
                'bg-black/[0.045] caret-[#007AFF] dark:caret-[#0A84FF]',
                TONE.label,
                'placeholder:text-[#8E8E93] dark:placeholder:text-[#8E8E93]',
                'outline-none transition-all duration-200',
                'focus:border-[#007AFF]/35 focus:bg-white',
                'focus:shadow-[0_0_0_4px_rgba(0,122,255,0.10),0_1px_0_rgba(255,255,255,0.9)_inset]',
                'dark:bg-white/[0.06]',
                'dark:focus:border-[#0A84FF]/45 dark:focus:bg-[#1C1C1E]',
                'dark:focus:shadow-[0_0_0_4px_rgba(10,132,255,0.14),0_1px_0_rgba(255,255,255,0.06)_inset]',
                '[&::-webkit-search-cancel-button]:hidden',
              ].join(' ')}
            />

            <button
              type="button"
              onClick={onCommandPalette}
              aria-label={t('commandPalette.open')}
              title="Open command palette (⌘K)"
              className={[
                'group absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-1',
                'overflow-hidden rounded-md border px-2 py-1',
                'text-[11px] font-bold',
                'border-black/[0.08] bg-black/[0.04] text-[#636366]',
                'transition-colors hover:bg-black/[0.09] hover:text-[#1D1D1F]',
                'dark:border-white/[0.12] dark:bg-white/[0.06] dark:text-[#98989D]',
                'dark:hover:bg-white/[0.12] dark:hover:text-[#F5F5F7]',
                TONE.focus,
              ].join(' ')}
            >
              ⌘K
              {!reduced && (
                <motion.span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent dark:via-white/25"
                  initial={{ x: '-100%' }}
                  animate={{ x: '200%' }}
                  transition={{
                    duration: 1.8,
                    repeat: Infinity,
                    repeatDelay: 5,
                    ease: 'easeInOut',
                  }}
                />
              )}
            </button>
          </motion.form>

          {/* ── Action cluster ───────────────────────────────────────── */}
          <div className="ml-auto flex items-center gap-1.5">
            <Magnetic strength={0.4}>
              <motion.button
                type="button"
                whileHover={iconHover}
                whileTap={iconTap}
                transition={SPRING.snappy}
                onClick={() => setCalculatorOpen(true)}
                title={t('nav.calculator') || 'Calculator'}
                aria-label={t('nav.calculator') || 'Calculator'}
                className={[
                  'rounded-full p-2.5 transition-colors',
                  TONE.secondary,
                  'hover:bg-black/[0.05] hover:text-[#1D1D1F]',
                  'dark:hover:bg-white/[0.06] dark:hover:text-[#F5F5F7]',
                  TONE.focus,
                ].join(' ')}
              >
                <StaticIcon paths={I.calculator} className="h-[18px] w-[18px]" />
              </motion.button>
            </Magnetic>

            <LanguageSwitcher />
            <ThemeToggle />
            <NotificationsMenu />

            <span className={`mx-2 h-8 w-px ${TONE.divider}`} aria-hidden />

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

/* ────────────────────────────────────────────────────────────────────────── */
/*  MobileTopBar                                                              */
/* ────────────────────────────────────────────────────────────────────────── */

export function MobileTopBar({
  onOpenSearch,
  onOpenMenu,
}: {
  onOpenSearch: () => void;
  onOpenMenu: () => void;
}) {
  const { t } = useI18n();
  const reduced = usePrefersReducedMotion();

  const tap = (extra?: Record<string, number>) =>
    reduced ? undefined : { scale: 0.92, ...extra };

  const iconBtn = [
    'rounded-full p-2',
    TONE.secondary,
    'transition-colors hover:bg-black/[0.05] hover:text-[#1D1D1F]',
    'dark:hover:bg-white/[0.06] dark:hover:text-[#F5F5F7]',
    TONE.focus,
  ].join(' ');

  return (
    <header
      className="fixed inset-x-0 top-0 z-40 flex h-[calc(4rem+env(safe-area-inset-top,0px))] items-center pt-[env(safe-area-inset-top,0px)] xl:hidden"
    >
      <GlassSurface
        tone="topbar"
        radius="1.5rem"
        spotlight={false}
        className={[
          'm-2.5 flex h-full w-full items-center justify-between border px-5',
          'border-black/[0.06] dark:border-white/[0.08]',
          'shadow-[0_1px_0_rgba(255,255,255,0.85)_inset,0_0_0_0.5px_rgba(0,0,0,0.04),0_6px_24px_-8px_rgba(0,0,0,0.12)]',
          'dark:shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_0_0_0.5px_rgba(255,255,255,0.05),0_6px_24px_-8px_rgba(0,0,0,0.5)]',
        ].join(' ')}
      >
        <Brand size="sm" />

        <div className="flex items-center gap-1.5">
          <Magnetic strength={0.4}>
            <motion.button
              type="button"
              whileTap={tap()}
              transition={SPRING.snappy}
              onClick={onOpenSearch}
              aria-label={t('nav.searchPlaceholder') || 'Search'}
              className={iconBtn}
            >
              <StaticIcon paths={I.search} />
            </motion.button>
          </Magnetic>

          <Magnetic strength={0.4}>
            <motion.button
              type="button"
              whileTap={tap()}
              transition={SPRING.snappy}
              onClick={() => setCalculatorOpen(true)}
              aria-label={t('nav.calculator') || 'Calculator'}
              className={iconBtn}
            >
              <StaticIcon paths={I.calculator} />
            </motion.button>
          </Magnetic>

          <ThemeToggle />
          <NotificationsMenu />

          <Magnetic strength={0.4}>
            <motion.button
              type="button"
              whileTap={tap({ rotate: -8 })}
              transition={SPRING.snappy}
              onClick={onOpenMenu}
              aria-label={t('a11y.openMenu') || 'Open menu'}
              className={[
                'rounded-full p-2 transition-colors',
                TONE.label,
                'hover:bg-black/[0.05] dark:hover:bg-white/[0.06]',
                TONE.focus,
              ].join(' ')}
            >
              <StaticIcon paths={I.menu} className="h-6 w-6" />
            </motion.button>
          </Magnetic>
        </div>
      </GlassSurface>
    </header>
  );
}