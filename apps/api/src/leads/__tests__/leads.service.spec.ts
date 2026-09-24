import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LeadsService } from '../leads.service';
import { PrismaService } from '../../prisma/prisma.service';

function createMockPrisma() {
  return {
    lead: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    user: { findFirst: vi.fn() },
    student: { create: vi.fn() },
    leadActivity: { deleteMany: vi.fn(), create: vi.fn() },
    followUp: { deleteMany: vi.fn() },
    $transaction: vi.fn(),
  };
}

describe('LeadsService cross-tenant owner guard', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let svc: LeadsService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    svc = new LeadsService(prisma as unknown as PrismaService);
  });

  it('rejects creating a lead owned by a user from another organization', async () => {
    prisma.user.findFirst.mockResolvedValue(null); // owner not in this org
    await expect(
      svc.create('org-1', { firstName: 'A', ownerId: 'user-other-org' }),
    ).rejects.toThrow('Owner user not found in this organization');
    expect(prisma.lead.create).not.toHaveBeenCalled();
  });

  it('allows creating a lead owned by a user in the same organization', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
    prisma.lead.create.mockResolvedValue({ id: 'lead-1' });
    const result = await svc.create('org-1', { firstName: 'A', ownerId: 'user-1' });
    expect(prisma.lead.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ ownerId: 'user-1' }) }),
    );
    expect(result).toBeDefined();
  });

  it('rejects re-assigning a lead to another org owner on update', async () => {
    prisma.lead.findFirst.mockResolvedValue({ id: 'lead-1', organizationId: 'org-1' });
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(
      svc.update('org-1', 'lead-1', { ownerId: 'user-other-org' }),
    ).rejects.toThrow('Owner user not found in this organization');
    expect(prisma.lead.update).not.toHaveBeenCalled();
  });
});

describe('LeadsService delete integrity', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let svc: LeadsService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    svc = new LeadsService(prisma as unknown as PrismaService);
  });

  it('deletes activities + follow-ups before the lead (no P2003 500)', async () => {
    prisma.lead.findFirst.mockResolvedValue({ id: 'lead-1', organizationId: 'org-1' });
    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        leadActivity: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
        followUp: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
        lead: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      };
      return fn(tx);
    });

    const result = await svc.remove('org-1', 'lead-1');
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(result).toEqual({ id: 'lead-1', organizationId: 'org-1' });
  });

  it('rejects removing a lead from another org (404)', async () => {
    prisma.lead.findFirst.mockResolvedValue(null);
    await expect(svc.remove('org-1', 'lead-other-org')).rejects.toThrow('Lead not found');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('LeadsService terminal WON stage protection', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let svc: LeadsService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    svc = new LeadsService(prisma as unknown as PrismaService);
  });

  it('rejects moving a converted (WON) lead back to an earlier stage', async () => {
    prisma.lead.findFirst.mockResolvedValue({ id: 'lead-1', organizationId: 'org-1', stage: 'WON' });
    await expect(
      svc.updateStage('org-1', 'lead-1', 'NEW'),
    ).rejects.toThrow('converted (WON) lead cannot move back');
    expect(prisma.lead.updateMany).not.toHaveBeenCalled();
  });

  it('allows updating a WON lead to WON (idempotent no-op is harmless)', async () => {
    prisma.lead.findFirst.mockResolvedValue({ id: 'lead-1', organizationId: 'org-1', stage: 'WON' });
    prisma.lead.updateMany.mockResolvedValue({ count: 1 });
    const result = await svc.updateStage('org-1', 'lead-1', 'WON');
    expect(prisma.lead.updateMany).toHaveBeenCalled();
    expect(result.stage).toBe('WON');
  });

  it('still allows non-terminal transitions (e.g. NEW → TRIAL_LESSON)', async () => {
    prisma.lead.findFirst
      .mockResolvedValueOnce({ id: 'lead-1', organizationId: 'org-1', stage: 'NEW' })
      .mockResolvedValueOnce({ id: 'lead-1', organizationId: 'org-1', stage: 'TRIAL_LESSON' });
    prisma.lead.updateMany.mockResolvedValue({ count: 1 });
    const result = await svc.updateStage('org-1', 'lead-1', 'TRIAL_LESSON');
    expect(result.stage).toBe('TRIAL_LESSON');
  });
});
