import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { telegramApi, type TelegramAccountState } from '@/lib/api';
import { GlassButton, useToasts } from '@/components/ui';
import { getErrorMessage } from '@/lib/errorMessages';
import { useI18n } from '@/i18n/I18nProvider';

/**
 * Settings → Integrations → Telegram.
 *
 * Server is the source of truth: the panel renders whatever
 * `GET /api/telegram/status` returns and re-reads it after every action, so a
 * disconnect performed elsewhere (bot `/unlink`, admin action, automatic
 * BLOCKED marking) is reflected on the next load rather than cached locally.
 *
 * Security: the API never sends the bot token, webhook/callback secret or the
 * chat id, so there is nothing sensitive to accidentally render. The deep link
 * is a one-time, short-lived token bound to the CALLER's own account (it is
 * minted from the JWT, never from anything this component sends).
 */
export function TelegramIntegration() {
  const { t, locale } = useI18n();
  const { push } = useToasts();
  const qc = useQueryClient();
  const [pendingLink, setPendingLink] = useState<string | null>(null);

  const status = useQuery({
    queryKey: ['telegram-status'],
    queryFn: telegramApi.status,
  });

  const createLink = useMutation({
    mutationFn: () => telegramApi.createLink(),
    onSuccess: (data) => {
      setPendingLink(data.deepLink);
      push('success', t('settings.telegram.linkReady'));
    },
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  const unlink = useMutation({
    mutationFn: () => telegramApi.unlink(),
    onSuccess: () => {
      setPendingLink(null);
      push('success', t('settings.telegram.disconnected'));
      void qc.invalidateQueries({ queryKey: ['telegram-status'] });
    },
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  const testNotification = useMutation({
    mutationFn: () => telegramApi.testNotification(),
    onSuccess: (data) =>
      push(
        data.sent ? 'success' : 'error',
        data.sent ? t('settings.telegram.testSent') : t('settings.telegram.testFailed'),
      ),
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  const state = status.data;
  // Report the lifecycle state the server actually stored — including the
  // non-deliverable ones (BLOCKED / SUSPENDED / DISCONNECTED), which come back
  // with `linked: false`. Hiding them behind "not connected" would tell the
  // user the wrong thing and hide the recovery path.
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

  const stateTone =
    accountState === 'ACTIVE'
      ? 'var(--state-success)'
      : accountState === 'BLOCKED' || accountState === 'SUSPENDED'
        ? 'var(--state-error)'
        : 'var(--text-muted)';

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
      <p className="text-sm" role="status" style={{ color: 'var(--text-muted)' }}>
        {t('common.loading')}
      </p>
    );
  }

  if (status.isError) {
    return (
      <div className="space-y-3" role="alert">
        <p className="text-sm" style={{ color: 'var(--state-error)' }}>
          {getErrorMessage(status.error as Error)}
        </p>
        <GlassButton type="button" onClick={() => void status.refetch()}>
          {t('common.retry')}
        </GlassButton>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
          style={{
            background: 'var(--bg-glass)',
            border: '1px solid var(--border-subtle)',
            color: stateTone,
          }}
          role="status"
          aria-live="polite"
        >
          <span
            aria-hidden
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: stateTone }}
          />
          {stateLabel}
        </span>

        {state?.username && (
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            @{state.username}
          </span>
        )}

        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {t('settings.telegram.lastSeen')}: {formatWhen(state?.lastSeenAt)}
        </span>
      </div>

      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {t('settings.telegram.hint')}
      </p>

      {pendingLink && (
        <div
          className="rounded-xl p-3 space-y-2"
          style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)' }}
        >
          <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
            {t('settings.telegram.openLink')}
          </p>
          <a
            href={pendingLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm break-all underline"
            style={{ color: 'var(--m-vivid)' }}
          >
            {pendingLink}
          </a>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {t('settings.telegram.linkExpires', {
              time: formatWhen(state?.pendingLinkExpiresAt),
            })}
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
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
          <>
            <GlassButton
              type="button"
              onClick={() => testNotification.mutate()}
              disabled={testNotification.isPending}
            >
              {t('settings.telegram.test')}
            </GlassButton>
            <GlassButton
              type="button"
              variant="danger"
              onClick={() => unlink.mutate()}
              disabled={unlink.isPending}
            >
              {unlink.isPending ? t('common.saving') : t('settings.telegram.disconnect')}
            </GlassButton>
          </>
        )}
      </div>

      {accountState === 'BLOCKED' && (
        <p className="text-xs" role="note" style={{ color: 'var(--text-muted)' }}>
          {t('settings.telegram.blockedHint')}
        </p>
      )}
    </div>
  );
}
