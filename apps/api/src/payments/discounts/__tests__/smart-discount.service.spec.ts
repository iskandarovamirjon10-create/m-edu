import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SmartDiscountService } from '../smart-discount.service';

describe('SmartDiscountService', () => {
  let service: SmartDiscountService;
  let mockPrisma: any;
  let mockAudit: any;

  beforeEach(() => {
    mockPrisma = {
      student: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      discount: {
        updateMany: vi.fn(),
        create: vi.fn(),
      },
    };
    mockAudit = {
      record: vi.fn().mockResolvedValue(undefined),
    };

    service = new SmartDiscountService(mockPrisma, mockAudit);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('detects sibling network by matching parent phone number and applies 2nd child 10% discount', async () => {
    const student1 = {
      id: 'st-child-1',
      organizationId: 'org-1',
      parentPhone: '+998909998877',
      user: { firstName: 'Temur', lastName: 'Rahimov', createdAt: new Date() },
      parentStudents: [],
      groups: [{ id: 'sg-1', group: { name: 'English Beginner' } }],
      grades: [],
    };

    const student2 = {
      id: 'st-child-2',
      organizationId: 'org-1',
      parentPhone: '+998909998877',
      user: { firstName: 'Malika', lastName: 'Rahimova', createdAt: new Date() },
      parentStudents: [],
      groups: [{ id: 'sg-2', group: { name: 'IELTS Prep' } }],
      grades: [],
    };

    mockPrisma.student.findFirst.mockResolvedValue(student2);
    mockPrisma.student.findMany.mockResolvedValue([student1, student2]);

    const evalResult = await service.evaluateDiscounts('org-1', {
      studentId: 'st-child-2',
      tuitionAmount: 1_000_000,
    });

    expect(evalResult.siblingNetwork.siblingCount).toBe(2);
    expect(evalResult.siblingNetwork.birthOrEnrollmentOrder).toBe(2);
    expect(evalResult.appliedDiscounts.some((d) => d.category === 'SIBLING' && d.value === 10)).toBe(true);
    expect(evalResult.netPayableUz).toBe(900_000);
  });

  it('evaluates merit scholarship when student has high average grade (>=90%)', async () => {
    const student = {
      id: 'st-genius-1',
      organizationId: 'org-1',
      parentPhone: null,
      user: { firstName: 'Shoxruh', lastName: 'Yusupov', createdAt: new Date() },
      parentStudents: [],
      groups: [{ id: 'sg-1', group: { name: 'Math Olympiad' } }],
      grades: [{ value: 95 }, { value: 92 }],
    };

    mockPrisma.student.findFirst.mockResolvedValue(student);
    mockPrisma.student.findMany.mockResolvedValue([student]);

    const evalResult = await service.evaluateDiscounts('org-1', {
      studentId: 'st-genius-1',
      tuitionAmount: 1_000_000,
    });

    expect(evalResult.appliedDiscounts.some((d) => d.category === 'MERIT' && d.value === 15)).toBe(true);
    expect(evalResult.totalDeductionUz).toBe(150_000);
    expect(evalResult.netPayableUz).toBe(850_000);
  });
});
