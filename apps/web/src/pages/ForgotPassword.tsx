import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { authApi, friendlyHttpMessage, type ApiError } from '@/lib/api';
import { usePageTitle } from '@/hooks/usePageTitle';

const KEYFRAMES = `
@keyframes auth-rise   { from { opacity:0; transform:translateY(14px) scale(.985) } to { opacity:1; transform:none } }
@keyframes auth-fade   { from { opacity:0 } to { opacity:1 } }
@keyframes auth-check  { from { stroke-dashoffset: 24 } to { stroke-dashoffset: 0 } }
@media (prefers-reduced-motion: reduce) {
  .auth-motion * { animation-duration: .01ms !important; transition-duration: .01ms !important; }
}
`;

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

function Spinner() {
  return (
    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
    </svg>
  );
}

function Check() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="24" className="[animation:auth-check_.45s_cubic-bezier(.2,.8,.2,1)_forwards]" />
    </svg>
  );
}

function Arrow() {
  return (
    <svg className="h-4 w-4 transition-transform duration-300 ease-out group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BrandMark() {
  return (
    <div
      className="relative mx-auto mb-6 grid h-12 w-12 place-items-center rounded-2xl text-white"
      style={{
        background: 'linear-gradient(135deg, var(--m-vivid) 0%, var(--m-deep) 100%)',
        boxShadow: '0 10px 30px -10px rgba(84,115,252,0.55), inset 0 1px 0 rgba(255,255,255,0.25)',
        border: '1px solid rgba(255,255,255,0.25)',
      }}
    >
      <span className="text-[20px] font-semibold tracking-tight">M</span>
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

export function ForgotPasswordPage() {
  usePageTitle('Reset Password');

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const tag = document.createElement('style');
    tag.textContent = KEYFRAMES;
    document.head.appendChild(tag);
    return () => tag.remove();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await authApi.forgotPassword(email);
      setDone(true);
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      setError(friendlyHttpMessage(apiErr.status, apiErr.message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="auth-motion flex min-h-screen items-center justify-center px-5"
      style={{ background: 'var(--bg-base)' }}
    >
      <Backdrop />
      <main
        className="relative z-10 w-full max-w-[400px] [animation:auth-rise_.6s_cubic-bezier(.16,.99,.3,1)_both]"
      >
        <section className="glass-card p-8 sm:p-9">
          <BrandMark />

          <p
            className="mb-1 text-center text-[13px] font-medium uppercase tracking-[.06em]"
            style={{ color: 'var(--text-muted)' }}
          >
            M-EDU
          </p>
          <h1
            className="mb-2 text-center text-[22px] font-semibold tracking-[-0.02em]"
            style={{ color: 'var(--text-primary)' }}
          >
            Reset your password
          </h1>
          <p
            className="mb-6 text-center text-[14px] leading-relaxed"
            style={{ color: 'var(--text-secondary)' }}
          >
            Enter your email and we'll send you a link to reset your password.
          </p>

          {done ? (
            <div className="space-y-4 [animation:auth-fade_.4s_ease-out]">
              <div
                className="flex items-center gap-2.5 rounded-[12px] p-3.5 text-[14px]"
                style={{
                  background: 'rgba(94,230,168,0.12)',
                  border: '1px solid rgba(94,230,168,0.30)',
                  color: '#2ea870',
                }}
              >
                <Check />
                If an account with that email exists, a reset link has been sent. Check your inbox.
              </div>
              <Link
                to="/login"
                className="glass-btn glass-btn-primary h-[48px] w-full text-[15px] font-medium"
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="email"
                required
                autoFocus
                autoComplete="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy}
                className="glass-input h-[48px] text-[15px]"
              />

              {error && (
                <p
                  role="alert"
                  className="flex items-start gap-1.5 text-[13px] [animation:auth-fade_.25s_ease-out]"
                  style={{ color: 'var(--state-error)' }}
                >
                  <svg className="mt-[3px] h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 5a1.25 1.25 0 0 1 1.25 1.25v5a1.25 1.25 0 0 1-2.5 0v-5A1.25 1.25 0 0 1 12 7Zm0 11a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z" />
                  </svg>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy || !email}
                aria-busy={busy}
                className="glass-btn glass-btn-primary group h-[48px] w-full text-[15px] font-medium"
              >
                {busy ? (<><Spinner /> Sending…</>) : (<><span>Send reset link</span><Arrow /></>)}
              </button>
            </form>
          )}
        </section>

        <p
          className="mt-7 text-center text-[13px] tracking-[-0.01em] [animation:auth-fade_.9s_.25s_ease-out_both]"
          style={{ color: 'var(--text-secondary)' }}
        >
          <Link
            to="/login"
            className="font-medium underline-offset-[3px] hover:underline"
            style={{ color: 'var(--m-vivid)' }}
          >
            Back to sign in
          </Link>
        </p>
      </main>
    </div>
  );
}
