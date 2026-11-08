import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, NotFoundException, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { RolesGuard } from '../roles.guard';
import { ROLES_KEY } from '../roles.decorator';
import { ADMIN_ROLES, TEACHING_ROLES, FAMILY_ROLES } from '../authorization.policy';
import { GroupsService } from '../../groups/groups.service';
import { StudentsService } from '../../students/students.service';
import { AttendanceService } from '../../attendance/attendance.service';
import { GradesService } from '../../grades/grades.service';
import { HomeworkService } from '../../homework/homework.service';

describe('Security RBAC & Object-Level Authorization Regression Suite', () => {
  describe('1. Endpoint-Level RBAC Gating on Financial & Admin Surfaces', () => {
    let guard: RolesGuard;
    let reflector: { getAllAndOverride: ReturnType<typeof vi.fn> };

    beforeEach(() => {
      reflector = { getAllAndOverride: vi.fn() };
      guard = new RolesGuard(reflector as unknown as Reflector);
    });

    function makeContext(user?: unknown): ExecutionContext {
      return {
        getHandler: () => () => {},
        getClass: () => class {},
        switchToHttp: () => ({
          getRequest: () => ({ user }),
        }),
      } as unknown as ExecutionContext;
    }

    it('denies TEACHER, STUDENT, and PARENT on ADMIN_ROLES endpoints (expenses, payments, billing)', () => {
      reflector.getAllAndOverride.mockImplementation((key: string) => {
        if (key === ROLES_KEY) return ADMIN_ROLES;
        return undefined;
      });

      // Allowed administrative roles
      for (const role of ADMIN_ROLES) {
        expect(guard.canActivate(makeContext({ role }))).toBe(true);
      }

      // Denied non-admin roles
      const forbiddenRoles = [...TEACHING_ROLES, ...FAMILY_ROLES];
      for (const role of forbiddenRoles) {
        expect(guard.canActivate(makeContext({ role }))).toBe(false);
      }
    });
  });

  describe('2. GroupsService Object-Level Authorization (IDOR Defense)', () => {
    let prismaMock: any;
    let service: GroupsService;

    const orgId = 'org-1111';
    const teacherUserId = 'user-teacher-1';
    const teacherRecordId = 'teacher-rec-1';
    const otherTeacherRecordId = 'teacher-rec-2';

    beforeEach(() => {
      prismaMock = {
        teacher: {
          findFirst: vi.fn().mockImplementation(({ where }) => {
            if (where.userId === teacherUserId && where.organizationId === orgId) {
              return Promise.resolve({ id: teacherRecordId });
            }
            return Promise.resolve(null);
          }),
        },
        group: {
          findMany: vi.fn().mockResolvedValue([]),
          count: vi.fn().mockResolvedValue(0),
          findFirst: vi.fn(),
        },
      };
      service = new GroupsService(prismaMock);
    });

    it('scopes findAll to teacherId when caller is a TEACHER', async () => {
      await service.findAll(orgId, {} as any, { id: teacherUserId, role: 'TEACHER' });

      expect(prismaMock.teacher.findFirst).toHaveBeenCalledWith({
        where: { userId: teacherUserId, organizationId: orgId },
        select: { id: true },
      });
      expect(prismaMock.group.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: orgId,
            teacherId: teacherRecordId,
          }),
        }),
      );
    });

    it('allows an ADMIN to list all groups across the organization without teacherId scoping', async () => {
      await service.findAll(orgId, {} as any, { id: 'admin-user', role: 'ORG_ADMIN' });

      expect(prismaMock.teacher.findFirst).not.toHaveBeenCalled();
      expect(prismaMock.group.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: orgId },
        }),
      );
    });

    it('allows a TEACHER to view their own group via findOne', async () => {
      prismaMock.group.findFirst.mockResolvedValue({
        id: 'group-mine',
        organizationId: orgId,
        teacherId: teacherRecordId,
      });

      const res = await service.findOne(orgId, 'group-mine', { id: teacherUserId, role: 'TEACHER' });
      expect(res).toBeDefined();
      expect(res.id).toBe('group-mine');
    });

    it('rejects a TEACHER attempting to view another teacher group (IDOR attempt) with ForbiddenException', async () => {
      prismaMock.group.findFirst.mockResolvedValue({
        id: 'group-other',
        organizationId: orgId,
        teacherId: otherTeacherRecordId,
      });

      await expect(
        service.findOne(orgId, 'group-other', { id: teacherUserId, role: 'TEACHER' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows an ADMIN to view any group within the organization', async () => {
      prismaMock.group.findFirst.mockResolvedValue({
        id: 'group-other',
        organizationId: orgId,
        teacherId: otherTeacherRecordId,
      });

      const res = await service.findOne(orgId, 'group-other', { id: 'admin-user', role: 'ORG_ADMIN' });
      expect(res).toBeDefined();
      expect(res.id).toBe('group-other');
    });

    it('scopes findAll to enrolled groups when caller is a STUDENT', async () => {
      const studentUserId = 'user-student-1';
      await service.findAll(orgId, {} as any, { id: studentUserId, role: 'STUDENT' });

      expect(prismaMock.group.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: orgId,
            enrollments: {
              some: {
                isActive: true,
                organizationId: orgId,
                student: { userId: studentUserId },
              },
            },
          }),
        }),
      );
    });

    it('rejects a STUDENT attempting to view a group they are not enrolled in', async () => {
      prismaMock.group.findFirst.mockResolvedValue({
        id: 'group-not-enrolled',
        organizationId: orgId,
        enrollments: [{ student: { userId: 'other-student' } }],
      });

      await expect(
        service.findOne(orgId, 'group-not-enrolled', { id: 'student-me', role: 'STUDENT' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects a PARENT attempting to view a group their children are not in', async () => {
      prismaMock.group.findFirst.mockResolvedValue({
        id: 'group-no-child',
        organizationId: orgId,
        enrollments: [{ student: { parentStudents: [{ parentId: 'parent-other' }] } }],
      });

      await expect(
        service.findOne(orgId, 'group-no-child', { id: 'parent-me', role: 'PARENT' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('3. StudentsService Object-Level Authorization (IDOR Defense)', () => {
    let prismaMock: any;
    let service: StudentsService;

    const orgId = 'org-1111';
    const teacherUserId = 'user-teacher-1';
    const teacherRecordId = 'teacher-rec-1';
    const otherTeacherRecordId = 'teacher-rec-2';

    beforeEach(() => {
      prismaMock = {
        teacher: {
          findFirst: vi.fn().mockImplementation(({ where }) => {
            if (where.userId === teacherUserId && where.organizationId === orgId) {
              return Promise.resolve({ id: teacherRecordId });
            }
            return Promise.resolve(null);
          }),
        },
        student: {
          findMany: vi.fn().mockResolvedValue([]),
          count: vi.fn().mockResolvedValue(0),
          findFirst: vi.fn(),
        },
      };
      service = new StudentsService(prismaMock);
    });

    it('scopes findAll to students enrolled in groups taught by the teacher', async () => {
      await service.findAll(orgId, {} as any, { id: teacherUserId, role: 'TEACHER' });

      expect(prismaMock.student.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: orgId,
            groups: {
              some: {
                isActive: true,
                organizationId: orgId,
                group: { teacherId: teacherRecordId },
              },
            },
          }),
        }),
      );
    });

    it('allows a TEACHER to view a student enrolled in their group', async () => {
      prismaMock.student.findFirst.mockResolvedValue({
        id: 'student-enrolled',
        organizationId: orgId,
        groups: [{ group: { id: 'g-1', teacherId: teacherRecordId } }],
      });

      const res = await service.findOne(orgId, 'student-enrolled', { id: teacherUserId, role: 'TEACHER' });
      expect(res).toBeDefined();
      expect(res.id).toBe('student-enrolled');
    });

    it('rejects a TEACHER attempting to view a student from another teacher group with ForbiddenException', async () => {
      prismaMock.student.findFirst.mockResolvedValue({
        id: 'student-foreign',
        organizationId: orgId,
        groups: [{ group: { id: 'g-2', teacherId: otherTeacherRecordId } }],
      });

      await expect(
        service.findOne(orgId, 'student-foreign', { id: teacherUserId, role: 'TEACHER' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows an ADMIN to view any student within the organization', async () => {
      prismaMock.student.findFirst.mockResolvedValue({
        id: 'student-foreign',
        organizationId: orgId,
        groups: [{ group: { id: 'g-2', teacherId: otherTeacherRecordId } }],
      });

      const res = await service.findOne(orgId, 'student-foreign', { id: 'admin-user', role: 'ORG_ADMIN' });
      expect(res).toBeDefined();
      expect(res.id).toBe('student-foreign');
    });

    it('scopes findAll to self when caller is a STUDENT', async () => {
      const studentUserId = 'user-student-1';
      await service.findAll(orgId, {} as any, { id: studentUserId, role: 'STUDENT' });

      expect(prismaMock.student.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: orgId,
            userId: studentUserId,
          }),
        }),
      );
    });

    it('rejects a STUDENT attempting to view another student profile (IDOR defense)', async () => {
      prismaMock.student.findFirst.mockResolvedValue({
        id: 'student-other',
        userId: 'other-user-uuid',
        organizationId: orgId,
      });

      await expect(
        service.findOne(orgId, 'student-other', { id: 'student-me-uuid', role: 'STUDENT' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects a PARENT attempting to view another parent child profile (IDOR defense)', async () => {
      prismaMock.student.findFirst.mockResolvedValue({
        id: 'student-other-child',
        organizationId: orgId,
        parentStudents: [{ parentId: 'parent-other-uuid' }],
      });

      await expect(
        service.findOne(orgId, 'student-other-child', { id: 'parent-me-uuid', role: 'PARENT' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException for cross-tenant student queries (Multi-tenant isolation)', async () => {
      // Student exists in another tenant (org-2222)
      prismaMock.student.findFirst
        .mockResolvedValueOnce(null) // first query with organizationId: org-1111
        .mockResolvedValueOnce({ id: 'student-org2', organizationId: 'org-2222' }); // second existence check

      await expect(
        service.findOne(orgId, 'student-org2', { id: 'admin-user', role: 'ORG_ADMIN' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('4. AttendanceService Object-Level Authorization (IDOR Defense)', () => {
    let prismaMock: any;
    let service: AttendanceService;

    const orgId = 'org-1111';
    const teacherUserId = 'user-teacher-1';
    const teacherRecordId = 'teacher-rec-1';
    const otherTeacherRecordId = 'teacher-rec-2';

    beforeEach(() => {
      prismaMock = {
        teacher: {
          findFirst: vi.fn().mockImplementation(({ where }) => {
            if (where.userId === teacherUserId && where.organizationId === orgId) {
              return Promise.resolve({ id: teacherRecordId });
            }
            return Promise.resolve(null);
          }),
        },
        group: {
          findFirst: vi.fn(),
        },
        attendance: {
          findMany: vi.fn().mockResolvedValue([]),
          count: vi.fn().mockResolvedValue(0),
        },
      };
      service = new AttendanceService(prismaMock);
    });

    it('rejects a TEACHER attempting to mark attendance for another teacher group (IDOR defense)', async () => {
      prismaMock.group.findFirst.mockResolvedValue({
        id: 'group-other',
        organizationId: orgId,
        teacherId: otherTeacherRecordId,
        isActive: true,
      });

      await expect(
        service.markAttendance(
          orgId,
          { groupId: 'group-other', date: '2026-09-15', records: [] } as any,
          { id: teacherUserId, role: 'TEACHER' } as any,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('5. GradesService Object-Level Authorization (IDOR Defense)', () => {
    let prismaMock: any;
    let service: GradesService;

    const orgId = 'org-1111';
    const teacherUserId = 'user-teacher-1';
    const teacherRecordId = 'teacher-rec-1';
    const otherTeacherRecordId = 'teacher-rec-2';

    beforeEach(() => {
      prismaMock = {
        teacher: {
          findFirst: vi.fn().mockImplementation(({ where }) => {
            if (where.userId === teacherUserId && where.organizationId === orgId) {
              return Promise.resolve({ id: teacherRecordId });
            }
            return Promise.resolve(null);
          }),
        },
        group: {
          findFirst: vi.fn(),
        },
        student: {
          findFirst: vi.fn(),
        },
        grade: {
          findFirst: vi.fn(),
          findMany: vi.fn().mockResolvedValue([]),
          count: vi.fn().mockResolvedValue(0),
          create: vi.fn(),
        },
        studentGroup: {
          findFirst: vi.fn(),
        },
      };
      service = new GradesService(prismaMock);
    });

    it('rejects a TEACHER attempting to grade a student in another teacher group with ForbiddenException', async () => {
      prismaMock.student.findFirst.mockResolvedValue({ id: 's-1', organizationId: orgId });
      prismaMock.group.findFirst.mockResolvedValue({ id: 'g-other', organizationId: orgId, teacherId: otherTeacherRecordId });

      await expect(
        service.create(
          orgId,
          { studentId: 's-1', groupId: 'g-other', value: 90 } as any,
          { id: teacherUserId, role: 'TEACHER' } as any,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects a STUDENT attempting to view another student grade with ForbiddenException', async () => {
      prismaMock.grade.findFirst.mockResolvedValue({
        id: 'grade-other',
        organizationId: orgId,
        student: { userId: 'other-student-id' },
        group: { id: 'g-1' },
      });

      await expect(
        service.findOne(orgId, 'grade-other', { id: 'student-me-id', role: 'STUDENT' } as any),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('6. HomeworkService Object-Level Authorization (IDOR Defense)', () => {
    let prismaMock: any;
    let service: HomeworkService;

    const orgId = 'org-1111';
    const teacherUserId = 'user-teacher-1';
    const teacherRecordId = 'teacher-rec-1';
    const otherTeacherRecordId = 'teacher-rec-2';

    beforeEach(() => {
      prismaMock = {
        teacher: {
          findFirst: vi.fn().mockImplementation(({ where }) => {
            if (where.userId === teacherUserId && where.organizationId === orgId) {
              return Promise.resolve({ id: teacherRecordId });
            }
            return Promise.resolve(null);
          }),
        },
        group: {
          findFirst: vi.fn(),
        },
        homework: {
          findFirst: vi.fn(),
          findMany: vi.fn().mockResolvedValue([]),
          count: vi.fn().mockResolvedValue(0),
          create: vi.fn(),
          update: vi.fn(),
          updateMany: vi.fn(),
        },
      };
      service = new HomeworkService(prismaMock);
    });

    it('rejects a TEACHER attempting to create homework for another teacher group with ForbiddenException', async () => {
      prismaMock.group.findFirst.mockResolvedValue({
        id: 'group-other',
        organizationId: orgId,
        teacherId: otherTeacherRecordId,
      });

      await expect(
        service.create(
          orgId,
          { groupId: 'group-other', title: 'HW 1' } as any,
          { id: teacherUserId, role: 'TEACHER' } as any,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(prismaMock.homework.create).not.toHaveBeenCalled();
    });

    it('rejects a TEACHER attempting to update homework belonging to another teacher group', async () => {
      prismaMock.homework.findFirst.mockResolvedValue({
        id: 'hw-other',
        organizationId: orgId,
        groupId: 'group-other',
        group: { id: 'group-other', teacherId: otherTeacherRecordId },
      });

      await expect(
        service.update(
          orgId,
          'hw-other',
          { title: 'New Title' } as any,
          { id: teacherUserId, role: 'TEACHER' } as any,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects a STUDENT attempting to view homework for a group they are not enrolled in', async () => {
      prismaMock.homework.findFirst.mockResolvedValue({
        id: 'hw-other',
        organizationId: orgId,
        groupId: 'group-other',
        group: {
          id: 'group-other',
          enrollments: [
            { isActive: true, student: { userId: 'someone-else' } },
          ],
        },
      });

      await expect(
        service.findOne(orgId, 'hw-other', { id: 'student-me-id', role: 'STUDENT' } as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects a PARENT attempting to view homework for a group where their child is not enrolled', async () => {
      prismaMock.homework.findFirst.mockResolvedValue({
        id: 'hw-other',
        organizationId: orgId,
        groupId: 'group-other',
        group: {
          id: 'group-other',
          enrollments: [
            {
              isActive: true,
              student: {
                userId: 'someone-else',
                parentStudents: [{ parentId: 'other-parent-id' }],
              },
            },
          ],
        },
      });

      await expect(
        service.findOne(orgId, 'hw-other', { id: 'parent-me-id', role: 'PARENT' } as any),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
