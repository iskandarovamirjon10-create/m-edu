/**
 * QuickActionsGrid — frequent daily workflows plus the AI Copilot entry point.
 */

import { Link } from 'react-router-dom';
import { Icon, type IconName } from '@/lib/design';
import { MeduAiLogo } from '@/components/brand/MeduAiLogo';

interface QuickAction {
  title: string;
  to: string;
  icon: IconName;
  tone: string;
}

const ACTIONS: QuickAction[] = [
  { title: 'Yangi o\'quvchi', to: '/students/new', icon: 'user', tone: 'bg-apple-blue/10 text-apple-blue' },
  { title: 'Davomat olish', to: '/attendance', icon: 'checkCircle', tone: 'bg-apple-green/10 text-apple-green' },
  { title: 'To\'lov qabul qilish', to: '/payments', icon: 'creditCard', tone: 'bg-apple-purple/10 text-apple-purple' },
  { title: 'Yangi guruh', to: '/groups/new', icon: 'folder', tone: 'bg-apple-orange/10 text-apple-orange' },
  { title: 'Hisobotlar', to: '/reports', icon: 'barChart', tone: 'bg-apple-pink/10 text-apple-pink' },
  { title: 'Kameralar', to: '/cameras', icon: 'video', tone: 'bg-apple-teal/10 text-apple-teal' },
];

export function QuickActionsGrid() {
  return (
    <div className="flex h-full flex-col gap-4">
      <div className="rounded-xl border border-subtle bg-card p-5 shadow-card">
        <div className="flex items-center gap-2.5 border-b border-subtle pb-3.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-apple-indigo/10 text-apple-indigo">
            <Icon name="zap" size={16} />
          </span>
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-primary">Tezkor amallar</h3>
            <p className="text-xs text-tertiary">Eng ko'p foydalaniladigan amallar</p>
          </div>
        </div>

        <div className="mt-3.5 grid grid-cols-2 gap-2">
          {ACTIONS.map((action) => (
            <Link
              key={action.title}
              to={action.to}
              className="group flex items-center gap-2.5 rounded-lg border border-subtle bg-black/[0.02] p-2.5 transition-colors duration-150 hover:bg-black/[0.04] dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
            >
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${action.tone}`}>
                <Icon name={action.icon} size={15} />
              </span>
              <span className="truncate text-xs font-medium text-secondary transition-colors group-hover:text-primary">
                {action.title}
              </span>
            </Link>
          ))}
        </div>
      </div>

      <Link
        to="/ai-copilot"
        className="group flex items-center justify-between gap-3 rounded-xl border border-subtle bg-card p-4 shadow-card transition-all duration-150 ease-apple-spring hover:-translate-y-px hover:shadow-card-hover active:translate-y-0 active:scale-[0.99]"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-apple-indigo/10 text-apple-indigo">
            <MeduAiLogo size="sm" glow />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-primary transition-colors group-hover:text-brand-500">
                M-EDU AI Yordamchi
              </span>
              <span className="rounded-full bg-apple-indigo/10 px-2 py-0.5 text-[11px] font-medium text-apple-indigo">
                Copilot
              </span>
            </div>
            <div className="mt-0.5 truncate text-xs text-tertiary">
              Davomat tahlili, hisobotlar va avtomatlashtirish
            </div>
          </div>
        </div>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-subtle text-secondary transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-primary">
          <Icon name="arrowRight" size={16} />
        </span>
      </Link>
    </div>
  );
}

export default QuickActionsGrid;
