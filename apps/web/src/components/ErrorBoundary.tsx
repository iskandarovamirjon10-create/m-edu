import { Component, type ErrorInfo, type ReactNode} from'react';

/**
 * Real React error boundary with a professional fallback UI.
 *
 * The previous app relied on <Suspense> only, which catches *lazy loading*
 * failures but NOT runtime render errors — a crash inside any page would
 * blank the entire application. This boundary:
 * - catches render/lifecycle errors in the subtree,
 * - renders a branded, actionable fallback (reload / try again),
 * - logs the original error for diagnostics,
 * - offers a "reload app"escape hatch when retry keeps failing.
 */
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

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
 state: ErrorBoundaryState = { error: null, attempt: 0};

 static getDerivedStateFromError(error: Error): ErrorBoundaryState {
 return { error, attempt: 0};
}

 componentDidCatch(error: Error, info: ErrorInfo) {
 // Keep the error visible to operators without leaking raw stacks to the
 // user. In dev this also surfaces in the console as usual.
 console.error('[ErrorBoundary]', error, info.componentStack);
}

 private handleRetry = () => {
 this.setState((prev) => ({ error: null, attempt: prev.attempt + 1}));
};

 private handleReload = () => {
 window.location.assign(window.location.pathname + window.location.search);
};

 render() {
 const { error} = this.state;
 if (!error) return this.props.children;

 if (this.props.fallback) {
 return this.props.fallback({ error, reset: this.handleRetry });
 }

 const context = this.props.label ? ` while loading ${this.props.label}` :'';

 return (
 <div
 className="flex min-h-[50vh] flex-col items-center justify-center px-6 py-16 text-center"
 role="alert"
 >
 <div
 className="flex h-14 w-14 items-center justify-center rounded-full"
 style={{
 background:'rgba(240,112,112,0.10)',
 color:'var(--state-error)',
 border:'1px solid rgba(240,112,112,0.22)',
}}
 >
 <svg
 className="h-7 w-7"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth="1.5"
 aria-hidden="true"
 >
 <path
 strokeLinecap="round"
 strokeLinejoin="round"
 d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
 />
 </svg>
 </div>
 <h2
 className="mt-5 text-lg font-semibold"
 style={{ color:'var(--text-primary)'}}
 >
 Something went wrong{context}
 </h2>
 <p
 className="mt-2 max-w-md text-sm"
 style={{ color:'var(--text-muted)'}}
 >
 An unexpected error occurred. You can try again, or reload the
 application to continue where you left off.
 </p>
 <div className="mt-6 flex items-center gap-3">
 <button
 type="button"
 className="btn-secondary"
 onClick={this.handleRetry}
 >
 Try again
 </button>
 <button
 type="button"
 className="btn-primary"
 onClick={this.handleReload}
 >
 Reload app
 </button>
 </div>
 </div>
 );
}
}

export default ErrorBoundary;
