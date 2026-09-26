import type { ReactNode } from 'react';
import { MeduLogo } from '@/components/brand/MeduLogo';

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
          <MeduLogo size="xl" className="mx-auto" />
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
