/**
 * M-EDU AuthLayout — Apple VisionOS / macOS Sequoia Liquid Glass Auth Shell.
 *
 * Features:
 * - Liquid Glass card with specular highlight rim, optical borders, and multi-tier ambient glow.
 * - Dynamic viewport adaptation (100dvh + calc(var(--app-vh, 1vh) * 100) fallback).
 * - Safe area inset padding for edge-to-edge iOS notch / dynamic island handling.
 * - Staggered kinetic typography with prefers-reduced-motion fallback.
 * - Top-right floating glass controls (LanguageSwitcher + Theme toggle) with >=44px touch targets.
 * - Responsive ergonomic card padding (p-5.5 sm:p-8 md:p-10) eliminating 320px squish.
 */
import { useMemo, useCallback, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MeduLogo } from '@/components/brand/MeduLogo';
import { Icon, usePrefersReducedMotion, type IconName } from '@/lib/design';
import { LanguageSwitcher } from '@/i18n/LanguageSwitcher';
import { useTheme } from '@/hooks/useTheme';
import { usePersistSettings } from '@/hooks/usePersistSettings';
import { useSafeI18n } from '@/i18n/I18nProvider';

const EASE = [0.16, 1, 0.3, 1] as const;
const TITLE_DELAY = 0.12;
const CHAR_STAGGER = 0.02;

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  showTrustBadges?: boolean;
}

/** Multi-layer ambient lighting — visionOS specular glow */
function AmbientWash() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Top primary glow orb */}
      <div className="absolute left-1/2 -top-40 h-[480px] w-[820px] -translate-x-1/2 rounded-full bg-gradient-to-b from-brand-500/[0.08] via-indigo-500/[0.04] to-transparent blur-[120px] dark:from-brand-500/[0.14] dark:via-purple-500/[0.07]" />

      {/* Bottom corner soft counter-glow */}
      <div className="absolute -bottom-24 -right-24 h-[360px] w-[360px] rounded-full bg-sky-400/[0.04] blur-[90px] dark:bg-sky-400/[0.07]" />
      <div className="absolute -bottom-24 -left-24 h-[360px] w-[360px] rounded-full bg-brand-400/[0.03] blur-[90px] dark:bg-brand-400/[0.06]" />

      {/* Subtle depth vignette */}
      <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black/[0.04] to-transparent dark:from-white/[0.02]" />
    </div>
  );
}

/** Staggered kinetic title with accessible full-label fallback */
function KineticTitle({ text, reduced }: { text: string; reduced: boolean }) {
  const chars = useMemo(() => Array.from(text), [text]);

  return (
    <h1
      className="mt-5 text-center text-[25px] font-semibold tracking-[-0.03em] text-primary sm:text-[28px]"
      aria-label={text}
    >
      <span className="sr-only">{text}</span>
      <span aria-hidden className="inline-block">
        {chars.map((c, i) => (
          <motion.span
            key={i}
            initial={reduced ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: TITLE_DELAY + i * CHAR_STAGGER, ease: EASE }}
            className="inline-block"
            style={c === ' ' ? { whiteSpace: 'pre' } : undefined}
          >
            {c === ' ' ? '\u00A0' : c}
          </motion.span>
        ))}
      </span>
    </h1>
  );
}

/** Top right glass theme toggle button with 44px HIG target */
function AuthThemeToggle() {
  const { setTheme, isDark } = useTheme();
  const persist = usePersistSettings();
  const reduced = usePrefersReducedMotion();

  const toggle = useCallback(() => {
    const next = isDark ? 'light' : 'dark';
    setTheme(next);
    persist({ theme: next });
  }, [isDark, setTheme, persist]);

  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.94 }}
      transition={{ type: 'spring', stiffness: 480, damping: 28, mass: 0.65 }}
      onClick={toggle}
      className="group relative flex h-10 w-10 min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-black/[0.08] bg-white/60 text-[#86868B] shadow-[0_4px_16px_-4px_rgba(0,0,0,0.08),inset_0_1px_1px_rgba(255,255,255,0.8)] backdrop-blur-2xl backdrop-saturate-[210%] transition-colors hover:border-[#007AFF]/40 hover:text-[#1D1D1F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 dark:border-white/[0.12] dark:bg-[#1C1C1E]/60 dark:text-[#98989D] dark:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.15)] dark:hover:border-[#0A84FF]/40 dark:hover:text-[#F5F5F7]"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-2 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/30"
      />
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={isDark ? 'dark' : 'light'}
          initial={reduced ? { opacity: 0 } : { y: -6, rotate: -25, scale: 0.8, opacity: 0 }}
          animate={{ y: 0, rotate: 0, scale: 1, opacity: 1 }}
          exit={reduced ? { opacity: 0 } : { y: 6, rotate: 25, scale: 0.8, opacity: 0 }}
          transition={reduced ? { duration: 0 } : { duration: 0.2 }}
          className="inline-flex items-center justify-center"
        >
          {isDark ? (
            <svg
              className="h-4.5 w-4.5 text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.45)]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
            </svg>
          ) : (
            <svg
              className="h-4.5 w-4.5 text-indigo-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
            </svg>
          )}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}

