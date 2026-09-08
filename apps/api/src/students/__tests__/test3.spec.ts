import { describe, it, expect, vi, beforeEach } from 'vitest';

function createMockPrisma() {
  const studentGroup = {
    findUnique: vi.fn(),
    count: vi.fn(),
    upsert: vi.fn(),
  };
  const obj: any = { studentGroup, group: { findFirst: vi.fn() }, student: { findFirst: vi.fn() } };
  obj.$transaction = vi.fn((fn: any) => fn(obj));
  return obj;
}

describe('reactivation test', () => {
  let prisma: any;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    prisma.$transaction.mockImplementation((fn: any) => fn(prisma));
  });

  it('check findUnique inside tx', async () => {
    prisma.group.findFirst.mockResolvedValue({ id: 'g1', organizationId: 'org-1', capacity: 20 });
    prisma.student.findFirst.mockResolvedValue({ id: 's1', organizationId: 'org-1' });
    prisma.studentGroup.count.mockResolvedValue(20);
    prisma.studentGroup.findUnique.mockResolvedValue({ studentId: 's1', groupId: 'g1', isActive: false });

    let found: any;
    await prisma.$transaction(async (tx: any) => {
      const cnt = await tx.studentGroup.count({ where: { groupId: 'g1', isActive: true } });
      const m = await tx.studentGroup.findUnique({ where: { studentId_groupId: { studentId: 's1', groupId: 'g1' } } });
      found = m;
      console.log('inside tx: cnt=' + cnt + ', m=' + JSON.stringify(m));
      return { cnt, m };
    });

    console.log('found outside:', JSON.stringify(found));
    expect(found?.isActive).toBe(false);
  });
});
