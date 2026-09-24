import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { StudentsService } from '../students.service';
import { PrismaService } from '../../prisma/prisma.service';

function createMockPrisma() {
  return {
    student: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
    group: { findFirst: vi.fn() },
    studentGroup: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
      upsert: vi.fn(),
      count: vi.fn(),
    },
    payment: { count: vi.fn() },
    attendance: { count: vi.fn() },
    grade: { count: vi.fn() },
    faceEnrollment: { count: vi.fn() },
    recognitionAttempt: { count: vi.fn() },
    cameraAttendanceEvent: { count: vi.fn() },
    notification: { deleteMany: vi.fn() },
    session: { deleteMany: vi.fn() },
    userSettings: { deleteMany: vi.fn() },
    $transaction: vi.fn(),
  };
}

type MockPrisma = ReturnType<typeof createMockPrisma>;

describe('StudentsService findOne and create', () => {
  let prisma: MockPrisma;
  let svc: StudentsService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    svc = new StudentsService(prisma as unknown as PrismaService);
  });

  describe('findOne', () => {
    it('returns student when found within organization', async () => {
      const mockStudent = { id: 's1', organizationId: 'org-1', user: { firstName: 'Ali' } };
      prisma.student.findFirst.mockResolvedValue(mockStudent);

      const result = await svc.findOne('org-1', 's1');
      expect(result).toEqual(mockStudent);
      expect(prisma.student.findFirst).toHaveBeenCalledWith({
        where: { id: 's1', organizationId: 'org-1' },
        include: expect.any(Object),
      });
    });

    it('throws NotFoundException when student does not exist', async () => {
      prisma.student.findFirst.mockResolvedValue(null);

      await expect(svc.findOne('org-1', 'unknown')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('throws BadRequestException if email already registered', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'u1', email: 'test@example.com' });

      await expect(
        svc.create('org-1', {
          firstName: 'Ali',
          lastName: 'Valiyev',
          email: 'test@example.com',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates student with placeholder email when none provided', async () => {
      const createdStudent = { id: 's1', organizationId: 'org-1' };
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.student.create.mockResolvedValue(createdStudent);

      const result = await svc.create('org-1', {
        firstName: 'Ali',
        lastName: 'Valiyev',
      });

      expect(result).toEqual(createdStudent);
      expect(prisma.student.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organization: { connect: { id: 'org-1' } },
            user: expect.objectContaining({
              create: expect.objectContaining({
                email: expect.stringMatching(/^student-.*@placeholder\.local$/),
                firstName: 'Ali',
                lastName: 'Valiyev',
              }),
            }),
          }),
        }),
      );
    });
  });
});
