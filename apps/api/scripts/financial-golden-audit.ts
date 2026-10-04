import { PrismaClient } from '@prisma/client';
import { FinancialBrainService } from '../src/analytics/financial-brain.service';
import { DashboardService } from '../src/dashboard/dashboard.service';

const prisma = new PrismaClient();

async function runAudit() {
  console.log('Starting Golden Financial Ledger Forensics...');
  const finance = new FinancialBrainService(prisma as any);
  const dashboard = new DashboardService(prisma as any, finance);

  const orgId = 'golden-audit-org-' + Date.now();
  
  // 1. Setup Golden Organization
  const org = await prisma.organization.create({
    data: { id: orgId, name: 'Audit Org', address: 'Test', phone: '123', email: 'audit@test.com' },
  });

  try {
    const user = await prisma.user.create({
      data: {
        organizationId: org.id,
        email: 'student-golden@test.com',
        firstName: 'Golden',
        lastName: 'Student',
      }
    });

    const student = await prisma.student.create({
      data: {
        organizationId: org.id,
        userId: user.id,
      }
    });

    const now = new Date();
    const invoice = await prisma.invoice.create({
      data: {
        organizationId: org.id,
        studentId: student.id,
        number: 'INV-GOLD-1',
        status: 'ISSUED',
        total: 1000000,
        subtotal: 1000000,
        paidAmount: 0,
        refundedAmount: 0,
        discount: 0,
        penalty: 0,
        currency: 'UZS',
        dueDate: now,
      }
    });

    // Payment A = 600,000
    const payA = await prisma.payment.create({
      data: {
        organizationId: org.id,
        studentId: student.id,
        invoiceId: invoice.id,
        amount: 600000,
        status: 'PAID',
        paidAt: now,
      }
    });

    // Payment B = 400,000
    const payB = await prisma.payment.create({
      data: {
        organizationId: org.id,
        studentId: student.id,
        invoiceId: invoice.id,
        amount: 400000,
        status: 'PAID',
        paidAt: now,
      }
    });

    // Refund B = 100,000
    const refundB = await prisma.refund.create({
      data: {
        organizationId: org.id,
        paymentId: payB.id,
        invoiceId: invoice.id,
        amount: 100000,
        status: 'PROCESSED',
        requestedBy: user.id,
        processedBy: user.id,
        processedAt: now,
      }
    });

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        paidAmount: 1000000,
        refundedAmount: 100000,
      }
    });

    await prisma.student.update({
      where: { id: student.id },
      data: { balance: 900000 }
    });

    // VERIFY DASHBOARD
    const dashStats = await dashboard.getStats(org.id);
    if (dashStats.totalPaid !== 900000) {
      throw new Error('Dashboard totalPaid expected 900000, got ' + dashStats.totalPaid);
    }
    if (dashStats.totalPending !== 100000) {
      throw new Error('Dashboard totalPending expected 100000, got ' + dashStats.totalPending);
    }
    console.log('[PASS] Dashboard == Canonical Financial Source');

    // VERIFY FINANCIAL BRAIN
    const debt = await finance.getDebtAndReceivables(org.id);
    if (debt.totalReceivables !== 100000) {
      throw new Error('FinancialBrain outstanding expected 100000, got ' + debt.totalReceivables);
    }
    console.log('[PASS] FinancialBrain Debt Equation');

    const cashFlow = await finance.getCashFlow(org.id, new Date(Date.now() - 86400000), new Date(Date.now() + 86400000));
    if (cashFlow.inflows.cashCollected !== 1000000) {
      throw new Error('CashCollected expected 1000000, got ' + cashFlow.inflows.cashCollected);
    }
    if (cashFlow.inflows.refundsTotal !== 100000) {
      throw new Error('RefundsTotal expected 100000, got ' + cashFlow.inflows.refundsTotal);
    }
    if (cashFlow.inflows.netCashInflow !== 900000) {
      throw new Error('NetCashInflow expected 900000, got ' + cashFlow.inflows.netCashInflow);
    }
    console.log('[PASS] Cash Flow Equation');

    const monthlyRevenue = await finance.getMonthlyRevenueSeries(org.id);
    if (monthlyRevenue[0].total !== 900000) {
      throw new Error('Monthly Revenue expected 900000, got ' + monthlyRevenue[0].total);
    }
    console.log('[PASS] Monthly Revenue Series Equation (No double counting)');

    console.log('✅ All Financial Invariants PASSED.');

  } finally {
    // Teardown
    await prisma.refund.deleteMany({ where: { organizationId: org.id } });
    await prisma.payment.deleteMany({ where: { organizationId: org.id } });
    await prisma.invoice.deleteMany({ where: { organizationId: org.id } });
    await prisma.student.deleteMany({ where: { organizationId: org.id } });
    await prisma.user.deleteMany({ where: { organizationId: org.id } });
    await prisma.organization.delete({ where: { id: org.id } });
    await prisma.$disconnect();
  }
}

runAudit().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
