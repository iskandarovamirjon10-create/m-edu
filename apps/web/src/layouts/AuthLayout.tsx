/**
 * M-EDU AuthLayout — Apple-premium sign-in shell.
 *
 * Restrained ambient wash, kinetic char-by-char title and a clean solid card
 * (`bg-card` + hairline border + soft shadow).
 */
import { useMemo, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { MeduLogo } from '@/components/brand/MeduLogo';
import { Icon, usePrefersReducedMotion, type IconName } from '@/lib/design';

const EASE = [0.16, 1, 0.3, 1] as const;
const TITLE_DELAY = 0.12;
const CHAR_STAGGER = 0.02;

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

/** One low-opacity neutral wash — no orbs, no particles. */
function AmbientWash() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute left-1/2 -top-40 h-[440px] w-[760px] -translate-x-1/2 rounded-full bg-brand-500/[0.05] blur-[110px] dark:bg-brand-500/[0.09]" />
      <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/[0.03] to-transparent dark:from-white/[0.04]" />
    </div>
  );
}

/** Staggered char reveal — falls back to plain text under reduced motion. */
function KineticTitle({ text, reduced }: { text: string; reduced: boolean }) {
  const chars = useMemo(() => Array.from(text), [text]);

  return (
    <h1
      className="mt-5 text-center text-[26px] font-semibold leading-tight tracking-[-0.03em] text-primary"
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
            {c === ' ' ? ' ' : c}
          </motion.span>
        ))}
      </span>
    </h1>
  );
}

/** Trust signals — inline SVG icons, never emoji. */
const TRUST: readonly { label: string; icon: IconName }[] = [
  { label: '256-bit SSL', icon: 'lock' },
  { label: 'Face ID', icon: 'user' },
  { label: 'GDPR', icon: 'shieldCheck' },
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
          className="inline-flex items-center gap-1.5 rounded-full border border-subtle bg-black/[0.03] px-2.5 py-1 text-[11px] font-medium text-secondary dark:bg-white/[0.06]"
        >
          <Icon name={item.icon} size={16} />
          {item.label}
        </li>
      ))}
    </motion.ul>
  );
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  const reduced = usePrefersReducedMotion();

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--bg-base)] px-4 py-12 text-primary">
      <AmbientWash />

      <div className="relative z-10 w-full max-w-md">
        <header className="mb-7 text-center">
          <motion.div
            initial={reduced ? false : { opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-subtle bg-card p-2 shadow-card"
          >
            <MeduLogo size="lg" />
          </motion.div>

          <KineticTitle text={title} reduced={reduced} />

          {subtitle && (
            <motion.p
              initial={reduced ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.25, ease: EASE }}
              className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-secondary"
            >
              {subtitle}
            </motion.p>
          )}
        </header>

        <div className="animate-fade-in rounded-2xl border border-subtle bg-card p-8 shadow-modal sm:p-10">
          {children}
        </div>

        <TrustBadges reduced={reduced} />

        <p className="mt-5 text-center text-[11px] font-medium text-muted">
          © {new Date().getFullYear()} M-EDU · Education Management Platform
        </p>
      </div>
    </div>
  );
}
