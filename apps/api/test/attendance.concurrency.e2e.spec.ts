import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { AttendanceService } from '../src/attendance/attendance.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Attendance Concurrency (Integration)', () => {
  const prisma = new PrismaClient();
  let svc: AttendanceService;

  let orgId: string;
  let groupId: string;
  let studentId: string;
  const testDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  beforeAll(async () => {
    // Setup test fixtures
    const org = await prisma.organization.create({
      data: { name: 'Concurrency Test Org', email: `test-org-${Date.now()}@test.com` },
    });
    orgId = org.id;

    const user = await prisma.user.create({
      data: { organizationId: orgId, email: `student-${Date.now()}@test.com`, firstName: 'Test', lastName: 'Student' },
    });

    const student = await prisma.student.create({
      data: { organizationId: orgId, userId: user.id },
    });
    studentId = student.id;

    const course = await prisma.course.create({
      data: { organizationId: orgId, name: 'Concurrency Course', price: 100000, duration: 30 },
    });

    const group = await prisma.group.create({
      data: { organizationId: orgId, name: 'Concurrency Group', courseId: course.id },
    });
    groupId = group.id;

    await prisma.studentGroup.create({
      data: { organizationId: orgId, studentId, groupId, isActive: true },
    });

    // markAttendance requires a planned Lesson for the group on the target date.
    const testDateUtc = new Date(`${testDate}T00:00:00.000Z`);
    await prisma.lesson.create({
      data: {
        organizationId: orgId,
        groupId,
        date: testDateUtc,
        startTime: '09:00',
        endTime: '10:00',
        status: 'PLANNED',
        updatedAt: new Date(),
      },
    });

    svc = new AttendanceService(prisma as unknown as PrismaService);
  });

  afterAll(async () => {
    // Cleanup
    await prisma.attendance.deleteMany({ where: { organizationId: orgId } });
    await prisma.lesson.deleteMany({ where: { organizationId: orgId } });
    await prisma.studentGroup.deleteMany({ where: { organizationId: orgId } });
    await prisma.group.deleteMany({ where: { id: groupId } });
    await prisma.course.deleteMany({ where: { organizationId: orgId } });
    await prisma.student.deleteMany({ where: { id: studentId } });
    await prisma.user.deleteMany({ where: { organizationId: orgId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.$disconnect();
  });

  it('handles 2 simultaneous requests for the exact same student/group/date safely', async () => {
    // Fire two identical markAttendance operations at exactly the same time.
    // The DB transaction + upsert must prevent P2002 duplicate key errors and surface 1 row.
    const p1 = svc.markAttendance(orgId, {
      groupId,
      date: testDate,
      records: [{ studentId, status: 'PRESENT' }],
    });
    const p2 = svc.markAttendance(orgId, {
      groupId,
      date: testDate,
      records: [{ studentId, status: 'PRESENT' }],
    });

    await Promise.all([p1, p2]);

    const count = await prisma.attendance.count({
      where: { organizationId: orgId, groupId, studentId },
    });
    expect(count).toBe(1);
  });

  it('handles 10 simultaneous requests gracefully', async () => {
    // 10 concurrent requests trying to mark the same student PRESENT or LATE.
    const promises = Array.from({ length: 10 }).map((_, i) =>
      svc.markAttendance(orgId, {
        groupId,
        date: testDate,
        records: [{ studentId, status: i % 2 === 0 ? 'PRESENT' : 'LATE' }],
      })
    );

    await Promise.all(promises);

    const count = await prisma.attendance.count({
      where: { organizationId: orgId, groupId, studentId },
    });
    expect(count).toBe(1); // Still exactly one record.
  });

  it('handles 50 simultaneous requests gracefully (progressive stress test)', async () => {
    const promises = Array.from({ length: 50 }).map((_, i) =>
      svc.markAttendance(orgId, {
        groupId,
        date: testDate,
        records: [{ studentId, status: i % 2 === 0 ? 'PRESENT' : 'ABSENT' }],
      })
    );

    await Promise.all(promises);

    const count = await prisma.attendance.count({
      where: { organizationId: orgId, groupId, studentId },
    });
    expect(count).toBe(1);
  });

  it('handles 100 simultaneous requests under contention without deadlocks or duplicates', async () => {
    const promises = Array.from({ length: 100 }).map((_, i) =>
      svc.markAttendance(orgId, {
        groupId,
        date: testDate,
        records: [{ studentId, status: i % 3 === 0 ? 'PRESENT' : i % 3 === 1 ? 'LATE' : 'EXCUSED' }],
      })
    );

    await Promise.all(promises);

    const count = await prisma.attendance.count({
      where: { organizationId: orgId, groupId, studentId },
    });
    expect(count).toBe(1);
  });
});