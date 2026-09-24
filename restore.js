const fs = require('fs');

const p = 'apps/web/src/pages/Invoices.tsx';
let code = fs.readFileSync(p, 'utf8');

const topParts = code.split(/const FILTER_TABS = \['','ISSUED','PARTIALLY_PAID','PAID','OVERDUE','CANCELLED'\];/);
const bottomParts = topParts[1].split(/<\/div>\s*<\/GlassTD>\s*<\/GlassTR>\s*\);\s*\}\)\}\s*<\/GlassTBody>\s*<\/GlassTable>/);

const injected = `const FILTER_TABS = ['','ISSUED','PARTIALLY_PAID','PAID','OVERDUE','CANCELLED'];

export default function InvoicesPage() {
  const { t } = useI18n();
  usePageTitle(t('nav.invoices'));
  const { push } = useToast();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<Invoice | null>(null);
  const [refundTarget, setRefundTarget] = useState<Invoice | null>(null);
  const [paymentForm, setPaymentForm] = useState<PaymentFormState>(EMPTY_PAYMENT);
  const [refundForm, setRefundForm] = useState<RefundFormState>(EMPTY_REFUND);

  const invoices = useQuery({
    queryKey: ['invoices', statusFilter],
    queryFn: () => invoicesApi.list({ status: statusFilter || undefined, limit: 100 }),
  });

  const remaining = (inv: Invoice) => {
    const total = Number(inv.totalAmount) || 0;
    const paid = Number(inv.amountPaid) || 0;
    return Math.max(0, total - paid);
  };

  const recordPayment = useMutation({
    mutationFn: ({ invoiceId, data }: { invoiceId: string, data: PaymentFormState }) => invoicesApi.recordPayment(invoiceId, data),
    onSuccess: () => {
      push('success', t('invoices.paymentSuccess'));
      setPayTarget(null);
      setPaymentForm(EMPTY_PAYMENT);
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (error: any) => {
      push('error', getErrorMessage(error));
    },
  });

  if (invoices.isLoading) {
    return <GlassPageLoader />;
  }

  if (invoices.isError) {
    return <GlassErrorState onRetry={() => invoices.refetch()} />;
  }

  return (
    <div className="space-y-6 pb-24">
      <GlassPageHeader
        title={t('nav.invoices')}
        description={t('invoices.subtitle')}
        primaryAction={{
          label: t('invoices.createInvoice'),
          onClick: () => setCreateOpen(true),
        }}
      />

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-[2rem] glass-card">
        <GlassTabs
          active={statusFilter}
          onChange={setStatusFilter}
          tabs={FILTER_TABS.map(opt => ({ id: opt, label: opt === '' ? t('invoices.allTab') : t(invoiceStatusKey(opt)) }))}
        />
      </div>

      <div className="rounded-[2.5rem] glass-card overflow-hidden relative">
        <div className="absolute inset-0 rounded-[2.5rem] pointer-events-none ring-1 ring-inset ring-black/5 dark:ring-white/5" aria-hidden />

        {invoices.data && invoices.data.items.length > 0 ? (
          <div className="relative z-10 w-full overflow-x-auto custom-scrollbar">
            <GlassTable>
              <GlassTHead>
                <GlassTR>
                  <GlassTH>{t('invoices.col.details')}</GlassTH>
                  <GlassTH>{t('invoices.col.student')}</GlassTH>
                  <GlassTH>{t('common.status')}</GlassTH>
                  <GlassTH className="text-right">{t('invoices.col.totalPaid')}</GlassTH>
                  <GlassTH className="text-right">{t('invoices.col.balanceDue')}</GlassTH>
                  <GlassTH className="text-right">{t('common.actions')}</GlassTH>
                </GlassTR>
              </GlassTHead>
              <GlassTBody>
                {invoices.data.items.map((inv: any, idx: number) => {
                  const statusConfig = getInvoiceStatusConfig(inv.status);
                  const studentName = inv.student?.user ? \`\${inv.student.user.firstName} \${inv.student.user.lastName}\` : inv.studentId.slice(0, 8);
                  const isOverdue = inv.status === 'OVERDUE';
                  const bal = remaining(inv);
                  return (
                    <GlassTR key={inv.id}>
                      <GlassTD>
                        <div className="font-medium text-[var(--text-primary)]">
                          {inv.number || inv.id.slice(0, 8)}
                        </div>
                        <div className="text-xs text-[var(--text-muted)]">
                          {inv.issueDate}
                        </div>
                      </GlassTD>
                      <GlassTD>{studentName}</GlassTD>
                      <GlassTD>
                        <span className={\`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-bold \${statusConfig.bg} \${statusConfig.text}\`}>
                          <span className={\`w-1.5 h-1.5 rounded-full \${statusConfig.dot}\`} />
                          {t(invoiceStatusKey(inv.status))}
                        </span>
                      </GlassTD>
                      <GlassTD className="text-right font-medium">{formatCurrency(Number(inv.amountPaid), 'USD')}</GlassTD>
                      <GlassTD className="text-right font-medium text-rose-500">{formatCurrency(bal, 'USD')}</GlassTD>
                      <GlassTD className="text-right">
                        <div className="flex justify-end gap-2">
                          <GlassButton type="button" variant="secondary" size="sm" onClick={() => setPayTarget(inv)}>{t('invoices.recordPayment')}</GlassButton>
                          <GlassButton type="button" variant="secondary" size="sm" onClick={() => setRefundTarget(inv)}>{t('invoices.recordRefund')}</GlassButton>
                        </div>
                      </GlassTD>
                    </GlassTR>
                  );
                })}
              </GlassTBody>
            </GlassTable>`;

fs.writeFileSync(p, topParts[0] + injected + bottomParts[1], 'utf8');
console.log('Restored Invoices.tsx');
