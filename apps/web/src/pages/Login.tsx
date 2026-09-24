import {
  forwardRef,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthError, useAuthActions, useAuthState } from '@/auth/AuthContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n, type TranslateFn } from '@/i18n/I18nProvider';

/* ────────────────────────────────────────────────────────────────────────── */
/*  Motion tokens (injected once)                                            */
/* ────────────────────────────────────────────────────────────────────────── */

const KEYFRAMES = `
@keyframes auth-rise   { from { opacity:0; transform:translateY(14px) scale(.985) } to { opacity:1; transform:none } }
@keyframes auth-fade   { from { opacity:0 } to { opacity:1 } }
@keyframes auth-shake  { 10%,90%{transform:translateX(-1px)} 20%,80%{transform:translateX(2px)} 30%,50%,70%{transform:translateX(-4px)} 40%,60%{transform:translateX(4px)} }
@keyframes auth-check  { from { stroke-dashoffset: 24 } to { stroke-dashoffset: 0 } }
@media (prefers-reduced-motion: reduce) {
  .auth-motion * { animation-duration: .01ms !important; transition-duration: .01ms !important; }
}
`;

/* ────────────────────────────────────────────────────────────────────────── */
/*  Background orbs (glass system)                                           */
/* ────────────────────────────────────────────────────────────────────────── */

