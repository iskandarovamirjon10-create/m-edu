/**
 * M-EDU Mobile Navigation Systems — v11 "Titanium"
 * Thumb-zone bottom bar, accessible slide-over drawer, and modal search sheet.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '@/i18n/I18nProvider';
import {
  SPRING, DUR, EASE_APPLE,
  mobileSheetVariants, backdropVariants,
} from '../core/tokens';
import { useFocusTrap } from '../core/singletons';
import { GlassSurface } from './GlassSurface';
import { Brand } from './Brand';
import { StaticIcon, Magnetic, I } from './Icons';
import {
  ALL_ITEMS_MAP, HIDDEN_FOR_STUDENT, NavItems, type NavItem,
} from './Sidebar';

const MOBILE_TAB_ROUTES = ['/', '/attendance', '/students', '/face'] as const;

export function MobileBottomNav({
  role,
  onOpenMore,
}: {
  role: string;
  onOpenMore: () => void;
}) {
  const { t } = useI18n();
  const normalizedRole = role?.toUpperCase() ?? '';
  const tabs = useMemo(
    () =>
      MOBILE_TAB_ROUTES.map((route) => ALL_ITEMS_MAP.get(route))
        .filter((item): item is NavItem => Boolean(item))
        .filter((item) => !(normalizedRole === 'STUDENT' && HIDDEN_FOR_STUDENT.has(item.to))),
    [normalizedRole],
  );

  return (
    <nav
      aria-label={t('a11y.primaryNav', 'Primary navigation')}
      className="fixed inset-x-0 bottom-0 z-40 px-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom,0px))] md:hidden"
    >
      <GlassSurface
        tone="topbar"
        radius="1.5rem"
        spotlight={false}
        className="border border-[#00000010] shadow-[0_-4px_24px_rgba(0,0,0,0.06)] dark:border-[#ffffff12] dark:shadow-[0_-4px_24px_rgba(0,0,0,0.5)]"
      >
        <ul className="flex items-stretch">
          {tabs.map((item) => (
            <li key={item.to} className="min-w-0 flex-1">
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  [
                    'flex min-h-[3.25rem] flex-col items-center justify-center gap-1 rounded-[1.25rem] px-1 py-1.5 text-[10px] font-semibold tracking-tight outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#007AFF]/50',
                    isActive
                      ? 'text-[#007AFF] dark:text-[#0A84FF]'
                      : 'text-[#636366] dark:text-[#98989D]',
                  ].join(' ')
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={isActive ? 'opacity-100' : 'opacity-75'}>
                      <StaticIcon paths={item.iconPath} className="h-[1.35rem] w-[1.35rem]" />
                    </span>
                    <span className="max-w-full truncate">{t(item.labelKey) || item.label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
          <li className="min-w-0 flex-1">
            <button
              type="button"
              onClick={onOpenMore}
              aria-label={t('a11y.openMenu', 'Open menu')}
              className="flex min-h-[3.25rem] w-full flex-col items-center justify-center gap-1 rounded-[1.25rem] px-1 py-1.5 text-[10px] font-semibold tracking-tight text-[#636366] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#007AFF]/50 dark:text-[#98989D]"
            >
              <StaticIcon paths={I.menu} className="h-[1.35rem] w-[1.35rem]" />
              <span>{t('nav.more', 'More')}</span>
            </button>
          </li>
        </ul>
      </GlassSurface>
    </nav>
  );
}

export function MobileMenuDrawer({
  open,
  onClose,
  role,
  orgName,
  onLogout,
}: {
  open: boolean;
  onClose: () => void;
  role: string;
  orgName: string;
  onLogout: () => void;
}) {
  const { t } = useI18n();
  const drawerRef = useRef<HTMLDivElement | null>(null);

  useFocusTrap(drawerRef, open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="mobile-menu"
          className="fixed inset-0 z-[60] xl:hidden"
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          <motion.div
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute inset-0 bg-black/40"
            onClick={onClose}
          />
          <motion.div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label={t('a11y.mainNav') || 'Navigation menu'}
            variants={mobileSheetVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute left-0 top-0 ml-2.5 mt-2.5 h-[calc(100dvh-20px-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] w-[min(290px,86vw)]"
          >
            <GlassSurface
              tone="sidebar"
              className="flex flex-1 h-full min-h-0 flex-col overflow-hidden border border-[#00000010] shadow-[20px_0_40px_rgba(0,0,0,0.08)] dark:border-[#ffffff15] dark:shadow-[20px_0_40px_rgba(0,0,0,0.2)]"
              radius="2rem"
              spotlight={false}
            >
              <div className="flex h-16 shrink-0 items-center justify-between border-b border-[#00000010] px-6 dark:border-[#ffffff10]">
                <Brand />
                <Magnetic strength={0.4}>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.9, rotate: 90 }}
                    onClick={onClose}
                    className="rounded-full bg-black/5 p-2 text-[#636366] outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF]/50 dark:bg-white/10 dark:text-[#98989D]"
                    aria-label={t('a11y.closeMenu') || 'Close menu'}
                  >
                    <StaticIcon paths={I.close} />
                  </motion.button>
                </Magnetic>
              </div>
              <div className="shrink-0 border-b border-[#00000010] px-6 py-4 dark:border-[#ffffff10]">
                <p className="truncate text-[15px] font-semibold tracking-tight">{orgName}</p>
                <p className="mt-0.5 text-[12px] font-medium capitalize text-[#636366] dark:text-[#98989D]">
                  {role.replace(/_/g, ' ').toLowerCase()}
                </p>
              </div>
              <NavItems role={role} onNavigate={onClose} />
              <div className="shrink-0 border-t border-[#00000010] p-4 dark:border-[#ffffff10]">
                <button
                  type="button"
                  onClick={onLogout}
                  className="flex w-full items-center justify-center gap-2.5 rounded-[1rem] bg-[#FF3B30]/10 px-4 py-3 text-[14px] font-bold text-[#FF3B30] transition-colors hover:bg-[#FF3B30]/20 focus-visible:ring-2 focus-visible:ring-[#FF3B30]/50"
                >
                  <StaticIcon paths={I.logout} />
                  {t('nav.logout')}
                </button>
              </div>
            </GlassSurface>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function MobileSearchSheet({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (q: string) => void;
}) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [value, setValue] = useState('');

  useFocusTrap(containerRef, open, inputRef);

  useEffect(() => {
    if (!open) setValue('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const submit = useCallback(() => {
    const q = value.trim();
    if (!q) return;
    onSubmit(q);
    onClose();
  }, [value, onSubmit, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="mobile-search"
          className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[calc(5rem+env(safe-area-inset-top,0px))] xl:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: DUR.base, ease: EASE_APPLE }}
        >
          <motion.div
            className="absolute inset-0 bg-black/40"
            onClick={onClose}
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            aria-hidden
          />
          <motion.div
            ref={containerRef}
            role="dialog"
            aria-modal="true"
            aria-label={t('nav.searchPlaceholder') || 'Search'}
            initial={{ y: -20, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -20, opacity: 0, scale: 0.96 }}
            transition={SPRING.smooth}
            className="relative w-full max-w-md"
          >
            <GlassSurface tone="modal" className="border border-[#ffffff60] shadow-2xl dark:border-[#ffffff15]" radius="1.5rem">
              <div className="flex items-center gap-3 px-4 py-3">
                <StaticIcon paths={I.search} className="h-5 w-5 text-[#636366] dark:text-[#98989D]" />
                <input
                  ref={inputRef}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submit();
                  }}
                  placeholder={t('nav.searchPlaceholder') || 'Search…'}
                  className="flex-1 bg-transparent text-[15px] font-medium outline-none placeholder:text-[#636366] dark:placeholder:text-[#98989D]"
                  aria-label={t('nav.searchPlaceholder') || 'Search'}
                  type="search"
                />
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full p-1.5 text-[#636366] hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-[#007AFF]/50 dark:text-[#98989D] dark:hover:bg-white/10"
                  aria-label={t('a11y.closeSearch') || 'Close search'}
                >
                  <StaticIcon paths={I.close} className="h-4 w-4" />
                </button>
              </div>
            </GlassSurface>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
