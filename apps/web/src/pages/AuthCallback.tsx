import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AuthLayout } from '@/layouts/AuthLayout';
import { authApi, userStore } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';
import { GlassButton } from '@/components/ui';
import type { User } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useSafeI18n } from '@/i18n/I18nProvider';

type CallbackStatus = 'processing' | 'success' | 'error';

interface CallbackState {
  status: CallbackStatus;
  messageKey: string;
  rawMessage?: string;
}

const INITIAL_STATE: CallbackState = {
  status: 'processing',
  messageKey: 'authCallback.processing',
};

export function AuthCallbackPage() {
  const { t } = useSafeI18n();
  usePageTitle(t('authCallback.pageTitle'));
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [state, setState] = useState<CallbackState>(INITIAL_STATE);
  const exchangeAttemptedRef = useRef(false);
  const navTimerRef = useRef<number | null>(null);
  useEffect(() => () => { if (navTimerRef.current) window.clearTimeout(navTimerRef.current); }, []);

  const handleError = useCallback(
    (messageKey: string, rawMessage?: string) => {
      setState({
        status: 'error',
        messageKey,
        rawMessage,
      });
    },
    [],
  );

  const handleSuccess = useCallback(
    async () => {
      try {
        // JWT is transported as HttpOnly cookie (set by /auth/oauth/exchange).
        const user = (await authApi.me()) as User;
        userStore.set(user);
        setUser(user);

        setState({
          status: 'success',
          messageKey: 'authCallback.success',
        });

        // Small delay to allow the success message to be visible
        // and ensure smooth UX transition
        navTimerRef.current = window.setTimeout(() => {
          navigate('/', { replace: true });
        }, 500);
      } catch {
        handleError('authCallback.errorRetrieval');
      }
    },
    [navigate, setUser, handleError],
  );

  const exchangeCode = useCallback(
    async (code: string, state?: string) => {
      try {
        await authApi.exchangeCode(code, state);
        await handleSuccess();
      } catch {
        handleError('authCallback.errorExpired');
      }
    },
    [handleSuccess, handleError],
  );

  useEffect(() => {
    // Prevent double execution in React StrictMode
    if (exchangeAttemptedRef.current) {
      return;
    }
    exchangeAttemptedRef.current = true;

    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const errorParam = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Handle OAuth error parameters
    if (errorParam) {
      const decodedError = errorDescription
        ? decodeURIComponent(errorDescription)
        : decodeURIComponent(errorParam);
      handleError('authCallback.oauthError', decodedError);
      return;
    }

    // Validate authorization code
    if (!code) {
      handleError('authCallback.errorMissingCode');
      return;
    }

    // Exchange the code for tokens (bound with state for CSRF defense)
    exchangeCode(code, state || undefined);
  }, [searchParams, exchangeCode, handleError]);

  const handleBackToLogin = useCallback(() => {
    navigate('/login', { replace: true });
  }, [navigate]);

  return (
    <AuthLayout title={t('authCallback.completing')}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        className="relative overflow-hidden rounded-2xl bg-white/70 dark:bg-white/[0.04] p-6 sm:p-8 backdrop-blur-md ring-1 ring-inset ring-black/[0.06] dark:ring-white/[0.08] shadow-[0_12px_40px_-15px_rgba(0,0,0,0.06)] dark:shadow-[0_20px_50px_-15px_rgba(0,0,0,0.5)] w-full max-w-md mx-auto"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/20 z-10" />
        {state.status === 'error' ? (
          <div
            className="rounded-2xl p-4 text-sm bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400"
            role="alert"
            aria-live="assertive"
          >
            <div className="flex items-start gap-3">
              <svg
                className="h-5 w-5 shrink-0 mt-0.5 text-rose-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <div className="flex-1">
                <p className="font-semibold text-rose-700 dark:text-rose-300">{t('authCallback.failedTitle')}</p>
                <p className="mt-1 text-slate-600 dark:text-slate-300 text-xs leading-relaxed">{state.rawMessage ?? t(state.messageKey)}</p>
              </div>
            </div>
            <div className="mt-4">
              <GlassButton
                type="button"
                variant="secondary"
                className="w-full sm:w-auto text-xs"
                onClick={handleBackToLogin}
              >
                {t('auth.backToSignIn')}
              </GlassButton>
            </div>
          </div>
        ) : state.status === 'success' ? (
          <div
            className="rounded-2xl p-4 text-sm bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <p className="font-semibold text-sm">{t(state.messageKey)}</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="relative flex h-12 w-12 items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 border-indigo-500/20 border-t-indigo-600 animate-spin" />
            </div>
            <p className="text-center text-sm font-medium text-slate-600 dark:text-slate-300">
              {t(state.messageKey)}
            </p>
          </div>
        )}
      </motion.div>
    </AuthLayout>
  );
}