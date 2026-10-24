/**
 * AiBroadcastCard — Interactive Liquid Glass Mass Announcement & Broadcast Widget.
 *
 * Responsibilities:
 *   - Visualizes broadcast / notification drafts from `broadcast.send` tool.
 *   - Displays delivery channel (SMS, Telegram, In-App), recipient count, and text preview.
 *   - Graceful states: loading, empty, error.
 *   - Direct deep-link navigation to `/notifications` or `/broadcast`.
 */
import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Send, MessageSquare, Smartphone, Bell, ArrowUpRight, AlertCircle, Users } from 'lucide-react';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { cn } from '@/lib/design';
import type { AiBroadcastData } from '@/types/ai';

export interface AiBroadcastCardProps {
  data?: AiBroadcastData | null;
  loading?: boolean;
  error?: string | null;
  className?: string;
}

function tr(t: (k: string) => string, key: string, fallback: string): string {
  try {
    const val = t(key);
    return !val || val === key ? fallback : val;
  } catch {
    return fallback;
  }
}

export const AiBroadcastCard = memo(function AiBroadcastCard({
  data,
  loading = false,
  error,
  className,
}: AiBroadcastCardProps) {
  const { t } = useSafeI18n();

  if (loading) {
    return (
      <div
        role="status"
        aria-label="Xabarnoma ma'lumotlari yuklanmoqda"
        className={cn(
          'w-full max-w-md animate-pulse rounded-2xl border border-[var(--border-subtle,rgba(0,0,0,0.08))] p-4',
          'bg-[var(--bg-card,#ffffff)]/80 backdrop-blur-xl dark:bg-[#1C1C1E]/80',
          className
        )}
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-black/10 dark:bg-white/10" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/3 rounded bg-black/10 dark:bg-white/10" />
            <div className="h-3 w-1/2 rounded bg-black/10 dark:bg-white/10" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className={cn(
          'flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-3.5 text-xs text-rose-600 dark:text-rose-400',
          className
        )}
      >
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  if (!data || !data.message) {
    return (
      <div
        role="status"
        className={cn(
          'w-full max-w-md rounded-2xl border border-[var(--border-subtle,rgba(0,0,0,0.08))] p-4 text-center text-xs text-[var(--text-muted,#86868B)]',
          'bg-[var(--bg-card,#ffffff)]/80 backdrop-blur-xl dark:bg-[#1C1C1E]/80',
          className
        )}
      >
        {tr(t, 'ai.widget.broadcast.empty', "Xabarnoma ma'lumoti topilmadi")}
      </div>
    );
  }

  const {
    channel = 'all',
    recipientGroup = "Barcha o'quvchilar va ota-onalar",
    recipientCount = 0,
    title,
    message,
  } = data;

  const ChannelIcon =
    channel === 'sms'
      ? Smartphone
      : channel === 'telegram'
        ? MessageSquare
        : channel === 'platform'
          ? Bell
          : Send;

  const channelLabel =
    channel === 'sms'
      ? 'SMS Xabarnoma'
      : channel === 'telegram'
        ? 'Telegram Xabar'
        : channel === 'platform'
          ? 'Platforma bildirishnomasi'
          : 'Barcha kanallar (SMS + Telegram)';

  return (
    <div
      role="region"
      aria-label="AI Ommaviy xabarnoma kartasi"
      data-testid="ai-broadcast-card"
      className={cn(
        'relative overflow-hidden w-full max-w-md rounded-2xl border p-4.5',
        'border-black/[0.08] dark:border-white/10',
        'bg-white/85 text-[var(--text-primary)] backdrop-blur-2xl dark:bg-[#1C1C1E]/85',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_12px_32px_-12px_rgba(0,0,0,0.12)]',
        'dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_12px_32px_-12px_rgba(0,0,0,0.5)]',
        className
      )}
    >
      {/* Specular edge highlight */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[#007AFF]/30 to-transparent"
      />

      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-black/[0.06] dark:border-white/[0.06] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#007AFF]/15 to-[#007AFF]/5 text-[#007AFF] border border-[#007AFF]/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] dark:bg-[#007AFF]/20">
            <ChannelIcon className="h-4.5 w-4.5" />
          </div>
          <div>
            <h4 className="text-[13px] font-bold tracking-tight text-[var(--text-primary)]">
              {tr(t, 'ai.widget.broadcast.title', 'Ommaviy Xabarnoma')}
            </h4>
            <span className="text-[11px] font-medium text-[var(--text-muted)]">
              {channelLabel}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 rounded-full border border-black/[0.06] bg-black/[0.02] px-2.5 py-1 text-[11px] font-semibold dark:border-white/[0.08] dark:bg-white/[0.04]">
          <Users className="h-3.5 w-3.5 text-[#007AFF]" />
          <span>{recipientCount > 0 ? `${recipientCount} ta qabul qiluvchi` : recipientGroup}</span>
        </div>
      </div>

      {/* Message Preview Box */}
      <div className="mt-3.5 rounded-xl border border-black/[0.06] bg-black/[0.02] p-3 dark:border-white/[0.06] dark:bg-white/[0.03]">
        {title && (
          <h5 className="text-xs font-bold text-[var(--text-primary)] mb-1">
            {title}
          </h5>
        )}
        <p className="text-[12px] leading-relaxed text-[var(--text-secondary)] whitespace-pre-wrap">
          {message}
        </p>
        <div className="mt-2 flex items-center justify-between border-t border-black/[0.04] pt-2 dark:border-white/[0.06] text-[10px] text-[var(--text-muted)]">
          <span>Belgilar soni: {message.length}</span>
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">Tasdiqlashga tayyor</span>
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="mt-2.5 flex items-center justify-end border-t border-black/[0.06] dark:border-white/[0.06] pt-2">
        <Link
          to="/notifications"
          className="group inline-flex items-center gap-1 text-[11px] font-semibold text-[#007AFF] hover:text-[#0051A8] transition-colors active:scale-[0.98]"
        >
          <span>{tr(t, 'ai.widget.broadcast.viewAll', 'Bildirishnomalar markazi')}</span>
          <ArrowUpRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
      </div>
    </div>
  );
});
