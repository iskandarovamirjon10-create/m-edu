/**
 * M-EDU Login — Apple Liquid Glass / Spatial Optic ID Edition
 *
 * Clean, distraction-free authentication experience crafted to Apple HIG standards:
 *  · Interactive Biometric Lock Orb reacting to idle, focus, password entropy, busy & error states
 *  · Cursor-tracked radial glass spotlight & Framer Motion `layoutId` focus halo transitions
 *  · Smart email validation badge, quick-clear action & SF-Symbols inspired vector geometry
 *  · macOS Lock Screen tactile rejection shake on authentication failure
 *  · Fluid AnimatePresence height/blur transitions (zero layout jump on errors or CapsLock)
 *  · Native Google SSO Glass action wired to `googleOAuthUrl`
 *  · Defensive password clearing with automatic focus restoration to the password input
 *  · Exports `LoginPage` (named + default) and `googleOAuthUrl` for contract stability
 */
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  memo,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import { AuthError, useAuth } from '@/auth/AuthContext';
import { GlassButton, GlassInput } from '@/components/ui';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { AuthLayout } from '@/layouts/AuthLayout';
import { getErrorMessage } from '@/lib/errorMessages';

/** Backend OAuth initiation endpoint (preserved for contract stability). */
export const googleOAuthUrl = '/api/auth/google';

/* ══════════════════════════════════════════════════════════════════════════
 * MOTION & PHYSICS TOKENS — 120Hz ProMotion Curves
 * ════════════════════════════════════════════════════════════════════════ */

const APPLE_SPRING = {
  type: 'spring' as const,
  stiffness: 440,
  damping: 32,
  mass: 0.75,
};

const HALO_SPRING = {
  type: 'spring' as const,
  stiffness: 380,
  damping: 30,
  mass: 0.65,
};

