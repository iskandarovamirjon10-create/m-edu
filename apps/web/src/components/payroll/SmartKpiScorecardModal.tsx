import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { GlassModal, GlassButton, useToast } from '@/components/ui';
import { payrollApi } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys.factory';
import { useSafeI18n } from '@/i18n/I18nProvider';
import type { TeacherSmartKpiScorecard } from '@/types/payroll';

interface SmartKpiScorecardModalProps {
  open: boolean;
  onClose: () => void;
  teacherId: string;
  teacherName: string;
  year: number;
  month: number;
  onApplied?: (bonusAmount: number, baseAmount: number) => void;
}

export function SmartKpiScorecardModal({
  open,
  onClose,
  teacherId,
  teacherName,
  year,
  month,
  onApplied,
}: SmartKpiScorecardModalProps) {
  const { t } = useSafeI18n();
  const { push } = useToast();
  const queryClient = useQueryClient();
  const [customBonus, setCustomBonus] = useState<string>('');

  const { data: kpi, isLoading, isError } = useQuery<TeacherSmartKpiScorecard>({
    queryKey: ['smart-kpi', teacherId, year, month],
    queryFn: () => payrollApi.getSmartKpi({ teacherId, year, month }),
    enabled: open && Boolean(teacherId),
  });

  const applyMutation = useMutation({
    mutationFn: async () => {
      if (!teacherId || !kpi) return;
      const bonus = customBonus !== '' ? Number(customBonus) : kpi.totalRecommendedBonus;
      return payrollApi.createSmartKpiRun({
        teacherId,
        year,
        month,
        customBonus: bonus,
      });
    },
    onSuccess: () => {
      push('success', t('payroll.smartKpiApplied', 'Smart KPI maoshi va bonusi muvaffaqiyatli hisoblandi'));
      queryClient.invalidateQueries({ queryKey: queryKeys.payroll.runs(year, month) });
      queryClient.invalidateQueries({ queryKey: queryKeys.payroll.summary(year, month) });
      if (kpi && onApplied) {
        const bonus = customBonus !== '' ? Number(customBonus) : kpi.totalRecommendedBonus;
        onApplied(bonus, kpi.estimatedBase);
      }
      onClose();
    },
    onError: (err: any) => {
      push('error', err?.message || t('common.error', 'Xatolik yuz berdi'));
    },
  });

  return (
    <GlassModal
      open={open}
      onClose={onClose}
      title={`💎 Smart KPI & Bonus: ${teacherName}`}
      wide
    >
      <div className="space-y-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {t('payroll.loadingKpi', "O'qituvchining jonli davomat, retention va test ko'rsatkichlari tahlil qilinmoqda...")}
            </p>
          </div>
        ) : isError || !kpi ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 text-center">
            <p className="text-xs font-bold text-rose-600 dark:text-rose-400">
              {t('payroll.kpiError', "KPI ma'lumotlarini yuklashda xatolik yuz berdi")}
            </p>
          </div>
        ) : (
          <>
            {/* Top Score Banner */}
            <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-blue-500/10 p-5 backdrop-blur-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/40 bg-emerald-500/20 text-3xl shadow-lg shadow-emerald-500/20">
                    💎
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-black text-slate-900 dark:text-white">
                        {kpi.compositeScore}/100
                      </span>
                      <span
                        className="rounded-full px-2.5 py-0.5 text-xs font-extrabold uppercase tracking-wider text-white shadow-sm"
                        style={{ backgroundColor: kpi.badgeColor }}
                      >
                        {kpi.tierLabel}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                      {year}-yil {month}-oy bo'yicha umumiy samaradorlik koeffitsienti
                    </p>
                  </div>
                </div>

                <div className="sm:text-right">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Tavsiya etilgan KPI Bonus
                  </p>
                  <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                    +{formatCurrency(kpi.totalRecommendedBonus)}
                  </p>
                </div>
              </div>
            </div>

            {/* 4 Pillars Grid */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {/* Pillar 1: Attendance */}
              <div className="rounded-2xl border border-black/[0.08] dark:border-white/[0.12] bg-white/60 dark:bg-slate-800/60 p-4 backdrop-blur-md">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    📅 Davomat KPI
                  </span>
                  <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                    +{kpi.pillars.attendance.bonusPct}%
                  </span>
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  {kpi.pillars.attendance.rate}%
                </div>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Chegara: {kpi.pillars.attendance.threshold}% | {kpi.pillars.attendance.stats.present} keldi, {kpi.pillars.attendance.stats.late} kechikdi
                </p>
                <div className="mt-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                  Mukofot: +{formatCurrency(kpi.pillars.attendance.bonusEarned)}
                </div>
              </div>

              {/* Pillar 2: Retention */}
              <div className="rounded-2xl border border-black/[0.08] dark:border-white/[0.12] bg-white/60 dark:bg-slate-800/60 p-4 backdrop-blur-md">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    👥 Saqlab qolish
                  </span>
                  <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                    +{kpi.pillars.retention.bonusPct}%
                  </span>
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  {kpi.pillars.retention.rate}%
                </div>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  {kpi.pillars.retention.activeStudents} faol / {kpi.pillars.retention.totalStudents} jami o'quvchi
                </p>
                <div className="mt-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                  Mukofot: +{formatCurrency(kpi.pillars.retention.bonusEarned)}
                </div>
              </div>

              {/* Pillar 3: Academic Grades */}
              <div className="rounded-2xl border border-black/[0.08] dark:border-white/[0.12] bg-white/60 dark:bg-slate-800/60 p-4 backdrop-blur-md">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    🎓 Test / Baho
                  </span>
                  <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                    +{kpi.pillars.academic.bonusPct}%
                  </span>
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  {kpi.pillars.academic.averageScore}%
                </div>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  O'rtacha sinov bali ({kpi.pillars.academic.gradeCount} ta baho)
                </p>
                <div className="mt-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                  Mukofot: +{formatCurrency(kpi.pillars.academic.bonusEarned)}
                </div>
              </div>

              {/* Pillar 4: Volume & Conducted */}
              <div className="rounded-2xl border border-black/[0.08] dark:border-white/[0.12] bg-white/60 dark:bg-slate-800/60 p-4 backdrop-blur-md">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    ⏱️ Dars hajmi
                  </span>
                  <span className="text-xs font-black text-blue-600 dark:text-blue-400">
                    {kpi.salaryType}
                  </span>
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  {kpi.pillars.discipline.conductedLessons} dars
                </div>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  {kpi.pillars.discipline.hoursWorked} soat o'tildi ({kpi.groupCount} ta guruh)
                </p>
                <div className="mt-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                  Baza: {formatCurrency(kpi.estimatedBase)}
                </div>
              </div>
            </div>

            {/* Custom Bonus Override */}
            <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-slate-500/[0.04] p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="w-full sm:w-auto">
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  Bonus miqdorini tahrirlash (ixtiyoriy):
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Agar maxsus mukofot kiritmoqchi bo'lsangiz, summani o'zgartirishingiz mumkin
                </p>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={customBonus !== '' ? customBonus : kpi.totalRecommendedBonus}
                  onChange={(e) => setCustomBonus(e.target.value)}
                  className="min-h-[44px] w-full sm:w-44 rounded-xl border border-black/10 bg-white/80 dark:bg-slate-800/80 px-3 text-base sm:text-xs font-black text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50"
                  placeholder="Bonus so'mda"
                />
                <span className="text-xs font-semibold text-slate-500">so'm</span>
              </div>
            </div>

            {/* Final Action Buttons */}
            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3 pt-3 border-t border-black/[0.06] dark:border-white/[0.08]">
              <GlassButton type="button" variant="secondary" onClick={onClose}>
                {t('common.cancel', 'Bekor qilish')}
              </GlassButton>
              <GlassButton
                type="button"
                variant="primary"
                disabled={applyMutation.isPending}
                onClick={() => applyMutation.mutate()}
                className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/25"
              >
                {applyMutation.isPending
                  ? t('common.saving', 'Biriktirilmoqda...')
                  : `⚡ KPI bilan maoshni hisoblash (${formatCurrency(
                      kpi.estimatedBase +
                        (customBonus !== '' ? Number(customBonus) : kpi.totalRecommendedBonus),
                    )})`}
              </GlassButton>
            </div>
          </>
        )}
      </div>
    </GlassModal>
  );
}
