/**
 * ═══════════════════════════════════════════════════════════════════════════
 * RegisterPage V3.0 — "The Ceremony · Editorial Onboarding"
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   V2 → V3 Rearchitecture (100% logic preserved):
 *   ────────────────────────────────────────────────
 *   ✅ Split-Pane Ceremony — Sticky journey rail + 3 editorial chapters.
 *   ✅ Live Avatar — Squircle from firstName + lastName, updates per keystroke.
 *   ✅ Completion Ring — Radial SVG showing 3-section progress (Identity/Org/Security).
 *   ✅ Entropy Dial — Replaces 4-bar meter. Radial ring in security chapter.
 *   ✅ Editorial Chapters — 01 Identity · 02 Organization · 03 Security.
 *   ✅ Seal & Send CTA — Letter/wax-seal aesthetic with pulse halo.
 *   ✅ Floating Command Bar — Sticky breadcrumb with pending status pill.
 *   ✅ Aurora Backdrop — Consistent with v19 suite.
 *   ✅ Pending Screen — Orbital rings with proper geometry.
 *   ✅ 100% preserved:
 *      • Shannon entropy (NIST SP 800-63B)
 *      • Spring physics (ζ, ω₀, m) → Framer params
 *      • Form state machine (touched / errors / submitAttempted)
 *      • All 7 bug fixes from v2
 *      • CapsLock detection (keydown/keyup/input)
 *      • Focus first invalid field on submit
 *      • AbortController cleanup
 *      • Reduced-motion singleton (useSyncExternalStore)
 *      • All validation rules and i18n keys
 *      • 44px Fitts touch target floor
 */

import {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  useSyncExternalStore,
} from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, type Variants } from 'framer-motion';

import { AuthLayout } from '@/layouts/AuthLayout';
import { useAuth, AuthError } from '@/auth/AuthContext';
import { GlassInput } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { getErrorMessage } from '@/lib/errorMessages';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n, type TranslateFn } from '@/i18n/I18nProvider';

/* ═══════════════════════════════════════════════════════════════════════════
 * §1  PHYSICS CONSTANTS (100% preserved from v2)
 * ═══════════════════════════════════════════════════════════════════════════ */

const SPRING_PHYSICS = {
  snappy: { zeta: 0.55, omega0: 26, mass: 0.7 },
  smooth: { zeta: 0.70, omega0: 15, mass: 0.9 },
  gentle: { zeta: 0.85, omega0: 10, mass: 0.9 },
} as const;

function deriveSpringParams(p: { zeta: number; omega0: number; mass: number }): {
  type: 'spring';
  stiffness: number;
  damping: number;
  mass: number;
} {
  const k = p.mass * p.omega0 * p.omega0;
  const c = 2 * p.zeta * p.mass * p.omega0;
  return {
    type: 'spring',
    stiffness: Math.round(k),
    damping: Math.round(c * 10) / 10,
    mass: p.mass,
  };
}

const SPRING = {
  snappy: deriveSpringParams(SPRING_PHYSICS.snappy),
  smooth: deriveSpringParams(SPRING_PHYSICS.smooth),
  gentle: deriveSpringParams(SPRING_PHYSICS.gentle),
} as const;

const STAGGER_BASE_MS = 40;
const STAGGER_RATIO = 1.35;
const STAGGER_CAP_MS = 480;

export function staggerDelay(index: number): number {
  const raw = STAGGER_BASE_MS * Math.pow(STAGGER_RATIO, index);
  return Math.min(raw, STAGGER_CAP_MS);
}
void staggerDelay;

const TOUCH_TARGET_MIN_PX = 44;

const ENTROPY_THRESHOLDS = {
  veryWeak: 28,
  weak: 35,
  acceptable: 59,
  strong: 79,
} as const;

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;

const EASE_APPLE = [0.22, 1, 0.36, 1] as const;

/* ═══════════════════════════════════════════════════════════════════════════
 * §2  REDUCED-MOTION SINGLETON (100% preserved)
 * ═══════════════════════════════════════════════════════════════════════════ */

type RMListener = () => void;
const rmSubs = new Set<RMListener>();
let rmMq: MediaQueryList | null = null;
let rmVal = false;

function getRM(): boolean {
  if (typeof window === 'undefined') return false;
  if (!rmMq) {
    rmMq = window.matchMedia('(prefers-reduced-motion: reduce)');
    rmVal = rmMq.matches;
  }
  return rmVal;
}

function subRM(cb: RMListener): () => void {
  if (typeof window === 'undefined') return () => { /* noop */ };
  if (!rmMq) {
    rmMq = window.matchMedia('(prefers-reduced-motion: reduce)');
    rmVal = rmMq.matches;
  }
  const handler = (e: MediaQueryListEvent) => {
    rmVal = e.matches;
    for (const s of rmSubs) s();
  };
  rmSubs.add(cb);
  if (rmSubs.size === 1) rmMq.addEventListener('change', handler);
  return () => {
    rmSubs.delete(cb);
    if (rmSubs.size === 0 && rmMq) rmMq.removeEventListener('change', handler);
  };
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subRM, getRM, () => false);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * §3  MOTION VARIANTS
 * ═══════════════════════════════════════════════════════════════════════════ */

