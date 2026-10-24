/**
 * CopilotContextPanel — the right-hand intelligence rail.
 * ============================================================================
 * Sections
 *   1. Quick actions  — always available, one tap to run a task
 *   2. Insights       — live metrics (feature-flagged)
 *   3. Suggested prompts — route-aware starters (feature-flagged)
 *   4. Privacy note   — what the assistant can and cannot see
 *
 * Day/night: fully token driven. Mobile: rendered inside a bottom sheet.
 * ============================================================================
 */
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'framer-motion';
import {
  IconAttendance,
  IconCheck,
  IconChevronRight,
  IconClose,
  IconCompass,
  IconFinance,
  IconInfo,
  IconReport,
  IconShield,
  IconStudents,
} from './copilotIcons';
import { CopilotBadge, CopilotIconButton } from './CopilotControls';
import { AI_FLAGS } from '@/lib/ai/flags';
import { aiInsightsApi, aiSuggestionsApi, type AiInsight } from '@/lib/ai';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { cn } from '@/lib/design';

/* ─────────────────────────────────────────────────────────────────────────
 * Copy helpers
 * ─────────────────────────────────────────────────────────────────────── */

function resolve(
  t: ((key: string, fallback?: string) => string) | undefined,
  key: string,
  fallback: string,
): string {
  if (!t) return fallback;
  try {
    const value = t(key, fallback);
    return !value || value === key ? fallback : value;
  } catch {
    return fallback;
  }
}

interface QuickAction {
  id: string;
  title: string;
  desc: string;
  prompt: string;
  icon: ReactNode;
  gradient: string;
  glow: string;
}

function useQuickActions(t?: (key: string, fallback?: string) => string): QuickAction[] {
  return [
    {
      id: 'attendanceSummary',
      title: resolve(t, 'ai.tools.attendanceSummary.title', 'Davomat tahlili'),
      desc: resolve(t, 'ai.tools.attendanceSummary.desc', "Bugungi davomat va qatnashmaganlar"),
      prompt: resolve(
        t,
        'ai.tools.attendanceSummary.prompt',
        "Bugungi davomat bo'yicha to'liq hisobot ber: kelganlar, kelmaganlar va kechikkanlar.",
      ),
      icon: <IconAttendance size={16} />,
      gradient: 'linear-gradient(140deg,#0A84FF,#32ADE6)',
      glow: 'rgba(10,132,255,0.45)',
    },
    {
      id: 'lessonPlan',
      title: resolve(t, 'ai.tools.lessonPlan.title', 'Dars rejasi'),
      desc: resolve(t, 'ai.tools.lessonPlan.desc', '45 daqiqalik reja va topshiriqlar'),
      prompt: resolve(
        t,
        'ai.tools.lessonPlan.prompt',
        "Mavzu bo'yicha batafsil 45 daqiqalik dars rejasi, vaqt taqsimoti va uy vazifasini tuzib ber.",
      ),
      icon: <IconReport size={16} />,
      gradient: 'linear-gradient(140deg,#5E5CE6,#BF5AF2)',
      glow: 'rgba(94,92,230,0.45)',
    },
    {
      id: 'studentRisk',
      title: resolve(t, 'ai.tools.studentRisk.title', "Xavf tahlili"),
      desc: resolve(t, 'ai.tools.studentRisk.desc', "Orqada qolayotgan o'quvchilar"),
      prompt: resolve(
        t,
        'ai.tools.studentRisk.prompt',
        "Davomat va baholarda pasayish kuzatilgan, xavf ostidagi o'quvchilar tahlilini ko'rsat.",
      ),
      icon: <IconStudents size={16} />,
      gradient: 'linear-gradient(140deg,#FF9F0A,#FF375F)',
      glow: 'rgba(255,159,10,0.45)',
    },
    {
      id: 'financialDebt',
      title: resolve(t, 'ai.tools.financialDebt.title', 'Moliyaviy nazorat'),
      desc: resolve(t, 'ai.tools.financialDebt.desc', "Qarzdorlar va kassa tushumi"),
      prompt: resolve(
        t,
        'ai.tools.financialDebt.prompt',
        "Qarzdor o'quvchilar, kechikkan to'lovlar va moliyaviy intizom bo'yicha hisobot ber.",
      ),
      icon: <IconFinance size={16} />,
      gradient: 'linear-gradient(140deg,#30D158,#10B981)',
      glow: 'rgba(48,209,88,0.4)',
    },
  ];
}

