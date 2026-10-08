import { Link, useNavigate } from 'react-router-dom';
import { GlassEmptyState } from '@/components/ui';
import { formatDate, formatTime } from '@/lib/format';
import type { DashboardStats } from '@/lib/types';
import { useI18n } from '@/i18n/I18nProvider';

interface FollowUpsSectionProps {
  followUps: DashboardStats['upcomingFollowUps'];
}

type UrgencyLevel = 'overdue' | 'today' | 'upcoming';

function getUrgency(
  scheduledAt: string | Date,
  t: (key: string) => string | undefined,
): { level: UrgencyLevel; label: string } {
  const d = new Date(scheduledAt);
  const now = new Date();
  
  const isSameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  if (isSameDay) {
    const timeStr = formatTime(d.toTimeString().slice(0, 5));
    const todayLabel = t('dashboard.today') || 'Today';
    return { level: 'today', label: `${todayLabel} ${timeStr}` };
  }

  if (d < now) {
    return { level: 'overdue', label: t('dashboard.overdue') || 'Overdue' };
  }

  return { level: 'upcoming', label: formatDate(d.toISOString()) };
}

function getLeadName(
  lead: { firstName?: string | null; lastName?: string | null } | undefined,
  fallback: string,
) {
  if (!lead) return fallback;
  return [lead.firstName, lead.lastName].filter(Boolean).join(' ').trim() || fallback;
}

export function FollowUpsSection({ followUps }: FollowUpsSectionProps) {
  const { t } = useI18n();
  const navigate = useNavigate();

  return (
    <div className="flex flex-col justify-between rounded-[var(--radius-2xl)] border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-sm)] sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-[var(--text-primary)]">
            {t('dashboard.upcomingFollowUps') || 'Scheduled Follow-ups'}
          </h2>
          <p className="text-xs text-[var(--text-muted)]">
            {t('dashboard.viewLeads') || 'Pending inquiries & calls'}
          </p>
        </div>

        <Link
          to="/leads"
          className="items-center gap-1 text-xs font-semibold text-[var(--primary)] transition-colors hover:underline inline-flex"
        >
          <span>{t('leads.title') || 'View pipeline'}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 17 17 7" /><path d="M7 7h10v10" />
          </svg>
        </Link>
      </div>

      <div className="mt-4 flex-1">
        {!followUps?.length ? (
          <div className="py-8">
            <GlassEmptyState
              title={t('dashboard.noFollowUps') || 'All caught up!'}
              message={t('dashboard.noFollowUpsHint') || 'No scheduled follow-ups pending at this time.'}
            />
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-subtle)] overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)]">
            {followUps.slice(0, 6).map((item) => {
              const name = getLeadName(item.lead, t('dashboard.lead') || 'Lead');
              const urgency = getUrgency(item.scheduledAt, t);
              const leadPhone = (item.lead as { phone?: string })?.phone;

              return (
                <div
                  key={item.id}
                  onClick={() => navigate('/leads')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      navigate('/leads');
                    }
                  }}
                  className="group flex cursor-pointer items-center justify-between gap-3 p-3 transition-colors hover:bg-[var(--bg-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                >
                  {/* Left: Contact Info */}
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                        urgency.level === 'overdue'
                          ? 'bg-[var(--danger-soft)] text-[var(--danger)]'
                          : urgency.level === 'today'
                            ? 'bg-[var(--warning-soft)] text-[var(--warning)]'
                            : 'bg-[var(--primary-soft)] text-[var(--primary)]'
                      }`}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                      </svg>
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-[var(--text-primary)] group-hover:text-[var(--primary)]">
                        {name}
                      </p>
                      <p className="truncate text-[11px] text-[var(--text-muted)]">
                        {item.note || leadPhone || t('dashboard.viewLeads') || 'Scheduled call'}
                      </p>
                    </div>
                  </div>

                  {/* Right: Urgency Pill + Arrow */}
                  <div className="flex shrink-0 items-center gap-2.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-tight ${
                        urgency.level === 'overdue'
                          ? 'bg-[var(--danger-soft)] text-[var(--danger)]'
                          : urgency.level === 'today'
                            ? 'bg-[var(--warning-soft)] text-[var(--warning)]'
                            : 'bg-[var(--neutral-soft)] text-[var(--text-secondary)]'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          urgency.level === 'overdue'
                            ? 'bg-[var(--danger)] animate-pulse'
                            : urgency.level === 'today'
                              ? 'bg-[var(--warning)]'
                              : 'bg-[var(--text-tertiary)]'
                        }`}
                      />
                      {urgency.label}
                    </span>

                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="hidden sm:block text-[var(--text-tertiary)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--primary)]"
                    >
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
