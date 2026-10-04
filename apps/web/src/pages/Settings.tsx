/**
 * M-EDU SettingsPage — Apple Design Award Edition
 *
 * Premium craft:
 *  - Hero header with gradient app-icon + signed-in account chip
 *  - "Premium panel" sections with squircle gradient icons + tone colors
 *  - Theme switcher as a native segmented control (layoutId indicator)
 *  - Live password strength meter with tone feedback
 *  - Password visibility toggles with custom SVG eye icons
 *  - Shimmer skeletons (not pulse)
 *  - Custom SVG icons in SF Symbols proportions
 *  - Framer Motion spring physics + staggered blur-in
 *  - Full i18n + a11y preserved (radiogroup, aria-invalid, aria-describedby)
 */

import { useState, useEffect, useCallback, useRef, useMemo, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { organizationsApi, usersApi, authApi } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';
import {
  GlassPageHeader,
  GlassErrorState,
  GlassField,
  GlassInput,
  GlassSelect,
  useToasts,
  GlassButton,
} from '@/components/ui';
import { getErrorMessage } from '@/lib/errorMessages';
import { TelegramIntegration } from '@/components/TelegramIntegration';
import type { Organization, User } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useTheme, type Theme } from '@/hooks/useTheme';
import { usePersistSettings } from '@/hooks/usePersistSettings';
import { useI18n, isLocale } from '@/i18n/I18nProvider';

/* ============================================================================
 * MOTION TOKENS
 * ========================================================================== */

const SPRING = {
  snappy: { type: 'spring', stiffness: 500, damping: 30, mass: 0.7 },
  smooth: { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 },
  soft:   { type: 'spring', stiffness: 220, damping: 28, mass: 1.0 },
} as const;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.08 } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 18, filter: 'blur(8px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: SPRING.smooth },
};

/* ============================================================================
 * CUSTOM ICONS (SF Symbols proportions)
 * ========================================================================== */

const ICON_STROKE = 1.75;

const I: Record<string, string[]> = {
  settings: [
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  ],
  sun: [
    'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z',
    'M12 1v2', 'M12 21v2',
    'M4.22 4.22l1.42 1.42', 'M18.36 18.36l1.42 1.42',
    'M1 12h2', 'M21 12h2',
    'M4.22 19.78l1.42-1.42', 'M18.36 5.64l1.42-1.42',
  ],
  moon: ['M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z'],
  monitor: [
    'M20 3H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z',
    'M8 21h8', 'M12 17v4',
  ],
  building: [
    'M3 21h18',
    'M5 21V7l8-4v18',
    'M19 21V11l-6-4',
    'M9 9v.01', 'M9 12v.01', 'M9 15v.01', 'M9 18v.01',
  ],
  user: [
    'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M20 21v-1a8 8 0 0 0-16 0v1',
  ],
  lock: [
    'M5 11h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z',
    'M7 11V7a5 5 0 0 1 10 0v4',
  ],
  telegram: [
    'M21.5 3.5 2.8 10.6l5.2 1.6 1.6 5.2 3-3.6 4.9 3.4z',
    'M8 12.2 16.9 6.4l-5 8.2',
  ],
  palette: [
    'M12 22a10 10 0 1 1 0-20c5.5 0 10 3.6 10 8 0 2.2-1.8 4-4 4h-1.5a1.5 1.5 0 0 0-1.06 2.56c.13.13.2.3.2.48C15.64 19.8 14.03 22 12 22z',
    'M6.5 11.5h.01', 'M9.5 8h.01', 'M14.5 8h.01', 'M17.5 11.5h.01',
  ],
  globe: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M2 12h20',
    'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z',
  ],
  clock: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 6v6l4 2',
  ],
  mail: [
    'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
    'M22 6 12 13 2 6',
  ],
  phone: [
    'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7 12.8 12.8 0 0 0 .7 2.8 2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4 12.8 12.8 0 0 0 2.8.7 2 2 0 0 1 1.7 2z',
  ],
  shield: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'],
  check: ['M20 6 9 17l-5-5'],
  eye: [
    'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z',
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  ],
  eyeOff: [
    'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94',
    'M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19',
    'M14.12 14.12a3 3 0 1 1-4.24-4.24',
    'M1 1l22 22',
  ],
  sparkles: [
    'M12 3.5 13.9 9.1 19.5 11 13.9 12.9 12 18.5 10.1 12.9 4.5 11 10.1 9.1z',
    'M18.5 3.5v3', 'M20 5h-3',
    'M5.5 18v2.5', 'M6.75 19.25h-2.5',
  ],
  key: [
    'M21 2l-2 2',
    'M15.5 7.5l3 3L22 7l-3-3z',
    'M15.5 7.5 9 14a3.5 3.5 0 1 1-3-3l6.5-6.5',
  ],
  save: [
    'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z',
    'M17 21v-8H7v8', 'M7 3v5h8',
  ],
};

