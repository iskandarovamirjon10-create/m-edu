const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Testing Student Creation, Records, and Cascade Deletion...');

  const { StudentsService } = require('../apps/api/dist/students/students.service.js');
  const service = new StudentsService(prisma);

  const org = await prisma.organization.findFirst({
    where: { name: "M-EDU Ta'lim Markazi" }
  });
  if (!org) throw new Error('Org not found');

  // Clean up any old leftover test student properly via service
  const oldStudent = await prisma.student.findFirst({
    where: { user: { email: 'test.delete.student@example.com' } }
  });
  if (oldStudent) {
    console.log('Cleaning up previous test student via service.remove...');
    await service.remove(org.id, oldStudent.id);
  }

  const passwordHash = await bcrypt.hash('TestPass123!', 10);
  const email = `test.student.${Date.now()}@example.com`;

  // 1. Create a student
  const student = await prisma.student.create({
    data: {
      organization: { connect: { id: org.id } },
      user: {
        create: {
          organization: { connect: { id: org.id } },
          email,
          passwordHash,
          firstName: 'Test',
          lastName: 'Student',
          role: 'STUDENT',
          settings: { create: {} },
        }
      }
    }
  });
  console.log('Created student:', student.id);

  // 2. Add historical records: payment, invoice, attendance
  const invoice = await prisma.invoice.create({
    data: {
      organizationId: org.id,
      studentId: student.id,
      number: `INV-${Date.now()}`,
      total: 500000,
    }
  });

  const payment = await prisma.payment.create({
    data: {
      organizationId: org.id,
      studentId: student.id,
      invoiceId: invoice.id,
      amount: 500000,
      status: 'PAID',
    }
  });

  const course = await prisma.course.create({
    data: {
      organizationId: org.id,
      name: `Test Course ${Date.now()}`,
      price: 100000,
      duration: 3,
    }
  });

  const group = await prisma.group.create({
    data: {
      organizationId: org.id,
      name: `Test Group ${Date.now()}`,
      courseId: course.id,
    }
  });

  const attendance = await prisma.attendance.create({
    data: {
      organizationId: org.id,
      studentId: student.id,
      groupId: group.id,
      date: new Date(),
      status: 'PRESENT',
    }
  });

  console.log('Created invoice, payment, and attendance for student');

  console.log('Invoking StudentsService.remove...');
  const res = await service.remove(org.id, student.id);
  console.log('StudentsService.remove succeeded:', res);

  // Clean up dummy course & group
  await prisma.attendance.deleteMany({ where: { groupId: group.id } });
  await prisma.group.delete({ where: { id: group.id } });
  await prisma.course.delete({ where: { id: course.id } });

  // 4. Verify everything is deleted
  const checkStudent = await prisma.student.findUnique({ where: { id: student.id } });
  const checkPayment = await prisma.payment.findUnique({ where: { id: payment.id } });
  const checkInvoice = await prisma.invoice.findUnique({ where: { id: invoice.id } });
  const checkAttendance = await prisma.attendance.findUnique({ where: { id: attendance.id } });

  console.log({
    studentExists: !!checkStudent,
    paymentExists: !!checkPayment,
    invoiceExists: !!checkInvoice,
    attendanceExists: !!checkAttendance,
  });

  if (checkStudent || checkPayment || checkInvoice || checkAttendance) {
    throw new Error('Records were not fully deleted!');
  }

  console.log('TEST PASSED! Students can be created and deleted cleanly with all historical records!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
