/**
 * M-EDU AuthLayout — "iOS 27 · Spatial Liquid Glass" Architecture
 * V4.0 Calculated — Full 4-Theme & Token Synchronization
 *
 * Characteristics:
 * - Decoupled token consumption: 100% synchronized with design-tokens.css V4.
 * - Multi-layer living chromatic aurora with mathematical easing.
 * - True pitch black in OLED mode (ambient lights suppressed).
 * - Full 44px Apple HIG tap targets for Theme & Language toggles.
 * - 120 Hz GPU compositor optimization (transform/opacity only).
 */
import { useCallback, memo, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MeduLogo } from '@/components/brand/MeduLogo';
import { Icon, usePrefersReducedMotion, type IconName } from '@/lib/design';
import { LanguageSwitcher } from '@/i18n/LanguageSwitcher';
import { useTheme } from '@/hooks/useTheme';
import { usePersistSettings } from '@/hooks/usePersistSettings';
import { useSafeI18n } from '@/i18n/I18nProvider';

const EASE = [0.16, 1, 0.3, 1] as const;

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  showTrustBadges?: boolean;
}

/** Multi-layer spatial atmospheric lighting — Synced with V4 tokens */
const AmbientWash = memo(function AmbientWash() {
  const reduced = usePrefersReducedMotion();

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden select-none">
      {/* Primary Crown Aurora */}
      <motion.div
        animate={
          reduced
            ? undefined
            : {
                scale: [1, 1.08, 0.98, 1],
                x: ['-50%', '-48%', '-52%', '-50%'],
                y: [0, 15, -10, 0],
              }
        }
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        className="orb-cyan-1 absolute left-1/2 -top-44 h-[540px] w-[920px] rounded-full blur-[130px] opacity-70"
      />

      {/* Violet / Iridescent Spatial Orb — Bottom Right */}
      <motion.div
        animate={
          reduced
            ? undefined
            : {
                scale: [1, 1.15, 0.95, 1],
                x: [0, -25, 15, 0],
                y: [0, -20, 10, 0],
              }
        }
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        className="orb-indigo-1 absolute -bottom-36 -right-28 h-[460px] w-[460px] rounded-full blur-[110px] opacity-60"
      />

      {/* Electric Teal Sub-surface Caustic — Bottom Left */}
      <motion.div
        animate={
          reduced
            ? undefined
            : {
                scale: [0.95, 1.1, 1, 0.95],
                x: [0, 20, -15, 0],
                y: [0, 15, -20, 0],
              }
        }
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
        className="orb-cyan-2 absolute -bottom-32 -left-28 h-[420px] w-[420px] rounded-full blur-[105px] opacity-60"
      />

      {/* Optical micro-mesh grid */}
      <div className="absolute inset-0 bg-grid opacity-50" />
    </div>
  );
});

/** Editorial Cupertino heading with smooth spring arrival */
function EditorialTitle({ text, reduced }: { text: string; reduced: boolean }) {
  return (
    <motion.h1
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: EASE }}
      className="mt-3.5 text-center text-[26px] font-bold tracking-tight text-primary sm:text-[29px]"
    >
      {text}
    </motion.h1>
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
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.94 }}
      transition={{ type: 'spring', stiffness: 480, damping: 28, mass: 0.65 }}
      onClick={toggle}
      className="group relative flex h-10 w-10 min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl glass-subtle text-secondary transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
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
              className="h-4.5 w-4.5 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]"
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
  { label: '256-bit AES Vault', icon: 'lock' },
  { label: 'Centralized IAM', icon: 'shieldCheck' },
  { label: 'Identity Protection', icon: 'user' },
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
          className="jewel-pill jewel-slate text-[11px]"
        >
          <Icon name={item.icon} size={14} />
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
    <div className="relative flex min-h-screen min-h-[calc(var(--app-vh,1vh)*100)] min-h-dvh flex-col items-center justify-center overflow-x-clip bg-page px-4 pt-[calc(1.5rem+env(safe-area-inset-top,0px))] pb-[calc(2rem+env(safe-area-inset-bottom,0px))] pl-[calc(1rem+env(safe-area-inset-left,0px))] pr-[calc(1rem+env(safe-area-inset-right,0px))] text-primary">
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
      <main className="relative z-10 w-full max-w-[450px] my-auto">
        <header className="mb-6 text-center sm:mb-7">
          {/* 3D Floating Spatial Logo Emblem */}
          <motion.div
            initial={reduced ? false : { opacity: 0, scale: 0.9, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.38, ease: EASE }}
            className="group relative mx-auto flex h-17 w-17 items-center justify-center rounded-[24px] glass-card p-3 shadow-glass-card transition-transform hover:scale-105 active:scale-95"
          >
            <MeduLogo size="lg" />
          </motion.div>

          {/* Centralized IAM System Badge */}
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.28, ease: EASE }}
            className="mt-3.5 inline-flex items-center gap-1.5 rounded-full jewel-pill jewel-blue text-[11px]"
          >
            <span className="live-dot" />
            <span>M-EDU OS &middot; CENTRALIZED IAM</span>
          </motion.div>

          <EditorialTitle text={title} reduced={reduced} />

          {subtitle && (
            <motion.p
              initial={reduced ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.28, duration: 0.25, ease: EASE }}
              className="mx-auto mt-1.5 max-w-sm text-[13.5px] leading-relaxed text-secondary sm:text-[14px]"
            >
              {subtitle}
            </motion.p>
          )}
        </header>

        {/* The Auth Card Surface */}
        <div className="auth-glass-panel relative w-full p-6 sm:p-8">
          {children}
        </div>

        {showTrustBadges && <TrustBadges reduced={reduced} />}
      </main>
    </div>
  );
}

export default AuthLayout;
