const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const orgs = await prisma.organization.findMany();
  console.log('Organizations:', orgs);

  const userCount = await prisma.user.count();
  const studentCount = await prisma.student.count();
  const teacherCount = await prisma.teacher.count();
  const courseCount = await prisma.course.count();
  const groupCount = await prisma.group.count();
  const paymentCount = await prisma.payment.count();
  const invoiceCount = await prisma.invoice.count();
  const attendanceCount = await prisma.attendance.count();
  const gradeCount = await prisma.grade.count();
  const leadCount = await prisma.lead.count();

  console.log({
    userCount,
    studentCount,
    teacherCount,
    courseCount,
    groupCount,
    paymentCount,
    invoiceCount,
    attendanceCount,
    gradeCount,
    leadCount,
  });

  const users = await prisma.user.findMany({
    select: { id: true, email: true, firstName: true, lastName: true, role: true, organizationId: true }
  });
  console.log('Users in DB:');
  users.forEach(u => console.log(`  ${u.role} | ${u.email} | ${u.firstName} ${u.lastName}`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