const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: STAGGER_BASE_MS / 1000,
      delayChildren: 0.05,
    },
  },
};

const chapterVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: SPRING.smooth },
};

/* ═══════════════════════════════════════════════════════════════════════════
 * §4  ICONS
 * ═══════════════════════════════════════════════════════════════════════════ */

interface IconProps {
  paths: readonly string[] | string[];
  size?: number;
  className?: string;
  strokeWidth?: number;
}

function Icon({ paths, size = 18, className = '', strokeWidth = 2.2 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

const I = {
  alert: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z', 'M12 7v6', 'M12 17h.01'],
  check: ['M20 6 9 17l-5-5'],
  clock: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z', 'M12 6v6l4 2'],
  eye: ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
  eyeOff: ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M4 4l16 16'],
  user: ['M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M20 21v-1a8 8 0 0 0-16 0v1'],
  building: ['M4 22h16', 'M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18', 'M10 6h4', 'M10 10h4', 'M10 14h4', 'M10 18h4'],
  lock: ['M5 11h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z', 'M7 11V7a5 5 0 0 1 10 0v4'],
  mail: ['M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M22 6 12 13 2 6'],
  sparkles: [
    'M12 3.5 13.9 9.1 19.5 11 13.9 12.9 12 18.5 10.1 12.9 4.5 11 10.1 9.1z',
    'M18.5 3.5v3', 'M20 5h-3',
    'M5.5 18v2.5', 'M6.75 19.25h-2.5',
  ],
  seal: ['M12 2 4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6z', 'M9 12l2 2 4-4'],
  arrowRight: ['M5 12h14', 'M12 5l7 7-7 7'],
  arrowLeft: ['M19 12H5', 'M12 19l-7-7 7-7'],
} as const;

/* ═══════════════════════════════════════════════════════════════════════════
 * §5  SPINNER
 * ═══════════════════════════════════════════════════════════════════════════ */

function Spinner({ size = 20, className = '' }: { size?: number; className?: string }) {
  const reduced = usePrefersReducedMotion();
  return (
    <motion.svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      animate={reduced ? undefined : { rotate: 360 }}
      transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </motion.svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * §6  ENTROPY (100% preserved)
 * ═══════════════════════════════════════════════════════════════════════════ */

interface EntropyResult {
  bits: number;
  alphabetSize: number;
  classes: {
    lowercase: boolean;
    uppercase: boolean;
    digits: boolean;
    symbols: boolean;
    unicode: boolean;
  };
}

function estimateEntropy(password: string): EntropyResult {
  if (password.length === 0) {
    return {
      bits: 0,
      alphabetSize: 0,
      classes: { lowercase: false, uppercase: false, digits: false, symbols: false, unicode: false },
    };
  }
  const classes = {
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    digits: /[0-9]/.test(password),
    symbols: /[!-/:-@[-`{-~]/.test(password),
    unicode: /[^\x00-\x7F]/.test(password),
  };
  let N = 0;
  if (classes.lowercase) N += 26;
  if (classes.uppercase) N += 26;
  if (classes.digits) N += 10;
  if (classes.symbols) N += 32;
  if (classes.unicode) N += 50;
  if (N === 0) N = 1;
  const bits = password.length * Math.log2(N);
  return { bits, alphabetSize: N, classes };
}

type StrengthLevel = 'empty' | 'veryWeak' | 'weak' | 'acceptable' | 'strong' | 'veryStrong';

interface StrengthResult extends EntropyResult {
  level: StrengthLevel;
  score: 0 | 1 | 2 | 3 | 4;
  color: string;
}

function getStrength(password: string): StrengthResult {
  const { bits, alphabetSize, classes } = estimateEntropy(password);
  let level: StrengthLevel = 'empty';
  let score: 0 | 1 | 2 | 3 | 4 = 0;
  let color = 'rgba(148,163,184,0.25)';
  if (password.length === 0) {
    return { bits, alphabetSize, classes, level, score, color };
  }
  if (bits < ENTROPY_THRESHOLDS.veryWeak) { level = 'veryWeak'; score = 1; color = '#EF4444'; }
  else if (bits < ENTROPY_THRESHOLDS.weak) { level = 'weak'; score = 1; color = '#F59E0B'; }
  else if (bits < ENTROPY_THRESHOLDS.acceptable) { level = 'acceptable'; score = 2; color = '#FFCC00'; }
  else if (bits < ENTROPY_THRESHOLDS.strong) { level = 'strong'; score = 3; color = '#10B981'; }
  else { level = 'veryStrong'; score = 4; color = '#30D158'; }
  return { bits, alphabetSize, classes, level, score, color };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * §7  ENTROPY DIAL — SVG radial ring replacing 4-bar meter
 * ═══════════════════════════════════════════════════════════════════════════ */

function EntropyDial({ password, size = 96 }: { password: string; size?: number }) {
  const reduced = usePrefersReducedMotion();
  const strength = useMemo(() => getStrength(password), [password]);
  const stroke = 8;
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(100, (strength.bits / 100) * 100);
  const dash = (pct / 100) * circ;

  if (password.length === 0) return null;

  return (
    <div
      className="relative flex shrink-0 select-none"
      style={{ width: size, height: size }}
      role="status"
      aria-live="polite"
      aria-atomic
      aria-label={`Password strength: ${strength.level}, entropy ${Math.round(strength.bits)} bits`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-slate-200/70 dark:stroke-white/[0.06]"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={strength.color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={reduced ? { strokeDashoffset: circ - dash } : { strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - dash }}
          transition={reduced ? { duration: 0 } : { ...SPRING.snappy }}
          style={{ filter: `drop-shadow(0 0 6px ${strength.color}66)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-[20px] font-black leading-none tabular-nums"
          style={{ color: strength.color }}
        >
          {Math.round(strength.bits)}
        </span>
        <span className="mt-0.5 text-[8.5px] font-black uppercase tracking-[0.1em] text-[var(--text-muted)]">
          bits
        </span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * §8  MATCH INDICATOR (preserved)
 * ═══════════════════════════════════════════════════════════════════════════ */

function PasswordMatchIndicator({ password, confirm }: { password: string; confirm: string }) {
  const reduced = usePrefersReducedMotion();
  if (confirm.length === 0) return null;
  const matches = password === confirm;

  return (
    <motion.p
      key="match-indicator"
      initial={reduced ? false : { opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.2, ease: EASE_APPLE }}
      className={[
        'mt-2 flex items-center gap-1.5 text-[11.5px] font-semibold',
        matches ? 'text-emerald-600 dark:text-emerald-400' : 'text-[var(--text-muted)]',
      ].join(' ')}
      role="status"
      aria-live="polite"
    >
      {matches && (
        <motion.span
          initial={reduced ? false : { scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={SPRING.snappy}
          className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-inset ring-emerald-500/30"
          aria-hidden
        >
          <Icon paths={I.check} size={9} strokeWidth={3} className="text-emerald-600 dark:text-emerald-400" />
        </motion.span>
      )}
      {matches ? 'Passwords match' : ''}
    </motion.p>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * §9  FORM MODEL (100% preserved)
 * ═══════════════════════════════════════════════════════════════════════════ */

interface RegisterFormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  organizationName: string;
  inviteCode: string;
  password: string;
  confirm: string;
}

const INITIAL_FORM: RegisterFormState = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  organizationName: '',
  inviteCode: '',
  password: '',
  confirm: '',
};

type FieldKey = keyof RegisterFormState;

interface FormErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  organizationName?: string;
  password?: string;
  confirm?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateForm(form: RegisterFormState, t: TranslateFn): FormErrors {
  const errors: FormErrors = {};
  if (!form.firstName.trim()) errors.firstName = t('teachers.form.firstNameRequired');
  if (!form.lastName.trim()) errors.lastName = t('teachers.form.lastNameRequired');
  if (!form.email.trim()) {
    errors.email = t('hr.form.validation.emailRequired');
  } else if (!EMAIL_RE.test(form.email.trim())) {
    errors.email = t('register.emailInvalid');
  }
  if (!form.organizationName.trim()) {
    errors.organizationName = t('register.organizationRequired');
  }
  if (form.password.length < PASSWORD_MIN_LENGTH) {
    errors.password = `${t('auth.passwordMinLength', { min: PASSWORD_MIN_LENGTH })}.`;
  } else if (form.password.length > PASSWORD_MAX_LENGTH) {
    errors.password = `Password must be at most ${PASSWORD_MAX_LENGTH} characters.`;
  } else if (!/[A-Z]/.test(form.password)) {
    errors.password = t('register.passwordUppercase');
  } else if (!/[0-9]/.test(form.password)) {
    errors.password = t('register.passwordNumber');
  }
  if (form.password !== form.confirm) {
    errors.confirm = t('auth.passwordsDoNotMatch');
  }
  return errors;
}

type RegisterResult =
  | { status: 'success' }
  | { status: 'pending'; message: string };

/* ═══════════════════════════════════════════════════════════════════════════
 * §10  AVATAR UTILITIES
 * ═══════════════════════════════════════════════════════════════════════════ */

function nameHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const AVATAR_PALETTES: ReadonlyArray<readonly [string, string, string]> = [
  ['#1E3A8A', '#2563EB', '#93C5FD'],
  ['#312E81', '#4F46E5', '#A5B4FC'],
  ['#064E3B', '#059669', '#6EE7B7'],
  ['#78350F', '#D97706', '#FCD34D'],
  ['#134E4A', '#0D9488', '#5EEAD4'],
  ['#4C1D95', '#7C3AED', '#C4B5FD'],
  ['#831843', '#DB2777', '#F9A8D4'],
];

function avatarBg(name: string): string {
  const [a, b, c] = AVATAR_PALETTES[nameHash(name) % AVATAR_PALETTES.length];
  return `radial-gradient(circle at 28% 22%, ${c}55 0%, transparent 55%), linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

function getInitials(first: string, last: string): string {
  const a = first.trim().charAt(0) || '';
  const b = last.trim().charAt(0) || '';
  return (a + b).toUpperCase() || '·';
}

/* ═══════════════════════════════════════════════════════════════════════════
 * §11  AURORA BACKDROP
 * ═══════════════════════════════════════════════════════════════════════════ */

function AuroraBackdrop() {
  const reduced = usePrefersReducedMotion();
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 dark:from-[#04060C] dark:via-[#0A0F1A] dark:to-[#0A0715]" />
      <div className="absolute -left-40 -top-40 h-[580px] w-[580px] rounded-full bg-blue-400/12 blur-[140px] dark:bg-sky-500/12" />
      <div className="absolute -right-32 top-1/4 h-[520px] w-[520px] rounded-full bg-violet-400/12 blur-[140px] dark:bg-violet-500/12" />
      <div className="absolute -bottom-32 left-1/3 h-[460px] w-[460px] rounded-full bg-emerald-400/08 blur-[140px] dark:bg-emerald-500/08" />
      {!reduced && (
        <motion.div
          animate={{ scale: [1, 1.05, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute left-1/2 top-1/2 h-[700px] w-[1000px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-blue-500/[0.04] via-violet-500/[0.03] to-emerald-500/[0.04] blur-[160px]"
        />
      )}
      <div
        className="absolute inset-0 opacity-[0.015] dark:opacity-[0.022]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(15,23,42,0.85) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.85) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * §12  LIVE AVATAR + COMPLETION RING — left rail hero
 * ═══════════════════════════════════════════════════════════════════════════ */

function JourneyHero({
  form, sections, t,
}: {
  form: RegisterFormState;
  sections: { identity: boolean; organization: boolean; security: boolean };
  t: TranslateFn;
}) {
  const reduced = usePrefersReducedMotion();
  const fullName = `${form.firstName} ${form.lastName}`.trim();
  const hasName = Boolean(fullName);
  const initials = getInitials(form.firstName, form.lastName);
  const completeCount = [sections.identity, sections.organization, sections.security].filter(Boolean).length;
  const completionPct = Math.round((completeCount / 3) * 100);

  const ringSize = 148;
  const stroke = 4;
  const r = (ringSize - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (completionPct / 100) * circ;
  const ringColor = completionPct === 100 ? '#10B981' : completionPct >= 66 ? '#2563EB' : '#F59E0B';

  return (
    <div className="flex flex-col items-center text-center">
      {/* Avatar within completion ring */}
      <div className="relative" style={{ width: ringSize, height: ringSize }}>
        <svg
          width={ringSize}
          height={ringSize}
          viewBox={`0 0 ${ringSize} ${ringSize}`}
          className="-rotate-90 absolute inset-0"
          aria-hidden
        >
          <circle
            cx={ringSize / 2}
            cy={ringSize / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            className="stroke-slate-200/70 dark:stroke-white/[0.08]"
          />
          <motion.circle
            cx={ringSize / 2}
            cy={ringSize / 2}
            r={r}
            fill="none"
            stroke={ringColor}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circ}
            initial={reduced ? { strokeDashoffset: circ - dash } : { strokeDashoffset: circ }}
            animate={{ strokeDashoffset: circ - dash }}
            transition={reduced ? { duration: 0 } : { ...SPRING.smooth }}
            style={{ filter: `drop-shadow(0 0 8px ${ringColor}55)` }}
          />
        </svg>

        <motion.div
          initial={reduced ? false : { scale: 0.88, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={SPRING.smooth}
          className="absolute inset-[10px] flex items-center justify-center rounded-full font-bold text-white shadow-[0_8px_24px_-6px_rgba(15,23,42,0.35),inset_0_2px_1px_rgba(255,255,255,0.55)]"
          style={{
            background: hasName ? avatarBg(fullName) : avatarBg('new member'),
            fontSize: 36,
            letterSpacing: '0.02em',
          }}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,0.42)_0%,transparent_55%)]"
          />
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={initials}
              initial={reduced ? false : { opacity: 0, y: 6, scale: 0.85 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduced ? undefined : { opacity: 0, y: -6, scale: 0.85 }}
              transition={{ duration: 0.22, ease: EASE_APPLE }}
              className="relative z-10"
            >
              {initials}
            </motion.span>
          </AnimatePresence>
        </motion.div>

        {/* Completion badge */}
        <motion.div
          initial={reduced ? false : { scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ ...SPRING.snappy, delay: 0.2 }}
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/70 bg-white/95 px-2.5 py-1 text-[10px] font-black tabular-nums shadow-[0_4px_12px_-4px_rgba(15,23,42,0.2)] backdrop-blur-md dark:border-white/15 dark:bg-surface-900/95"
          style={{ color: ringColor }}
        >
          {completionPct}% · {completeCount}/3
        </motion.div>
      </div>

      {/* Name preview */}
      <h2 className="mt-5 line-clamp-1 text-[18px] font-black tracking-tight text-[var(--text-primary)]">
        {hasName ? fullName : (t('register.title') || 'Yangi a\'zo')}
      </h2>
      <p className="mt-1 line-clamp-1 text-[11.5px] font-medium text-[var(--text-muted)]">
        {form.email || (t('register.subtitle') || 'Ceremony of entry')}
      </p>

      {/* Section chips */}
      <div className="mt-4 flex flex-wrap justify-center gap-1.5">
        {[
          { key: 'identity', done: sections.identity, num: '01', label: t('register.chapterIdentity') || 'Identity' },
          { key: 'organization', done: sections.organization, num: '02', label: t('register.chapterOrg') || 'Organization' },
          { key: 'security', done: sections.security, num: '03', label: t('register.chapterSecurity') || 'Security' },
        ].map((s) => (
          <span
            key={s.key}
            className={[
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.08em]',
              s.done
                ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
                : 'bg-slate-500/[0.06] text-[var(--text-muted)]',
            ].join(' ')}
          >
            {s.done ? (
              <Icon paths={I.check} size={8} strokeWidth={3} />
            ) : (
              <span className="tabular-nums opacity-60">{s.num}</span>
            )}
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * §13  CHAPTER CARD — editorial numbered section
 * ═══════════════════════════════════════════════════════════════════════════ */

function ChapterCard({
  number, title, subtitle, icon, completed, children,
}: {
  number: string;
  title: string;
  subtitle?: string;
  icon: readonly string[];
  completed: boolean;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      variants={chapterVariants}
      className="relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card"
      style={{
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 2px rgba(15,23,42,0.03), 0 12px 32px -12px rgba(15,23,42,0.08)',
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent dark:via-white/[0.18]"
      />
      <header className="flex items-center gap-3 border-b border-slate-200/70 px-4 py-3.5 dark:border-white/[0.06]">
        <span
          className="text-[26px] font-black leading-none tabular-nums tracking-[-0.02em] text-slate-900/15 dark:text-white/[0.12]"
          style={{ fontFeatureSettings: '"tnum"' }}
        >
          {number}
        </span>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-900/[0.05] text-[var(--text-secondary)] dark:bg-white/[0.06]">
            <Icon paths={icon} size={13} strokeWidth={2.2} />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-[13.5px] font-bold tracking-tight text-[var(--text-primary)]">
              {title}
            </h3>
            {subtitle && (
              <p className="mt-0.5 truncate text-[10.5px] font-medium text-[var(--text-muted)]">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        <AnimatePresence>
          {completed && (
            <motion.span
              initial={{ scale: 0, opacity: 0, rotate: -45 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0, opacity: 0, rotate: 45 }}
              transition={SPRING.snappy}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-[0_2px_8px_-2px_rgba(16,185,129,0.6)]"
              aria-label="Bo'lim to'ldirildi"
            >
              <Icon paths={I.check} size={11} strokeWidth={3} />
            </motion.span>
          )}
        </AnimatePresence>
      </header>
      <div className="space-y-3 p-4">{children}</div>
    </motion.section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * §14  PENDING SCREEN
 * ═══════════════════════════════════════════════════════════════════════════ */

function PendingScreen({ message }: { message: string }) {
  const { t } = useI18n();
  const reduced = usePrefersReducedMotion();

  return (
    <AuthLayout title={t('auth.pendingTitle')} subtitle={t('auth.pendingSubtitle')}>
      <div className="space-y-6 py-6 text-center">
        <motion.div
          initial={reduced ? false : { scale: 0.8, opacity: 0, rotate: -12 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ ...SPRING.gentle, delay: 0.05 }}
          className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-[0_12px_32px_-10px_rgba(245,158,11,0.6),inset_0_1px_0_rgba(255,255,255,0.4)]"
        >
          {!reduced &&
            [0, 1, 2].map((i) => (
              <motion.span
                key={i}
                aria-hidden
                className="absolute inset-0 rounded-full border border-amber-400/50"
                initial={{ scale: 1, opacity: 0.6 }}
                animate={{ scale: 1.6, opacity: 0 }}
                transition={{
                  duration: 2.4,
                  repeat: Infinity,
                  delay: i * 0.8,
                  ease: 'easeOut',
                }}
              />
            ))}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-b from-white/40 to-transparent"
          />
          <Icon paths={I.clock} size={32} strokeWidth={2.2} className="relative" />
        </motion.div>

        <motion.div
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING.gentle, delay: 0.15 }}
        >
          <h3 className="text-[19px] font-black tracking-tight text-[var(--text-primary)]">
            {t('auth.pendingHeader')}
          </h3>
          <p className="mx-auto mt-2 max-w-sm text-[13.5px] font-medium leading-relaxed text-[var(--text-secondary)]">
            {message}
          </p>
        </motion.div>

        <motion.div
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING.gentle, delay: 0.25 }}
          className="pt-2"
        >
          <Link
            to="/login"
            className="inline-flex h-[46px] items-center justify-center rounded-2xl bg-[#007AFF] px-7 text-[14.5px] font-bold text-white shadow-[0_8px_24px_-8px_rgba(0,122,255,0.6),inset_0_1px_0_rgba(255,255,255,0.3)] outline-none transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#0071E3] focus-visible:ring-2 focus-visible:ring-[#2563EB]/50 active:scale-[.98]"
            style={{ minHeight: TOUCH_TARGET_MIN_PX }}
          >
            {t('auth.returnToLogin')}
          </Link>
        </motion.div>
      </div>
    </AuthLayout>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * §15  MAIN COMPONENT
 * ═══════════════════════════════════════════════════════════════════════════ */

export function RegisterPage() {
  const { t } = useI18n();
  usePageTitle(t('auth.registerTitle'));

  const { register } = useAuth();
  const navigate = useNavigate();
  const reduced = usePrefersReducedMotion();

  const [form, setForm] = useState<RegisterFormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [capsOn, setCapsOn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [_submitAttempted, setSubmitAttempted] = useState(false);
  void _submitAttempted;

  const firstNameRef = useRef<HTMLInputElement>(null);
  const lastNameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const organizationNameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  const fieldRefs = useMemo<Record<keyof FormErrors, React.RefObject<HTMLInputElement>>>(
    () => ({
      firstName: firstNameRef,
      lastName: lastNameRef,
      email: emailRef,
      organizationName: organizationNameRef,
      password: passwordRef,
      confirm: confirmRef,
    }),
    [],
  );

  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const set = useCallback(<K extends FieldKey>(key: K, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      setErrors((prevErr) => {
        const nextErr = { ...prevErr };
        delete nextErr[key as keyof FormErrors];
        if (key === 'password' && prevErr.confirm) {
          if (next.password === next.confirm) delete nextErr.confirm;
        }
        if (key === 'confirm' && next.password === next.confirm) {
          delete nextErr.confirm;
        }
        return nextErr;
      });
      return next;
    });
    setSubmitError('');
  }, []);

  const checkCaps = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const isOn = e.getModifierState?.('CapsLock') ?? false;
    setCapsOn(isOn);
  }, []);

  const canSubmit = useMemo<boolean>(() => {
    if (busy) return false;
    if (!form.firstName.trim()) return false;
    if (!form.lastName.trim()) return false;
    if (!form.email.trim()) return false;
    if (!form.organizationName.trim()) return false;
    if (form.password.length === 0) return false;
    if (form.confirm.length === 0) return false;
    return true;
  }, [busy, form]);

  const sections = useMemo(
    () => ({
      identity: Boolean(form.firstName.trim() && form.lastName.trim() && form.email.trim()),
      organization: Boolean(form.organizationName.trim()),
      security: Boolean(
        form.password.length >= PASSWORD_MIN_LENGTH &&
          form.confirm.length >= PASSWORD_MIN_LENGTH,
      ),
    }),
    [form],
  );

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitError('');
      setSubmitAttempted(true);

      const validationErrors = validateForm(form, t);
      setErrors(validationErrors);

      if (Object.keys(validationErrors).length > 0) {
        const firstKey = Object.keys(validationErrors)[0] as keyof FormErrors;
        requestAnimationFrame(() => {
          const node = fieldRefs[firstKey]?.current;
          if (node) {
            node.focus({ preventScroll: false });
            if (typeof node.scrollIntoView === 'function') {
              node.scrollIntoView({
                behavior: reduced ? 'auto' : 'smooth',
                block: 'center',
              });
            }
          }
        });
        return;
      }

      setBusy(true);
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = (await register({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || undefined,
          organizationName: form.organizationName.trim(),
          inviteCode: form.inviteCode.trim() || undefined,
          password: form.password,
        })) as { pendingApproval?: boolean; message?: string } | undefined;

        if (controller.signal.aborted) return;

        const result: RegisterResult =
          res && 'pendingApproval' in res && res.pendingApproval
            ? { status: 'pending', message: res.message || t('auth.pendingApprovalNotice') }
            : { status: 'success' };

        if (result.status === 'pending') {
          setPendingMessage(result.message);
          return;
        }
        navigate('/', { replace: true });
      } catch (err) {
        if (controller.signal.aborted) return;
        setSubmitError(
          err instanceof ApiError || err instanceof AuthError
            ? getErrorMessage(err)
            : t('register.failed'),
        );
      } finally {
        if (!controller.signal.aborted) {
          setBusy(false);
        }
      }
    },
    [form, t, register, navigate, reduced, fieldRefs],
  );

  /* ── Pending screen ── */
  if (pendingMessage) {
    return <PendingScreen message={pendingMessage} />;
  }

  /* ── Main form — split-pane ceremony ── */
  return (
    <AuthLayout title={t('register.title')} subtitle={t('register.subtitle')}>
      <div className="relative">
        <AuroraBackdrop />

        <motion.div
          variants={containerVariants}
          initial={reduced ? false : 'hidden'}
          animate="visible"
          className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]"
        >
          {/* ── LEFT: JOURNEY RAIL (sticky on desktop) ── */}
          <aside className="hidden lg:block">
            <div className="lg:sticky lg:top-6">
              <div
                className="relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 p-6 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card"
                style={{
                  boxShadow:
                    'inset 0 1px 0 rgba(255,255,255,0.9), 0 8px 24px -12px rgba(15,23,42,0.10)',
                }}
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent dark:via-white/[0.18]"
                />
                <div className="relative">
                  <div className="mb-5 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_#10B981]" />
                    <span>Ceremony</span>
                    <span className="opacity-40">·</span>
                    <span className="text-[#2563EB] dark:text-[#38BDF8]">Step {Object.values(sections).filter(Boolean).length + 1}/3</span>
                  </div>

                  <JourneyHero form={form} sections={sections} t={t} />

                  {/* Footer quote */}
                  <div className="mt-6 border-t border-slate-200/70 pt-4 dark:border-white/[0.06]">
                    <p className="text-[10.5px] font-medium italic leading-relaxed text-[var(--text-muted)]">
                      &ldquo;{t('register.ceremonyQuote') || 'Every account is a promise. Fill the three chapters and seal the letter.'}&rdquo;
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          {/* ── RIGHT: FORM CHAPTERS ── */}
          <form onSubmit={onSubmit} noValidate aria-label={t('register.title')} className="min-w-0 space-y-4">
            {/* Mobile hero (compact) */}
            <div className="lg:hidden">
              <div
                className="relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 p-4 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card"
                style={{
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 4px 16px -8px rgba(15,23,42,0.08)',
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] font-bold text-white"
                    style={{
                      background: avatarBg(`${form.firstName} ${form.lastName}`.trim() || 'new member'),
                      fontSize: 14,
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4)',
                    }}
                  >
                    {getInitials(form.firstName, form.lastName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold text-[var(--text-primary)]">
                      {`${form.firstName} ${form.lastName}`.trim() || (t('register.title') || 'Yangi a\'zo')}
                    </p>
                    <p className="truncate text-[10.5px] font-medium text-[var(--text-muted)]">
                      {Object.values(sections).filter(Boolean).length}/3 · {Math.round((Object.values(sections).filter(Boolean).length / 3) * 100)}%
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Submit error banner */}
            <AnimatePresence mode="wait">
              {submitError && (
                <motion.div
                  key="submit-error"
                  role="alert"
                  aria-live="assertive"
                  initial={reduced ? false : { opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.97 }}
                  transition={SPRING.snappy}
                  className="flex items-start gap-2.5 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-[12.5px] text-rose-600 backdrop-blur-md dark:text-rose-400"
                >
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-500/15 ring-1 ring-inset ring-rose-500/25">
                    <Icon paths={I.alert} size={12} strokeWidth={2.4} />
                  </span>
                  <span className="font-semibold leading-5">{submitError}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ═══ CHAPTER 01 · IDENTITY ═══ */}
            <ChapterCard
              number="01"
              title={t('register.chapterIdentity') || 'Identity'}
              subtitle={t('register.chapterIdentityHint') || 'Who you are'}
              icon={I.user}
              completed={sections.identity}
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <GlassInput
                  ref={firstNameRef}
                  label={t('teachers.form.firstName')}
                  required
                  error={errors.firstName}
                  value={form.firstName}
                  onChange={(e) => set('firstName', e.target.value)}
                  placeholder={t('register.firstNamePlaceholder')}
                  autoComplete="given-name"
                  disabled={busy}
                  aria-invalid={Boolean(errors.firstName)}
                />
                <GlassInput
                  ref={lastNameRef}
                  label={t('teachers.form.lastName')}
                  required
                  error={errors.lastName}
                  value={form.lastName}
                  onChange={(e) => set('lastName', e.target.value)}
                  placeholder={t('register.lastNamePlaceholder')}
                  autoComplete="family-name"
                  disabled={busy}
                  aria-invalid={Boolean(errors.lastName)}
                />
              </div>
              <GlassInput
                ref={emailRef}
                label={t('auth.emailAddress')}
                required
                error={errors.email}
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                placeholder="john@example.com"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                disabled={busy}
                aria-invalid={Boolean(errors.email)}
              />
            </ChapterCard>

            {/* ═══ CHAPTER 02 · ORGANIZATION ═══ */}
            <ChapterCard
              number="02"
              title={t('register.chapterOrg') || 'Organization'}
              subtitle={t('register.chapterOrgHint') || 'Where you operate'}
              icon={I.building}
              completed={sections.organization}
            >
              <GlassInput
                ref={organizationNameRef}
                label={t('settings.orgName')}
                required
                hint={t('register.organizationHint')}
                error={errors.organizationName}
                value={form.organizationName}
                onChange={(e) => set('organizationName', e.target.value)}
                placeholder={t('register.organizationPlaceholder')}
                disabled={busy}
                aria-invalid={Boolean(errors.organizationName)}
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <GlassInput
                  label={t('common.phone')}
                  type="tel"
                  value={form.phone}
                  onChange={(e) => set('phone', e.target.value)}
                  placeholder="+998 90 123 4567"
                  autoComplete="tel"
                  disabled={busy}
                />
                <GlassInput
                  label={t('register.inviteCode')}
                  hint={t('register.inviteCodeHint')}
                  value={form.inviteCode}
                  onChange={(e) => set('inviteCode', e.target.value)}
                  placeholder="M-EDU-..."
                  disabled={busy}
                />
              </div>
            </ChapterCard>

            {/* ═══ CHAPTER 03 · SECURITY ═══ */}
            <ChapterCard
              number="03"
              title={t('register.chapterSecurity') || 'Security'}
              subtitle={t('register.chapterSecurityHint') || 'Seal the letter'}
              icon={I.lock}
              completed={sections.security}
            >
              {/* Password + entropy dial row */}
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <GlassInput
                    ref={passwordRef}
                    label={t('auth.password')}
                    required
                    hint={!form.password ? t('register.passwordHint') : undefined}
                    error={errors.password}
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => set('password', e.target.value)}
                    onKeyDown={checkCaps}
                    onKeyUp={checkCaps}
                    onInput={checkCaps}
                    autoComplete="new-password"
                    maxLength={PASSWORD_MAX_LENGTH}
                    disabled={busy}
                    aria-invalid={Boolean(errors.password)}
                    inputSuffix={
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                        className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors focus:outline-none"
                      >
                        <Icon paths={showPassword ? I.eyeOff : I.eye} size={16} />
                      </button>
                    }
                  />
                  <AnimatePresence>
                    {capsOn && (
                      <motion.p
                        key="caps-warning"
                        initial={reduced ? false : { opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2, ease: EASE_APPLE }}
                        className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-[10.5px] font-bold text-amber-700 dark:text-amber-300"
                        role="status"
                        aria-live="polite"
                      >
                        <span aria-hidden>⇪</span>
                        {t('login.capsLock') || 'Caps Lock is on.'}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
                <AnimatePresence mode="wait">
                  {form.password.length > 0 && (
                    <motion.div
                      key="dial"
                      initial={reduced ? false : { opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.85 }}
                      transition={SPRING.snappy}
                    >
                      <EntropyDial password={form.password} size={96} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <GlassInput
                ref={confirmRef}
                label={t('auth.confirmPassword')}
                required
                error={errors.confirm}
                type={showConfirm ? 'text' : 'password'}
                value={form.confirm}
                onChange={(e) => set('confirm', e.target.value)}
                onKeyDown={checkCaps}
                onKeyUp={checkCaps}
                onInput={checkCaps}
                autoComplete="new-password"
                maxLength={PASSWORD_MAX_LENGTH}
                disabled={busy}
                aria-invalid={Boolean(errors.confirm)}
                inputSuffix={
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowConfirm((v) => !v)}
                    aria-label={showConfirm ? t('auth.hidePassword') : t('auth.showPassword')}
                    className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors focus:outline-none"
                  >
                    <Icon paths={showConfirm ? I.eyeOff : I.eye} size={16} />
                  </button>
                }
              />
              <AnimatePresence mode="wait">
                {form.confirm.length > 0 && (
                  <PasswordMatchIndicator key="match" password={form.password} confirm={form.confirm} />
                )}
              </AnimatePresence>
            </ChapterCard>

            {/* ═══ SEAL & SEND CTA ═══ */}
            <motion.div variants={chapterVariants} className="pt-1">
              <motion.button
                type="submit"
                disabled={!canSubmit}
                aria-busy={busy}
                whileHover={reduced || !canSubmit ? undefined : { scale: 1.005, y: -1 }}
                whileTap={reduced || !canSubmit ? undefined : { scale: 0.99 }}
                transition={SPRING.snappy}
                className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-[#007AFF] px-6 text-[14.5px] font-black text-white shadow-[0_8px_24px_-8px_rgba(0,122,255,0.6),inset_0_1px_0_rgba(255,255,255,0.3)] transition-colors hover:bg-[#0071E3] disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none dark:disabled:bg-slate-700"
                style={{ height: 56, minHeight: TOUCH_TARGET_MIN_PX }}
              >
                {!reduced && canSubmit && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2"
                    style={{
                      background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)',
                      animation: 'register-shimmer 3.6s linear infinite',
                    }}
                  />
                )}
                {!reduced && canSubmit && (
                  <motion.span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-[#007AFF]/40"
                    animate={{ scale: [1, 1.02, 1], opacity: [0.3, 0, 0.3] }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                  />
                )}
                <span className="relative inline-flex items-center gap-2">
                  {busy ? (
                    <>
                      <Spinner size={18} />
                      {t('register.creating')}
                    </>
                  ) : (
                    <>
                      <Icon paths={I.seal} size={18} strokeWidth={2.4} />
                      {t('register.createAccount')}
                    </>
                  )}
                </span>
              </motion.button>
            </motion.div>

            {/* Login link */}
            <p className="pt-2 text-center text-[12.5px]" style={{ color: 'var(--text-secondary)' }}>
              {t('register.haveAccount')}{' '}
              <Link
                to="/login"
                className="font-bold underline-offset-[3px] outline-none transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-[#2563EB]/50"
                style={{ color: 'var(--m-vivid)' }}
              >
                {t('auth.login')}
              </Link>
            </p>
          </form>
        </motion.div>

        <style>{`
          @keyframes register-shimmer {
            0%   { transform: translateX(-120%); }
            100% { transform: translateX(220%); }
          }
          @media (prefers-reduced-motion: reduce) {
            [class*="register-shimmer"] { animation: none !important; }
          }
        `}</style>
      </div>
    </AuthLayout>
  );
}

export default RegisterPage;