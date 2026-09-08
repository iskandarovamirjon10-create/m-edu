import { Link } from 'react-router-dom';
import { Card } from '@/components/ui';
import { usePageTitle } from '@/hooks/usePageTitle';

/**
 * 404 page — shown for unknown routes inside the authenticated app shell.
 * Includes an actionable back-to-dashboard link and the request context
 * (current URL) so users never feel stranded.
 */
export function NotFoundPage() {
  usePageTitle('Page Not Found');

  return (
    <div className="page-container">
      <div className="orb-container" aria-hidden="true">
        <div className="orb orb-cyan-1" />
        <div className="orb orb-cyan-2" />
        <div className="orb orb-indigo-1" />
        <div className="orb orb-deep-1" />
      </div>

      <div className="flex min-h-[70vh] items-center justify-center px-4" style={{ position: 'relative', zIndex: 1 }}>
        <Card className="w-full max-w-md p-10 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[rgba(84,115,252,0.12)] text-brand-700">
            <svg
              className="h-8 w-8"
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
          <p className="mt-6 text-5xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            404
          </p>
          <h1 className="mt-2 text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            Page not found
          </h1>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            The page you're looking for doesn't exist or may have been moved.
            Check the address, or head back to your dashboard to continue.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/" className="glass-btn glass-btn-primary">
              Back to dashboard
            </Link>
            <Link
              to="/"
              className="text-sm font-medium" style={{ color: 'var(--m-vivid)' }}
            >
              Go home
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default NotFoundPage;