/** Trust signals — visionOS pill badges with micro glass surface */
const TRUST: readonly { label: string; icon: IconName }[] = [
  { label: '256-bit SSL', icon: 'lock' },
  { label: 'Face ID / WebAuthn', icon: 'user' },
  { label: 'GDPR / Privacy', icon: 'shieldCheck' },
];

function TrustBadges({ reduced }: { reduced: boolean }) {
  return (
    <motion.ul
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.45, duration: 0.25, ease: EASE }}
      className="mt-6 flex flex-wrap items-center justify-center gap-2"
    >
      {TRUST.map((item) => (
        <li
          key={item.label}
          className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.06] bg-black/[0.02] px-3 py-1 text-[11px] font-medium text-secondary shadow-[0_1px_3px_rgba(0,0,0,0.02)] backdrop-blur-md dark:border-white/[0.08] dark:bg-white/[0.04] dark:shadow-[0_1px_3px_rgba(0,0,0,0.2)]"
        >
          <Icon name={item.icon} size={15} />
          {item.label}
        </li>
      ))}
    </motion.ul>
  );
}

export function AuthLayout({ children, title, subtitle, showTrustBadges = false }: AuthLayoutProps) {
  const reduced = usePrefersReducedMotion();
  const { t } = useSafeI18n();

  return (
    <div className="relative flex min-h-screen min-h-[calc(var(--app-vh,1vh)*100)] min-h-dvh flex-col items-center justify-center overflow-x-hidden bg-[var(--bg-base)] px-4 pt-[calc(1.5rem+env(safe-area-inset-top,0px))] pb-[calc(2rem+env(safe-area-inset-bottom,0px))] pl-[calc(1rem+env(safe-area-inset-left,0px))] pr-[calc(1rem+env(safe-area-inset-right,0px))] text-primary selection:bg-brand-500/20 selection:text-brand-600 dark:selection:text-brand-400">
      <AmbientWash />

      {/* Top Floating Glass Navigation Bar (Language & Theme) */}
      <aside
        aria-label={t('settings.title', 'Settings')}
        className="fixed right-4 top-4 z-40 flex items-center gap-2.5 pt-[env(safe-area-inset-top,0px)] pr-[env(safe-area-inset-right,0px)]"
      >
        <LanguageSwitcher />
        <AuthThemeToggle />
      </aside>

      {/* Main Glass Centerpiece */}
      <main className="relative z-10 w-full max-w-[440px] my-auto">
        <header className="mb-6 text-center sm:mb-8">
          <motion.div
            initial={reduced ? false : { opacity: 0, scale: 0.92, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="group relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-black/[0.08] bg-white/70 p-2.5 shadow-[0_8px_24px_-6px_rgba(0,0,0,0.08),inset_0_1px_1px_rgba(255,255,255,0.9)] backdrop-blur-2xl backdrop-saturate-[200%] transition-transform hover:scale-105 dark:border-white/[0.14] dark:bg-[#1C1C1E]/70 dark:shadow-[0_8px_24px_-6px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.18)]"
          >
            {/* Specular top rim on logo card */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-2 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/30"
            />
            <MeduLogo size="lg" />
          </motion.div>

          <KineticTitle text={title} reduced={reduced} />

          {subtitle && (
            <motion.p
              initial={reduced ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.28, duration: 0.25, ease: EASE }}
              className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-secondary sm:text-[14px]"
            >
              {subtitle}
            </motion.p>
          )}
        </header>

        {/* VisionOS Specular Liquid Glass Card Container */}
        <div className="relative rounded-2xl sm:rounded-3xl border border-black/[0.08] bg-card/85 p-5.5 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.12),inset_0_1px_1px_rgba(255,255,255,0.8)] backdrop-blur-2xl backdrop-saturate-[190%] dark:border-white/[0.12] dark:bg-[#161618]/80 dark:shadow-[0_20px_50px_-16px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.12)] sm:p-8 md:p-9.5">
          {/* Hairline glass inner highlight rim */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-4 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/20"
          />
          {children}
        </div>

        {showTrustBadges && <TrustBadges reduced={reduced} />}

        <footer className="mt-6 text-center">
          <p className="text-[11px] font-medium tracking-wide text-muted">
            &copy; {new Date().getFullYear()} M-EDU &middot; Education Management Platform
          </p>
        </footer>
      </main>
    </div>
  );
}
