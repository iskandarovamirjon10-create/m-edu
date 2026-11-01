import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StudentRetentionService } from '../student-retention.service';

describe('StudentRetentionService', () => {
  let service: StudentRetentionService;
  let mockPrisma: any;
  let mockAudit: any;

  beforeEach(() => {
    mockPrisma = {
      student: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
      },
    };
    mockAudit = {
      record: vi.fn().mockResolvedValue(undefined),
    };

    service = new StudentRetentionService(mockPrisma, mockAudit);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('evaluates student churn risk correctly with high attendance drop and overdue invoices', async () => {
    const mockStudent = {
      id: 'student-risk-1',
      organizationId: 'org-1',
      balance: -100_000,
      notes: '',
      user: { firstName: 'Jasur', lastName: 'Karimov', phone: '+998901234567' },
      groups: [
        {
          group: {
            id: 'g-1',
            name: 'IELTS Intensive',
            course: { price: 800_000 },
          },
        },
      ],
      attendance: [
        { status: 'ABSENT', date: new Date() },
        { status: 'ABSENT', date: new Date() },
        { status: 'ABSENT', date: new Date() },
        { status: 'PRESENT', date: new Date() },
      ],
      grades: [{ value: 45 }],
      Invoice: [
        {
          total: 800_000,
          paidAmount: 0,
          dueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days overdue
        },
      ],
    };

    mockPrisma.student.findMany.mockResolvedValue([mockStudent]);

    const result = await service.getRetentionCockpit('org-1', {});

    expect(result.totalActiveStudents).toBe(1);
    expect(result.students[0].riskScore).toBeGreaterThanOrEqual(75);
    expect(result.students[0].riskTier).toBe('CRITICAL');
    expect(result.criticalRiskCount).toBe(1);
    expect(result.atRiskRevenueMonthlyUz).toBe(800_000);
    expect(result.students[0].primaryRiskFactor).toContain('Davomat');
  });

  it('records an intervention and updates student notes with audit log', async () => {
    mockPrisma.student.findFirst.mockResolvedValue({
      id: 'student-1',
      organizationId: 'org-1',
      notes: 'Initial note',
      user: { firstName: 'Jasur', lastName: 'Karimov' },
    });
    mockPrisma.student.update.mockResolvedValue({});

    const response = await service.recordIntervention('org-1', 'student-1', 'admin-1', {
      type: 'DIRECTOR_CALL',
      notes: 'Spoke with father. Agreed on 2-installment payment plan.',
      followUpDays: 7,
    });

    expect(response.success).toBe(true);
    expect(response.type).toBe('DIRECTOR_CALL');
    expect(mockAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'RETENTION_INTERVENTION',
        resourceId: 'student-1',
      }),
    );
    expect(mockPrisma.student.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'student-1' },
        data: expect.objectContaining({
          notes: expect.stringContaining('Spoke with father'),
        }),
      }),
    );
  });
});
