import { describe, it, expect, vi, beforeEach } from 'vitest';

function createMockPrisma() {
  const studentGroup = { findUnique: vi.fn(), count: vi.fn(), upsert: vi.fn() };
  const obj: any = { studentGroup, group: { findFirst: vi.fn() }, student: { findFirst: vi.fn() } };
  obj.$transaction = vi.fn((fn: any) => fn(obj));
  return obj;
}

describe('findUnique mock behavior', () => {
  let prisma: any;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    prisma.$transaction.mockImplementation((fn: any) => fn(prisma));
  });

  it('findUnique should return mockResolvedValue set in test body', async () => {
    // Set AFTER beforeEach
    prisma.studentGroup.findUnique.mockResolvedValue({ studentId: 's1', groupId: 'g1', isActive: false });
    prisma.studentGroup.count.mockResolvedValue(20);

    // Test inside transaction
    let result: any;
    await prisma.$transaction(async (tx) => {
      const m = await tx.studentGroup.findUnique({ where: { studentId_groupId: { studentId: 's1', groupId: 'g1' } } });
      const cnt = await tx.studentGroup.count({ where: { groupId: 'g1', isActive: true } });
      result = { m, cnt };
    });

    console.log('Result:', JSON.stringify(result));
    expect(result.m).not.toBeNull();
    expect(result.m.isActive).toBe(false);
  });
});
