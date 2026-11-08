import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seed() {
  console.log('Seeding browser E2E test data...');
  
  // 1. Organization
  let org = await prisma.organization.findFirst({
    where: { email: 'academy@medu.test' },
  });

  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: 'M-EDU Academy',
        email: 'academy@medu.test',
        phone: '+998901234567',
        language: 'en',
        currency: 'UZS',
      },
    });
    console.log('Created organization:', org.id);
  }

  // 2. Admin User
  const passwordHash = await bcrypt.hash('Password123!', 10);
  for (const adminEmail of ['admin@medu.test', 'admin@medu.uz']) {
    let user = await prisma.user.findUnique({
      where: { email: adminEmail },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          organizationId: org.id,
          email: adminEmail,
          passwordHash,
          firstName: 'System',
          lastName: 'Administrator',
          role: 'ORG_ADMIN',
          isActive: true,
        },
      });
      console.log('Created admin user:', user.email);
    } else {
      // Ensure password is up to date
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash, isActive: true },
      });
    }
  }

  // 3. Course
  let course = await prisma.course.findFirst({
    where: { organizationId: org.id, name: 'Advanced Mathematics' },
  });
  if (!course) {
    course = await prisma.course.create({
      data: {
        organizationId: org.id,
        name: 'Advanced Mathematics',
        description: 'Comprehensive algebra and calculus course',
        price: 500000,
        duration: 90,
      },
    });
  }

  // 4. Teacher
  let teacherUser = await prisma.user.findUnique({
    where: { email: 'teacher@medu.test' },
  });
  if (!teacherUser) {
    teacherUser = await prisma.user.create({
      data: {
        organizationId: org.id,
        email: 'teacher@medu.test',
        passwordHash,
        firstName: 'Dilshod',
        lastName: 'Karimov',
        role: 'TEACHER',
        isActive: true,
      },
    });
  }
  let teacher = await prisma.teacher.findFirst({
    where: { organizationId: org.id, userId: teacherUser.id },
  });
  if (!teacher) {
    teacher = await prisma.teacher.create({
      data: {
        organizationId: org.id,
        userId: teacherUser.id,
      },
    });
  }

  // 5. Group
  let group = await prisma.group.findFirst({
    where: { organizationId: org.id, name: 'Math Group Alpha' },
  });
  if (!group) {
    group = await prisma.group.create({
      data: {
        organizationId: org.id,
        name: 'Math Group Alpha',
        courseId: course.id,
        teacherId: teacher.id,
        capacity: 25,
      },
    });
  }

  // 6. Student (student@medu.test and student.e2e@medu.test)
  for (const sEmail of ['student@medu.test', 'student.e2e@medu.test']) {
    let studentUser = await prisma.user.findUnique({
      where: { email: sEmail },
    });
    if (!studentUser) {
      studentUser = await prisma.user.create({
        data: {
          organizationId: org.id,
          email: sEmail,
          passwordHash,
          firstName: 'Anvar',
          lastName: 'Jalilov',
          role: 'STUDENT',
          isActive: true,
        },
      });
    } else {
      await prisma.user.update({
        where: { id: studentUser.id },
        data: { passwordHash, isActive: true },
      });
    }
    let student = await prisma.student.findFirst({
      where: { organizationId: org.id, userId: studentUser.id },
    });
    if (!student) {
      student = await prisma.student.create({
        data: {
          organizationId: org.id,
          userId: studentUser.id,
          status: 'ACTIVE',
        },
      });
    }

    // Enroll student in group
    const existingEnrollment = await prisma.studentGroup.findUnique({
      where: {
        studentId_groupId: {
          studentId: student.id,
          groupId: group.id,
        },
      },
    });
    if (!existingEnrollment) {
      await prisma.studentGroup.create({
        data: {
          organizationId: org.id,
          studentId: student.id,
          groupId: group.id,
          isActive: true,
        },
      });
    }

    // 7. Parent account (parent@medu.test)
    let parent = await prisma.parentAccount.findFirst({
      where: { email: 'parent@medu.test' },
    });
    if (!parent) {
      parent = await prisma.parentAccount.create({
        data: {
          organizationId: org.id,
          email: 'parent@medu.test',
          passwordHash,
          firstName: 'Baxtiyor',
          lastName: 'Aliyev',
          phone: '+998901234568',
          isActive: true,
        },
      });
      console.log('Created parent account: parent@medu.test');
    } else {
      await prisma.parentAccount.update({
        where: { id: parent.id },
        data: { passwordHash, isActive: true },
      });
    }

    const existingParentStudent = await prisma.parentStudent.findFirst({
      where: { parentId: parent.id, studentId: student.id },
    });
    if (!existingParentStudent) {
      await prisma.parentStudent.create({
        data: {
          parentId: parent.id,
          studentId: student.id,
          relation: 'father',
        },
      });
    }
  }

  console.log('Seed completed successfully for org:', org.name);
  await prisma.$disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
