import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentsService } from '../payments.service';

function createMockPrisma() {
  return {
    student: { findFirst: vi.fn() },
    payment: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
  };
}

describe('PaymentsService', () => {
  let prisma: any;
  let svc: PaymentsService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    svc = new PaymentsService(prisma);
  });

  it('rejects creating a payment for a student outside the organization (tenant isolation)', async () => {
    prisma.student.findFirst.mockResolvedValue(null);
    await expect(
      svc.create('org-1', { studentId: 's-other', amount: 100 }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it('normalizes an empty reference to null', async () => {
    prisma.student.findFirst.mockResolvedValue({ id: 's1' });
    prisma.payment.create.mockResolvedValue({ id: 'p1' });
    await svc.create('org-1', { studentId: 's1', amount: 100, reference: '' });
    const data = prisma.payment.create.mock.calls[0][0].data;
    expect(data.reference).toBeNull();
  });

  it('rejects a duplicate payment reference within the same org (P2002 → 400)', async () => {
    prisma.student.findFirst.mockResolvedValue({ id: 's1' });
    prisma.payment.create.mockRejectedValue({ code: 'P2002' });
    await expect(
      svc.create('org-1', { studentId: 's1', amount: 100, reference: 'INV-001' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rethrows non-unique DB errors', async () => {
    prisma.student.findFirst.mockResolvedValue({ id: 's1' });
    prisma.payment.create.mockRejectedValue(new Error('db down'));
    await expect(
      svc.create('org-1', { studentId: 's1', amount: 100 }),
    ).rejects.toThrow('db down');
  });

  it('rejects updating a payment to a reference that already exists (P2002 → 400)', async () => {
    prisma.payment.findFirst.mockResolvedValue({ id: 'p1', organizationId: 'org-1' });
    prisma.payment.update.mockRejectedValue({ code: 'P2002' });
    await expect(
      svc.update('org-1', 'p1', { reference: 'INV-002' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('PaymentsService status transitions', () => {
  let prisma: any;
  let svc: PaymentsService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    svc = new PaymentsService(prisma);
  });

  it('rejects CANCELLED → PAID (terminal state resurrection)', async () => {
    prisma.payment.findFirst.mockResolvedValue({ id: 'p1', organizationId: 'org-1', status: 'CANCELLED' });
    await expect(
      svc.update('org-1', 'p1', { status: 'PAID' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.payment.update).not.toHaveBeenCalled();
  });

  it('rejects PAID → PENDING (paid invoice cannot flip back)', async () => {
    prisma.payment.findFirst.mockResolvedValue({ id: 'p1', organizationId: 'org-1', status: 'PAID' });
    await expect(
      svc.update('org-1', 'p1', { status: 'PENDING' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows PENDING → PAID', async () => {
    prisma.payment.findFirst.mockResolvedValue({ id: 'p1', organizationId: 'org-1', status: 'PENDING' });
    prisma.payment.update.mockResolvedValue({ id: 'p1', status: 'PAID' });
    const result = await svc.update('org-1', 'p1', { status: 'PAID' });
    expect(prisma.payment.update).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it('allows OVERDUE → CANCELLED', async () => {
    prisma.payment.findFirst.mockResolvedValue({ id: 'p1', organizationId: 'org-1', status: 'OVERDUE' });
    prisma.payment.update.mockResolvedValue({ id: 'p1', status: 'CANCELLED' });
    const result = await svc.update('org-1', 'p1', { status: 'CANCELLED' });
    expect(prisma.payment.update).toHaveBeenCalled();
    expect(result).toBeDefined();
  });
});
