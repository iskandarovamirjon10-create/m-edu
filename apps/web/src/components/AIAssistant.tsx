/**
 * AI Assistant — Floating glass orb & slide-out panel
 * Premium AI companion that helps with quick insights.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/lib/api';

interface AIInsight {
  id: string;
  title: string;
  body: string;
  severity: 'info' | 'success' | 'warning' | 'error';
  metric?: string;
}

const severityStyle: Record<AIInsight['severity'], { color: string; bg: string }> = {
  info:    { color: 'var(--m-vivid)',     bg: 'rgba(84,115,252,0.10)' },
  success: { color: 'var(--state-success)', bg: 'rgba(94,230,168,0.10)' },
  warning: { color: 'var(--state-warning)', bg: 'rgba(245,184,106,0.10)' },
  error:   { color: 'var(--state-error)',   bg: 'rgba(240,112,112,0.10)' },
};

function generateInsights(stats: {
  totalStudents: number;
  activeStudents: number;
  totalTeachers: number;
  totalPaid: string | number;
  totalPending: string | number;
  totalOverdue: string | number;
  totalLeads: number;
  newLeadsThisMonth: number;
  conversionRate: number;
  upcomingFollowUps?: { id: string; scheduledAt: string; lead?: { firstName?: string | null; lastName?: string | null } | null }[];
  attendanceStats?: { status: string; count: number }[];
}): AIInsight[] {
  const insights: AIInsight[] = [];

  // Revenue insight
  const totalPaid = Number(stats.totalPaid) || 0;
  const totalPending = Number(stats.totalPending) || 0;
  const totalOverdue = Number(stats.totalOverdue) || 0;
  const total = totalPaid + totalPending + totalOverdue;
  if (total > 0) {
    const collectionRate = Math.round((totalPaid / total) * 100);
    if (collectionRate >= 80) {
      insights.push({
        id: 'rev-1',
        severity: 'success',
        title: 'Strong collection rate',
        body: `${collectionRate}% of expected revenue has been collected. Consider a celebration message to your team.`,
        metric: `${collectionRate}%`,
      });
    } else if (collectionRate < 60) {
      insights.push({
        id: 'rev-1',
        severity: 'warning',
        title: 'Collection rate below target',
        body: `Only ${collectionRate}% collected. ${stats.upcomingFollowUps?.length ?? 0} follow-up(s) scheduled — consider prioritizing overdue accounts.`,
        metric: `${collectionRate}%`,
      });
    }
  }

  if (totalOverdue > 0) {
    insights.push({
      id: 'rev-2',
      severity: 'error',
      title: 'Overdue payments',
      body: `${totalOverdue.toLocaleString()} in overdue payments. Send friendly reminders to maintain cashflow.`,
      metric: `${totalOverdue.toLocaleString()}`,
    });
  }

  // Leads insight
  if (stats.newLeadsThisMonth > 0 && stats.conversionRate < 30) {
    insights.push({
      id: 'lead-1',
      severity: 'warning',
      title: 'Lead conversion opportunity',
      body: `${stats.newLeadsThisMonth} new leads this month, with a ${stats.conversionRate}% conversion rate. Review follow-up cadence.`,
      metric: `${stats.conversionRate}%`,
    });
  } else if (stats.conversionRate >= 50) {
    insights.push({
      id: 'lead-1',
      severity: 'success',
      title: 'Excellent lead conversion',
      body: `Your ${stats.conversionRate}% conversion is well above the industry average. Keep the momentum!`,
      metric: `${stats.conversionRate}%`,
    });
  }

  // Attendance insight
  if (stats.attendanceStats && stats.attendanceStats.length > 0) {
    const absent = stats.attendanceStats.find((a) => a.status === 'ABSENT')?.count ?? 0;
    const present = stats.attendanceStats.find((a) => a.status === 'PRESENT')?.count ?? 0;
    const total_attendance = present + absent;
    if (total_attendance > 0) {
      const presentRate = Math.round((present / total_attendance) * 100);
      if (presentRate < 70) {
        insights.push({
          id: 'att-1',
          severity: 'warning',
          title: 'Attendance below healthy range',
          body: `${presentRate}% present over the last 30 days. Consider reaching out to absent students.`,
          metric: `${presentRate}%`,
        });
      }
    }
  }

  // Upcoming follow-ups
  const upcoming = stats.upcomingFollowUps?.length ?? 0;
  if (upcoming > 0) {
    insights.push({
      id: 'fl-1',
      severity: 'info',
      title: `${upcoming} follow-up${upcoming > 1 ? 's' : ''} ahead`,
      body: `Stay on top of your pipeline. Open the Leads view to prepare for upcoming calls.`,
      metric: `${upcoming}`,
    });
  }

  return insights.slice(0, 5);
}

function severityIcon(severity: AIInsight['severity']) {
  const cls = 'w-4 h-4';
  if (severity === 'success') {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    );
  }
  if (severity === 'warning') {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    );
  }
  if (severity === 'error') {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    );
  }
  return (
    <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

export function AIAssistant() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const orbRef = useRef<HTMLButtonElement>(null);

  const { data } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: dashboardApi.stats,
    staleTime: 60_000,
  });

  const stats = data as {
    totalStudents: number;
    activeStudents: number;
    totalTeachers: number;
    totalPaid: string | number;
    totalPending: string | number;
    totalOverdue: string | number;
    totalLeads: number;
    newLeadsThisMonth: number;
    conversionRate: number;
    upcomingFollowUps?: { id: string; scheduledAt: string; lead?: { firstName?: string | null; lastName?: string | null } | null }[];
    attendanceStats?: { status: string; count: number }[];
  } | undefined;

  const insights = stats ? generateInsights(stats) : [];

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onClickOutside = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        orbRef.current && !orbRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClickOutside);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, [open]);

  const toggle = useCallback(() => setOpen((v) => !v), []);

  return (
    <>
      {/* Floating glass orb */}
      <button
        ref={orbRef}
        type="button"
        onClick={toggle}
        aria-label={open ? 'Close AI assistant' : 'Open AI assistant'}
        aria-expanded={open}
        className="fixed bottom-6 right-6 z-[150] group"
        style={{
          width: 60,
          height: 60,
          borderRadius: '50%',
          background:
            'conic-gradient(from 0deg, #94EAEF 0%, #5474FC 25%, #94EAEF 50%, #5474FC 75%, #94EAEF 100%)',
          padding: 2,
          animation: 'orb-spin 12s linear infinite',
          boxShadow:
            '0 12px 36px rgba(84,115,252,0.40), 0 0 60px rgba(148,234,239,0.30)',
        }}
      >
        <div
          className="w-full h-full rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-95"
          style={{
            background:
              'radial-gradient(circle at 30% 30%, #FFFFFF 0%, #F4F8FB 40%, #FFFFFF 100%)',
          }}
        >
          <svg
            className="w-6 h-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: 'var(--m-vivid)' }}
            aria-hidden="true"
          >
            <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
            <path d="M20 3v4M22 5h-4M4 17v2M5 18H3" />
          </svg>
        </div>
        {/* Notification dot */}
        {insights.length > 0 && !open && (
          <span
            className="absolute -top-1 -right-1 flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold"
            style={{
              background: 'var(--state-error)',
              color: 'white',
              boxShadow: '0 2px 8px rgba(240,112,112,0.5)',
            }}
          >
            {insights.length}
          </span>
        )}
      </button>

      {/* Slide-out panel */}
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="AI Assistant"
          className="fixed bottom-24 right-6 z-[151] w-[380px] max-w-[calc(100vw-3rem)]"
          style={{
            background: 'var(--bg-card)',
            backdropFilter: 'blur(40px) saturate(1.8)',
            WebkitBackdropFilter: 'blur(40px) saturate(1.8)',
            border: '1px solid var(--border-glass)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-lg)',
            animation: 'glass-dropdown-in 0.25s cubic-bezier(.25,.46,.45,.94) forwards',
            transformOrigin: 'bottom right',
          }}
        >
          {/* Reflection */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'linear-gradient(145deg, rgba(255,255,255,0.30) 0%, transparent 40%, rgba(148,234,239,0.04) 100%)',
              borderRadius: 'inherit',
            }}
          />

          <div className="relative z-10">
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: '1px solid var(--border-subtle)' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, var(--m-cyan) 0%, var(--m-vivid) 100%)',
                    color: 'white',
                  }}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    AI Assistant
                  </h3>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    Insights based on your live data
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-lg p-1.5 transition-colors"
                style={{ color: 'var(--text-muted)' }}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Insights list */}
            <ul className="max-h-96 overflow-y-auto p-4 space-y-2.5">
              {!stats && (
                <li className="text-center py-6">
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    Loading insights…
                  </p>
                </li>
              )}
              {stats && insights.length === 0 && (
                <li
                  className="text-center py-8"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <div
                    className="w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-3"
                    style={{ background: 'rgba(94,230,168,0.10)' }}
                  >
                    <svg
                      className="w-6 h-6"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      style={{ color: 'var(--state-success)' }}
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    All clear
                  </p>
                  <p className="text-xs mt-1">No critical insights right now.</p>
                </li>
              )}
              {insights.map((ins) => {
                const s = severityStyle[ins.severity];
                return (
                  <li
                    key={ins.id}
                    className="rounded-xl p-3 transition-all duration-200 hover:translate-x-0.5"
                    style={{
                      background: s.bg,
                      border: `1px solid ${s.color}22`,
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className="shrink-0 mt-0.5"
                        style={{ color: s.color }}
                      >
                        {severityIcon(ins.severity)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-[0.8125rem] font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {ins.title}
                          </p>
                          {ins.metric && (
                            <span
                              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                              style={{
                                background: s.bg,
                                color: s.color,
                                border: `1px solid ${s.color}33`,
                              }}
                            >
                              {ins.metric}
                            </span>
                          )}
                        </div>
                        <p
                          className="text-[0.75rem] leading-relaxed"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          {ins.body}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Footer */}
            <div
              className="px-4 py-2.5 text-center"
              style={{
                borderTop: '1px solid var(--border-subtle)',
                color: 'var(--text-muted)',
              }}
            >
              <p className="text-[10px]">
                Insights are derived from live dashboard data
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default AIAssistant;
