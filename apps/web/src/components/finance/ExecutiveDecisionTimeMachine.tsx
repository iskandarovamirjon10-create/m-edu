'use client';

/**
 * ============================================================================
 * M-EDU Executive Decision Time Machine — What-If Simulator (v2.0)
 * ============================================================================
 *
 * Real-time Strategic Scenario Forecasting Engine:
 *  • Parametric sliders: Monthly Tuition, Total Students, Teacher Share, Fixed Rent
 *  • Instant recalculated Margin, Break-even Student Count, 6-Month Projection
 *  • 3 Executive Strategy Presets (Baseline, Aggressive Growth, Maximum Capacity)
 *  • Confetti celebration & digital audit export upon locking strategy
 * ============================================================================
 */

import { useState, memo, useMemo, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useHaptics } from '@/hooks/useHaptics';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { fireExecutiveConfetti } from '@/lib/executiveConfetti';
import { analyticsApi } from '@/lib/api';

interface SimulationState {
  monthlyTuition: number; // in UZS (e.g. 850,000)
  totalStudents: number; // e.g. 450
  teacherRevenueShare: number; // in % (e.g. 40%)
  rentAndUtilities: number; // in UZS (e.g. 25,000,000)
}

export const ExecutiveDecisionTimeMachine = memo(function ExecutiveDecisionTimeMachine({
  initialData,
}: {
  initialData?: SimulationState;
}) {
  const haptics = useHaptics();
  const sound = usePremiumSound();

  // Load real financial overview and active student volume from backend
  const { data: analyticsData } = useQuery({
    queryKey: ['executive-analytics-overview'],
    queryFn: async () => {
      try {
        const res: any = await analyticsApi.overview();
        return res?.data || res;
      } catch {
        return null;
      }
    },
  });

  const [baseline, setBaseline] = useState<SimulationState>(() => {
    if (initialData) return initialData;
    return {
      monthlyTuition: 850_000,
      totalStudents: 150,
      teacherRevenueShare: 40,
      rentAndUtilities: 20_000_000,
    };
  });

  const [sim, setSim] = useState<SimulationState>(baseline);

  // Re-sync with live backend baseline if available
  useEffect(() => {
    if (initialData) return;
    if (analyticsData) {
      const liveStudents = analyticsData.totalStudents || analyticsData.activeStudents || 150;
      const liveTuition = analyticsData.averagePrice || analyticsData.avgTuition || 850_000;
      const liveRent = analyticsData.fixedCosts || analyticsData.monthlyExpenses || 20_000_000;
      const newBase: SimulationState = {
        monthlyTuition: Math.max(200_000, Number(liveTuition) || 850_000),
        totalStudents: Math.max(10, Number(liveStudents) || 150),
        teacherRevenueShare: 40,
        rentAndUtilities: Math.max(2_000_000, Number(liveRent) || 20_000_000),
      };
      setBaseline(newBase);
      setSim(newBase);
    }
  }, [analyticsData, initialData]);

  const [lockedPlan, setLockedPlan] = useState<string | null>(null);

  // Dynamic calculated presets based on persistent real baseline
  const presets = useMemo(() => {
    const baseStudents = baseline.totalStudents || 100;
    const baseTuition = baseline.monthlyTuition || 850_000;
    const baseRent = baseline.rentAndUtilities || 20_000_000;

    return {
      baseline: {
        monthlyTuition: baseTuition,
        totalStudents: baseStudents,
        teacherRevenueShare: baseline.teacherRevenueShare || 40,
        rentAndUtilities: baseRent,
      },
      growth: {
        monthlyTuition: Math.round((baseTuition * 1.15) / 50_000) * 50_000,
        totalStudents: Math.round((baseStudents * 1.35) / 10) * 10,
        teacherRevenueShare: 38,
        rentAndUtilities: Math.round((baseRent * 1.2) / 500_000) * 500_000,
      },
      maxCapacity: {
        monthlyTuition: Math.round((baseTuition * 1.3) / 50_000) * 50_000,
        totalStudents: Math.round((baseStudents * 1.8) / 10) * 10,
        teacherRevenueShare: 35,
        rentAndUtilities: Math.round((baseRent * 1.35) / 500_000) * 500_000,
      },
    };
  }, [baseline]);

  const handleSliderChange = useCallback((key: keyof SimulationState, val: number) => {
    sound.playTick();
    haptics.light();
    setSim((prev) => ({ ...prev, [key]: val }));
  }, [sound, haptics]);

  const handleApplyPreset = useCallback((preset: SimulationState, name: string) => {
    haptics.medium();
    sound.playTick();
    setSim(preset);
    setLockedPlan(`Reja qo'llandi: ${name}`);
    setTimeout(() => setLockedPlan(null), 3500);
  }, [haptics, sound]);

  const handleLockDecision = useCallback(() => {
    haptics.heavy();
    sound.playPayment();
    fireExecutiveConfetti({ originY: 0.6, particleCount: 70 });
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(
          'medu_executive_scenario_target',
          JSON.stringify({
            ...sim,
            lockedAt: new Date().toISOString(),
          })
        );
      }
    } catch {
      // Ignore quota error
    }
    setLockedPlan('Qaror strategik rejaga muhrlandi! (6 oylik maqsad belgilandi)');
    setTimeout(() => setLockedPlan(null), 4500);
  }, [haptics, sound, sim]);

  const calculations = useMemo(() => {
    const grossMonthlyRevenue = sim.totalStudents * sim.monthlyTuition;
    const teacherPayroll = (grossMonthlyRevenue * sim.teacherRevenueShare) / 100;
    const totalMonthlyExpense = teacherPayroll + sim.rentAndUtilities;
    const netMonthlyProfit = grossMonthlyRevenue - totalMonthlyExpense;
    const profitMargin = grossMonthlyRevenue > 0 ? Math.round((netMonthlyProfit / grossMonthlyRevenue) * 100) : 0;

    // Unit contribution margin per student
    const studentMargin = sim.monthlyTuition * (1 - sim.teacherRevenueShare / 100);
    const breakEvenStudents = studentMargin > 0 ? Math.ceil(sim.rentAndUtilities / studentMargin) : 0;

    // Safety margin (cushion above break-even)
    const safetyMarginStudents = Math.max(0, sim.totalStudents - breakEvenStudents);
    const safetyMarginPercent = sim.totalStudents > 0 ? Math.round((safetyMarginStudents / sim.totalStudents) * 100) : 0;

    // Profit contribution per enrolled student
    const profitPerStudent = sim.totalStudents > 0 ? Math.round(netMonthlyProfit / sim.totalStudents) : 0;

    // Projections
    const month6Revenue = grossMonthlyRevenue * 6;
    const month6Profit = netMonthlyProfit * 6;
    const annualRunRateRevenue = grossMonthlyRevenue * 12;
    const annualRunRateProfit = netMonthlyProfit * 12;

    return {
      grossMonthlyRevenue,
      teacherPayroll,
      totalMonthlyExpense,
      netMonthlyProfit,
      profitMargin,
      studentMargin,
      breakEvenStudents,
      safetyMarginStudents,
      safetyMarginPercent,
      profitPerStudent,
      month6Revenue,
      month6Profit,
      annualRunRateRevenue,
      annualRunRateProfit,
    };
  }, [sim]);

  return (
    <div className="relative isolate overflow-hidden rounded-[2.5rem] border border-white/60 bg-white/[0.85] p-6 shadow-2xl backdrop-blur-3xl dark:border-white/10 dark:bg-[#0b101d]/90">
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#AF52DE] to-transparent opacity-70" />

      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-black/[0.06] pb-5 sm:flex-row sm:items-center sm:justify-between dark:border-white/[0.08]">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#AF52DE] to-[#5856D6] text-white shadow-lg shadow-[#AF52DE]/30">
            ⏳
          </div>
          <div>
            <h3 className="text-lg font-black tracking-tight text-[var(--text-primary)]">
              Direktor Qarorlar Vaqt Mashinasi (What-If Simulator)
            </h3>
            <p className="text-xs text-[var(--text-secondary)]">
              Narx, o‘quvchi soni va o‘qituvchi ulushini o‘zgartirganda daromad va rentabellikning 6 oylik proyeksiyasi
            </p>
          </div>
        </div>

        {/* Strategy Presets */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleApplyPreset(presets.baseline, 'Standart')}
            className="rounded-xl border border-black/10 bg-black/5 px-2.5 py-1.5 text-xs font-bold transition-all hover:bg-black/10 dark:border-white/10 dark:bg-white/5"
          >
            Standart
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset(presets.growth, 'O‘sish')}
            className="rounded-xl border border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400 px-2.5 py-1.5 text-xs font-bold transition-all hover:bg-sky-500/20"
          >
            O‘sish (+35%)
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset(presets.maxCapacity, 'Maksimal Quvvat')}
            className="rounded-xl border border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2.5 py-1.5 text-xs font-bold transition-all hover:bg-purple-500/20"
          >
            Maksimal (+80%)
          </button>
        </div>
      </div>

      <div className="my-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Controls Column */}
        <div className="space-y-5 rounded-3xl bg-black/[0.02] p-5 border border-black/[0.05] dark:bg-white/[0.02] dark:border-white/[0.05]">
          {/* Slider 1: Kurs Narxi */}
          <div>
            <div className="flex justify-between text-xs font-bold mb-2">
              <span className="text-[var(--text-secondary)]">Oylik Kurs Narxi (UZS):</span>
              <span className="font-mono text-[#007AFF] font-black">{sim.monthlyTuition.toLocaleString('uz-UZ')} so‘m</span>
            </div>
            <input
              type="range"
              min={200_000}
              max={3_000_000}
              step={25_000}
              value={sim.monthlyTuition}
              onChange={(e) => handleSliderChange('monthlyTuition', Number(e.target.value))}
              className="w-full accent-[#007AFF] cursor-pointer"
            />
          </div>

          {/* Slider 2: O'quvchilar soni */}
          <div>
            <div className="flex justify-between text-xs font-bold mb-2">
              <span className="text-[var(--text-secondary)]">Faol O‘quvchilar Soni:</span>
              <span className="font-mono text-[#34C759] font-black">{sim.totalStudents} nafar</span>
            </div>
            <input
              type="range"
              min={10}
              max={2000}
              step={10}
              value={sim.totalStudents}
              onChange={(e) => handleSliderChange('totalStudents', Number(e.target.value))}
              className="w-full accent-[#34C759] cursor-pointer"
            />
          </div>

          {/* Slider 3: O'qituvchi ulushi */}
          <div>
            <div className="flex justify-between text-xs font-bold mb-2">
              <span className="text-[var(--text-secondary)]">O‘qituvchi Oylik Ulushi (%):</span>
              <span className="font-mono text-[#AF52DE] font-black">{sim.teacherRevenueShare}%</span>
            </div>
            <input
              type="range"
              min={15}
              max={70}
              step={1}
              value={sim.teacherRevenueShare}
              onChange={(e) => handleSliderChange('teacherRevenueShare', Number(e.target.value))}
              className="w-full accent-[#AF52DE] cursor-pointer"
            />
          </div>

          {/* Slider 4: Ijara va Boshqa doimiy xarajatlar */}
          <div>
            <div className="flex justify-between text-xs font-bold mb-2">
              <span className="text-[var(--text-secondary)]">Filial Ijara & Doimiy Xarajat:</span>
              <span className="font-mono text-[#FF9500] font-black">{sim.rentAndUtilities.toLocaleString('uz-UZ')} so‘m</span>
            </div>
            <input
              type="range"
              min={2_000_000}
              max={120_000_000}
              step={1_000_000}
              value={sim.rentAndUtilities}
              onChange={(e) => handleSliderChange('rentAndUtilities', Number(e.target.value))}
              className="w-full accent-[#FF9500] cursor-pointer"
            />
          </div>
        </div>

        {/* Real-Time Forecasting Output */}
        <div className="flex flex-col justify-between rounded-3xl bg-gradient-to-br from-[#AF52DE]/10 via-transparent to-[#007AFF]/10 p-5 border border-[#AF52DE]/20 shadow-inner">
          <div className="space-y-4">
            <span className="text-[10px] uppercase font-mono tracking-widest text-[#AF52DE] font-bold">
              ★ Bashorat Natijalari (Real-Time Forecast)
            </span>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/60 p-3.5 dark:bg-white/5 border border-white/40 dark:border-white/10">
                <span className="text-[10px] text-[var(--text-tertiary)] block">Oylik Jami Tushum:</span>
                <span className="font-mono text-base font-black text-[var(--text-primary)]">
                  {calculations.grossMonthlyRevenue.toLocaleString('uz-UZ')} so‘m
                </span>
              </div>

              <div className="rounded-2xl bg-white/60 p-3.5 dark:bg-white/5 border border-white/40 dark:border-white/10">
                <span className="text-[10px] text-[var(--text-tertiary)] block">Sof Oylik Foyda:</span>
                <span className={`font-mono text-base font-black ${calculations.netMonthlyProfit >= 0 ? 'text-[#34C759]' : 'text-[#FF3B30]'}`}>
                  {calculations.netMonthlyProfit.toLocaleString('uz-UZ')} so‘m
                </span>
              </div>

              <div className="rounded-2xl bg-white/60 p-3.5 dark:bg-white/5 border border-white/40 dark:border-white/10">
                <span className="text-[10px] text-[var(--text-tertiary)] block">Rentabellik Marjasi:</span>
                <span className="font-mono text-base font-black text-[#007AFF]">
                  {calculations.profitMargin}%
                </span>
                <span className="text-[10px] text-zinc-500 block mt-0.5">
                  1 o‘quvchidan: {calculations.profitPerStudent.toLocaleString('uz-UZ')} so‘m
                </span>
              </div>

              <div className="rounded-2xl bg-white/60 p-3.5 dark:bg-white/5 border border-white/40 dark:border-white/10">
                <span className="text-[10px] text-[var(--text-tertiary)] block">Zararsizlik Nuqtasi:</span>
                <span className="font-mono text-base font-black text-[#FF9500]">
                  {calculations.breakEvenStudents} talaba
                </span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block mt-0.5">
                  Zaxira: +{calculations.safetyMarginStudents} ({calculations.safetyMarginPercent}%)
                </span>
              </div>
            </div>

            {/* 6-Month Cumulative Horizon */}
            <div className="rounded-2xl bg-white/70 p-4 dark:bg-white/5 border border-black/5 dark:border-white/10 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[var(--text-primary)]">6 Oylik Kümülyativ Sof Jamg‘arma:</span>
                <span className="font-mono font-black text-[#AF52DE]">
                  {calculations.month6Profit.toLocaleString('uz-UZ')} so‘m
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-[var(--text-tertiary)]">
                <span>Jami 6 oylik kutilayotgan tushum:</span>
                <span className="font-mono">{calculations.month6Revenue.toLocaleString('uz-UZ')} so‘m</span>
              </div>
              <div className="pt-1 border-t border-black/5 dark:border-white/10 flex items-center justify-between text-[10px] text-zinc-400">
                <span>Yillik aylanma (Run-Rate):</span>
                <span className="font-mono font-semibold text-zinc-300">{calculations.annualRunRateRevenue.toLocaleString('uz-UZ')} so‘m</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-black/5 dark:border-white/10">
            {lockedPlan ? (
              <div className="text-center text-xs font-bold text-emerald-500 py-2">
                ✓ {lockedPlan}
              </div>
            ) : (
              <button
                type="button"
                onClick={handleLockDecision}
                className="w-full py-2.5 rounded-xl text-xs font-bold bg-[#AF52DE] text-white hover:bg-[#9b3ec9] transition shadow-lg flex items-center justify-center gap-2"
              >
                <span>🎯</span> Ushbu Moliyaviy Ssenariyni Maqsad Qilib Belgilash
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