function Icon({
  paths,
  size = 18,
  className = '',
  strokeWidth = ICON_STROKE,
  ...rest
}: {
  paths: string[];
  size?: number;
  className?: string;
  strokeWidth?: number;
} & React.SVGProps<SVGSVGElement>) {
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
      {...rest}
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

/* ============================================================================
 * TONE PALETTE
 * ========================================================================== */

type Tone = 'blue' | 'green' | 'orange' | 'red' | 'purple';

const TONES: Record<Tone, { fg: string; bg: string; glow: string; border: string }> = {
  blue:   { fg: '#007AFF', bg: 'rgba(0,122,255,0.10)', glow: 'rgba(0,122,255,0.28)', border: 'rgba(0,122,255,0.20)' },
  green:  { fg: '#34C759', bg: 'rgba(52,199,89,0.10)',  glow: 'rgba(52,199,89,0.28)',  border: 'rgba(52,199,89,0.20)' },
  orange: { fg: '#FF9500', bg: 'rgba(255,149,0,0.10)',  glow: 'rgba(255,149,0,0.28)',  border: 'rgba(255,149,0,0.20)' },
  red:    { fg: '#FF3B30', bg: 'rgba(255,59,48,0.10)',  glow: 'rgba(255,59,48,0.28)',  border: 'rgba(255,59,48,0.20)' },
  purple: { fg: '#AF52DE', bg: 'rgba(175,82,222,0.10)', glow: 'rgba(175,82,222,0.28)', border: 'rgba(175,82,222,0.20)' },
};

/* ============================================================================
 * TYPES & CONSTANTS
 * ========================================================================== */

interface OrgFormState {
  name: string;
  email: string;
  phone: string;
}

interface PasswordFormState {
  currentPassword: string;
  newPassword: string;
  confirm: string;
}

interface SettingsFormState {
  language: string;
  timezone: string;
}

const INITIAL_PASSWORD_FORM: PasswordFormState = {
  currentPassword: '',
  newPassword: '',
  confirm: '',
};

const TIMEZONES = [
  { value: 'UTC', label: 'UTC' },
  { value: 'Europe/London', label: 'Europe/London' },
  { value: 'Asia/Tashkent', label: 'Asia/Tashkent' },
  { value: 'America/New_York', label: 'America/New_York' },
];

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'uz', label: 'Oʻzbekcha' },
  { value: 'ru', label: 'Русский' },
];

/* ============================================================================
 * PASSWORD UTILS
 * ========================================================================== */

function validatePassword(password: string): string | undefined {
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number.';
  return undefined;
}

interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  tone: Tone;
}

function getPasswordStrength(pwd: string): PasswordStrength {
  if (!pwd) return { score: 0, label: '', tone: 'red' };
  let s = 0;
  if (pwd.length >= 8) s++;
  if (pwd.length >= 12) s++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) s++;
  if (/[0-9]/.test(pwd)) s++;
  if (/[^A-Za-z0-9]/.test(pwd)) s++;
  const score = Math.min(4, s) as PasswordStrength['score'];
  const map: Record<number, { label: string; tone: Tone }> = {
    0: { label: 'settings.password.tooWeak', tone: 'red' },
    1: { label: 'settings.password.weak', tone: 'red' },
    2: { label: 'settings.password.fair', tone: 'orange' },
    3: { label: 'settings.password.good', tone: 'blue' },
    4: { label: 'settings.password.strong', tone: 'green' },
  };
  return { score, ...map[score] };
}

/* ============================================================================
 * PREMIUM SUB-COMPONENTS
 * ========================================================================== */

