/**
 * Payments Analytics & Intelligence Tab (M-EDU Payments v2)
 * Visual financial telemetry, payment method shares, and collection discipline.
 */

import { useMemo } from 'react';
import {
  TrendingUp,
  CreditCard,
  Banknote,
  Building,
  PieChart,
  ShieldAlert,
  ArrowUpRight,
  Zap,
  Smartphone,
  Globe,
} from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import type { Payment } from '@/lib/types';

interface PaymentsAnalyticsTabProps {
  payments: Payment[];
  onOpenQuickPayment?: () => void;
  onOpenZReport?: () => void;
}

export function PaymentsAnalyticsTab({
  payments,
  onOpenQuickPayment,
  onOpenZReport,
}: PaymentsAnalyticsTabProps) {
  // Method distribution
  const analytics = useMemo(() => {
    let totalPaidMinor = 0;
    let totalPendingMinor = 0;
    let totalOverdueMinor = 0;

    const methodSumsMinor: Record<string, number> = {
      CASH: 0,
      CARD: 0,
      BANK_TRANSFER: 0,
      PAYME: 0,
      CLICK: 0,
      OTHER: 0,
    };

    let paidCount = 0;
    let pendingCount = 0;
    let overdueCount = 0;

    for (const p of payments) {
      const amtMinor = Math.round((Number(p.amount) || 0) * 100);
      if (p.status === 'PAID') {
        totalPaidMinor += amtMinor;
        paidCount++;
        const methodKey = p.method ? String(p.method).toUpperCase() : 'CASH';
        if (methodKey in methodSumsMinor) {
          methodSumsMinor[methodKey] += amtMinor;
        } else {
          methodSumsMinor.OTHER += amtMinor;
        }
      } else if (p.status === 'PENDING') {
        totalPendingMinor += amtMinor;
        pendingCount++;
      } else if (p.status === 'OVERDUE') {
        totalOverdueMinor += amtMinor;
        overdueCount++;
      }
    }

    const totalBills = paidCount + overdueCount + pendingCount;
    const collectionDisciplineRate =
      totalBills > 0 ? Math.round((paidCount / totalBills) * 100) : 100;
    const avgCheck =
      paidCount > 0 ? Math.round(totalPaidMinor / paidCount) / 100 : 0;

    const methodSums: Record<string, number> = {
      CASH: methodSumsMinor.CASH / 100,
      CARD: methodSumsMinor.CARD / 100,
      BANK_TRANSFER: methodSumsMinor.BANK_TRANSFER / 100,
      PAYME: methodSumsMinor.PAYME / 100,
      CLICK: methodSumsMinor.CLICK / 100,
      OTHER: methodSumsMinor.OTHER / 100,
    };

    return {
      totalPaidSum: totalPaidMinor / 100,
      totalPendingSum: totalPendingMinor / 100,
      totalOverdueSum: totalOverdueMinor / 100,
      methodSums,
      paidCount,
      pendingCount,
      overdueCount,
      collectionDisciplineRate,
      avgCheck,
    };
  }, [payments]);

  const methodEntries = useMemo(() => {
    const list = [
      { key: 'CASH', label: 'Naqd pul', sum: analytics.methodSums.CASH, icon: Banknote, color: 'emerald' },
      { key: 'CARD', label: 'Bank kartasi', sum: analytics.methodSums.CARD, icon: CreditCard, color: 'blue' },
      { key: 'BANK_TRANSFER', label: "Bank o'tkazmasi", sum: analytics.methodSums.BANK_TRANSFER, icon: Building, color: 'indigo' },
      { key: 'PAYME', label: 'Payme', sum: analytics.methodSums.PAYME, icon: Smartphone, color: 'cyan' },
      { key: 'CLICK', label: 'Click', sum: analytics.methodSums.CLICK, icon: Smartphone, color: 'sky' },
      { key: 'OTHER', label: 'Boshqa', sum: analytics.methodSums.OTHER, icon: Globe, color: 'slate' },
    ];
    const total = analytics.totalPaidSum;
    return list
      .filter((item) => item.sum > 0 || ['CASH', 'CARD', 'BANK_TRANSFER'].includes(item.key))
      .map((item) => ({
        ...item,
        pct: total > 0 ? Math.round((item.sum / total) * 100) : 0,
      }));
  }, [analytics]);

  return (
    <div className="space-y-5">
      {/* Top Telemetry KPI Trio */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {/* Tushum summasi */}
        <div className="p-5 rounded-2xl border border-white/75 dark:border-white/[0.12] bg-white/60 dark:bg-white/[0.04] backdrop-blur-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Jami Qabul Qilingan Tushum
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white tabular-nums">
            {formatCurrency(analytics.totalPaidSum)}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {analytics.paidCount} ta muvaffaqiyatli tranzaksiya
          </p>
        </div>

        {/* To'lov intizomi */}
        <div className="p-5 rounded-2xl border border-white/75 dark:border-white/[0.12] bg-white/60 dark:bg-white/[0.04] backdrop-blur-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              To'lov Intizomi Ko'rsatkichi
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white tabular-nums">
            {analytics.collectionDisciplineRate}%
          </div>
          <div className="mt-2 w-full bg-slate-200 dark:bg-white/10 rounded-full h-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-emerald-500 to-blue-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${analytics.collectionDisciplineRate}%` }}
            />
          </div>
        </div>

        {/* O'rtacha to'lov miqdori */}
        <div className="p-5 rounded-2xl border border-white/75 dark:border-white/[0.12] bg-white/60 dark:bg-white/[0.04] backdrop-blur-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              O'rtacha To'lov Miqdori
            </span>
            <div className="w-8 h-8 rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-400 flex items-center justify-center">
              <PieChart className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white tabular-nums">
            {formatCurrency(analytics.avgCheck)}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Kutilayotgan qoldiq: {formatCurrency(analytics.totalPendingSum + analytics.totalOverdueSum)}
          </p>
        </div>
      </div>

      {/* Payment methods breakdown grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Usullar taqsimoti */}
        <div className="lg:col-span-2 p-6 rounded-2xl border border-white/75 dark:border-white/[0.12] bg-white/60 dark:bg-white/[0.04] backdrop-blur-2xl shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                To'lov Usullari Taqsimoti
              </h3>
              <p className="text-xs text-slate-500">M-EDU tushumlarining to'lov kanallari bo'yicha ulushi</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300">
              Real-vaqt
            </span>
          </div>

          <div className="space-y-3 pt-2">
            {methodEntries.map((item) => {
              const IconComp = item.icon;
              return (
                <div key={item.key} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                      <IconComp className="w-4 h-4 text-brand-500" />
                      {item.label}
                    </span>
                    <span className="tabular-nums font-bold text-slate-900 dark:text-white">
                      {formatCurrency(item.sum)} ({item.pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-white/10 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-2.5 rounded-full transition-all duration-500 ${
                        item.key === 'CASH'
                          ? 'bg-emerald-500'
                          : item.key === 'CARD'
                          ? 'bg-blue-500'
                          : item.key === 'PAYME'
                          ? 'bg-cyan-500'
                          : item.key === 'CLICK'
                          ? 'bg-sky-500'
                          : 'bg-indigo-500'
                      }`}
                      style={{ width: `${Math.max(item.pct, 3)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Xavflar va kassa tavsiyalari */}
        <div className="p-6 rounded-2xl border border-white/75 dark:border-white/[0.12] bg-white/60 dark:bg-white/[0.04] backdrop-blur-2xl shadow-sm flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <ShieldAlert className="w-5 h-5" />
              <h4 className="text-sm font-bold">Kassa & Moliya Nazorati</h4>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Kunning oxirida barcha naqd va terminal tushumlarini muvofiqlashtirish uchun
              <strong> Z-Hisobot</strong> modulidan foydalaning. Bu kassa kamomadi yoki
              nomuvofiqliklarini darhol bartaraf etadi.
            </p>

            {analytics.overdueCount > 0 && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-700 dark:text-rose-300">
                <strong>{analytics.overdueCount} ta</strong> to'lov muddati o'tib ketgan.
                Qarzdorlik radaridan ota-onalarga eslatma yuborish tavsiya etiladi.
              </div>
            )}
          </div>

          <div className="pt-4 flex flex-col gap-2">
            <button
              type="button"
              onClick={onOpenZReport}
              className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2"
            >
              Kassa Z-Hisobotini ochish
              <ArrowUpRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onOpenQuickPayment}
              className="w-full py-2.5 px-3 rounded-xl bg-slate-900 dark:bg-white/10 hover:bg-slate-800 text-white text-xs font-bold transition-all flex items-center justify-center gap-2"
            >
              Yangi to'lov qabul qilish
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
