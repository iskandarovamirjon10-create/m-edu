const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('--- Cleaning Demo / Fake Data from Database ---');

  const demoOrg = await prisma.organization.findFirst({
    where: { name: { in: ['Demo Education Center', 'Demo', 'Demo Education'] } },
  });

  if (!demoOrg) {
    console.log('No organization named "Demo Education Center" found. Checking all organizations...');
  }

  const orgId = demoOrg ? demoOrg.id : (await prisma.organization.findFirst())?.id;
  if (!orgId) {
    console.log('No organizations found at all.');
    return;
  }

  console.log('Targeting organization ID:', orgId);

  // 1. Delete financial demo records
  console.log('Deleting refunds, payment transactions, payments, invoices...');
  await prisma.refund.deleteMany({ where: { organizationId: orgId } });
  await prisma.paymentTransaction.deleteMany({});
  await prisma.payment.deleteMany({ where: { organizationId: orgId } });
  await prisma.invoiceItem.deleteMany({});
  await prisma.invoice.deleteMany({ where: { organizationId: orgId } });

  // 2. Delete academic & student records
  console.log('Deleting academic & student records...');
  await prisma.attendance.deleteMany({ where: { organizationId: orgId } });
  await prisma.grade.deleteMany({ where: { organizationId: orgId } });
  await prisma.examResult.deleteMany({ where: { organizationId: orgId } });
  await prisma.certificate.deleteMany({ where: { organizationId: orgId } });
  await prisma.libraryBorrow.deleteMany({ where: { organizationId: orgId } });
  await prisma.homeworkSubmission.deleteMany({});
  await prisma.assignmentSubmission.deleteMany({});
  await prisma.quizAttemptAnswer.deleteMany({});
  await prisma.quizAttempt.deleteMany({ where: { organizationId: orgId } });
  await prisma.studentObjectiveMastery.deleteMany({ where: { organizationId: orgId } });
  await prisma.studentProgressSnapshot.deleteMany({ where: { organizationId: orgId } });
  await prisma.gamificationXpEvent.deleteMany({ where: { organizationId: orgId } });
  await prisma.studentGamification.deleteMany({ where: { organizationId: orgId } });
  await prisma.discount.deleteMany({ where: { organizationId: orgId } });

  // 3. Biometric data
  console.log('Deleting biometric records...');
  await prisma.cameraAttendanceEvent.deleteMany({ where: { organizationId: orgId } });
  await prisma.recognitionAttempt.deleteMany({ where: { organizationId: orgId } });
  await prisma.faceTemplate.deleteMany({ where: { organizationId: orgId } });
  await prisma.faceEnrollment.deleteMany({ where: { organizationId: orgId } });

  // 4. Student group memberships & Parent relations
  console.log('Deleting group memberships and parent associations...');
  await prisma.studentGroup.deleteMany({ where: { organizationId: orgId } });
  await prisma.parentStudent.deleteMany({});
  await prisma.parentTeacherMessage.deleteMany({ where: { organizationId: orgId } });

  // 5. Delete students and student users
  console.log('Deleting students...');
  const students = await prisma.student.findMany({
    where: { organizationId: orgId },
    select: { id: true, userId: true },
  });
  await prisma.student.deleteMany({ where: { organizationId: orgId } });
  const studentUserIds = students.map((s) => s.userId).filter(Boolean);
  if (studentUserIds.length > 0) {
    await prisma.notification.deleteMany({ where: { userId: { in: studentUserIds } } });
    await prisma.session.deleteMany({ where: { userId: { in: studentUserIds } } });
    await prisma.userSettings.deleteMany({ where: { userId: { in: studentUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: studentUserIds } } });
  }

  // 6. Delete groups and schedules
  console.log('Deleting groups and schedules...');
  await prisma.schedule.deleteMany({});
  await prisma.lesson.deleteMany({});
  await prisma.group.deleteMany({ where: { organizationId: orgId } });

  // 7. Delete courses
  console.log('Deleting courses...');
  await prisma.course.deleteMany({ where: { organizationId: orgId } });

  // 8. Delete teachers and teacher users
  console.log('Deleting teachers...');
  const teachers = await prisma.teacher.findMany({
    where: { organizationId: orgId },
    select: { id: true, userId: true },
  });
  await prisma.payrollRun.deleteMany({ where: { organizationId: orgId } });
  await prisma.teacher.deleteMany({ where: { organizationId: orgId } });
  const teacherUserIds = teachers.map((t) => t.userId).filter(Boolean);
  if (teacherUserIds.length > 0) {
    await prisma.notification.deleteMany({ where: { userId: { in: teacherUserIds } } });
    await prisma.session.deleteMany({ where: { userId: { in: teacherUserIds } } });
    await prisma.userSettings.deleteMany({ where: { userId: { in: teacherUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: teacherUserIds } } });
  }

  // 9. Delete leads and CRM followups
  console.log('Deleting leads and followups...');
  await prisma.followUp.deleteMany({ where: { organizationId: orgId } });
  await prisma.lead.deleteMany({ where: { organizationId: orgId } });

  // 10. Delete demo admin user (keep only main admin)
  console.log('Removing demo admin user demo@medu.test...');
  const demoAdmin = await prisma.user.findFirst({
    where: { email: 'demo@medu.test' },
  });
  if (demoAdmin) {
    await prisma.notification.deleteMany({ where: { userId: demoAdmin.id } });
    await prisma.session.deleteMany({ where: { userId: demoAdmin.id } });
    await prisma.userSettings.deleteMany({ where: { userId: demoAdmin.id } });
    await prisma.user.delete({ where: { id: demoAdmin.id } });
  }

  // 11. Rename Organization to a clean, professional name
  console.log('Renaming organization to M-EDU Ta\'lim Markazi...');
  await prisma.organization.update({
    where: { id: orgId },
    data: {
      name: 'M-EDU Ta\'lim Markazi',
      phone: '+998 71 200 00 00',
    },
  });

  // 12. Ensure clean primary admin exists with known password
  const adminPasswordHash = await bcrypt.hash('Password123!', 10);
  const adminUser = await prisma.user.findFirst({
    where: { email: 'admin@medu.test' },
  });
  if (adminUser) {
    await prisma.user.update({
      where: { id: adminUser.id },
      data: {
        firstName: 'Admin',
        lastName: 'M-EDU',
        passwordHash: adminPasswordHash,
        organizationId: orgId,
      },
    });
    console.log('Primary admin updated: admin@medu.test / Password123!');
  } else {
    await prisma.user.create({
      data: {
        organizationId: orgId,
        email: 'admin@medu.test',
        passwordHash: adminPasswordHash,
        firstName: 'Admin',
        lastName: 'M-EDU',
        role: 'ORG_ADMIN',
        settings: { create: {} },
      },
    });
    console.log('Created primary admin: admin@medu.test / Password123!');
  }

  console.log('--- Cleaning Complete! Database is fresh and clean. ---');
}

main()
  .catch((e) => {
    console.error('Clean failed:', e);
  })
  .finally(() => prisma.$disconnect());