/** Shimmer — siljiydigan gradient, pulse emas */
function Shimmer({ className = '', radius = '0.75rem' }: { className?: string; radius?: string }) {
  return (
    <div
      className={`relative overflow-hidden bg-[#E5E5EA]/60 dark:bg-[#2C2C2E]/60 ${className}`}
      style={{ borderRadius: radius }}
    >
      <motion.div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.65) 50%, transparent 100%)',
        }}
        animate={{ x: ['-100%', '%100'] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="space-y-5">
      <Shimmer className="h-28 w-full" radius="1.75rem" />
      {[1, 2, 3, 4].map((i) => (
        <Shimmer key={i} className="h-44 w-full" radius="1.75rem" />
      ))}
    </div>
  );
}

/** Premium section panel — squircle icon + title + subtitle + content + footer */
function PremiumPanel({
  icon,
  title,
  subtitle,
  tone = 'blue',
  children,
  footer,
}: {
  icon: string[];
  title: string;
  subtitle?: string;
  tone?: Tone;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const c = TONES[tone];
  return (
    <motion.section
      variants={cardVariants}
      className="group relative overflow-hidden rounded-3xl border border-[#ffffff70] bg-[#ffffff80] backdrop-blur-2xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
      style={{
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.7), 0 10px 30px -18px rgba(0,0,0,0.12)',
      }}
    >
      {/* top gloss */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-24"
        style={{
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, transparent 100%)',
        }}
      />

      {/* Header */}
      <div className="relative flex items-center gap-3 border-b border-[#00000008] px-5 py-4 dark:border-[#ffffff08]">
        <div
          className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
          style={{
            background: c.bg,
            color: c.fg,
            border: `1px solid ${c.border}`,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.5), 0 6px 16px -8px ${c.glow}`,
          }}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-2xl"
            style={{
              background:
                'linear-gradient(180deg, rgba(255,255,255,0.45), transparent)',
            }}
          />
          <Icon paths={icon} size={18} strokeWidth={2} className="relative" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[14px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-0.5 text-[12px] font-medium text-[#86868B]">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="relative p-5">{children}</div>

      {/* Footer */}
      {footer && (
        <div className="relative flex justify-end border-t border-[#00000008] px-5 py-4 dark:border-[#ffffff08]">
          {footer}
        </div>
      )}
    </motion.section>
  );
}

/** Premium field icon badge — small squircle leading the input */
function FieldIcon({ icon, tone = 'blue' }: { icon: string[]; tone?: Tone }) {
  const c = TONES[tone];
  return (
    <span
      className="pointer-events-none absolute left-3 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-lg"
      style={{ background: c.bg, color: c.fg }}
      aria-hidden
    >
      <Icon paths={icon} size={12} strokeWidth={2.2} />
    </span>
  );
}

/** Password input with visibility toggle */
function PasswordInput({
  value,
  onChange,
  autoComplete,
  disabled,
  invalid,
  describedBy,
  ariaLabel,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  autoComplete?: string;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  ariaLabel?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <GlassInput
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        disabled={disabled}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        aria-label={ariaLabel}
        className="pr-10"
      />
      <motion.button
        type="button"
        onClick={() => setShow((v) => !v)}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        transition={SPRING.snappy}
        aria-label={show ? 'Hide password' : 'Show password'}
        title={show ? 'Hide password' : 'Show password'}
        className="absolute right-2 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-[#86868B] hover:bg-black/[0.04] hover:text-[#1D1D1F] dark:hover:bg-white/[0.06] dark:hover:text-[#F5F5F7]"
      >
        <Icon paths={show ? I.eyeOff : I.eye} size={14} strokeWidth={2} />
      </motion.button>
    </div>
  );
}

/** Password strength meter */
function PasswordStrengthMeter({ value }: { value: string }) {
  const { t } = useI18n();
  const { score, label, tone } = getPasswordStrength(value);
  const translatedLabel = t(label) || label;
  const c = TONES[tone];
  const segments = [0, 1, 2, 3];

  return (
    <AnimatePresence initial={false}>
      {value.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -4, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: -4, height: 0 }}
          transition={SPRING.smooth}
          className="mt-2 overflow-hidden"
        >
          <div className="flex items-center gap-2">
            <div className="flex flex-1 gap-1">
              {segments.map((i) => {
                const active = i < score;
                return (
                  <motion.span
                    key={i}
                    className="h-1.5 flex-1 rounded-full"
                    animate={{
                      backgroundColor: active ? c.fg : 'rgba(0,0,0,0.08)',
                    }}
                    transition={{ duration: 0.25 }}
                  />
                );
              })}
            </div>
            <motion.span
              key={translatedLabel}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={SPRING.snappy}
              className="text-[10.5px] font-bold uppercase tracking-[0.12em]"
              style={{ color: c.fg }}
            >
              {translatedLabel}
            </motion.span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Premium theme segmented control */
function ThemeSwitcher() {
  const { t } = useI18n();
  const { theme, setTheme } = useTheme();
  const persist = usePersistSettings();

  const choose = useCallback(
    (next: Theme) => {
      setTheme(next);
      persist({ theme: next });
    },
    [setTheme, persist],
  );

  const options: { value: Theme; label: string; icon: string[]; tone: Tone }[] = useMemo(
    () => [
      { value: 'light', label: t('settings.themeLight'), icon: I.sun, tone: 'orange' },
      { value: 'dark', label: t('settings.themeDark'), icon: I.moon, tone: 'purple' },
      { value: 'system', label: t('common.system'), icon: I.monitor, tone: 'blue' },
    ],
    [t],
  );

  return (
    <div
      className="grid grid-cols-3 gap-2"
      role="radiogroup"
      aria-label={t('a11y.themeSelection')}
    >
      {options.map((opt) => {
        const active = theme === opt.value;
        const c = TONES[opt.tone];
        return (
          <motion.button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => choose(opt.value)}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.97 }}
            transition={SPRING.snappy}
            className="relative flex flex-col items-center gap-2 rounded-2xl border px-3 py-4 text-center outline-none transition-colors"
            style={{
              borderColor: active ? c.border : 'rgba(0,0,0,0.06)',
              background: active ? c.bg : 'transparent',
              color: active ? c.fg : '#86868B',
              boxShadow: active
                ? `inset 0 1px 0 rgba(255,255,255,0.5), 0 8px 20px -10px ${c.glow}`
                : 'none',
            }}
          >
            {active && (
              <motion.span
                layoutId="theme-active-glow"
                className="pointer-events-none absolute inset-0 rounded-2xl"
                style={{
                  background:
                    'radial-gradient(120% 60% at 50% 0%, rgba(255,255,255,0.45), transparent 70%)',
                }}
                transition={SPRING.smooth}
              />
            )}
            <span className="relative flex h-9 w-9 items-center justify-center rounded-xl"
              style={{
                background: active ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.03)',
                color: active ? c.fg : '#86868B',
              }}
            >
              <Icon paths={opt.icon} size={17} strokeWidth={2} />
            </span>
            <span className="relative text-[12px] font-semibold tracking-tight">
              {opt.label}
            </span>
            <AnimatePresence>
              {active && (
                <motion.span
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={SPRING.snappy}
                  className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full"
                  style={{ background: c.fg, color: '#fff' }}
                >
                  <Icon paths={I.check} size={10} strokeWidth={3} />
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        );
      })}
    </div>
  );
}

/** Small premium "signed-in" chip */
function AccountChip({
  name,
  role,
  avatarGradient,
  initials,
}: {
  name: string;
  role: string;
  avatarGradient: string;
  initials: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#ffffff60] bg-[#ffffff70] px-3 py-2.5 backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e70]"
      style={{
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.6), 0 4px 14px -8px rgba(0,0,0,0.10)',
      }}
    >
      <div
        className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-bold text-white ring-2 ring-white/50 dark:ring-black/30"
        style={{
          background: avatarGradient,
          fontSize: '11px',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35)',
        }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.4), transparent 55%)',
          }}
        />
        <span className="relative">{initials}</span>
      </div>
      <div className="min-w-0">
        <p className="truncate text-[12.5px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
          {name}
        </p>
        <p className="truncate text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#86868B]">
          {role}
        </p>
      </div>
    </div>
  );
}

/* ============================================================================
 * AVATAR HELPERS
 * ========================================================================== */

const AVATAR_PALETTES = [
  ['#007AFF', '#5856D6'],
  ['#AF52DE', '#FF2D55'],
  ['#34C759', '#32ADE6'],
  ['#FF9500', '#FF2D55'],
];

function nameHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function avatarGradient(name: string): string {
  const [a, b] = AVATAR_PALETTES[nameHash(name) % AVATAR_PALETTES.length];
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

function getInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .map((p) => p.charAt(0))
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '—'
  );
}

/* ============================================================================
 * MAIN PAGE
 * ========================================================================== */

export function SettingsPage() {
  const { setLocale, locale, t } = useI18n();
  usePageTitle(t('settings.title'));
  const { push, toastNode } = useToasts();
  const { user, setUser, hasAnyRole } = useAuth();
  const isAdmin = hasAnyRole('SUPER_ADMIN', 'ORG_ADMIN');
  const qc = useQueryClient();

  const [orgForm, setOrgForm] = useState<OrgFormState | null>(null);
  const [orgErrors, setOrgErrors] = useState<Partial<Record<keyof OrgFormState, string>>>({});
  const [pwdForm, setPwdForm] = useState<PasswordFormState>(INITIAL_PASSWORD_FORM);
  const [pwdErrors, setPwdErrors] = useState<Partial<Record<keyof PasswordFormState, string>>>({});
  const [settingsForm, setSettingsForm] = useState<SettingsFormState>({
    language: locale,
    timezone: user?.settings?.timezone || 'UTC',
  });

  /* ── Server language adoption (fresh device only) ───────────────────── */
  const adoptedServerLang = useRef(false);
  useEffect(() => {
    if (adoptedServerLang.current) return;
    const lang = user?.settings?.language;
    if (!lang || !isLocale(lang)) return;
    let stored: string | null = null;
    try {
      stored = localStorage.getItem('medu-lang');
    } catch {
      stored = null;
    }
    if (stored) {
      adoptedServerLang.current = true;
      return;
    }
    adoptedServerLang.current = true;
    setLocale(lang);
    setSettingsForm((prev) => ({ ...prev, language: lang }));
  }, [user?.settings?.language, setLocale]);

  /* ── Keep language field aligned with live locale ───────────────────── */
  useEffect(() => {
    setSettingsForm((prev) =>
      prev.language === locale ? prev : { ...prev, language: locale },
    );
  }, [locale]);

  useEffect(() => {
    if (user?.settings) {
      setSettingsForm((prev) => ({
        language: locale,
        timezone: user.settings?.timezone || prev.timezone,
      }));
    }
  }, [user, locale]);

  /* ── Organization query ─────────────────────────────────────────────── */
  const org = useQuery({
    queryKey: ['org-me'],
    queryFn: organizationsApi.me,
    enabled: isAdmin,
    placeholderData: (previousData) => previousData,
  });

  useEffect(() => {
    if (org.data && !orgForm) {
      const orgData = org.data as Organization;
      setOrgForm({
        name: orgData.name,
        email: orgData.email,
        phone: orgData.phone || '',
      });
    }
  }, [org.data, orgForm]);

  /* ── Mutations ──────────────────────────────────────────────────────── */
  const saveOrg = useMutation({
    mutationFn: () => {
      if (!orgForm) throw new Error('Organization form not initialized');
      return organizationsApi.update(orgForm);
    },
    onSuccess: async () => {
      push('success', t('settings.orgUpdated'));
      qc.invalidateQueries({ queryKey: ['org-me'] });
      try {
        const me = (await authApi.me()) as User;
        setUser(me);
      } catch {
        /* noop */
      }
    },
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  const changePassword = useMutation({
    mutationFn: () =>
      usersApi.changePassword({
        currentPassword: pwdForm.currentPassword,
        newPassword: pwdForm.newPassword,
      }),
    onSuccess: () => {
      push('success', t('settings.passwordChanged'));
      setPwdForm(INITIAL_PASSWORD_FORM);
      setPwdErrors({});
    },
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  const saveSettings = useMutation({
    mutationFn: () => {
      if (!user?.id) throw new Error('User not authenticated');
      return usersApi.updateSettings(user.id, settingsForm);
    },
    onSuccess: () => {
      push('success', t('settings.saved'));
      qc.invalidateQueries({ queryKey: ['auth-me'] });
    },
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  /* ── Validators ─────────────────────────────────────────────────────── */
  const validateOrgForm = useCallback((): boolean => {
    if (!orgForm) return false;
    const errors: Partial<Record<keyof OrgFormState, string>> = {};
    if (!orgForm.name.trim()) errors.name = 'Organization name is required';
    if (!orgForm.email.trim()) errors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(orgForm.email.trim()))
      errors.email = 'Please enter a valid email address';
    setOrgErrors(errors);
    return Object.keys(errors).length === 0;
  }, [orgForm]);

  const validatePasswordForm = useCallback((): boolean => {
    const errors: Partial<Record<keyof PasswordFormState, string>> = {};
    if (!pwdForm.currentPassword) errors.currentPassword = 'Current password is required';
    const passwordError = validatePassword(pwdForm.newPassword);
    if (passwordError) errors.newPassword = passwordError;
    if (pwdForm.newPassword !== pwdForm.confirm) errors.confirm = 'Passwords do not match';
    setPwdErrors(errors);
    return Object.keys(errors).length === 0;
  }, [pwdForm]);

  /* ── Handlers ───────────────────────────────────────────────────────── */
  const handleOrgChange = useCallback(
    (field: keyof OrgFormState) =>
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setOrgForm((prev) => (prev ? { ...prev, [field]: e.target.value } : prev));
        setOrgErrors((prev) => ({ ...prev, [field]: undefined }));
      },
    [],
  );

  const handlePwdChange = useCallback(
    (field: keyof PasswordFormState) =>
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setPwdForm((prev) => ({ ...prev, [field]: e.target.value }));
        setPwdErrors((prev) => ({ ...prev, [field]: undefined }));
      },
    [],
  );

  const handleSettingsChange = useCallback(
    (field: keyof SettingsFormState) =>
      (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        setSettingsForm((prev) => ({ ...prev, [field]: value }));
        if (field === 'language' && isLocale(value)) {
          setLocale(value);
        }
      },
    [setLocale],
  );

  const handleOrgSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!validateOrgForm()) return;
      saveOrg.mutate();
    },
    [validateOrgForm, saveOrg],
  );

  const handlePasswordSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!validatePasswordForm()) return;
      changePassword.mutate();
    },
    [validatePasswordForm, changePassword],
  );

  const handleSettingsSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      saveSettings.mutate();
    },
    [saveSettings],
  );

  const { refetch: refetchOrg } = org;
  const handleRetry = useCallback(() => {
    void refetchOrg();
  }, [refetchOrg]);

  /* ── Derived display values ─────────────────────────────────────────── */
  const displayName = useMemo(() => {
    if (!user) return '—';
    const fn = user.firstName || '';
    const ln = user.lastName || '';
    const full = `${fn} ${ln}`.trim();
    return full || user.email || '—';
  }, [user]);

  const displayRole = useMemo(() => {
    if (!user?.role) return 'User';
    return user.role.replace(/_/g, ' ');
  }, [user]);

  /* ── Loading ────────────────────────────────────────────────────────── */
  if (isAdmin && org.isLoading && !org.data) {
    return (
      <div className="page-container mx-auto max-w-3xl space-y-5">
        <GlassPageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />
        <SettingsSkeleton />
      </div>
    );
  }

  /* ── Error ──────────────────────────────────────────────────────────── */
  if (isAdmin && org.isError) {
    return (
      <div className="page-container mx-auto max-w-3xl space-y-5">
        <GlassPageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />
        <div className="glass-card p-8">
          <GlassErrorState
            title={t('settings.loadFailed')}
            message={getErrorMessage(org.error as Error)}
            onRetry={handleRetry}
          />
        </div>
      </div>
    );
  }

  /* ── Render ─────────────────────────────────────────────────────────── */
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="page-container mx-auto max-w-3xl space-y-5"
    >
      {/* ============================================================
          HERO HEADER
      ============================================================ */}
      <motion.div variants={cardVariants}>
        <GlassPageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />
      </motion.div>

      <motion.div variants={cardVariants} className="flex flex-wrap items-center gap-3">
        <AccountChip
          name={displayName}
          role={displayRole}
          avatarGradient={avatarGradient(displayName)}
          initials={getInitials(displayName)}
        />
        <div className="flex items-center gap-1.5 rounded-full border border-[#007AFF33] bg-[#007AFF]/[0.08] px-3 py-1.5">
          <Icon paths={I.sparkles} size={12} strokeWidth={2.2} className="text-[#007AFF]" />
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#007AFF]">
            {t('settings.title')}
          </span>
        </div>
      </motion.div>

      {/* ============================================================
          APPEARANCE
      ============================================================ */}
      <PremiumPanel
        icon={I.palette}
        title={t('settings.appearance')}
        subtitle={t('settings.appearanceHint')}
        tone="purple"
      >
        <div className="space-y-3">
          <p className="text-[12px] font-medium text-[#86868B]">
            {t('settings.themeHint')}
          </p>
          <ThemeSwitcher />
        </div>
      </PremiumPanel>

      {/* ============================================================
          TELEGRAM INTEGRATION
      ============================================================ */}
      <PremiumPanel
        icon={I.telegram}
        title={t('settings.telegram.title')}
        subtitle={t('settings.telegram.subtitle')}
        tone="blue"
      >
        <TelegramIntegration />
      </PremiumPanel>

      {/* ============================================================
          ORGANIZATION (admin only)
      ============================================================ */}
      {isAdmin && (
        <PremiumPanel
          icon={I.building}
          title={t('settings.organization')}
          subtitle={t('settings.organizationHint')}
          tone="orange"
        >
          {orgForm && (
            <form className="space-y-4" onSubmit={handleOrgSubmit} noValidate>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <GlassField label={t('settings.orgName')} required error={orgErrors.name}>
                  <div className="relative">
                    <FieldIcon icon={I.building} tone="orange" />
                    <GlassInput
                      value={orgForm.name}
                      onChange={handleOrgChange('name')}
                      required
                      aria-invalid={Boolean(orgErrors.name)}
                      aria-describedby={orgErrors.name ? 'org-name-error' : undefined}
                      disabled={saveOrg.isPending}
                      className="pl-11"
                    />
                  </div>
                  {orgErrors.name && (
                    <span
                      id="org-name-error"
                      className="mt-1 text-xs"
                      style={{ color: 'var(--state-error)' }}
                    >
                      {orgErrors.name}
                    </span>
                  )}
                </GlassField>

                <GlassField
                  label={t('settings.contactEmail')}
                  required
                  error={orgErrors.email}
                >
                  <div className="relative">
                    <FieldIcon icon={I.mail} tone="blue" />
                    <GlassInput
                      type="email"
                      value={orgForm.email}
                      onChange={handleOrgChange('email')}
                      required
                      aria-invalid={Boolean(orgErrors.email)}
                      aria-describedby={orgErrors.email ? 'org-email-error' : undefined}
                      disabled={saveOrg.isPending}
                      className="pl-11"
                    />
                  </div>
                  {orgErrors.email && (
                    <span
                      id="org-email-error"
                      className="mt-1 text-xs"
                      style={{ color: 'var(--state-error)' }}
                    >
                      {orgErrors.email}
                    </span>
                  )}
                </GlassField>

                <GlassField label={t('settings.phone')}>
                  <div className="relative">
                    <FieldIcon icon={I.phone} tone="green" />
                    <GlassInput
                      type="tel"
                      value={orgForm.phone}
                      onChange={handleOrgChange('phone')}
                      disabled={saveOrg.isPending}
                      className="pl-11"
                    />
                  </div>
                </GlassField>
              </div>

              <div className="flex justify-end pt-2">
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <GlassButton type="submit" variant="primary" disabled={saveOrg.isPending}>
                    <span className="inline-flex items-center gap-2">
                      <Icon paths={I.save} size={14} strokeWidth={2} />
                      {saveOrg.isPending ? t('common.saving') : t('settings.saveOrg')}
                    </span>
                  </GlassButton>
                </motion.div>
              </div>
            </form>
          )}
        </PremiumPanel>
      )}

      {/* ============================================================
          ACCOUNT SETTINGS
      ============================================================ */}
      <PremiumPanel
        icon={I.user}
        title={t('settings.account')}
        subtitle={t('settings.accountHint')}
        tone="green"
      >
        <form className="space-y-4" onSubmit={handleSettingsSubmit} noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <GlassField label={t('settings.language')}>
              <div className="relative">
                <FieldIcon icon={I.globe} tone="blue" />
                <GlassSelect
                  value={settingsForm.language}
                  onChange={handleSettingsChange('language')}
                  aria-label={t('settings.language')}
                  disabled={saveSettings.isPending}
                  className="pl-11"
                >
                  {LANGUAGES.map((language) => (
                    <option key={language.value} value={language.value}>
                      {language.label}
                    </option>
                  ))}
                </GlassSelect>
              </div>
            </GlassField>

            <GlassField label={t('settings.timezone')}>
              <div className="relative">
                <FieldIcon icon={I.clock} tone="purple" />
                <GlassSelect
                  value={settingsForm.timezone}
                  onChange={handleSettingsChange('timezone')}
                  aria-label={t('settings.timezone')}
                  disabled={saveSettings.isPending}
                  className="pl-11"
                >
                  {TIMEZONES.map((timezone) => (
                    <option key={timezone.value} value={timezone.value}>
                      {timezone.label}
                    </option>
                  ))}
                </GlassSelect>
              </div>
            </GlassField>
          </div>

          <div className="flex justify-end pt-2">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <GlassButton type="submit" variant="primary" disabled={saveSettings.isPending}>
                <span className="inline-flex items-center gap-2">
                  {saveSettings.isPending ? (
                    <>
                      <motion.span
                        className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                      />
                      {t('common.saving')}
                    </>
                  ) : (
                    <>
                      <Icon paths={I.check} size={14} strokeWidth={2.5} />
                      {t('settings.save')}
                    </>
                  )}
                </span>
              </GlassButton>
            </motion.div>
          </div>
        </form>
      </PremiumPanel>

      {/* ============================================================
          CHANGE PASSWORD
      ============================================================ */}
      <PremiumPanel
        icon={I.lock}
        title={t('settings.changePassword')}
        subtitle={t('settings.changePasswordHint')}
        tone="red"
      >
        <form className="space-y-4" onSubmit={handlePasswordSubmit} noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <GlassField
              label={t('settings.currentPassword')}
              required
              error={pwdErrors.currentPassword}
            >
              <div className="relative">
                <FieldIcon icon={I.lock} tone="red" />
                <PasswordInput
                  value={pwdForm.currentPassword}
                  onChange={handlePwdChange('currentPassword')}
                  autoComplete="current-password"
                  disabled={changePassword.isPending}
                  invalid={Boolean(pwdErrors.currentPassword)}
                  describedBy={pwdErrors.currentPassword ? 'current-password-error' : undefined}
                  ariaLabel={t('settings.currentPassword')}
                />
              </div>
              {pwdErrors.currentPassword && (
                <span
                  id="current-password-error"
                  className="mt-1 text-xs"
                  style={{ color: 'var(--state-error)' }}
                >
                  {pwdErrors.currentPassword}
                </span>
              )}
            </GlassField>

            <GlassField
              label={t('settings.newPassword')}
              required
              error={pwdErrors.newPassword}
            >
              <div className="relative">
                <FieldIcon icon={I.key} tone="orange" />
                <PasswordInput
                  value={pwdForm.newPassword}
                  onChange={handlePwdChange('newPassword')}
                  autoComplete="new-password"
                  disabled={changePassword.isPending}
                  invalid={Boolean(pwdErrors.newPassword)}
                  describedBy={pwdErrors.newPassword ? 'new-password-error' : undefined}
                  ariaLabel={t('settings.newPassword')}
                />
              </div>
              {pwdErrors.newPassword && (
                <span
                  id="new-password-error"
                  className="mt-1 text-xs"
                  style={{ color: 'var(--state-error)' }}
                >
                  {pwdErrors.newPassword}
                </span>
              )}
              <PasswordStrengthMeter value={pwdForm.newPassword} />
            </GlassField>

            <GlassField
              label={t('settings.confirmPassword')}
              required
              error={pwdErrors.confirm}
            >
              <div className="relative">
                <FieldIcon icon={I.shield} tone="green" />
                <PasswordInput
                  value={pwdForm.confirm}
                  onChange={handlePwdChange('confirm')}
                  autoComplete="new-password"
                  disabled={changePassword.isPending}
                  invalid={Boolean(pwdErrors.confirm)}
                  describedBy={pwdErrors.confirm ? 'confirm-password-error' : undefined}
                  ariaLabel={t('settings.confirmPassword')}
                />
              </div>
              {pwdErrors.confirm && (
                <span
                  id="confirm-password-error"
                  className="mt-1 text-xs"
                  style={{ color: 'var(--state-error)' }}
                >
                  {pwdErrors.confirm}
                </span>
              )}
            </GlassField>
          </div>

          <div className="flex justify-end pt-2">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <GlassButton
                type="submit"
                variant="primary"
                disabled={changePassword.isPending}
              >
                <span className="inline-flex items-center gap-2">
                  {changePassword.isPending ? (
                    <>
                      <motion.span
                        className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                      />
                      {t('common.saving')}
                    </>
                  ) : (
                    <>
                      <Icon paths={I.key} size={14} strokeWidth={2.2} />
                      {t('settings.changePasswordAction')}
                    </>
                  )}
                </span>
              </GlassButton>
            </motion.div>
          </div>
        </form>
      </PremiumPanel>

      {toastNode}
    </motion.div>
  );
}