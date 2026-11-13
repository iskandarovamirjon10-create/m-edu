/**
 * M-EDU BillingSettingsPage — Ultra-Luxury Apple VisionOS Subscriptions & Quotas Center
 * Features quota meters, plan selection matrix, fiscal invoice audit table,
 * Payme / Click deep payment links, tactile sound cues, and safe i18n localization.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CreditCard,
  CheckCircle2,
  Clock,
  Building,
  Users,
  Briefcase,
  ExternalLink,
} from 'lucide-react';
import { subscriptionsApi, billingApi } from '@/lib/api';
import {
  useToasts,
  GlassCard,
  GlassButton,
  GlassModal,
  GlassBadge,
  GlassTable,
  GlassTHead,
  GlassTR,
  GlassTH,
  GlassTD,
} from '@/components/ui';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { usePremiumSound } from '@/hooks/usePremiumSound';

interface PlanItem {
  id: string;
  code: string;
  name: string;
  priceUzs: number;
  maxStudents: number;
  maxBranches: number;
  maxEmployees: number;
  hasFaceId: boolean;
}

interface InvoiceItem {
  id: string;
  invoiceNumber: string;
  issuedAt?: string;
  createdAt: string;
  amountUzs: number;
  status: 'PENDING' | 'PAID' | 'CANCELLED';
}

interface SubscriptionInfo {
  status?: string;
  trialEndAt?: string | null;
  plan?: string;
}

interface UsageQuota {
  current?: number;
  max?: number;
  percentage?: number;
}

interface UsageInfo {
  students?: UsageQuota;
  branches?: UsageQuota;
  employees?: UsageQuota;
}

interface InvoicePaymentLinks {
  paymeUrl?: string;
  clickUrl?: string;
}

export function BillingSettingsPage() {
  const { t } = useSafeI18n();
  const sound = usePremiumSound();
  const queryClient = useQueryClient();
  const { push } = useToasts();
  const [activeInvoiceForPay, setActiveInvoiceForPay] = useState<InvoiceItem | null>(null);

  usePageTitle(t('settings.billing', 'Ta’rif va obuna to‘lovlari'));

  // Queries
  const { data: currentSub } = useQuery<SubscriptionInfo>({
    queryKey: ['subscription-current'],
    queryFn: () => subscriptionsApi.getCurrentSubscription() as Promise<SubscriptionInfo>,
  });

  const { data: usage } = useQuery<UsageInfo>({
    queryKey: ['subscription-usage'],
    queryFn: () => subscriptionsApi.getUsage() as Promise<UsageInfo>,
  });

  const { data: plans = [] } = useQuery<PlanItem[]>({
    queryKey: ['subscription-plans'],
    queryFn: () => subscriptionsApi.getPlans() as Promise<PlanItem[]>,
  });

  const { data: invoices = [] } = useQuery<InvoiceItem[]>({
    queryKey: ['billing-invoices'],
    queryFn: () => billingApi.getInvoices() as Promise<InvoiceItem[]>,
  });

  const { data: payLinks, isLoading: isLinksLoading } = useQuery<InvoicePaymentLinks>({
    queryKey: ['billing-pay-links', activeInvoiceForPay?.invoiceNumber],
    queryFn: () => {
      if (!activeInvoiceForPay) throw new Error('No invoice selected');
      return billingApi.getPaymentLinks(activeInvoiceForPay.invoiceNumber) as Promise<InvoicePaymentLinks>;
    },
    enabled: Boolean(activeInvoiceForPay),
  });

  // Plan change mutation
  const changePlanMutation = useMutation({
    mutationFn: (planCode: string) => subscriptionsApi.changePlan({ plan: planCode }),
    onSuccess: () => {
      sound.playSuccess?.();
      queryClient.invalidateQueries({ queryKey: ['subscription-current'] });
      queryClient.invalidateQueries({ queryKey: ['subscription-usage'] });
      queryClient.invalidateQueries({ queryKey: ['billing-invoices'] });
      push('success', t('billing.planUpdated', 'Ta’rif rejasi muvaffaqiyatli yangilandi!'));
    },
    onError: (err: unknown) => {
      sound.playError?.();
      const message = err instanceof Error ? err.message : 'Ta’rifni o‘zgartirishda xatolik yuz berdi';
      push('error', message);
    },
  });

  const formatUzs = (amount: number) => {
    return new Intl.NumberFormat('uz-UZ').format(amount) + ' UZS';
  };

  const getDaysRemaining = (endAt?: string | null) => {
    if (!endAt) return 0;
    const diff = new Date(endAt).getTime() - new Date().getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  return (
    <div className="page-container space-y-6 pb-24 text-primary">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/[0.06] dark:border-white/[0.08] pb-5">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              <CreditCard className="w-5 h-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              {t('settings.billing', 'Ta’rif va obuna to‘lovlari')}
            </h1>
          </div>
          <p className="text-sm text-secondary mt-1.5">
            {t('billing.subtitle', 'Ta’lim platformangiz ta’rifini boshqaring, resurs limitlarini kuzating va hisob-fakturalarni tekshiring.')}
          </p>
        </div>
      </div>

      {/* Trial Countdown Alert Banner */}
      {currentSub?.status === 'TRIALING' && (
        <GlassCard className="p-4 sm:p-5 border-brand-500/30 bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-brand-500/10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="p-2 rounded-xl bg-purple-500/20 text-purple-600 dark:text-purple-300 shrink-0">
                <Clock className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="text-sm font-semibold text-primary">
                  {t('billing.trialActive', 'Sinov davri faol')} — {getDaysRemaining(currentSub.trialEndAt)} {t('common.daysRemaining', 'kun qoldi')}
                </div>
                <div className="text-xs text-secondary mt-0.5">
                  {t('billing.trialNotice', 'Siz hozirda 7 kunlik bepul sinov davridasiz. Uzluksiz ishlash uchun ta’rifni yangilang.')}
                </div>
              </div>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Quota Utilization Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {/* Student Quota */}
        <GlassCard padding="md" className="space-y-3">
          <div className="flex items-center justify-between text-xs text-secondary">
            <span className="font-semibold uppercase tracking-wider">{t('students.title', 'Faol o‘quvchilar')}</span>
            <Users className="w-4 h-4 text-brand-500" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-primary">
              {usage?.students?.current ?? '—'}
            </span>
            <span className="text-xs text-secondary">
              limit: {usage?.students?.max ?? '—'}
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                (usage?.students?.percentage || 0) > 90 ? 'bg-rose-500' : 'bg-brand-500'
              }`}
              style={{ width: `${Math.min(100, usage?.students?.percentage || 0)}%` }}
            />
          </div>
        </GlassCard>

        {/* Branch Quota */}
        <GlassCard padding="md" className="space-y-3">
          <div className="flex items-center justify-between text-xs text-secondary">
            <span className="font-semibold uppercase tracking-wider">{t('branches.title', 'Faol filiallar')}</span>
            <Building className="w-4 h-4 text-purple-500" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-primary">
              {usage?.branches?.current ?? '—'}
            </span>
            <span className="text-xs text-secondary">
              limit: {usage?.branches?.max ?? '—'}
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                (usage?.branches?.percentage || 0) > 90 ? 'bg-rose-500' : 'bg-purple-500'
              }`}
              style={{ width: `${Math.min(100, usage?.branches?.percentage || 0)}%` }}
            />
          </div>
        </GlassCard>

        {/* Staff Quota */}
        <GlassCard padding="md" className="space-y-3 sm:col-span-2 md:col-span-1">
          <div className="flex items-center justify-between text-xs text-secondary">
            <span className="font-semibold uppercase tracking-wider">{t('hr.title', 'Xodimlar')}</span>
            <Briefcase className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-primary">
              {usage?.employees?.current ?? '—'}
            </span>
            <span className="text-xs text-secondary">
              limit: {usage?.employees?.max ?? '—'}
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                (usage?.employees?.percentage || 0) > 90 ? 'bg-rose-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, usage?.employees?.percentage || 0)}%` }}
            />
          </div>
        </GlassCard>
      </div>

      {/* Subscription Plans Matrix */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-primary">
            {t('billing.chooseTier', 'Ta’rif rejasini tanlang')}
          </h2>
          <p className="text-xs text-secondary">
            {t('billing.chooseTierDesc', 'Tashkilotingiz ehtiyojlariga qarab mos ta’rifni tanlang.')}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {(plans as PlanItem[]).map((p) => {
            const isCurrent = currentSub?.plan === p.code;
            return (
              <GlassCard
                key={p.id}
                padding="md"
                variant={isCurrent ? 'elevated' : 'default'}
                className={`flex flex-col justify-between transition-all ${
                  isCurrent
                    ? 'border-purple-500/50 shadow-brand ring-1 ring-purple-500/30'
                    : 'hover:border-purple-500/30'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-primary">{p.name}</h3>
                    {isCurrent && (
                      <GlassBadge variant="purple" size="sm">
                        {t('billing.currentPlan', 'Joriy')}
                      </GlassBadge>
                    )}
                  </div>

                  <div className="mt-3">
                    <div className="text-2xl font-extrabold text-primary">
                      {formatUzs(p.priceUzs)}
                    </div>
                    <div className="text-xs text-secondary">{t('billing.perMonth', 'oyiga')}</div>
                  </div>

                  <ul className="mt-5 space-y-2.5 text-xs text-secondary">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>{p.maxStudents} {t('billing.studentsLimit', 'tagacha o‘quvchi')}</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>{p.maxBranches} {t('billing.branchesLimit', 'tagacha filial')}</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>{p.maxEmployees} {t('billing.staffLimit', 'tagacha xodim')}</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span className={p.hasFaceId ? 'text-primary font-medium' : 'text-secondary'}>
                        {p.hasFaceId ? 'Face ID biometriya' : 'Standart davomat'}
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>M-EDU Gemini AI Copilot</span>
                    </li>
                  </ul>
                </div>

                <div className="mt-6 pt-2 border-t border-black/[0.04] dark:border-white/[0.06]">
                  {isCurrent ? (
                    <GlassButton
                      disabled
                      size="sm"
                      variant="secondary"
                      className="min-h-[44px] w-full text-xs font-semibold opacity-60 cursor-not-allowed"
                    >
                      {t('billing.activePlan', 'Faol ta’rif')}
                    </GlassButton>
                  ) : (
                    <GlassButton
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        sound.playTick?.();
                        changePlanMutation.mutate(p.code);
                      }}
                      loading={changePlanMutation.isPending}
                      className="min-h-[44px] w-full text-xs font-semibold"
                    >
                      {p.name} {t('billing.switchTo', 'ta’rifiga o‘tish')}
                    </GlassButton>
                  )}
                </div>
              </GlassCard>
            );
          })}
        </div>
      </div>

      {/* Invoices History Table */}
      <GlassCard padding="none" className="overflow-hidden">
        <div className="p-5 border-b border-black/[0.06] dark:border-white/[0.08]">
          <h2 className="text-lg font-semibold text-primary">
            {t('billing.invoicesTitle', 'Hisob-fakturalar va to‘lov cheklari')}
          </h2>
          <p className="text-xs text-secondary mt-0.5">
            {t('billing.invoicesDesc', 'Platforma obunasi bo‘yicha moliyaviy hisobotlar va onlayn to‘lov qilish.')}
          </p>
        </div>

        <GlassTable minWidth={560}>
          <GlassTHead>
            <GlassTR>
              <GlassTH>{t('billing.invoiceNumber', 'Hisob raqami')}</GlassTH>
              <GlassTH>{t('billing.issueDate', 'Sana')}</GlassTH>
              <GlassTH>{t('billing.amount', 'Summa')}</GlassTH>
              <GlassTH>{t('billing.status', 'Holat')}</GlassTH>
              <GlassTH align="right">{t('common.actions', 'Amal')}</GlassTH>
            </GlassTR>
          </GlassTHead>
          <tbody>
            {(invoices as InvoiceItem[]).length === 0 ? (
              <GlassTR>
                <GlassTD colSpan={5} className="py-8 text-center text-xs text-secondary">
                  {t('billing.noInvoices', 'Hozircha hisob-fakturalar mavjud emas.')}
                </GlassTD>
              </GlassTR>
            ) : (
              (invoices as InvoiceItem[]).map((inv) => (
                <GlassTR key={inv.id}>
                  <GlassTD className="font-mono font-medium text-primary">
                    {inv.invoiceNumber}
                  </GlassTD>
                  <GlassTD className="text-xs text-secondary">
                    {new Date(inv.issuedAt || inv.createdAt).toLocaleDateString()}
                  </GlassTD>
                  <GlassTD className="text-sm font-semibold text-primary">
                    {formatUzs(inv.amountUzs)}
                  </GlassTD>
                  <GlassTD>
                    <GlassBadge
                      variant={inv.status === 'PAID' ? 'green' : 'amber'}
                      size="sm"
                    >
                      {inv.status === 'PAID' ? t('payments.status.PAID', 'To‘langan') : t('payments.status.PENDING', 'Kutilmoqda')}
                    </GlassBadge>
                  </GlassTD>
                  <GlassTD align="right">
                    {inv.status !== 'PAID' ? (
                      <GlassButton
                        size="xs"
                        variant="success"
                        className="min-h-[36px]"
                        onClick={() => {
                          sound.playTick?.();
                          setActiveInvoiceForPay(inv);
                        }}
                      >
                        {t('billing.payOnline', 'Onlayn to‘lash')}
                      </GlassButton>
                    ) : (
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {t('payments.status.PAID', 'To‘langan')}
                      </span>
                    )}
                  </GlassTD>
                </GlassTR>
              ))
            )}
          </tbody>
        </GlassTable>
      </GlassCard>

      {/* Online Payment Modal */}
      <GlassModal
        open={Boolean(activeInvoiceForPay)}
        onClose={() => {
          sound.playTick?.();
          setActiveInvoiceForPay(null);
        }}
        title={t('billing.payModalTitle', 'Obuna to‘lovini amalga oshirish')}
        description={
          activeInvoiceForPay
            ? `№ ${activeInvoiceForPay.invoiceNumber} · ${formatUzs(activeInvoiceForPay.amountUzs)}`
            : undefined
        }
        size="md"
      >
        <div className="p-6 space-y-4">
          <p className="text-xs text-secondary">
            {t('billing.selectGateway', 'To‘lovni tez va xavfsiz amalga oshirish uchun milliy to‘lov tizimini tanlang:')}
          </p>

          {isLinksLoading ? (
            <div className="py-8 flex items-center justify-center">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {payLinks?.paymeUrl && (
                <a
                  href={payLinks.paymeUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => sound.playTick?.()}
                  className="flex min-h-[48px] items-center justify-between p-4 rounded-2xl border border-black/[0.08] dark:border-white/[0.1] bg-white/60 dark:bg-white/[0.05] hover:bg-white dark:hover:bg-white/[0.1] transition-all group"
                >
                  <span className="font-semibold text-sm text-cyan-600 dark:text-cyan-400">Payme</span>
                  <ExternalLink className="w-4 h-4 text-secondary group-hover:text-primary transition-colors" />
                </a>
              )}
              {payLinks?.clickUrl && (
                <a
                  href={payLinks.clickUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => sound.playTick?.()}
                  className="flex min-h-[48px] items-center justify-between p-4 rounded-2xl border border-black/[0.08] dark:border-white/[0.1] bg-white/60 dark:bg-white/[0.05] hover:bg-white dark:hover:bg-white/[0.1] transition-all group"
                >
                  <span className="font-semibold text-sm text-brand-600 dark:text-brand-400">Click</span>
                  <ExternalLink className="w-4 h-4 text-secondary group-hover:text-primary transition-colors" />
                </a>
              )}
            </div>
          )}
        </div>
      </GlassModal>
    </div>
  );
}

export default BillingSettingsPage;
