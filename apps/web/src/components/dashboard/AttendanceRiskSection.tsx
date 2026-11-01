/**
 * AttendanceRiskSection — students under the 70% attendance threshold.
 * Sourced live from the early-warning service (ruleId: "attendance-low").
 * Elevated with iOS 27 / Apple Vision Pro Liquid Glass and Tactile Sound.
 */

import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { earlyWarningApi } from '@/lib/api';
import { Icon, Shimmer, getInitials } from '@/lib/design';
import { usePremiumSound } from '@/hooks/usePremiumSound';

interface EarlyWarningItem {
  id: string;
  ruleId: string;
  ruleName?: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  entityType?: string;
  entityId: string;
  entityName?: string;
  message?: string;
  detectedAt?: string | Date;
}

export function AttendanceRiskSection() {
  const sound = usePremiumSound();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['early-warning', 'attendance-low'],
    queryFn: () => earlyWarningApi.list({ ruleId: 'attendance-low', limit: 6 }),
    staleTime: 60_000,
  });

  const raw: EarlyWarningItem[] =
    (data as { items?: EarlyWarningItem[] } | undefined)?.items ||
    (Array.isArray(data) ? (data as EarlyWarningItem[]) : []);

  const students = raw.filter((item) => item.ruleId === 'attendance-low');

  return (
    <div className="vision-card relative isolate overflow-hidden flex h-full flex-col p-5 sm:p-6 backdrop-blur-2xl">
      {/* Top specular hairline */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/25"
      />

      <div className="flex items-center justify-between gap-3 border-b border-black/[0.06] pb-3.5 dark:border-white/[0.08]">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-rose-500 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),0_4px_10px_rgba(245,158,11,0.4)]">
            <Icon name="alert" size={18} strokeWidth={2.2} />
          </span>
          <div>
            <h3 className="text-sm font-bold tracking-tight text-[var(--text-primary,#1D1D1F)] dark:text-[var(--text-primary,#F5F5F7)]">
              Davomat xavfi
            </h3>
            <p className="text-xs text-[var(--text-secondary,#86868B)]">
              Oxirgi 14 kunlik darslarda &lt;70% qatnashganlar
            </p>
          </div>
        </div>
        {students.length > 0 && (
          <span className="jewel-pill jewel-amber text-[10.5px] font-bold uppercase tracking-wider py-0.5 px-2">
            {students.length} nafar
          </span>
        )}
      </div>

      <div className="mt-4 flex-1 space-y-2.5">
        {isLoading &&
          [0, 1, 2].map((i) => <Shimmer key={i} className="h-14 w-full" rounded="12px" />)}

        {isError && (
          <div role="alert" className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 text-center">
            <p className="text-xs text-[var(--text-secondary,#86868B)]">
              Davomat xavfi ma'lumotlarini yuklashda muammo yuz berdi.
            </p>
            <button
              type="button"
              onClick={() => {
                sound.playTick();
                void refetch();
              }}
              className="mt-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline"
            >
              Qayta urinish
            </button>
          </div>
        )}

        {!isLoading && !isError && students.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 shadow-[0_0_20px_rgba(52,199,89,0.25)] dark:text-emerald-400">
              <Icon name="checkCircle" size={24} />
            </span>
            <h4 className="mt-3 text-sm font-bold text-[var(--text-primary,#1D1D1F)] dark:text-white">
              Xavf ostidagi o'quvchilar yo'q
            </h4>
            <p className="mt-1 max-w-xs text-xs text-[var(--text-secondary,#86868B)]">
              Barcha faol o'quvchilarning davomati me'yor darajasida barqaror.
            </p>
          </div>
        )}

        {!isLoading &&
          !isError &&
          students.slice(0, 5).map((item) => {
            const rate = item.message?.match(/(\d+)%/)?.[1] ?? null;
            const isHighRisk = rate !== null && Number(rate) < 50;
            return (
              <div
                key={item.id}
                className="group relative flex items-center justify-between gap-3 rounded-2xl border border-black/[0.05] bg-white/50 p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-black/[0.1] hover:bg-white/80 hover:shadow-md dark:border-white/[0.08] dark:bg-white/[0.03] dark:hover:border-white/[0.15] dark:hover:bg-white/[0.06]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-xs font-black text-amber-600 dark:text-amber-400">
                    {item.entityName ? getInitials(item.entityName) : 'O'}
                  </span>
                  <div className="min-w-0">
                    <Link
                      to={`/students/${item.entityId}`}
                      onClick={() => sound.playTick()}
                      className="block truncate text-xs font-bold text-[var(--text-primary,#1D1D1F)] hover:text-sky-600 dark:text-white dark:hover:text-sky-400"
                    >
                      {item.entityName || "O'quvchi"}
                    </Link>
                    <p className="truncate text-[11.5px] text-[var(--text-secondary,#86868B)]">
                      {item.message || "Dars qoldirish ko'rsatkichi yuqori"}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {rate && (
                    <span
                      className={`jewel-pill text-[10px] font-bold py-0.5 px-2 tabular-nums ${
                        isHighRisk ? 'jewel-rose' : 'jewel-amber'
                      }`}
                    >
                      {rate}%
                    </span>
                  )}
                  <Link
                    to={`/students/${item.entityId}`}
                    onClick={() => sound.playTick()}
                    aria-label={`${item.entityName || "O'quvchi"} profiliga o'tish`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-transparent text-[var(--text-secondary,#86868B)] transition hover:border-black/[0.08] hover:bg-white/70 hover:text-[var(--text-primary,#1D1D1F)] active:scale-95 dark:hover:border-white/[0.12] dark:hover:bg-white/[0.08] dark:hover:text-white"
                  >
                    <Icon name="chevronRight" size={16} />
                  </Link>
                </div>
              </div>
            );
          })}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-black/[0.06] pt-3 text-xs dark:border-white/[0.08]">
        <span className="text-[var(--text-secondary,#86868B)] font-medium">
          Ogohlantirish darajasi: <strong className="text-amber-600 dark:text-amber-400">Yuqori</strong>
        </span>
        <Link
          to="/early-warning"
          onClick={() => sound.playTick()}
          className="inline-flex items-center gap-1 font-bold text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300"
        >
          Xavflar markazi
          <Icon name="chevronRight" size={14} />
        </Link>
      </div>
    </div>
  );
}

export default AttendanceRiskSection;
