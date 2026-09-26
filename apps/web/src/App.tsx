import { Suspense, useMemo, type ReactNode } from 'react';
import { BrowserRouter, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '@/auth/AuthContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { UserSettingsSync } from '@/components/UserSettingsSync';
import { PageLoader, ToastHost } from '@/components/ui';
import { AppRoutes } from './routes';
import { DocumentTitleManager } from './routes/DocumentTitle';

// Create query client with optimized defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Retry transient failures only — never 4xx client errors (401/403/404/422).
      retry: (failureCount, error) => {
        const status = (error as { status?: number } | null)?.status;
        if (typeof status === 'number' && status >= 400 && status < 500 && status !== 408 && status !== 429) {
          return false;
        }
        return failureCount < 1;
      },
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      gcTime: 5 * 60 * 1000, // 5 minutes
    },
    mutations: {
      retry: 0,
    },
  },
});

// Loading fallback component
export function PageFallback({ label = 'Loading page…' }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <PageLoader label={label} />
    </div>
  );
}

// Error boundary wrapper — catches runtime render errors (not just
// lazy-load failures) and shows a branded, actionable fallback.
export function ErrorBoundaryWrapper({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <ErrorBoundary label={label}>
      <Suspense fallback={<PageFallback label={`Loading ${label ?? 'page'}…`} />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}

// Protected route component
export function Protected({ children, roles }: { children: ReactNode; roles?: string[] }) {
  const { user, loading, hasAnyRole } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <PageLoader label="Loading your session…" />
      </div>
    );
  }

  if (!user) {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />;
  }

  if (roles?.length && !hasAnyRole(...roles)) {
    return <Navigate to="/unavailable" replace />;
  }

  return <>{children}</>;
}

// Public-only route component
export function PublicOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <PageLoader label="Loading…" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

// Route transition wrapper
export function RouteTransition({ children }: { children: ReactNode }) {
  const location = useLocation();

  return (
    <div
      key={location.pathname}
      className="animate-in fade-in duration-300"
      style={{ animationFillMode: 'both' }}
    >
      {children}
    </div>
  );
}

export default function App() {
  // Memoize routes to prevent unnecessary re-renders
  const routes = useMemo(() => <AppRoutes />, []);

  return (
    <ErrorBoundary label="Root">
      <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <DocumentTitleManager />
          {/* Server -> browser preference rehydration (language, theme). */}
          <UserSettingsSync />
          <RouteTransition>{routes}</RouteTransition>
          {/* Global toast host — every useToast() call in the app renders here */}
          <ToastHost />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
    </ErrorBoundary>
  );
}