/* ─────────────────────────────────────────────────────────────────────────
 * Props
 * ─────────────────────────────────────────────────────────────────────── */

export interface CopilotContextPanelProps {
  routeContext: string;
  onActionClick: (prompt: string) => void;
  onClose?: () => void;
  className?: string;
}

/* ─────────────────────────────────────────────────────────────────────────
 * Sections
 * ─────────────────────────────────────────────────────────────────────── */

function SectionHeading({
  title,
  trailing,
}: {
  title: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--cp-text-tertiary)]">
        {title}
      </h3>
      {trailing}
    </div>
  );
}

const INSIGHT_TONE: Record<AiInsight['type'], string> = {
  info: 'text-[color:var(--cp-accent)] bg-[color:var(--cp-accent-soft)]',
  success: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10',
  warning: 'text-amber-600 dark:text-amber-400 bg-amber-500/10',
  error: 'text-rose-600 dark:text-rose-400 bg-rose-500/10',
};

/* ─────────────────────────────────────────────────────────────────────────
 * Panel
 * ─────────────────────────────────────────────────────────────────────── */

interface RouteModuleInfo {
  title: string;
  badge: string;
  prompts: { label: string; prompt: string }[];
}

function getActiveRouteModule(route: string): RouteModuleInfo {
  if (route.includes('/attendance')) {
    return {
      title: 'Davomat Boshqaruvi',
      badge: 'Davomat',
      prompts: [
        { label: 'Bugun kelmaganlar', prompt: "Bugun qaysi o'quvchilar darsga kelmadi va sababi nima?" },
        { label: 'Davomat hisoboti', prompt: "Bugungi umumiy davomat foizi va holati bo'yicha to'liq hisobot ber." },
        { label: 'Surunkali qoldiruvchilar', prompt: "Eng ko'p dars qoldirayotgan xavf ostidagi o'quvchilarni aniqla." },
      ],
    };
  }
  if (route.includes('/finance') || route.includes('/payments')) {
    return {
      title: 'Moliya & To\'lovlar',
      badge: 'Moliya',
      prompts: [
        { label: 'Qarzdorlar ro\'yxati', prompt: "Muddati o'tgan to'lovlar va qarzdor o'quvchilar ro'yxatini ko'rsat." },
        { label: 'Bu oylik kassa', prompt: "Shu oy davomidagi umumiy tushum va to'lovlar dinamikasini ko'rsat." },
        { label: 'Eslatma tayyorlash', prompt: "Qarzdor o'quvchilar ota-onalariga xushmuomala to'lov eslatmasi matnini yoz." },
      ],
    };
  }
  if (route.includes('/students')) {
    return {
      title: 'Talabalar Kontingenti',
      badge: 'Talabalar',
      prompts: [
        { label: 'Xavf ostidagilar', prompt: "Baholari yoki davomati pasaygan xavf ostidagi o'quvchilarni aniqla." },
        { label: 'Yangi qabul qilinganlar', prompt: "Oxirgi 30 kunda qabul qilingan o'quvchilar ro'yxatini ko'rsat." },
        { label: 'Guruhsiz o\'quvchilar', prompt: "Birorta guruhga biriktirilmagan aktiv o'quvchilarni top." },
      ],
    };
  }
  if (route.includes('/schedule')) {
    return {
      title: 'Dars Jadvallari',
      badge: 'Jadval',
      prompts: [
        { label: 'Bugungi darslar', prompt: "Bugun qaysi guruhlar va xonalarda darslar bor?" },
        { label: 'Bo\'sh xonalar', prompt: "Hozirgi vaqtda qaysi o'quv xonalari bo'sh?" },
        { label: 'O\'qituvchi bandligi', prompt: "O'qituvchilarning dars soatlari va jadval to'qnashuvlarini tekshir." },
      ],
    };
  }
  if (route.includes('/teachers')) {
    return {
      title: 'O\'qituvchilar Shtati',
      badge: 'Ustozlar',
      prompts: [
        { label: 'Dars yuklamalari', prompt: "O'qituvchilarning haftalik dars yuklamalari va soatlarini ko'rsat." },
        { label: 'Faol guruhlar', prompt: "Har bir o'qituvchiga biriktirilgan guruhlar va o'quvchilar soni." },
      ],
    };
  }
  if (route.includes('/exams') || route.includes('/grades')) {
    return {
      title: 'Imtihonlar & Baholar',
      badge: 'Baholar',
      prompts: [
        { label: 'Imtihon natijalari', prompt: "Oxirgi imtihonlar natijalari va o'rtacha ballarni ko'rsat." },
        { label: 'Past ball olganlar', prompt: "O'tish ballini to'play olmagan o'quvchilarni sarala." },
      ],
    };
  }
  return {
    title: 'Umumiy Tizim',
    badge: 'Markaz',
    prompts: [
      { label: 'Davomat xulosasi', prompt: "Bugungi davomat bo'yicha qisqacha hisobot ber." },
      { label: 'Qarzdorlar tahlili', prompt: "Qarzdor o'quvchilar ro'yxatini chiqar." },
      { label: 'Dars rejasi tuzish', prompt: "Mavzu bo'yicha 45 daqiqalik dars rejasi tuzib ber." },
    ],
  };
}

