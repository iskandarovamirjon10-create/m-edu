import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '@/layouts/AuthLayout';
import { authApi, userStore } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';
import { GlassButton } from '@/components/ui';
import type { User } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n/I18nProvider';

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
  const { t } = useI18n();
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
    async (code: string) => {
      try {
        await authApi.exchangeCode(code);
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

    // Exchange the code for tokens
    exchangeCode(code);
  }, [searchParams, exchangeCode, handleError]);

  const handleBackToLogin = useCallback(() => {
    navigate('/login', { replace: true });
  }, [navigate]);

  return (
    <AuthLayout title={t('authCallback.completing')}>
      <div className="w-full max-w-md mx-auto">
        {state.status === 'error' ? (
          <div
            className="rounded-xl px-4 py-3 text-sm"
            style={{
              background: 'rgba(240,112,112,0.10)',
              border: '1px solid rgba(240,112,112,0.25)',
              color: 'var(--state-error)',
            }}
            role="alert"
            aria-live="assertive"
          >
            <div className="flex items-start gap-3">
              <svg
                className="h-5 w-5 shrink-0 mt-0.5"
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
                <p className="font-medium" style={{ color: 'var(--state-error)' }}>{t('authCallback.failedTitle')}</p>
                <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>{state.rawMessage ?? t(state.messageKey)}</p>
              </div>
            </div>
            <div className="mt-4">
              <GlassButton
                type="button"
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={handleBackToLogin}
              >
                {t('auth.backToSignIn')}
              </GlassButton>
            </div>
          </div>
        ) : state.status === 'success' ? (
          <div
            className="rounded-xl px-4 py-3 text-sm"
            style={{
              background: 'rgba(94,230,168,0.12)',
              border: '1px solid rgba(94,230,168,0.30)',
              color: '#2ea870',
            }}
            role="status"
            aria-live="polite"
          >
            <div className="flex items-center gap-3">
              <svg
                className="h-5 w-5 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <p className="font-medium">{t(state.messageKey)}</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 py-8">
            <div
              className="spinner spinner-lg"
              role="progressbar"
              aria-label={t('auth.authenticating')}
            />
            <p className="text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
              {t(state.messageKey)}
            </p>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}