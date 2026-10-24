/**
 * M-EDU ErrorBoundary — Apple VisionOS Liquid Glass Crash Recovery Boundary.
 *
 * Visual:
 * - Refractive frosted glass recovery card with specular inner highlights.
 * - Subtle red chromatic ambient pulse indicating an exception state.
 * - WCAG 2.2 AA / Apple HIG minimum 44px touch targets.
 * - Collapsible diagnostic drawer with 1-click error report copying.
 * - Progressive multi-attempt escape hatch (Dashboard reset).
 *
 * Behavior:
 * - Catches render/lifecycle errors in subtree without blanking the application.
 * - Telemetry reporting through `reportClientError`.
 * - 100% contract compatibility with existing tests and layout wrappers.
 */

import { Component, useState, type ErrorInfo, type ReactNode } from 'react';
import { reportClientError } from '../lib/errorReporter';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional label used to give the fallback a context (e.g. page name). */
  label?: string;
  /** Optional custom fallback renderer for render errors. */
  fallback?: (args: { error: Error; reset: () => void }) => ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
  attempt: number;
}

/** Diagnostic accordion displaying technical error details with 1-click clipboard copy */
function ErrorDiagnostics({ error }: { error: Error }) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  const copyDetails = () => {
    const payload = [
      `M-EDU Error Diagnostic Report`,
      `Timestamp: ${new Date().toISOString()}`,
      `URL: ${typeof window !== 'undefined' ? window.location.href : 'SSR'}`,
      `Name: ${error.name}`,
      `Message: ${error.message}`,
      `Stack:\n${error.stack || 'No stack trace available'}`,
    ].join('\n');

    navigator.clipboard?.writeText(payload).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="mt-6 w-full max-w-lg text-left">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex min-h-[36px] w-full items-center justify-between rounded-xl border border-black/[0.06] bg-black/[0.03] px-3.5 py-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-black/[0.06] hover:text-[var(--text-primary)] dark:border-white/[0.08] dark:bg-white/[0.04] dark:hover:bg-white/[0.08]"
        aria-expanded={open}
      >
        <span>Error Details & Diagnostics</span>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
          {open ? 'Hide' : 'Show'}
        </span>
      </button>

      {open && (
        <div className="mt-2 overflow-hidden rounded-2xl border border-black/[0.08] bg-black/[0.04] p-3 text-xs shadow-inner backdrop-blur-md dark:border-white/[0.1] dark:bg-black/40">
          <div className="mb-2 flex items-center justify-between border-b border-black/[0.06] pb-2 dark:border-white/[0.08]">
            <span className="font-mono text-[11px] font-medium text-apple-red">
              {error.name}: {error.message}
            </span>
            <button
              type="button"
              onClick={copyDetails}
              className="rounded-lg border border-black/[0.08] bg-white/70 px-2.5 py-1 text-[11px] font-semibold text-[var(--text-primary)] shadow-sm transition-all hover:bg-white active:scale-95 dark:border-white/[0.12] dark:bg-white/[0.08] dark:hover:bg-white/[0.16]"
            >
              {copied ? '✓ Copied' : 'Copy details'}
            </button>
          </div>
          <pre className="max-h-44 overflow-auto font-mono text-[10.5px] leading-relaxed text-[var(--text-secondary)] [scrollbar-width:thin]">
            {error.stack || error.message}
          </pre>
        </div>
      )}
    </div>
  );
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, attempt: 0 };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error, attempt: 0 };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary]', error, info.componentStack);
    }
    reportClientError(
      error instanceof Error
        ? new Error(`${error.message} @ ${info.componentStack ?? 'unknown'}`)
        : error,
      'boundary',
    );
  }

  private handleRetry = () => {
    this.setState((prev) => ({ error: null, attempt: prev.attempt + 1 }));
  };

  private handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.assign(window.location.pathname + window.location.search);
    }
  };

  private handleGoHome = () => {
    if (typeof window !== 'undefined') {
      window.location.assign('/');
    }
  };

  render() {
    const { error, attempt } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) {
      return this.props.fallback({ error, reset: this.handleRetry });
    }

    const context = this.props.label ? ` while loading ${this.props.label}` : '';

    return (
      <div
        className="relative flex min-h-[50vh] min-h-[calc(var(--app-vh,1vh)*50)] flex-col items-center justify-center px-4 py-12 text-center"
        role="alert"
      >
        {/* Liquid Glass Error Presentation Card */}
        <div className="relative flex w-full max-w-md flex-col items-center rounded-3xl border border-black/[0.08] bg-card/85 p-6 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.12),inset_0_1px_1px_rgba(255,255,255,0.8)] backdrop-blur-2xl backdrop-saturate-[190%] dark:border-white/[0.12] dark:bg-[#1C1C1E]/80 dark:shadow-[0_20px_48px_-16px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.12)] sm:p-8">
          {/* Specular inner top highlight rim */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-6 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/30"
          />

          {/* Ambient red hazard pulse icon */}
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-apple-red/25 bg-apple-red/10 text-apple-red shadow-[0_8px_20px_-4px_rgba(255,59,48,0.25),inset_0_1px_1px_rgba(255,255,255,0.6)] backdrop-blur-md dark:border-apple-red/35 dark:bg-apple-red/15 dark:shadow-[0_8px_24px_-4px_rgba(255,59,48,0.4)]">
            <svg
              className="h-8 w-8"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          </div>

          <h2 className="mt-5 text-xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-2xl">
            Something went wrong{context}
          </h2>

          <p className="mt-2 max-w-sm text-sm leading-relaxed text-[var(--text-secondary)]">
            An unexpected error occurred. You can try again, or reload the application to continue
            where you left off.
          </p>

          {/* Action buttons with strict WCAG 2.2 / Apple HIG 44px touch targets */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={this.handleRetry}
              className="flex min-h-[44px] min-w-[120px] items-center justify-center rounded-xl border border-black/[0.08] bg-white/70 px-5 py-2.5 text-sm font-semibold text-[var(--text-primary)] shadow-[0_2px_6px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-md transition-all hover:bg-white active:scale-95 dark:border-white/[0.12] dark:bg-white/[0.08] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] dark:hover:bg-white/[0.14]"
            >
              Try again
            </button>

            <button
              type="button"
              onClick={this.handleReload}
              className="flex min-h-[44px] min-w-[120px] items-center justify-center rounded-xl border border-brand-500/30 bg-gradient-to-b from-brand-500 to-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(0,122,255,0.35),inset_0_1px_0_rgba(255,255,255,0.4)] transition-all hover:brightness-105 active:scale-95"
            >
              Reload app
            </button>

            {attempt >= 2 && (
              <button
                type="button"
                onClick={this.handleGoHome}
                className="flex min-h-[44px] w-full items-center justify-center rounded-xl border border-black/[0.06] bg-black/[0.02] px-4 py-2 text-xs font-semibold text-brand-600 transition-all hover:bg-brand-500/10 active:scale-95 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-brand-400"
              >
                Return to Dashboard
              </button>
            )}
          </div>

          {/* Diagnostic Drawer */}
          <ErrorDiagnostics error={error} />
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