export function CopilotContextPanel({
  routeContext,
  onActionClick,
  onClose,
  className,
}: CopilotContextPanelProps) {
  const { t } = useSafeI18n();
  const reduced = Boolean(useReducedMotion());
  const quickActions = useQuickActions(t);

  const insightsQuery = useQuery({
    queryKey: ['ai', 'insights', routeContext],
    queryFn: () => aiInsightsApi.list(routeContext),
    enabled: AI_FLAGS.insights,
    staleTime: 60_000,
    retry: false,
  });

  const suggestionsQuery = useQuery({
    queryKey: ['ai', 'suggestions', routeContext],
    queryFn: () => aiSuggestionsApi.list(routeContext),
    enabled: AI_FLAGS.suggestions,
    staleTime: 60_000,
    retry: false,
  });

  const routeModule = getActiveRouteModule(routeContext);
  const insights = insightsQuery.data ?? [];
  const suggestions = suggestionsQuery.data ?? [];

  return (
    <aside
      aria-label={resolve(t, 'ai.context.panel', 'Kontekst paneli')}
      className={cn(
        'cp-panel relative flex h-full w-full flex-col overflow-hidden',
        'border-l border-[color:var(--cp-hairline)]',
        className,
      )}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[color:var(--cp-separator)] px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden="true"
            className="flex h-7 w-7 items-center justify-center rounded-[9px] border border-[color:var(--cp-accent-line)] bg-[color:var(--cp-accent-soft)] text-[color:var(--cp-accent)]"
          >
            <IconCompass size={15} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[12.5px] font-semibold text-[color:var(--cp-text)]">
              {resolve(t, 'ai.context.title', 'Kontekst')}
            </p>
            <p className="truncate text-[10px] text-[color:var(--cp-text-tertiary)]">
              {routeContext}
            </p>
          </div>
        </div>
        {onClose && (
          <CopilotIconButton
            label={resolve(t, 'common.close', 'Yopish')}
            icon={<IconClose size={15} />}
            onClick={onClose}
            className="!h-7 !w-7"
          />
        )}
      </div>

      <div className="cp-scroll flex-1 overflow-y-auto px-3.5 py-3.5">
        {/* Active Page Module Banner */}
        <div className="mb-4 rounded-2xl border border-[color:var(--cp-accent-line)] bg-gradient-to-br from-[color:var(--cp-accent-soft)] to-transparent p-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-bold text-[color:var(--cp-text)]">
              {routeModule.title}
            </span>
            <CopilotBadge tone="accent">{routeModule.badge}</CopilotBadge>
          </div>
          <p className="mt-1 text-[10.5px] text-[color:var(--cp-text-tertiary)]">
            Aktiv sahifangizga mos tezkor takliflar:
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {routeModule.prompts.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onActionClick(p.prompt)}
                className="inline-flex items-center rounded-lg border border-[color:var(--cp-hairline)] bg-[color:var(--cp-surface-raised)] px-2 py-1 text-[11px] font-medium text-[color:var(--cp-text-secondary)] hover:text-[color:var(--cp-accent)] hover:border-[color:var(--cp-accent-line)] transition-all active:scale-[0.97]"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <section aria-label="Quick actions">
          <SectionHeading title="Tezkor amallar" trailing={<CopilotBadge tone="accent">4</CopilotBadge>} />
          <div className="grid gap-1.5">
            {quickActions.map((action, index) => (
              <motion.button
                key={action.id}
                type="button"
                onClick={() => onActionClick(action.prompt)}
                initial={reduced ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: reduced ? 0 : index * 0.04, duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                className={cn(
                  'group flex w-full items-center gap-2.5 rounded-xl border border-[color:var(--cp-hairline)]',
                  'bg-[color:var(--cp-surface-sunken)] px-2.5 py-2 text-left',
                  'transition-all duration-200 hover:border-[color:var(--cp-accent-line)]',
                  'hover:bg-[color:var(--cp-surface-raised)] active:scale-[0.99]',
                  'outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--cp-accent-line)]',
                )}
              >
                <span
                  aria-hidden="true"
                  className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]"
                  style={{ background: action.gradient, boxShadow: `0 6px 14px -8px ${action.glow}` }}
                >
                  {action.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11.5px] font-semibold text-[color:var(--cp-text)]">
                    {action.title}
                  </span>
                  <span className="block truncate text-[10px] text-[color:var(--cp-text-tertiary)]">
                    {action.desc}
                  </span>
                </span>
                <IconChevronRight
                  size={13}
                  className="shrink-0 text-[color:var(--cp-text-quaternary)] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-[color:var(--cp-accent)]"
                />
              </motion.button>
            ))}
          </div>
        </section>

        {/* Insights */}
        {AI_FLAGS.insights && (
          <section aria-label="Signallar" className="mt-5">
            <SectionHeading
              title="Signallar"
              trailing={
                <span className="text-[9.5px] font-medium text-[color:var(--cp-text-quaternary)]">
                  {insightsQuery.isFetching ? 'yangilanmoqda…' : 'live'}
                </span>
              }
            />
            {insights.length === 0 ? (
              <PanelEmpty
                text={
                  insightsQuery.isLoading
                    ? 'Yuklanmoqda…'
                    : resolve(t, 'ai.context.noInsights', "Hozircha yangi insight yo'q")
                }
              />
            ) : (
              <ul className="grid gap-1.5" role="list">
                {insights.map((insight) => (
                  <li
                    key={insight.id}
                    className="rounded-xl border border-[color:var(--cp-hairline)] bg-[color:var(--cp-surface-sunken)] p-2.5"
                  >
                    <div className="flex items-start gap-2">
                      <span
                        aria-hidden="true"
                        className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md', INSIGHT_TONE[insight.type])}
                      >
                        <IconInfo size={12} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[11.5px] font-semibold text-[color:var(--cp-text)]">
                            {insight.title}
                          </p>
                          {insight.metric ? (
                            <span className="shrink-0 rounded-full bg-[color:var(--cp-surface-raised)] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-[color:var(--cp-text-secondary)]">
                              {insight.metric}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-[10.5px] leading-relaxed text-[color:var(--cp-text-tertiary)]">
                          {insight.body}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Suggested prompts */}
        {AI_FLAGS.suggestions && (
          <section aria-label="Tavsiya etilgan savollar" className="mt-5">
            <SectionHeading title="Tavsiya etilgan savollar" />
            {suggestions.length === 0 ? (
              <PanelEmpty
                text={
                  suggestionsQuery.isLoading
                    ? 'Yuklanmoqda…'
                    : resolve(t, 'ai.context.noSuggestions', "Bu sahifa uchun tavsiyalar yo'q")
                }
              />
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {suggestions.slice(0, 6).map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => onActionClick(suggestion)}
                    className={cn(
                      'inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-left',
                      'border-[color:var(--cp-hairline)] bg-[color:var(--cp-surface-raised)]',
                      'text-[10.5px] font-medium text-[color:var(--cp-text-secondary)]',
                      'transition-all duration-200 hover:border-[color:var(--cp-accent-line)] hover:text-[color:var(--cp-accent)]',
                      'outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--cp-accent-line)]',
                    )}
                  >
                    <IconCheck size={11} className="shrink-0 text-[color:var(--cp-accent)]" />
                    <span className="truncate">{suggestion}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Privacy footer */}
      <div className="shrink-0 border-t border-[color:var(--cp-separator)] bg-[color:var(--cp-surface-sunken)] px-3.5 py-2.5">
        <p className="flex items-start gap-1.5 text-[9.5px] leading-relaxed text-[color:var(--cp-text-tertiary)]">
          <IconShield size={12} className="mt-0.5 shrink-0 text-[color:var(--cp-success)]" />
          <span>
            AI faqat ruxsat berilgan kontekstda ishlaydi. Tasdiqlash talab qiladigan
            amallar sizdan so'raladi.
          </span>
        </p>
      </div>
    </aside>
  );
}

function PanelEmpty({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[color:var(--cp-hairline)] px-3 py-3 text-center text-[10.5px] text-[color:var(--cp-text-tertiary)]">
      {text}
    </div>
  );
}

export default CopilotContextPanel;
