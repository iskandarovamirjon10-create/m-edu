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

export function BillingSettingsPage() {
  const queryClient = useQueryClient();
  const { push } = useToasts();
  const [activeInvoiceForPay, setActiveInvoiceForPay] = useState<any | null>(null);

  // Queries
  const { data: currentSub } = useQuery({
    queryKey: ['subscription-current'],
    queryFn: subscriptionsApi.getCurrentSubscription,
  });

  const { data: usage } = useQuery({
    queryKey: ['subscription-usage'],
    queryFn: subscriptionsApi.getUsage,
  });

  const { data: plans = [] } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: subscriptionsApi.getPlans,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['billing-invoices'],
    queryFn: billingApi.getInvoices,
  });

  const { data: payLinks, isLoading: isLinksLoading } = useQuery({
    queryKey: ['billing-pay-links', activeInvoiceForPay?.invoiceNumber],
    queryFn: () => billingApi.getPaymentLinks(activeInvoiceForPay.invoiceNumber),
    enabled: Boolean(activeInvoiceForPay),
  });

  // Plan change mutation
  const changePlanMutation = useMutation({
    mutationFn: (planCode: string) => subscriptionsApi.changePlan({ plan: planCode }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-current'] });
      queryClient.invalidateQueries({ queryKey: ['subscription-usage'] });
      queryClient.invalidateQueries({ queryKey: ['billing-invoices'] });
      push('success', 'Subscription tier successfully updated!');
    },
    onError: (err: any) => {
      push('error', err.message || 'Failed to update subscription');
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
              Billing & Subscription
            </h1>
          </div>
          <p className="text-sm text-secondary mt-1.5">
            Manage your educational operating tier, track resource quotas, and review fiscal invoices.
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
                  Free Trial Active — {getDaysRemaining(currentSub.trialEndAt)} Days Remaining
                </div>
                <div className="text-xs text-secondary mt-0.5">
                  You are currently exploring M-EDU on the 7-day complimentary trial. Upgrade before expiration to ensure uninterrupted access.
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
            <span className="font-semibold uppercase tracking-wider">Active Students</span>
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
            <span className="font-semibold uppercase tracking-wider">Active Branches</span>
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
            <span className="font-semibold uppercase tracking-wider">Active Employees</span>
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
          <h2 className="text-xl font-bold tracking-tight text-primary">Choose Your Operating Tier</h2>
          <p className="text-xs text-secondary">Scale seamlessly as your educational organization grows.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((p: any) => {
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
                        Current
                      </GlassBadge>
                    )}
                  </div>

                  <div className="mt-3">
                    <div className="text-2xl font-extrabold text-primary">
                      {formatUzs(p.priceUzs)}
                    </div>
                    <div className="text-xs text-secondary">per month</div>
                  </div>

                  <ul className="mt-5 space-y-2.5 text-xs text-secondary">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>Up to <strong className="text-primary">{p.maxStudents}</strong> students</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>Up to <strong className="text-primary">{p.maxBranches}</strong> branch(es)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>Up to <strong className="text-primary">{p.maxEmployees}</strong> staff accounts</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span className={p.hasFaceId ? 'text-primary font-medium' : 'text-secondary'}>
                        {p.hasFaceId ? 'Face ID Biometrics' : 'Manual Attendance'}
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>Gemini AI Copilot</span>
                    </li>
                  </ul>
                </div>

                <div className="mt-6 pt-2 border-t border-black/[0.04] dark:border-white/[0.06]">
                  {isCurrent ? (
                    <GlassButton
                      disabled
                      size="sm"
                      variant="secondary"
                      className="w-full text-xs font-semibold opacity-60 cursor-not-allowed"
                    >
                      Active Plan
                    </GlassButton>
                  ) : (
                    <GlassButton
                      variant="primary"
                      size="sm"
                      onClick={() => changePlanMutation.mutate(p.code)}
                      loading={changePlanMutation.isPending}
                      className="w-full text-xs font-semibold"
                    >
                      Switch to {p.name}
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
          <h2 className="text-lg font-semibold text-primary">Invoices & Receipts</h2>
          <p className="text-xs text-secondary mt-0.5">Download fiscal documentation or pay outstanding subscription invoices.</p>
        </div>

        <GlassTable minWidth={560}>
          <GlassTHead>
            <GlassTR>
              <GlassTH>Invoice #</GlassTH>
              <GlassTH>Issue Date</GlassTH>
              <GlassTH>Amount</GlassTH>
              <GlassTH>Status</GlassTH>
              <GlassTH align="right">Action</GlassTH>
            </GlassTR>
          </GlassTHead>
          <tbody>
            {invoices.length === 0 ? (
              <GlassTR>
                <GlassTD colSpan={5} className="py-8 text-center text-xs text-secondary">
                  No billing invoices generated yet.
                </GlassTD>
              </GlassTR>
            ) : (
              invoices.map((inv: any) => (
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
                      {inv.status}
                    </GlassBadge>
                  </GlassTD>
                  <GlassTD align="right">
                    {inv.status !== 'PAID' ? (
                      <GlassButton
                        size="xs"
                        variant="success"
                        onClick={() => setActiveInvoiceForPay(inv)}
                      >
                        Pay Online
                      </GlassButton>
                    ) : (
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Paid
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
        onClose={() => setActiveInvoiceForPay(null)}
        title="Pay Subscription Invoice"
        description={
          activeInvoiceForPay
            ? `Invoice ${activeInvoiceForPay.invoiceNumber} · ${formatUzs(activeInvoiceForPay.amountUzs)}`
            : undefined
        }
        size="md"
      >
        <div className="p-6 space-y-4">
          <p className="text-xs text-secondary">
            Select your preferred Uzbek payment gateway to complete the payment instantly:
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
                  className="flex items-center justify-between p-4 rounded-xl border border-black/[0.08] dark:border-white/[0.1] bg-white/60 dark:bg-white/[0.05] hover:bg-white dark:hover:bg-white/[0.1] transition-all group"
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
                  className="flex items-center justify-between p-4 rounded-xl border border-black/[0.08] dark:border-white/[0.1] bg-white/60 dark:bg-white/[0.05] hover:bg-white dark:hover:bg-white/[0.1] transition-all group"
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
