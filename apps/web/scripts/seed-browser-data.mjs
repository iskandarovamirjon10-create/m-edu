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
  const passwordHash = await bcrypt.hash('Admin1234!', 10);
  let user = await prisma.user.findUnique({
    where: { email: 'admin@medu.test' },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        organizationId: org.id,
        email: 'admin@medu.test',
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

  // 6. Student
  let studentUser = await prisma.user.findUnique({
    where: { email: 'student.e2e@medu.test' },
  });
  if (!studentUser) {
    studentUser = await prisma.user.create({
      data: {
        organizationId: org.id,
        email: 'student.e2e@medu.test',
        firstName: 'Anvar',
        lastName: 'Jalilov',
        role: 'STUDENT',
        isActive: true,
      },
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

  console.log('Seed completed successfully for org:', org.name);
  await prisma.$disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
