/**
 * ============================================================================
 * QuickActionsRail v1.0 — Workspace command rail (Apple Studio Liquid Glass)
 * ============================================================================
 * New capability:
 *  Turns the six most frequent staff workflows into one-tap targets directly on
 *  the dashboard, with the `N` (new student) shortcut surfaced inline.
 *
 * Craft:
 *  - Compact refractive tiles with per-action chromatic icon orbs
 *  - Spring lift + specular sheen sweep on hover, tactile press state
 *  - Staggered entrance, reduced-motion safe, native link semantics
 *  - Responsive 2 → 3 → 6 columns, 44px+ touch targets at every breakpoint
 */

import { Link } from 'react-router-dom';
import { cn, Icon, type IconName } from '@/lib/design';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { usePremiumSound } from '@/hooks/usePremiumSound';

interface RailAction {
  key: string;
  to: string;
  icon: IconName;
  accent: string;
  label: string;
  shortcut?: string;
}

export function QuickActionsRail() {
  const { t } = useSafeI18n();
  const sound = usePremiumSound();

  const actions: RailAction[] = [
    {
      key: 'student',
      to: '/students/new',
      icon: 'user',
      accent: '#0A84FF',
      label: t('dashboard.actionNewStudent', "Yangi o'quvchi"),
      shortcut: 'N',
    },
    {
      key: 'attendance',
      to: '/attendance',
      icon: 'checkCircle',
      accent: '#34C759',
      label: t('dashboard.actionAttendance', 'Davomat olish'),
    },
    {
      key: 'payment',
      to: '/payments',
      icon: 'creditCard',
      accent: '#BF5AF2',
      label: t('dashboard.actionPayment', "To'lov qabul qilish"),
    },
    {
      key: 'group',
      to: '/groups/new',
      icon: 'folder',
      accent: '#FF9F0A',
      label: t('dashboard.actionNewGroup', 'Yangi guruh'),
    },
    {
      key: 'reports',
      to: '/reports',
      icon: 'barChart',
      accent: '#64D2FF',
      label: t('dashboard.actionReports', 'Hisobotlar'),
    },
    {
      key: 'copilot',
      to: '/ai-copilot',
      icon: 'sparkles',
      accent: '#5E5CE6',
      label: t('dashboard.actionCopilot', 'AI Yordamchi'),
    },
  ];

  return (
    <section
      aria-labelledby="dashboard-quick-actions"
      className={cn(
        'relative isolate overflow-hidden rounded-[2rem] p-4 sm:p-5',
        'border border-white/60 bg-white/75 backdrop-blur-3xl backdrop-saturate-[200%]',
        'shadow-[0_20px_50px_-16px_rgba(0,0,0,0.08),inset_0_1.5px_1.5px_rgba(255,255,255,0.9)]',
        'dark:border-white/[0.12] dark:bg-[#161618]/75',
        'dark:shadow-[0_20px_50px_-16px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.18)]',
      )}
    >
      {/* Ambient caustic */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 -top-24 -z-10 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(94,92,230,0.16),transparent_70%)] blur-3xl dark:bg-[radial-gradient(circle,rgba(94,92,230,0.22),transparent_70%)]"
      />

      {/* Top specular hairline */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/25"
      />

      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] bg-gradient-to-br from-[#0A84FF] to-[#5E5CE6] text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.5),0_6px_14px_-6px_rgba(10,132,255,0.65)]"
          >
            <Icon name="zap" size={15} strokeWidth={2.2} />
          </span>
          <div className="min-w-0">
            <h2
              id="dashboard-quick-actions"
              className="truncate text-[13.5px] font-bold tracking-tight text-[var(--text-primary,#1D1D1F)] dark:text-[var(--text-primary,#F5F5F7)]"
            >
              {t('dashboard.quickActions', 'Tezkor amallar')}
            </h2>
            <p className="truncate text-[11px] font-medium text-[var(--text-muted,#8E8E93)]">
              {t('dashboard.quickActionsSubtitle', "Eng ko'p ishlatiladigan bo'limlar")}
            </p>
          </div>
        </div>

        <p className="hidden shrink-0 items-center gap-1.5 text-[10.5px] font-semibold text-[var(--text-muted,#8E8E93)] sm:flex">
          <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-black/[0.08] bg-white/80 px-1 font-mono text-[10px] font-bold text-[var(--text-secondary,#515154)] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] dark:border-white/[0.12] dark:bg-white/[0.07] dark:text-[var(--text-secondary,#A1A1A6)]">
            N
          </kbd>
          {t('dashboard.actionNewStudent', "Yangi o'quvchi")}
        </p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {actions.map((action, index) => (
          <Link
            key={action.key}
            to={action.to}
            onClick={() => sound.playTick()}
            style={{ animationDelay: `${60 + index * 45}ms` }}
            className={cn(
              'group relative flex min-h-[64px] items-center gap-2.5 overflow-hidden rounded-[16px] p-2.5',
              'border border-black/[0.05] bg-white/60',
              'shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]',
              'transition-[transform,background-color,border-color,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
              'hover:-translate-y-0.5 hover:border-black/[0.09] hover:bg-white/90',
              'hover:shadow-[0_16px_30px_-16px_rgba(15,23,42,0.28),inset_0_1px_0_rgba(255,255,255,0.95)]',
              'active:translate-y-0 active:scale-[0.98]',
              'motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100',
              'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(10,132,255,0.45)] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#161618]',
              'dark:border-white/[0.08] dark:bg-white/[0.045]',
              'dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]',
              'dark:hover:border-white/[0.14] dark:hover:bg-white/[0.085]',
              'motion-safe:animate-[quickActionIn_420ms_cubic-bezier(0.22,1,0.36,1)_both]',
            )}
          >
            {/* Specular sheen sweep */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 -left-full w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/45 to-transparent transition-[left] duration-700 ease-out group-hover:left-[150%] motion-reduce:hidden dark:via-white/10"
            />

            <span
              aria-hidden="true"
              className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] transition-transform duration-300 ease-out group-hover:-rotate-2 group-hover:scale-[1.08] motion-reduce:group-hover:scale-100"
              style={{
                background: `linear-gradient(135deg, ${action.accent}2E 0%, ${action.accent}0F 100%)`,
                color: action.accent,
                border: `1px solid ${action.accent}3D`,
                boxShadow: `inset 0 1.5px 1px rgba(255,255,255,0.78), 0 6px 12px -6px ${action.accent}66`,
              }}
            >
              <Icon name={action.icon} size={16} strokeWidth={2.1} />
            </span>

            <span className="relative z-10 min-w-0 flex-1 truncate text-[11px] font-semibold leading-tight text-[var(--text-primary,#1D1D1F)] sm:text-[11.5px] dark:text-[var(--text-primary,#F5F5F7)]">
              {action.label}
            </span>

            {action.shortcut && (
              <kbd className="absolute right-1.5 top-1.5 hidden h-4 min-w-4 items-center justify-center rounded border border-black/[0.07] bg-white/85 px-0.5 font-mono text-[9px] font-bold text-[var(--text-muted,#8E8E93)] dark:border-white/[0.12] dark:bg-white/[0.08] xl:inline-flex">
                {action.shortcut}
              </kbd>
            )}
          </Link>
        ))}
      </div>

      <style>{`
        @keyframes quickActionIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  );
}

export default QuickActionsRail;
