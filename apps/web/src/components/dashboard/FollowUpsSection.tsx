import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GlassEmptyState } from '@/components/ui';
import { formatDate, formatTime } from '@/lib/format';
import type { DashboardStats } from '@/lib/types';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { DashboardGlassLayers, useDashboardGlassCard } from './DashboardGlass';

interface FollowUpsSectionProps {
  followUps: DashboardStats['upcomingFollowUps'];
}

type UrgencyLevel = 'overdue' | 'today' | 'upcoming';

function getUrgency(
  scheduledAt: string | Date,
  t: (key: string, fallback?: string) => string,
): { level: UrgencyLevel; label: string } {
  const d = new Date(scheduledAt);
  const now = new Date();
  
  const isSameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  if (isSameDay) {
    const timeStr = formatTime(d.toTimeString().slice(0, 5));
    const todayLabel = t('dashboard.today', 'Bugun');
    return { level: 'today', label: `${todayLabel} ${timeStr}` };
  }

  if (d < now) {
    return { level: 'overdue', label: t('dashboard.overdue', 'Muddati o‘tgan') };
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
  const { t } = useSafeI18n();
  const navigate = useNavigate();
  const sound = usePremiumSound();
  const cardRef = useDashboardGlassCard<HTMLDivElement>();

  return (
    <div
      ref={cardRef}
      className="lgx lgx--clear relative flex flex-col justify-between rounded-[2rem] p-5 sm:p-6"
    >
      <DashboardGlassLayers />
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-primary">
            {t('dashboard.upcomingFollowUps', 'Rejalashtirilgan muloqotlar')}
          </h2>
          <p className="text-xs text-secondary">
            {t('dashboard.viewLeads', 'Kutilayotgan lidlar va qo‘ng‘iroqlar')}
          </p>
        </div>

        <Link
          to="/leads"
          onClick={() => sound.playTick?.()}
          className="inline-flex min-h-[44px] items-center gap-1 text-xs font-semibold text-primary transition-colors hover:underline"
        >
          <span>{t('leads.title', 'Voronkani ochish')}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 17 17 7" /><path d="M7 7h10v10" />
          </svg>
        </Link>
      </div>

      <div className="mt-4 flex-1">
        {!followUps?.length ? (
          <div className="py-8">
            <GlassEmptyState
              title={t('dashboard.noFollowUps', 'Rejali muloqotlar yo‘q')}
              message={t('dashboard.noFollowUpsHint', 'Hozircha barcha muloqotlar o‘z vaqtida bajarilgan.')}
            />
          </div>
        ) : (
          <div className="divide-y divide-black/[0.04] dark:divide-white/[0.06] overflow-hidden rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.02]">
            {followUps.slice(0, 6).map((item) => {
              const name = getLeadName(item.lead, t('dashboard.lead', 'Lid'));
              const urgency = getUrgency(item.scheduledAt, t);
              const leadPhone = (item.lead as { phone?: string })?.phone;

              return (
                <motion.div
                  key={item.id}
                  whileHover={{ scale: 1.008, x: 2 }}
                  whileTap={{ scale: 0.985 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                  onClick={() => {
                    sound.playPop?.();
                    navigate('/leads');
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      sound.playPop?.();
                      navigate('/leads');
                    }
                  }}
                  className="group flex min-h-[48px] cursor-pointer items-center justify-between gap-3 p-3 transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {/* Left: Contact Info */}
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-semibold ${
                        urgency.level === 'overdue'
                          ? 'bg-apple-red/10 text-apple-red'
                          : urgency.level === 'today'
                            ? 'bg-apple-orange/10 text-apple-orange'
                            : 'bg-apple-blue/10 text-apple-blue'
                      }`}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                      </svg>
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-primary group-hover:text-apple-blue transition-colors">
                        {name}
                      </p>
                      <p className="truncate text-[11px] text-tertiary">
                        {item.note || leadPhone || t('dashboard.viewLeads', 'Rejali qo‘ng‘iroq')}
                      </p>
                    </div>
                  </div>

                  {/* Right: Urgency Pill + Arrow */}
                  <div className="flex shrink-0 items-center gap-2.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-tight ${
                        urgency.level === 'overdue'
                          ? 'bg-apple-red/10 text-apple-red'
                          : urgency.level === 'today'
                            ? 'bg-apple-orange/10 text-apple-orange'
                            : 'bg-black/[0.05] dark:bg-white/[0.08] text-secondary'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          urgency.level === 'overdue'
                            ? 'bg-apple-red animate-pulse'
                            : urgency.level === 'today'
                              ? 'bg-apple-orange'
                              : 'bg-tertiary'
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
                      className="hidden sm:block text-tertiary transition-transform group-hover:translate-x-0.5 group-hover:text-apple-blue"
                    >
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default FollowUpsSection;
