/**
 * QuickActionsGrid — frequent daily workflows plus the AI Copilot entry point.
 * Elevated with VisionOS Liquid Glass styling, i18n localization, tactile sound triggers,
 * and WCAG 2.2 AA compliant touch targets (min-h-[44px]).
 */

import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Icon, type IconName } from '@/lib/design';
import { MeduAiLogo } from '@/components/brand/MeduAiLogo';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { usePremiumSound } from '@/hooks/usePremiumSound';

interface QuickActionConfig {
  key: string;
  defaultTitle: string;
  to: string;
  icon: IconName;
  tone: string;
}

const ACTION_CONFIGS: QuickActionConfig[] = [
  { key: 'students.new', defaultTitle: 'Yangi o‘quvchi', to: '/students/new', icon: 'user', tone: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  { key: 'nav.attendance', defaultTitle: 'Davomat olish', to: '/attendance', icon: 'checkCircle', tone: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  { key: 'nav.payments', defaultTitle: 'To‘lov qabul qilish', to: '/payments', icon: 'creditCard', tone: 'bg-purple-500/10 text-purple-600 dark:text-purple-400' },
  { key: 'groups.new', defaultTitle: 'Yangi guruh', to: '/groups/new', icon: 'folder', tone: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  { key: 'nav.reports', defaultTitle: 'Hisobotlar', to: '/reports', icon: 'barChart', tone: 'bg-pink-500/10 text-pink-600 dark:text-pink-400' },
  { key: 'nav.cameras', defaultTitle: 'Kameralar', to: '/cameras', icon: 'video', tone: 'bg-teal-500/10 text-teal-600 dark:text-teal-400' },
];

export function QuickActionsGrid() {
  const { t } = useSafeI18n();
  const sound = usePremiumSound();

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Top Card: Quick Workflows */}
      <div className="relative overflow-hidden rounded-[2rem] border border-white/60 bg-white/75 p-5 shadow-[0_20px_50px_-16px_rgba(0,0,0,0.08),inset_0_1.5px_1.5px_rgba(255,255,255,0.9)] backdrop-blur-3xl backdrop-saturate-[200%] dark:border-white/[0.12] dark:bg-[#161618]/75 dark:shadow-[0_20px_50px_-16px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.18)] sm:p-6 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-[1.5px] before:bg-gradient-to-r before:from-transparent before:via-white/70 before:to-transparent dark:before:via-white/20">
        <div className="flex items-center gap-2.5 border-b border-black/[0.05] pb-3.5 dark:border-white/[0.08]">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 shadow-inner dark:bg-indigo-500/20 dark:text-indigo-400">
            <Icon name="zap" size={16} />
          </span>
          <div>
            <h3 className="text-sm font-bold tracking-tight text-[var(--text-primary)]">
              {t('dashboard.quickActions', 'Tezkor amallar')}
            </h3>
            <p className="text-xs text-[var(--text-secondary)]">
              {t('dashboard.frequentActions', 'Eng ko‘p foydalaniladigan amallar')}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          {ACTION_CONFIGS.map((action) => {
            const title = t(action.key, action.defaultTitle);
            return (
              <motion.div
                key={action.to}
                whileHover={{ scale: 1.015, y: -1 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              >
                <Link
                  to={action.to}
                  onClick={() => sound.playTick?.()}
                  className="group flex min-h-[46px] items-center gap-2.5 rounded-2xl border border-black/[0.05] bg-white/40 p-2.5 transition-colors hover:border-black/[0.1] hover:bg-white/80 hover:shadow-xs dark:border-white/[0.06] dark:bg-white/[0.02] dark:hover:border-white/[0.12] dark:hover:bg-white/[0.06]"
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl shadow-inner ${action.tone}`}>
                    <Icon name={action.icon} size={15} />
                  </span>
                  <span className="truncate text-xs font-semibold text-[var(--text-secondary)] transition-colors group-hover:text-[var(--text-primary)]">
                    {title}
                  </span>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Bottom Card: M-EDU AI Copilot Entry Point */}
      <motion.div
        whileHover={{ scale: 1.01, y: -1 }}
        whileTap={{ scale: 0.99 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      >
        <Link
          to="/ai-copilot"
          onClick={() => sound.playPop?.()}
          className="group relative flex min-h-[64px] items-center justify-between gap-3 overflow-hidden rounded-[2rem] border border-white/60 bg-white/75 p-4 shadow-[0_20px_50px_-16px_rgba(0,0,0,0.08),inset_0_1.5px_1.5px_rgba(255,255,255,0.9)] backdrop-blur-3xl backdrop-saturate-[200%] transition-all dark:border-white/[0.12] dark:bg-[#161618]/75 dark:shadow-[0_20px_50px_-16px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.18)] before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-[1.5px] before:bg-gradient-to-r before:from-transparent before:via-white/70 before:to-transparent dark:before:via-white/20 sm:p-5"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/15 via-brand-500/15 to-purple-500/15 p-2 shadow-inner ring-1 ring-inset ring-indigo-500/20">
              <MeduAiLogo size="sm" glow />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[var(--text-primary)] transition-colors group-hover:text-brand-600 dark:group-hover:text-brand-400">
                  {t('dashboard.aiAssistant', 'M-EDU AI Yordamchi')}
                </span>
                <span className="rounded-full bg-gradient-to-r from-indigo-500/10 to-brand-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-indigo-600 ring-1 ring-inset ring-indigo-500/20 dark:text-indigo-400">
                  Copilot
                </span>
              </div>
              <div className="mt-0.5 truncate text-[11.5px] text-[var(--text-secondary)]">
                {t('dashboard.aiSubtitle', 'Davomat tahlili, hisobotlar va dars rejasi generatsiyasi')}
              </div>
            </div>
          </div>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-black/[0.06] bg-white/50 text-[var(--text-secondary)] shadow-xs transition-transform group-hover:translate-x-0.5 group-hover:text-brand-600 dark:border-white/[0.08] dark:bg-white/[0.04] dark:group-hover:text-brand-400">
            <Icon name="arrowRight" size={16} />
          </span>
        </Link>
      </motion.div>
    </div>
  );
}

export default QuickActionsGrid;
