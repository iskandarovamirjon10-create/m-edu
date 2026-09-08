import type { ReactNode } from 'react';

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12"
      style={{ background: '#f4f8fb' }}
    >
      {/* Floating glass orbs (background decoration) */}
      <div className="orb-container" aria-hidden>
        <div className="orb orb-cyan-1" />
        <div className="orb orb-cyan-2" />
        <div className="orb orb-indigo-1" />
        <div className="orb orb-deep-1" />
      </div>

      <div className="relative w-full max-w-md z-10">
        {/* Logo and title */}
        <div className="mb-8 text-center animate-slide-up">
          <div
            className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-2xl font-bold text-white"
            style={{
              background: 'linear-gradient(135deg, var(--m-vivid) 0%, var(--m-deep) 100%)',
              boxShadow: '0 10px 30px -10px rgba(84,115,252,0.5), inset 0 1px 0 rgba(255,255,255,0.2)',
              border: '1px solid rgba(255,255,255,0.25)',
            }}
          >
            M
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
          <h1
            className="mt-4 text-2xl font-semibold tracking-[-0.02em]"
            style={{ color: 'var(--text-primary)' }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              className="mt-1 text-sm"
              style={{ color: 'var(--text-secondary)' }}
            >
              {subtitle}
            </p>
          )}
        </div>

        {/* Glass card */}
        <div className="glass-card p-8 sm:p-10">
          {children}
        </div>

        {/* Footer */}
        <p
          className="mt-6 text-center text-xs"
          style={{ color: 'var(--text-muted)' }}
        >
          M-EDU — Education Management Platform with secure face-recognition
          attendance
        </p>
      </div>
    </div>
  );
}