function Backdrop() {
  return (
    <div
      aria-hidden
      className="orb-container"
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}
    >
      <div className="orb orb-cyan-1" />
      <div className="orb orb-cyan-2" />
      <div className="orb orb-indigo-1" />
      <div className="orb orb-deep-1" />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Atoms                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

function BrandMark() {
  return (
    <div
      className="relative mx-auto mb-7 grid h-14 w-14 place-items-center rounded-2xl text-white"
      style={{
        background: 'linear-gradient(135deg, var(--m-vivid) 0%, var(--m-deep) 100%)',
        boxShadow: '0 10px 30px -10px rgba(84,115,252,0.55), inset 0 1px 0 rgba(255,255,255,0.25)',
        border: '1px solid rgba(255,255,255,0.25)',
      }}
    >
      <span className="text-[22px] font-semibold tracking-tight">M</span>
      <span
        aria-hidden
        className="absolute inset-0 rounded-2xl"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, transparent 100%)',
          opacity: 0.6,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="h-5 w-5 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeOpacity=".25"
        strokeWidth="2.5"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function GoogleMark() {
  return (
    <svg
      className="h-[18px] w-[18px] shrink-0"
      viewBox="0 0 24 24"
      aria-hidden
      focusable="false"
    >
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.57 5.57 0 0 1-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29a7.19 7.19 0 0 1 0-4.58V6.62H1.29a11.99 11.99 0 0 0 0 10.76l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}

function Check() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12.5l4.5 4.5L19 7.5"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="24"
        className="[animation:auth-check_.45s_cubic-bezier(.2,.8,.2,1)_forwards]"
      />
    </svg>
  );
}

function Arrow() {
  return (
    <svg
      className="h-4 w-4 transition-transform duration-300 ease-out group-hover:translate-x-0.5"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Eye({ off }: { off: boolean }) {
  return (
    <svg
      className="h-[18px] w-[18px]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M4 4l16 16" />}
    </svg>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Floating-label input (glass)                                             */
/* ────────────────────────────────────────────────────────────────────────── */

interface FloatingInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'placeholder'> {
  label: string;
  invalid?: boolean;
  trailing?: ReactNode;
}

const FloatingInput = forwardRef<HTMLInputElement, FloatingInputProps>(
  function FloatingInput(
    { label, invalid, trailing, className = '', ...rest },
    ref,
  ) {
    const id = useId();
    return (
      <div
        className={[
          'group/field relative transition-[box-shadow,background-color] duration-200 ease-out',
          'first:rounded-t-[14px] last:rounded-b-[14px]',
          'focus-within:z-10',
          invalid
            ? 'shadow-[0_0_0_1px_rgba(240,112,112,0.7)] focus-within:shadow-[0_0_0_3px_rgba(240,112,112,0.22),0_0_0_1px_var(--state-error)]'
            : 'shadow-[0_0_0_1px_rgba(84,115,252,0.18),0_1px_2px_rgba(20,30,45,0.04)] focus-within:shadow-[0_0_0_3px_rgba(84,115,252,0.22),0_0_0_1px_var(--m-vivid)]',
          className,
        ].join(' ')}
        style={{
          background: 'var(--bg-glass)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        <input
          ref={ref}
          id={id}
          placeholder=" "
          aria-invalid={invalid || undefined}
          className="peer block h-[58px] w-full bg-transparent px-4 pb-2 pt-6 text-[16px] tracking-[-0.01em] outline-none placeholder-transparent"
          style={{ color: 'var(--text-primary)' }}
          {...rest}
        />
        <label
          htmlFor={id}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[16px] transition-all duration-200 ease-out peer-focus:top-[13px] peer-focus:text-[11.5px] peer-focus:font-medium peer-focus:tracking-wide peer-[:not(:placeholder-shown)]:top-[13px] peer-[:not(:placeholder-shown)]:text-[11.5px] peer-[:not(:placeholder-shown)]:font-medium peer-[:not(:placeholder-shown)]:tracking-wide"
          style={{ color: 'var(--text-muted)' }}
        >
          {label}
        </label>
        {trailing && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            {trailing}
          </div>
        )}
      </div>
    );
  },
);

/* ────────────────────────────────────────────────────────────────────────── */
/*  Page                                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

function friendlyMessage(err: unknown, t: TranslateFn): string {
  if (err instanceof AuthError) {
    switch (err.code) {
      case 'INVALID_CREDENTIALS':
      case 'UNAUTHORIZED':
        return t('login.wrongEmailOrPassword');
      case 'NETWORK':
        return t('login.offline');
      case 'VALIDATION':
        return err.message || t('login.checkDetails');
      case 'FORBIDDEN':
        return t('login.noAccess');
      default:
        return err.message || t('login.genericError');
    }
  }
  return t('login.genericError');
}

/**
 * Backend Google OAuth initiation endpoint (proxied by vite dev / nginx).
 * The backend performs the OAuth dance and redirects back to
 * /auth/callback with a one-time code. Exported so tests can assert the
 * exact redirect target without depending on jsdom navigation support.
 */
export const googleOAuthUrl = '/api/auth/google';

export function LoginPage() {
  const { t } = useI18n();
  usePageTitle(t('nav.signIn'));
  const { login, clearError } = useAuthActions();
  const { pending } = useAuthState();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const returnTo = useMemo(() => {
    const r = params.get('returnTo');
    return r && r.startsWith('/') && !r.startsWith('//') ? r : '/';
  }, [params]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [done, setDone] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  const emailRef = useRef<HTMLInputElement>(null);
  const busy = pending === 'login';
  const canSubmit =
    email.trim().length > 3 && password.length > 0 && !busy && !done;

  useEffect(() => {
    emailRef.current?.focus();
    return () => clearError();
  }, [clearError]);

  function onPwKey(e: KeyboardEvent<HTMLInputElement>) {
    setCapsOn(e.getModifierState?.('CapsLock') ?? false);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    try {
      await login(email, password);
      setDone(true);
      window.setTimeout(() => navigate(returnTo, { replace: true }), 480);
    } catch (err) {
      setError(friendlyMessage(err, t));
      setShake((n) => n + 1);
      setPassword('');
    }
  }

  function startGoogle() {
    if (googleBusy || busy || done) return;
    setGoogleBusy(true);
    window.location.assign(googleOAuthUrl);
  }

  return (
    <div
      className="auth-motion relative flex min-h-dvh items-center justify-center px-5 py-12 antialiased"
      style={{ background: 'var(--bg-base)' }}
    >
      <style>{KEYFRAMES}</style>
      <Backdrop />

      <main
        key={shake}
        className={[
          'relative z-10 w-full max-w-[420px] [animation:auth-rise_.7s_cubic-bezier(.2,.8,.2,1)_both]',
          shake
            ? '[animation:auth-shake_.5s_cubic-bezier(.36,.07,.19,.97)_both]'
            : '',
        ].join(' ')}
      >
        {/* Glass card */}
        <section className="glass-card p-8 sm:p-10">
          <BrandMark />

          <header className="mb-8 text-center">
            <h1
              className="text-[28px] font-semibold leading-tight tracking-[-0.022em]"
              style={{ color: 'var(--text-primary)' }}
            >
              {t('login.heading')}
            </h1>
            <p
              className="mt-2 text-[15px] leading-snug tracking-[-0.01em]"
              style={{ color: 'var(--text-secondary)' }}
            >
              {t('login.subtitle')}
            </p>
          </header>

          <form onSubmit={onSubmit} noValidate className="space-y-5">
            {/* Grouped fields */}
            <div className="isolate divide-y overflow-hidden rounded-[14px]" style={{ borderColor: 'var(--border-subtle)' }}>
              <FloatingInput
                ref={emailRef}
                label={t('auth.email')}
                type="email"
                name="email"
                inputMode="email"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                invalid={!!error}
                disabled={busy || done || googleBusy}
              />
              <FloatingInput
                label={t('auth.password')}
                type={showPw ? 'text' : 'password'}
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={onPwKey}
                onKeyUp={onPwKey}
                onBlur={() => setCapsOn(false)}
                invalid={!!error}
                disabled={busy || done || googleBusy}
                trailing={
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPw((v) => !v)}
                    aria-label={showPw ? t('auth.hidePassword') : t('auth.showPassword')}
                    className="grid h-9 w-9 place-items-center rounded-full transition-colors active:scale-95"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <Eye off={showPw} />
                  </button>
                }
              />
            </div>

            {/* Live hints — no layout shift */}
            <div className="min-h-[20px] px-1 text-[13px] leading-5 tracking-[-0.01em]">
              {error ? (
                <p
                  role="alert"
                  className="flex items-start gap-1.5 [animation:auth-fade_.25s_ease-out]"
                  style={{ color: 'var(--state-error)' }}
                >
                  <svg
                    className="mt-[3px] h-3.5 w-3.5 shrink-0"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden
                  >
                    <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 5a1.25 1.25 0 0 1 1.25 1.25v5a1.25 1.25 0 0 1-2.5 0v-5A1.25 1.25 0 0 1 12 7Zm0 11a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z" />
                  </svg>
                  {error}
                </p>
              ) : capsOn ? (
                <p
                  className="[animation:auth-fade_.25s_ease-out]"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {t('login.capsLock')}
                </p>
              ) : null}
            </div>

            {/* Primary action */}
            <button
              type="submit"
              disabled={!canSubmit && !busy}
              aria-busy={busy}
              className={[
                'group relative flex h-[50px] w-full items-center justify-center gap-2 overflow-hidden rounded-[14px] text-[16px] font-medium tracking-[-0.01em] text-white',
                'transition-[transform,background-color,box-shadow,opacity] duration-200 ease-out',
                'active:scale-[.985] disabled:cursor-not-allowed',
                done
                  ? 'shadow-[0_8px_24px_-8px_rgba(94,230,168,0.6)]'
                  : 'disabled:opacity-45 disabled:shadow-none',
                'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(84,115,252,0.40)] focus-visible:ring-offset-2',
              ].join(' ')}
              style={{
                background: done
                  ? 'linear-gradient(135deg, #5EE6A8 0%, #2ea870 100%)'
                  : 'linear-gradient(135deg, var(--m-vivid) 0%, var(--m-deep) 100%)',
                boxShadow: done
                  ? undefined
                  : '0 8px 24px -8px rgba(84,115,252,0.7)',
              }}
            >
              {/* Glass highlight */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, transparent 100%)',
                  opacity: 0.7,
                }}
              />
              <span className="relative flex items-center gap-2">
                {done ? (
                  <>
                    <Check />
                    {t('login.signedIn')}
                  </>
                ) : busy ? (
                  <>
                    <Spinner />
                    {t('auth.loggingIn')}
                  </>
                ) : (
                  <>
                    {t('login.continue')}
                    <Arrow />
                  </>
                )}
              </span>
            </button>
          </form>

          {/* Divider */}
          <div
            className="my-6 flex items-center gap-3"
            role="separator"
            aria-label={t('login.or')}
          >
            <span
              aria-hidden
              className="h-px flex-1"
              style={{ background: 'var(--border-subtle)' }}
            />
            <span
              className="text-[13px] tracking-[-0.01em]"
              style={{ color: 'var(--text-muted)' }}
            >
              {t('login.or')}
            </span>
            <span
              aria-hidden
              className="h-px flex-1"
              style={{ background: 'var(--border-subtle)' }}
            />
          </div>

          {/* Google OAuth — full redirect to the backend; never expose secrets client-side */}
          <button
            type="button"
            onClick={startGoogle}
            disabled={googleBusy || busy || done}
            aria-busy={googleBusy}
            className={[
              'flex h-[50px] w-full items-center justify-center gap-3 rounded-[14px] text-[16px] font-medium tracking-[-0.01em]',
              'transition-[transform,box-shadow,opacity] duration-200 ease-out',
              'hover:-translate-y-px active:scale-[.985]',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(84,115,252,0.40)]',
            ].join(' ')}
            style={{
              background: 'var(--bg-glass)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-medium)',
              boxShadow: 'var(--shadow-xs)',
            }}
          >
            {googleBusy ? (
              <>
                <Spinner />
                <span>{t('login.redirectingGoogle')}</span>
              </>
            ) : (
              <>
                <GoogleMark />
                <span>{t('login.continueWithGoogle')}</span>
              </>
            )}
          </button>

          <div className="mt-6 flex items-center justify-center text-[13px] tracking-[-0.01em]">
            <Link
              to="/forgot-password"
              className="underline-offset-[3px] transition-colors hover:underline"
              style={{ color: 'var(--m-vivid)' }}
            >
              {t('auth.forgotPassword')}
            </Link>
          </div>
        </section>

        {/* Below the card */}
        <p
          className="mt-7 text-center text-[14px] tracking-[-0.01em] [animation:auth-fade_.9s_.25s_ease-out_both]"
          style={{ color: 'var(--text-secondary)' }}
        >
          {t('login.newTo')}{' '}
          <Link
            to="/register"
            className="font-medium underline-offset-[3px] hover:underline"
            style={{ color: 'var(--m-vivid)' }}
          >
            {t('login.createAccount')}
          </Link>
        </p>

        <p
          className="mt-10 text-center text-[11.5px] leading-relaxed tracking-[-0.005em] [animation:auth-fade_.9s_.4s_ease-out_both]"
          style={{ color: 'var(--text-muted)' }}
        >
          {t('login.agreeTo')}{' '}
          <Link to="/terms" className="underline-offset-2 hover:underline">
            {t('login.terms')}
          </Link>{' '}
          {t('login.and')}{' '}
          <Link to="/privacy" className="underline-offset-2 hover:underline">
            {t('login.privacy')}
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
