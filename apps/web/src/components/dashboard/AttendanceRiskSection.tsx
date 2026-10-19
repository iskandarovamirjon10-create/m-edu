/**
 * AttendanceRiskSection — students under the 70% attendance threshold.
 * Sourced live from the early-warning service (ruleId: "attendance-low").
 */

import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { earlyWarningApi } from '@/lib/api';
import { Icon, Shimmer, getInitials } from '@/lib/design';

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
    <div className="flex h-full flex-col rounded-xl border border-subtle bg-card p-5 shadow-card sm:p-6">
      <div className="flex items-center justify-between gap-3 border-b border-subtle pb-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-apple-orange/10 text-apple-orange">
            <Icon name="alert" size={18} />
          </span>
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-primary">Davomat xavfi</h3>
            <p className="text-xs text-tertiary">Oxirgi 14 kunlik darslarda &lt;70% qatnashganlar</p>
          </div>
        </div>
        {students.length > 0 && (
          <span className="inline-flex items-center rounded-full bg-apple-orange/10 px-2 py-0.5 text-[11px] font-medium text-apple-orange">
            {students.length} nafar
          </span>
        )}
      </div>

      <div className="mt-4 flex-1 space-y-2.5">
        {isLoading &&
          [0, 1, 2].map((i) => <Shimmer key={i} className="h-14 w-full" rounded="10px" />)}

        {isError && (
          <div role="alert" className="rounded-lg border border-apple-red/20 bg-apple-red/5 p-4 text-center">
            <p className="text-xs text-secondary">
              Davomat xavfi ma'lumotlarini yuklashda xatolik yuz berdi.
            </p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="mt-2 text-xs font-medium text-apple-red underline underline-offset-2"
            >
              Qayta urinish
            </button>
          </div>
        )}

        {!isLoading && !isError && students.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-apple-green/10 text-apple-green">
              <Icon name="checkCircle" size={20} />
            </span>
            <h4 className="mt-3 text-sm font-medium text-primary">Xavf ostidagi o'quvchilar yo'q</h4>
            <p className="mt-1 max-w-xs text-xs text-tertiary">
              Barcha faol o'quvchilarning davomati me'yorda.
            </p>
          </div>
        )}

        {!isLoading &&
          !isError &&
          students.slice(0, 5).map((item) => {
            const rate = item.message?.match(/(\d+)%/)?.[1] ?? null;
            return (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-subtle bg-black/[0.02] p-3 transition-colors duration-150 hover:bg-black/[0.04] dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-apple-orange/10 text-xs font-medium text-apple-orange">
                    {item.entityName ? getInitials(item.entityName) : 'O'}
                  </span>
                  <div className="min-w-0">
                    <Link
                      to={`/students/${item.entityId}`}
                      className="block truncate text-xs font-medium text-primary hover:text-brand-500"
                    >
                      {item.entityName || 'O\'quvchi'}
                    </Link>
                    <p className="truncate text-xs text-tertiary">
                      {item.message || 'Dars qoldirish ko\'rsatkichi yuqori'}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {rate && (
                    <span className="rounded-md bg-apple-orange/10 px-2 py-0.5 text-[11px] font-medium tabular-nums text-apple-orange">
                      {rate}%
                    </span>
                  )}
                  <Link
                    to={`/students/${item.entityId}`}
                    aria-label={`${item.entityName || 'O\'quvchi'} profiliga o'tish`}
                    className="rounded-md p-1.5 text-tertiary transition-colors hover:bg-black/[0.05] hover:text-primary dark:hover:bg-white/[0.08]"
                  >
                    <Icon name="chevronRight" size={16} />
                  </Link>
                </div>
              </div>
            );
          })}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-subtle pt-3 text-xs">
        <span className="text-tertiary">Ogohlantirish darajasi: Yuqori</span>
        <Link
          to="/early-warning"
          className="inline-flex items-center gap-1 font-medium text-brand-500 hover:text-brand-600"
        >
          Xavflar markazi
          <Icon name="chevronRight" size={14} />
        </Link>
      </div>
    </div>
  );
}

export default AttendanceRiskSection;
