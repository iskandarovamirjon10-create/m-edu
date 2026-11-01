/**
 * M-EDU Enterprise — Automated Teacher KPI & Multi-Formula Batch Payroll (`TeacherKpiBatchPayrollModal.tsx`)
 * Automatically calculates teacher pay based on verified lesson hours, student retention KPI,
 * lesson punctuality score, and group revenue share commission with 1-click batch approval.
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  GlassModal,
  GlassButton,
  GlassBadge,
  useToast,
} from '@/components/ui';
import { MeduAiLogo } from '@/components/brand/MeduAiLogo';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { teacherKpiPayrollApi } from '@/lib/api';
import { formatCurrency } from '@/lib/format';

interface TeacherKpiBatchPayrollModalProps {
  isOpen: boolean;
  onClose: () => void;
  branchId?: string;
}

export const TeacherKpiBatchPayrollModal: React.FC<TeacherKpiBatchPayrollModalProps> = ({
  isOpen,
  onClose,
  branchId,
}) => {
  const currentDate = new Date();
  const [periodYear, setPeriodYear] = useState<number>(currentDate.getFullYear());
  const [periodMonth, setPeriodMonth] = useState<number>(currentDate.getMonth() + 1);
  const [commissionRate, setCommissionRate] = useState<number>(10);
  const [retentionTarget, setRetentionTarget] = useState<number>(90);

  const queryClient = useQueryClient();
  const { playSuccess, playPop, playError } = usePremiumSound();
  const toast = useToast();

  const {
    data: calculationData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['teacher-kpi-batch', periodYear, periodMonth, branchId, commissionRate, retentionTarget],
    queryFn: () =>
      teacherKpiPayrollApi.calculateBatch({
        periodYear,
        periodMonth,
        branchId,
        commissionRatePercent: commissionRate,
        retentionTargetPercent: retentionTarget,
      }),
    enabled: isOpen,
    staleTime: 60_000,
  });

  const approveBatchMutation = useMutation({
    mutationFn: (proposals: any[]) =>
      teacherKpiPayrollApi.approveBatch({
        periodYear,
        periodMonth,
        branchId,
        proposals,
      }),
    onSuccess: (res: any) => {
      playSuccess();
      toast.success(
        `Oylik maoshlar muvaffaqiyatli tasdiqlandi! ${res.approvedCount} ta o'qituvchining jami ${formatCurrency(res.totalGrossAmount)} to'lovi rasmiylashtirildi.`
      );
      queryClient.invalidateQueries({ queryKey: ['teacher-kpi-batch'] });
      queryClient.invalidateQueries({ queryKey: ['payroll'] });
      queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
      onClose();
    },
    onError: (err: any) => {
      playError();
      toast.error(err?.message || "Oylik maoshlarni tasdiqlashda xatolik yuz berdi");
    },
  });

  const proposals = calculationData?.proposals || [];
  const totalPayout = calculationData?.totalGrossAmount || 0;

  const handleApproveAll = () => {
    if (proposals.length === 0) return;
    playPop();
    approveBatchMutation.mutate(proposals);
  };

  return (
    <GlassModal
      open={isOpen}
      onClose={onClose}
      size="xl"
      className="max-h-[90vh] overflow-y-auto"
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/40 pb-4">
          <div className="flex items-center gap-3">
            <MeduAiLogo size="md" glow />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  Smart O'qituvchi KPI & Avtomatlashtirilgan Oylik Hisob-Kitob
                </h2>
                <GlassBadge variant="primary" size="sm">AUTO PAYROLL</GlassBadge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Real o'tilgan dars soatlari, talaba saqlab qolish KPI, punktuallik va tushum foizi asosida shaffof hisoblash
              </p>
            </div>
          </div>
        </div>

        {/* Period Selector Controls */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/20 p-3.5 rounded-xl border border-border/40">
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Yil</label>
            <select
              value={periodYear}
              onChange={(e) => setPeriodYear(Number(e.target.value))}
              className="w-full text-xs rounded-lg border border-border/50 bg-background/50 px-3 py-1.5 text-foreground focus:outline-none focus:border-primary"
            >
              {[2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>{y}-yil</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Oy</label>
            <select
              value={periodMonth}
              onChange={(e) => setPeriodMonth(Number(e.target.value))}
              className="w-full text-xs rounded-lg border border-border/50 bg-background/50 px-3 py-1.5 text-foreground focus:outline-none focus:border-primary"
            >
              {[
                'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
                'Iyul', 'Avgust', 'Sentabr', 'Oktyabr', 'Noyabr', 'Dekabr'
              ].map((m, idx) => (
                <option key={idx + 1} value={idx + 1}>{m}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
              Guruh Tushumidan Ulush (%)
            </label>
            <input
              type="number"
              min={0}
              max={50}
              value={commissionRate}
              onChange={(e) => setCommissionRate(Number(e.target.value))}
              className="w-full text-xs rounded-lg border border-border/50 bg-background/50 px-3 py-1.5 text-foreground focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
              Saqlab Qolish KPI Maqsadi (%)
            </label>
            <input
              type="number"
              min={50}
              max={100}
              value={retentionTarget}
              onChange={(e) => setRetentionTarget(Number(e.target.value))}
              className="w-full text-xs rounded-lg border border-border/50 bg-background/50 px-3 py-1.5 text-foreground focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Executive Summary Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-md p-3.5">
            <span className="text-xs text-muted-foreground font-medium">Baho Berilgan O'qituvchilar</span>
            <div className="text-lg font-bold text-foreground mt-1">
              {proposals.length} nafar
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Faol o'qituvchilar tarkibi</div>
          </div>

          <div className="rounded-xl border border-primary/30 bg-primary/5 backdrop-blur-md p-3.5">
            <span className="text-xs text-primary font-medium">Jami Oylik Fond (Hisoblangan)</span>
            <div className="text-lg font-black text-primary mt-1">
              {formatCurrency(totalPayout)}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Asosiy + KPI + Ulush</div>
          </div>

          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 backdrop-blur-md p-3.5">
            <span className="text-xs text-emerald-400 font-medium">O'rtacha KPI Natijasi</span>
            <div className="text-lg font-bold text-emerald-500 mt-1">
              {proposals.length > 0
                ? Math.round(
                    proposals.reduce((acc: number, p: any) => acc + (p.kpiSummary?.retentionRate || 0), 0) /
                      proposals.length
                  )
                : 0}
              %
            </div>
            <div className="text-[11px] text-emerald-400/80 mt-0.5">Talabalarni saqlab qolish o'rtachasi</div>
          </div>
        </div>

        {/* Proposals List Table */}
        {isLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            <div className="animate-spin inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full mb-2" />
            <p>O'qituvchilar dars jurnali va davomat tahlillari hisoblanmoqda...</p>
          </div>
        ) : proposals.length === 0 ? (
          <div className="py-12 text-center rounded-xl border border-dashed border-border/60 bg-muted/10 p-6">
            <div className="text-3xl mb-2">📋</div>
            <h3 className="text-sm font-semibold text-foreground">Ushbu oy uchun o'qituvchilar topilmadi</h3>
            <p className="text-xs text-muted-foreground mt-1">
              O'qituvchilar ma'lumotlar bazasida mavjudligini yoki darslar o'tilganini tekshiring.
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {proposals.map((prop: any) => (
              <motion.div
                key={prop.teacherId}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-border/50 bg-card/50 hover:bg-card/75 transition-colors p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-foreground">
                      {prop.teacherName}
                    </span>
                    <GlassBadge variant="neutral" size="sm">
                      {prop.specialization || "O'qituvchi"}
                    </GlassBadge>
                  </div>

                  {/* KPI Metrics */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-muted-foreground pt-1">
                    <div>
                      Dars soatlari: <strong className="text-foreground">{prop.kpiSummary?.conductedHours || 0} soat</strong>
                    </div>
                    <div>
                      Saqlab qolish: <strong className={prop.kpiSummary?.retentionRate >= retentionTarget ? 'text-emerald-400' : 'text-amber-400'}>
                        {prop.kpiSummary?.retentionRate || 0}%
                      </strong>
                    </div>
                    <div>
                      Punktuallik: <strong className="text-emerald-400">{prop.kpiSummary?.punctualityRate || 0}%</strong>
                    </div>
                    <div>
                      Faol guruhlar: <strong className="text-foreground">{prop.kpiSummary?.activeGroupsCount || 0} ta</strong>
                    </div>
                  </div>

                  {/* Detailed Pay Breakdown */}
                  <div className="text-[11px] text-muted-foreground flex items-center gap-3 flex-wrap pt-0.5">
                    <span>Oklad: {formatCurrency(prop.baseSalary)}</span>
                    <span className="text-emerald-400">+KPI: {formatCurrency(prop.kpiBonus)}</span>
                    <span className="text-primary">+Ulush: {formatCurrency(prop.groupRevenueShare)}</span>
                    {prop.deductions > 0 && (
                      <span className="text-rose-400">-Ushlab qolish: {formatCurrency(prop.deductions)}</span>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-[10px] text-muted-foreground uppercase font-medium">To'lanadigan Summa</div>
                  <div className="text-base font-black text-emerald-500">
                    {formatCurrency(prop.totalGross)}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-border/30">
          <GlassButton
            variant="secondary"
            size="sm"
            onClick={() => {
              playPop();
              refetch();
            }}
          >
            🔄 Qayta Hisoblash
          </GlassButton>

          <div className="flex items-center gap-2">
            <GlassButton
              variant="secondary"
              size="sm"
              onClick={onClose}
            >
              Yopish
            </GlassButton>
            <GlassButton
              variant="primary"
              size="sm"
              loading={approveBatchMutation.isPending}
              disabled={proposals.length === 0}
              onClick={handleApproveAll}
            >
              ✅ Barcha Oyliklarni Tasdiqlash & Payrollga Kiritish
            </GlassButton>
          </div>
        </div>
      </div>
    </GlassModal>
  );
};
