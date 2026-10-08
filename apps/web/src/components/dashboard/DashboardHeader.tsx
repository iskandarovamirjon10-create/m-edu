import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { GlassButton } from '@/components/ui';
import { useI18n } from '@/i18n/I18nProvider';

interface DashboardHeaderProps {
  userName?: string;
  orgName?: string;
}

export function DashboardHeader({ userName, orgName }: DashboardHeaderProps) {
  const { t } = useI18n();

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 5) return { text: t('dashboard.goodNight') || 'Good night', emoji: '🌙' };
    if (h < 12) return { text: t('dashboard.goodMorning') || 'Good morning', emoji: '☀️' };
    if (h < 17) return { text: t('dashboard.goodAfternoon') || 'Good afternoon', emoji: '🌤️' };
    if (h < 22) return { text: t('dashboard.goodEvening') || 'Good evening', emoji: '🌆' };
    return { text: t('dashboard.goodNight') || 'Good night', emoji: '🌙' };
  }, [t]);

  const formattedDate = useMemo(() => {
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    }).format(new Date());
  }, []);

  return (
    <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-muted)]">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--primary-soft)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--primary)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)] animate-pulse" />
            {orgName || t('dashboard.liveOverview') || 'Live Overview'}
          </span>
          <span>·</span>
          <span>{formattedDate}</span>
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">
          <span className="mr-2" role="img" aria-label="greeting icon">
            {greeting.emoji}
          </span>
          {greeting.text}
          {userName ? `, ${userName}` : ''}
        </h1>

        <p className="text-sm text-[var(--text-muted)]">
          {t('dashboard.description') || "Here's what is happening across your academy today."}
        </p>
      </div>

      <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:flex sm:flex-wrap sm:items-center">
        <GlassButton asChild variant="secondary" size="sm" className="w-full justify-center rounded-xl font-medium sm:w-auto">
          <Link to="/students/new" className="flex items-center justify-center gap-1.5">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="19" y1="8" x2="19" y2="14" />
              <line x1="22" y1="11" x2="16" y2="11" />
            </svg>
            <span>{t('students.create') || 'New Student'}</span>
            <kbd className="hidden rounded bg-black/5 px-1 py-0.5 text-[10px] text-[var(--text-tertiary)] dark:bg-white/10 md:inline-block">
              ⌘N
            </kbd>
          </Link>
        </GlassButton>

        <GlassButton asChild variant="secondary" size="sm" className="w-full justify-center rounded-xl font-medium sm:w-auto">
          <Link to="/attendance" className="flex items-center justify-center gap-1.5">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" />
              <path d="M3 10h18" /><path d="m9 16 2 2 4-4" />
            </svg>
            <span>{t('nav.attendance') || 'Attendance'}</span>
          </Link>
        </GlassButton>

        <GlassButton asChild variant="secondary" size="sm" className="w-full justify-center rounded-xl font-medium sm:w-auto">
          <Link to="/groups/new" className="flex items-center justify-center gap-1.5">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span>{t('groups.create') || 'New Group'}</span>
          </Link>
        </GlassButton>

        <GlassButton asChild variant="primary" size="sm" className="w-full justify-center rounded-xl font-semibold shadow-md shadow-[var(--primary)]/20 sm:w-auto">
          <Link to="/payments" className="flex items-center justify-center gap-1.5">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="20" height="14" x="2" y="5" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
            <span>{t('payments.title') || 'Payments'}</span>
          </Link>
        </GlassButton>
      </div>
    </header>
  );
}
