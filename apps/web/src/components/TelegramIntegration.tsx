import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  Check,
  Copy,
  ExternalLink,
  AlertTriangle,
  RefreshCw,
  Bell,
  Clock,
} from 'lucide-react';
import { telegramApi, type TelegramAccountState } from '@/lib/api';
import { GlassButton, useToasts } from '@/components/ui';
import { getErrorMessage } from '@/lib/errorMessages';
import { useI18n } from '@/i18n/I18nProvider';
import { usePremiumSound } from '@/hooks/usePremiumSound';

/**
 * Settings → Integrations → Telegram.
 * Apple Pro Edition with Haptic Web Audio, Liquid Glass styling, and 1-Click Connect.
 */
export function TelegramIntegration() {
  const { t, locale } = useI18n();
  const { push } = useToasts();
  const qc = useQueryClient();
  const { playPop, playTick, playSuccess, playError } = usePremiumSound();

  const [pendingLink, setPendingLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const status = useQuery({
    queryKey: ['telegram-status'],
    queryFn: telegramApi.status,
  });

  const createLink = useMutation({
    mutationFn: () => telegramApi.createLink(),
    onSuccess: (data) => {
      setPendingLink(data.deepLink);
      playPop();
      push('success', t('settings.telegram.linkReady'));
    },
    onError: (e: Error) => {
      playError();
      push('error', getErrorMessage(e));
    },
  });

  const unlink = useMutation({
    mutationFn: () => telegramApi.unlink(),
    onSuccess: () => {
      setPendingLink(null);
      playPop();
      push('success', t('settings.telegram.disconnected'));
      void qc.invalidateQueries({ queryKey: ['telegram-status'] });
    },
    onError: (e: Error) => {
      playError();
      push('error', getErrorMessage(e));
    },
  });

  const testNotification = useMutation({
    mutationFn: () => telegramApi.testNotification(),
    onSuccess: (data) => {
      if (data.sent) {
        playSuccess();
        push('success', t('settings.telegram.testSent'));
      } else {
        playError();
        push('error', t('settings.telegram.testFailed'));
      }
    },
    onError: (e: Error) => {
      playError();
      push('error', getErrorMessage(e));
    },
  });

  const handleCopyLink = useCallback(async () => {
    if (!pendingLink) return;
    try {
      await navigator.clipboard.writeText(pendingLink);
      setCopied(true);
      playTick();
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [pendingLink, playTick]);

  const state = status.data;
  const accountState: TelegramAccountState | 'NOT_LINKED' = state?.status ?? 'NOT_LINKED';

  const stateLabel = useMemo(() => {
    switch (accountState) {
      case 'ACTIVE':
        return t('settings.telegram.stateActive');
      case 'DISCONNECTED':
        return t('settings.telegram.stateDisconnected');
      case 'BLOCKED':
        return t('settings.telegram.stateBlocked');
      case 'SUSPENDED':
        return t('settings.telegram.stateSuspended');
      default:
        return t('settings.telegram.stateNotLinked');
    }
  }, [accountState, t]);

  const isConnected = accountState === 'ACTIVE';

  const formatWhen = useCallback(
    (value: string | null | undefined) => {
      if (!value) return t('settings.telegram.never');
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) return t('settings.telegram.never');
      try {
        return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
          parsed,
        );
      } catch {
        return parsed.toISOString().slice(0, 16).replace('T', ' ');
      }
    },
    [locale, t],
  );

  if (status.isLoading) {
    return (
      <div className="flex items-center gap-2 p-4 text-sm text-[var(--text-muted)] animate-pulse">
        <RefreshCw className="h-4 w-4 animate-spin text-[#0088cc]" />
        <span>{t('common.loading')}</span>
      </div>
    );
  }

  if (status.isError) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 space-y-3" role="alert">
        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 font-medium">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{getErrorMessage(status.error as Error)}</span>
        </div>
        <GlassButton type="button" onClick={() => void status.refetch()}>
          {t('common.retry')}
        </GlassButton>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Telegram Hero Status Card */}
      <div className={[
        'relative overflow-hidden rounded-[1.25rem] p-4 sm:p-5',
        'border border-black/[0.06] dark:border-white/[0.08]',
        'bg-white/60 dark:bg-[#131622]/60 backdrop-blur-xl',
        'shadow-[0_1px_0_rgba(255,255,255,0.8)_inset,0_4px_16px_-4px_rgba(0,0,0,0.04)]',
      ].join(' ')}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            {/* Telegram Cyan Gradient Squircle */}
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-gradient-to-tr from-[#0088cc] to-[#2AABEE] text-white shadow-[0_4px_14px_rgba(0,136,204,0.35)] ring-1 ring-white/30 dark:ring-white/10">
              <Send className="h-6 w-6 -translate-x-0.5 translate-y-0.5 fill-white/20 stroke-[1.8]" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-bold tracking-tight text-[var(--text-primary)]">
                  Telegram Bot
                </span>

                {/* Status Pill Badge */}
                <span
                  role="status"
                  aria-live="polite"
                  className={[
                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold',
                    isConnected
                      ? 'border border-[#10B981]/30 bg-[#10B981]/10 text-[#10B981]'
                      : accountState === 'BLOCKED' || accountState === 'SUSPENDED'
                        ? 'border border-[#EF4444]/30 bg-[#EF4444]/10 text-[#EF4444]'
                        : 'border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-[var(--text-muted)]',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'h-1.5 w-1.5 rounded-full',
                      isConnected
                        ? 'bg-[#10B981]'
                        : accountState === 'BLOCKED'
                          ? 'bg-[#EF4444]'
                          : 'bg-slate-400',
                    ].join(' ')}
                  />
                  {stateLabel}
                </span>
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)]">
                {state?.username && (
                  <span className="font-semibold text-[#0088cc] dark:text-[#2AABEE]">
                    @{state.username}
                  </span>
                )}
                {state?.lastSeenAt && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3 opacity-60" />
                    {t('settings.telegram.lastSeen')}: {formatWhen(state?.lastSeenAt)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Action Badges */}
          {isConnected && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => testNotification.mutate()}
                disabled={testNotification.isPending}
                className="inline-flex items-center gap-1.5 rounded-xl border border-black/[0.08] dark:border-white/[0.1] bg-black/[0.03] dark:bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] transition-all hover:bg-black/[0.06] dark:hover:bg-white/[0.08] active:scale-95 disabled:opacity-50"
              >
                <Bell className="h-3.5 w-3.5 text-[#0088cc]" />
                <span>{t('settings.telegram.test')}</span>
              </button>
            </div>
          )}
        </div>

        <p className="mt-3.5 text-xs leading-relaxed text-[var(--text-muted)]">
          {t('settings.telegram.hint')}
        </p>
      </div>

      {/* Pending Deep Link Card (When Connect / Reconnect is clicked) */}
      <AnimatePresence>
        {pendingLink && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            className={[
              'rounded-[1.25rem] p-4 sm:p-5 space-y-3',
              'border border-[#0088cc]/30 bg-[#0088cc]/[0.06] dark:bg-[#0088cc]/[0.10]',
              'shadow-[0_4px_20px_rgba(0,136,204,0.15)]',
            ].join(' ')}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#0088cc] dark:text-[#2AABEE]">
                {t('settings.telegram.openLink')}
              </span>
              <span className="text-[11px] font-medium text-[var(--text-muted)]">
                {t('settings.telegram.linkExpires', {
                  time: formatWhen(state?.pendingLinkExpiresAt),
                })}
              </span>
            </div>

            {/* Apple 1-Click Launch Button & Copy Button */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <a
                href={pendingLink}
                target="_blank"
                rel="noopener noreferrer"
                role="link"
                className={[
                  'inline-flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 px-4',
                  'bg-[#0088cc] hover:bg-[#0077b5] text-white font-semibold text-xs tracking-tight',
                  'shadow-md shadow-[#0088cc]/25 transition-all active:scale-[0.98]',
                ].join(' ')}
              >
                <Send className="h-4 w-4" />
                <span>Telegram orqali ochish</span>
                <ExternalLink className="h-3.5 w-3.5 opacity-75" />
              </a>

              <button
                type="button"
                onClick={handleCopyLink}
                className={[
                  'inline-flex items-center justify-center gap-2 rounded-xl py-2.5 px-4',
                  'border border-black/10 dark:border-white/15 bg-white/80 dark:bg-[#2C2C2E]/80 text-xs font-semibold',
                  'text-[var(--text-primary)] transition-all active:scale-[0.98]',
                ].join(' ')}
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400">Nusxalandi!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-slate-500" />
                    <span>Nusxa olish</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Connect / Disconnect Buttons */}
      <div className="flex flex-wrap gap-2.5 pt-1">
        <GlassButton
          type="button"
          variant="primary"
          onClick={() => createLink.mutate()}
          disabled={createLink.isPending}
        >
          {createLink.isPending
            ? t('common.loading')
            : state?.linked
              ? t('settings.telegram.reconnect')
              : t('settings.telegram.connect')}
        </GlassButton>

        {state?.linked && (
          <GlassButton
            type="button"
            variant="danger"
            onClick={() => unlink.mutate()}
            disabled={unlink.isPending}
          >
            {unlink.isPending ? t('common.saving') : t('settings.telegram.disconnect')}
          </GlassButton>
        )}
      </div>

      {/* Blocked Recovery Hint */}
      {accountState === 'BLOCKED' && (
        <div
          role="note"
          className="flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3.5 text-xs text-amber-700 dark:text-amber-300"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
          <p className="leading-relaxed">
            {t('settings.telegram.blockedHint')}
          </p>
        </div>
      )}
    </div>
  );
}

export default TelegramIntegration;