const SOFT_COLLAPSE = {
  duration: 0.22,
  ease: [0.22, 1, 0.36, 1] as const,
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* ══════════════════════════════════════════════════════════════════════════
 * PRECISION CUPERTINO VECTOR GLYPHS
 * ════════════════════════════════════════════════════════════════════════ */

/** Precision Cupertino-style activity spinner with smooth optical stroke. */
const Spinner = memo(function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`h-4 w-4 animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9.25"
        stroke="currentColor"
        strokeWidth="2.5"
        className="opacity-20"
      />
      <path
        d="M12 2.75a9.25 9.25 0 0 1 9.25 9.25"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        className="opacity-95"
      />
    </svg>
  );
});

/** SF-Symbols inspired optical visibility icon with crisp 1.75px geometry. */
const EyeIcon = memo(function EyeIcon({ off = false }: { off?: boolean }) {
  return (
    <motion.span
      key={off ? 'eye-off' : 'eye-on'}
      initial={{ opacity: 0, scale: 0.82, filter: 'blur(2px)' }}
      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, scale: 0.82, filter: 'blur(2px)' }}
      transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
      className="inline-flex items-center justify-center"
    >
      {off ? (
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
          <path d="m2 2 20 20" />
          <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
        </svg>
      ) : (
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
    </motion.span>
  );
});

/** Native macOS CapsLock indicator symbol (⇪). */
const CapsLockGlyph = memo(function CapsLockGlyph() {
  return (
    <svg
      className="h-3.5 w-3.5 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3 4 12h5v5h6v-5h5L12 3Z" />
      <path d="M9 21h6" />
    </svg>
  );
});

/** Official multi-color Google G vector mark. */
const GoogleMark = memo(function GoogleMark() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.24a7.19 7.19 0 0 1 0-4.48V6.62H1.29a11.99 11.99 0 0 0 0 10.76l3.99-3.14Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
      />
    </svg>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * BIOMETRIC SECURITY ORB — Apple Optic ID / Touch ID Reactive Header
 * ════════════════════════════════════════════════════════════════════════ */

const BiometricSecurityOrb = memo(function BiometricSecurityOrb({
  activeField,
  hasError,
  busy,
  isEmailValid,
  passwordLength,
}: {
  activeField: 'email' | 'password' | null;
  hasError: boolean;
  busy: boolean;
  isEmailValid: boolean;
  passwordLength: number;
}) {
  // Calculate ring completion (0 -> 1) based on email validity + password length
  const progress = useMemo(() => {
    if (busy) return 0.85;
    const emailScore = isEmailValid ? 0.35 : 0;
    const passScore = Math.min(0.65, (passwordLength / 8) * 0.65);
    return Math.min(1, emailScore + passScore);
  }, [busy, isEmailValid, passwordLength]);

  const radius = 23;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  const toneColor = hasError
    ? 'text-[#FF3B30] dark:text-[#FF453A]'
    : progress >= 0.95
      ? 'text-emerald-500 dark:text-emerald-400'
      : 'text-[#007AFF] dark:text-[#38BDF8]';

  const glowBg = hasError
    ? 'from-red-500/25 via-rose-500/10 to-transparent'
    : progress >= 0.95
      ? 'from-emerald-500/25 via-teal-500/10 to-transparent'
      : 'from-blue-500/25 via-sky-500/10 to-transparent';

  return (
    <div className="relative mx-auto mb-2 flex flex-col items-center justify-center select-none">
      <div className="relative flex h-14 w-14 items-center justify-center">
        {/* Ambient breathing aura */}
        <motion.div
          animate={{
            scale: activeField ? [1, 1.12, 1] : 1,
            opacity: activeField ? [0.7, 1, 0.7] : 0.55,
          }}
          transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
          className={`pointer-events-none absolute -inset-2 rounded-full bg-gradient-to-tr ${glowBg} blur-xl`}
        />

        {/* SVG Progress Ring */}
        <svg
          className={`pointer-events-none absolute inset-0 h-full w-full -rotate-90 ${
            busy ? 'animate-spin' : ''
          }`}
          viewBox="0 0 56 56"
          aria-hidden="true"
        >
          <circle
            cx="28"
            cy="28"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            className="text-slate-200/75 dark:text-white/[0.08]"
          />
          <circle
            cx="28"
            cy="28"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className={`transition-all duration-500 ease-out ${toneColor}`}
          />
        </svg>

        {/* Inner Glass Squircle Core */}
        <motion.div
          animate={{
            scale: activeField === 'password' ? 1.05 : 1,
          }}
          transition={APPLE_SPRING}
          className="relative z-10 flex h-10 w-10 items-center justify-center rounded-2xl border border-white/80 bg-white/85 shadow-[0_4px_16px_-2px_rgba(15,23,42,0.1),0_1px_0_0_rgba(255,255,255,0.95)_inset] backdrop-blur-xl dark:border-white/15 dark:bg-surface-900/85 dark:shadow-[0_6px_20px_-2px_rgba(0,0,0,0.6)]"
        >
          <svg
            className={`h-4.5 w-4.5 transition-colors duration-300 ${toneColor}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="11" width="18" height="11" rx="2.5" ry="2.5" />
            <motion.path
              animate={{
                y: progress >= 0.95 && !hasError ? -1.5 : 0,
              }}
              transition={APPLE_SPRING}
              d={
                progress >= 0.95 && !hasError
                  ? 'M7 11V7a5 5 0 0 1 9.9-1'
                  : 'M7 11V7a5 5 0 0 1 10 0v4'
              }
            />
          </svg>
        </motion.div>
      </div>
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * MAIN LOGIN PAGE COMPONENT
 * ════════════════════════════════════════════════════════════════════════ */

export function LoginPage() {
  const { t } = useSafeI18n();
  const { login } = useAuth();
  const prefersReducedMotion = useReducedMotion();
  usePageTitle(t('login.heading'));

  const formRef = useRef<HTMLFormElement | null>(null);
  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const passwordInputRef = useRef<HTMLInputElement | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [errorShakeKey, setErrorShakeKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [activeField, setActiveField] = useState<'email' | 'password' | null>(
    'email',
  );

  const normalizedEmail = email.trim();
  const isEmailValid = useMemo(
    () => EMAIL_REGEX.test(normalizedEmail),
    [normalizedEmail],
  );
  const canSubmit = Boolean(normalizedEmail) && Boolean(password) && !busy;

  // Interactive cursor spotlight tracking
  const handleFormMouseMove = useCallback((e: MouseEvent<HTMLFormElement>) => {
    if (!formRef.current) return;
    const rect = formRef.current.getBoundingClientRect();
    formRef.current.style.setProperty('--spot-x', `${e.clientX - rect.left}px`);
    formRef.current.style.setProperty('--spot-y', `${e.clientY - rect.top}px`);
  }, []);

  const handleEmailChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setEmail(e.target.value);
      if (error) setError('');
    },
    [error],
  );

  const handleClearEmail = useCallback(() => {
    setEmail('');
    if (error) setError('');
    requestAnimationFrame(() => {
      emailInputRef.current?.focus();
    });
  }, [error]);

  const handlePasswordChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setPassword(e.target.value);
      if (error) setError('');
    },
    [error],
  );

  const syncCapsLock = useCallback(
    (e: KeyboardEvent<HTMLInputElement> | MouseEvent<HTMLInputElement>) => {
      if (typeof e.getModifierState === 'function') {
        setCapsLock(e.getModifierState('CapsLock'));
      }
    },
    [],
  );

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!canSubmit) return;

      setError('');
      setBusy(true);

      try {
        await login(normalizedEmail, password);
      } catch (err: unknown) {
        // Defensive: clear invalid password and restore focus like macOS Lock Screen.
        setPassword('');
        setShowPassword(false);
        setErrorShakeKey((k) => k + 1);

        const authErr = err instanceof AuthError ? err : null;
        const friendly =
          authErr?.code === 'INVALID_CREDENTIALS'
            ? t('login.wrongEmailOrPassword')
            : getErrorMessage(err) || t('login.genericError');
        setError(friendly);

        requestAnimationFrame(() => {
          passwordInputRef.current?.focus();
        });
      } finally {
        setBusy(false);
      }
    },
    [canSubmit, login, normalizedEmail, password, t],
  );

  return (
    <AuthLayout title={t('login.heading')} subtitle={t('login.subtitle')}>
      <motion.form
        ref={formRef}
        key={errorShakeKey}
        onSubmit={handleSubmit}
        onMouseMove={handleFormMouseMove}
        noValidate
        initial={false}
        animate={
          error && !prefersReducedMotion
            ? { x: [0, -10, 10, -7, 7, -3.5, 3.5, 0] }
            : { x: 0 }
        }
        transition={{ duration: 0.44, ease: 'easeInOut' }}
        className="group/authform relative space-y-4 antialiased selection:bg-brand-500/20 selection:text-brand-600 dark:selection:bg-brand-400/25 dark:selection:text-brand-300"
      >
        {/* Subtle cursor-tracked spatial spotlight */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-4 -z-10 rounded-3xl opacity-0 transition-opacity duration-500 group-hover/authform:opacity-100"
          style={{
            background:
              'radial-gradient(360px circle at var(--spot-x, 50%) var(--spot-y, 20%), rgba(0, 122, 255, 0.065), transparent 65%)',
          }}
        />

        {/* ── Biometric Optic ID Security Orb ──────────────────────── */}
        <BiometricSecurityOrb
          activeField={activeField}
          hasError={Boolean(error)}
          busy={busy}
          isEmailValid={isEmailValid}
          passwordLength={password.length}
        />

        {/* ── Error Notification (Dynamic Island Style Collapse) ────── */}
        <AnimatePresence initial={false} mode="sync">
          {error && (
            <motion.div
              key="auth-error-alert"
              role="alert"
              aria-live="assertive"
              initial={{ opacity: 0, y: -8, scale: 0.96, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -6, scale: 0.98, filter: 'blur(4px)' }}
              transition={APPLE_SPRING}
              className="relative overflow-hidden rounded-2xl border border-apple-red/25 bg-apple-red/[0.08] px-3.5 py-3 text-[13px] font-medium text-apple-red shadow-[0_12px_32px_-10px_rgba(255,59,48,0.25),inset_0_1px_0_0_rgba(255,255,255,0.22)] backdrop-blur-xl dark:border-apple-red/35 dark:bg-apple-red/[0.14]"
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-apple-red/50 to-transparent"
              />
              <div className="flex items-start gap-2.5">
                <svg
                  className="mt-0.5 h-4 w-4 shrink-0 text-apple-red drop-shadow-[0_1px_2px_rgba(255,59,48,0.3)]"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 5a1.25 1.25 0 0 1 1.25 1.25v5a1.25 1.25 0 0 1-2.5 0v-5A1.25 1.25 0 0 1 12 7Zm0 11a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z" />
                </svg>
                <span className="flex-1 leading-[1.4] tracking-[-0.008em]">
                  {error}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Email Field with Shared Focus Halo & Smart Validation ─── */}
        <div className="relative rounded-2xl p-0.5">
          {activeField === 'email' && (
            <motion.span
              layoutId="login-active-field-halo"
              transition={HALO_SPRING}
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-2xl border border-[#007AFF]/35 bg-[#007AFF]/[0.03] shadow-[0_0_24px_-4px_rgba(0,122,255,0.18)] dark:border-[#38BDF8]/40 dark:bg-[#38BDF8]/[0.04]"
            />
          )}
          <div className="relative z-10">
            <GlassInput
              ref={emailInputRef}
              id="login-email"
              type="email"
              aria-required
              aria-invalid={Boolean(error) || undefined}
              autoFocus
              autoComplete="email"
              inputMode="email"
              spellCheck={false}
              autoCapitalize="none"
              label={t('auth.email')}
              placeholder="name@school.uz"
              value={email}
              onChange={handleEmailChange}
              onFocus={() => setActiveField('email')}
              onBlur={() =>
                setActiveField((prev) => (prev === 'email' ? null : prev))
              }
              disabled={busy}
              className="h-11 text-[15px] tracking-[-0.011em] transition-shadow duration-200"
              inputPrefix={
                <svg
                  className={`h-4 w-4 transition-colors duration-200 ${
                    activeField === 'email'
                      ? 'text-[#007AFF] dark:text-[#38BDF8]'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect width="20" height="16" x="2" y="4" rx="3" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
              }
              inputSuffix={
                <div className="flex items-center gap-1">
                  <AnimatePresence initial={false}>
                    {isEmailValid && (
                      <motion.span
                        key="email-valid-badge"
                        initial={{ opacity: 0, scale: 0.6 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.6 }}
                        transition={APPLE_SPRING}
                        title="Email formati to'g'ri"
                        className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400"
                      >
                        <svg
                          className="h-3 w-3"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      </motion.span>
                    )}
                  </AnimatePresence>

                  {email.length > 0 && !busy && (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={handleClearEmail}
                      aria-label="Emailni tozalash"
                      className="flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition hover:bg-black/[0.06] hover:text-slate-700 active:scale-90 dark:hover:bg-white/10 dark:hover:text-slate-200"
                    >
                      <svg
                        className="h-3.5 w-3.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M18 6 6 18" />
                        <path d="m6 6 12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              }
            />
          </div>
        </div>

        {/* ── Password Field & Tactical CapsLock Indicator ──────────── */}
        <div className="space-y-1.5">
          <div className="relative rounded-2xl p-0.5">
            {activeField === 'password' && (
              <motion.span
                layoutId="login-active-field-halo"
                transition={HALO_SPRING}
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-2xl border border-[#007AFF]/35 bg-[#007AFF]/[0.03] shadow-[0_0_24px_-4px_rgba(0,122,255,0.18)] dark:border-[#38BDF8]/40 dark:bg-[#38BDF8]/[0.04]"
              />
            )}
            <div className="relative z-10">
              <GlassInput
                ref={passwordInputRef}
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                aria-required
                aria-invalid={Boolean(error) || undefined}
                autoComplete="current-password"
                label={t('auth.password')}
                placeholder="••••••••"
                value={password}
                onChange={handlePasswordChange}
                onKeyUp={syncCapsLock}
                onKeyDown={syncCapsLock}
                onClick={syncCapsLock}
                onFocus={() => setActiveField('password')}
                onBlur={() => {
                  setActiveField((prev) =>
                    prev === 'password' ? null : prev,
                  );
                  setCapsLock(false);
                }}
                disabled={busy}
                className="h-11 text-[15px] tracking-[-0.011em] transition-shadow duration-200"
                inputPrefix={
                  <svg
                    className={`h-4 w-4 transition-colors duration-200 ${
                      activeField === 'password'
                        ? 'text-[#007AFF] dark:text-[#38BDF8]'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                }
                inputSuffix={
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setShowPassword((v) => !v)}
                    disabled={busy}
                    aria-label={
                      showPassword
                        ? t('auth.hidePassword')
                        : t('auth.showPassword')
                    }
                    aria-pressed={showPassword}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-surface-500 transition-all duration-150 hover:bg-black/[0.06] hover:text-surface-800 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:pointer-events-none disabled:opacity-40 dark:text-surface-400 dark:hover:bg-white/[0.1] dark:hover:text-surface-100"
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      <EyeIcon off={showPassword} />
                    </AnimatePresence>
                  </button>
                }
              />
            </div>
          </div>

          {/* ── Smooth CapsLock Warning Pill & Forgot Password Row ───── */}
          <div className="flex items-center justify-between pt-0.5">
            <div className="min-h-[24px]">
              <AnimatePresence initial={false}>
                {capsLock && (
                  <motion.div
                    key="capslock-indicator"
                    initial={{ opacity: 0, height: 0, y: -4 }}
                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -4 }}
                    transition={SOFT_COLLAPSE}
                    className="overflow-hidden"
                  >
                    <p
                      role="status"
                      aria-live="polite"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-apple-orange/25 bg-apple-orange/[0.1] px-2.5 py-0.5 text-[11.5px] font-semibold tracking-[-0.006em] text-apple-orange shadow-[inset_0_1px_0_0_rgba(255,255,255,0.18)] backdrop-blur-md"
                    >
                      <CapsLockGlyph />
                      <span>{t('login.capsLock')}</span>
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <Link
              to="/forgot-password"
              tabIndex={busy ? -1 : 0}
              aria-disabled={busy}
              className="group relative inline-flex items-center rounded-md px-1 py-0.5 text-[13px] font-semibold tracking-[-0.008em] text-[#007AFF] transition-colors duration-150 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:text-[#38BDF8] dark:hover:text-sky-300"
            >
              <span>{t('auth.forgotPassword')}</span>
              <span
                aria-hidden="true"
                className="absolute inset-x-1 bottom-0 h-px origin-left scale-x-0 bg-current opacity-60 transition-transform duration-200 ease-out group-hover:scale-x-100"
              />
            </Link>
          </div>
        </div>

        {/* ── Primary Liquid Glass Submit Action ────────────────────── */}
        <div className="pt-1.5">
          <GlassButton
            type="submit"
            variant="primary"
            size="lg"
            disabled={!canSubmit}
            aria-busy={busy}
            className="group relative h-12 w-full overflow-hidden rounded-2xl text-[15px] font-semibold tracking-[-0.014em] shadow-[0_12px_28px_-6px_rgba(0,122,255,0.5),inset_0_1px_0_0_rgba(255,255,255,0.38)] transition-all duration-200 hover:shadow-[0_16px_34px_-6px_rgba(0,122,255,0.62),inset_0_1px_0_0_rgba(255,255,255,0.48)] active:scale-[0.985] disabled:shadow-none"
          >
            {/* Specular top edge sheen */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent opacity-90"
            />

            {/* Subtle animated light sweep when ready */}
            {canSubmit && !prefersReducedMotion && (
              <motion.span
                aria-hidden="true"
                initial={{ x: '-120%' }}
                animate={{ x: '220%' }}
                transition={{
                  duration: 2.6,
                  repeat: Infinity,
                  repeatDelay: 3.5,
                  ease: 'easeInOut',
                }}
                className="pointer-events-none absolute inset-y-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent"
              />
            )}

            <AnimatePresence mode="wait" initial={false}>
              {busy ? (
                <motion.span
                  key="submit-busy"
                  initial={{ opacity: 0, y: 6, filter: 'blur(3px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -6, filter: 'blur(3px)' }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  className="inline-flex items-center justify-center gap-2"
                >
                  <Spinner />
                  <span>{t('login.continue')}</span>
                </motion.span>
              ) : (
                <motion.span
                  key="submit-idle"
                  initial={{ opacity: 0, y: -6, filter: 'blur(3px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: 6, filter: 'blur(3px)' }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  className="inline-flex items-center justify-center gap-1.5"
                >
                  <span>{t('login.continue')}</span>
                  <svg
                    className="h-4 w-4 opacity-80 transition-transform duration-200 ease-out group-hover:translate-x-1 group-disabled:translate-x-0 group-disabled:opacity-40"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.1"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                  </svg>
                </motion.span>
              )}
            </AnimatePresence>
          </GlassButton>
        </div>

        {/* ── Optical Divider & Native Google Glass SSO ─────────────── */}
        <div className="space-y-3 pt-1">
          <div className="relative flex items-center justify-center">
            <div
              aria-hidden="true"
              className="w-full border-t border-slate-200/80 dark:border-white/[0.08]"
            />
            <span className="relative bg-transparent px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
              yoki
            </span>
            <div
              aria-hidden="true"
              className="w-full border-t border-slate-200/80 dark:border-white/[0.08]"
            />
          </div>

          <a
            href={googleOAuthUrl}
            tabIndex={busy ? -1 : 0}
            aria-disabled={busy}
            className="group relative flex h-11 w-full items-center justify-center gap-2.5 overflow-hidden rounded-2xl border border-slate-200/85 bg-white/75 px-4 text-[13.5px] font-semibold text-slate-700 shadow-[0_2px_10px_-2px_rgba(15,23,42,0.05),0_1px_0_0_rgba(255,255,255,0.9)_inset] backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:text-slate-950 hover:shadow-md active:scale-[0.99] dark:border-white/[0.1] dark:bg-white/[0.04] dark:text-slate-200 dark:shadow-none dark:hover:border-white/[0.18] dark:hover:bg-white/[0.08] dark:hover:text-white"
          >
            <GoogleMark />
            <span>Google orqali davom etish</span>
          </a>
        </div>

        {/* ── Multi-Tenant Security Telemetry Footer ────────────────── */}
        <div className="flex items-center justify-center gap-1.5 pt-2 text-[11px] font-medium text-slate-400 dark:text-slate-500">
          <svg
            className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
          <span>256-bit SSL · M-EDU Multi-Tenant Security</span>
        </div>
      </motion.form>
    </AuthLayout>
  );
}

export default LoginPage;