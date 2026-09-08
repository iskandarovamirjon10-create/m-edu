import { describe, it, expect, vi, beforeEach } from 'vitest';

function createMockPrisma() {
  const studentGroup = { findUnique: vi.fn(), count: vi.fn(), upsert: vi.fn() };
  const obj: any = { studentGroup, group: { findFirst: vi.fn() }, student: { findFirst: vi.fn() } };
  obj.$transaction = vi.fn((fn: any) => fn(obj));
  return obj;
}

describe('clearAllMocks behavior', () => {
  let prisma: any;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    // Re-set mockImpl after clearAllMocks
    prisma.$transaction.mockImplementation((fn: any) => fn(prisma));
  });

  it('mock is reset', async () => {
    prisma.studentGroup.findUnique.mockResolvedValue({ isActive: false });
    prisma.studentGroup.count.mockResolvedValue(20);
    await prisma.$transaction(async (tx) => {
      const m = await tx.studentGroup.findUnique();
      console.log('m.isActive:', m?.isActive);
      return m;
    });
    expect(prisma.studentGroup.findUnique).toHaveBeenCalled();
  });
});
