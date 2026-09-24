// M-EDU seed script — creates a demo organization with realistic data.
// Run: npm run db:seed  (or: npx prisma db seed)
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

// No hardcoded passwords: env override or a random per-run secret.
function resolveSecret(envVar: string): string {
  const fromEnv = process.env[envVar];
  if (fromEnv && fromEnv.length >= 8) return fromEnv;
  return randomBytes(12).toString('base64url');
}

const isProd = process.env.NODE_ENV === 'production';

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@medu.test';
  const password = resolveSecret('SEED_ADMIN_PASSWORD');
  const demoEmail = process.env.SEED_DEMO_EMAIL || 'demo@medu.test';
  const demoPassword = resolveSecret('SEED_DEMO_PASSWORD');
  const teacherPassword = resolveSecret('SEED_TEACHER_PASSWORD');
  const studentPassword = resolveSecret('SEED_STUDENT_PASSWORD');
  const orgName = process.env.SEED_ORG_NAME || 'Demo Education Center';

  const existingOrg = await prisma.organization.findFirst({ where: { name: orgName } });
  if (existingOrg) {
    console.log(`Seed: organization "${orgName}" already exists — skipping.`);
    return;
  }

  await prisma.$transaction(async (tx) => {
  const passwordHash = await bcrypt.hash(password, 10);

  const org = await tx.organization.create({
    data: {
      name: 'Demo Education Center',
      email,
      phone: '+998 90 123 45 67',
    },
  });

  const admin = await tx.user.create({
    data: {
      organizationId: org.id,
      email,
      passwordHash,
      firstName: 'Admin',
      lastName: 'Medu',
      role: 'ORG_ADMIN',
      settings: { create: {} },
    },
  });

  // Second documented admin (docs/DEVELOPMENT.md "Demo admin" account).
  const demoAdmin = await tx.user.create({
    data: {
      organizationId: org.id,
      email: demoEmail,
      passwordHash: await bcrypt.hash(demoPassword, 10),
      firstName: 'Demo',
      lastName: 'Admin',
      role: 'ORG_ADMIN',
      settings: { create: {} },
    },
  });

  // Courses
  const math = await tx.course.create({ data: { organizationId: org.id, name: 'Mathematics', price: 120, duration: 6, level: 'Intermediate', description: 'Algebra and geometry' } });
  const eng = await tx.course.create({ data: { organizationId: org.id, name: 'English', price: 100, duration: 4, level: 'Beginner', description: 'General English' } });
  await tx.course.create({ data: { organizationId: org.id, name: 'Physics', price: 140, duration: 6, level: 'Advanced', description: 'Mechanics and electromagnetism' } });

  // Teachers
  const teacher1 = await tx.teacher.create({
    data: {
      organization: { connect: { id: org.id } },
      specializations: ['Mathematics', 'Physics'],
      hourlyRate: 25,
      experience: 8,
      bio: 'Senior math and physics instructor',
      user: {
        create: {
          organization: { connect: { id: org.id } },
          email: 'teacher.math@demo.medu.test',
          passwordHash: await bcrypt.hash(teacherPassword, 10),
          firstName: 'Karim',
          lastName: 'Yusupov',
          role: 'TEACHER',
          settings: { create: {} },
        },
      },
    },
  });

  const teacher2 = await tx.teacher.create({
    data: {
      organization: { connect: { id: org.id } },
      specializations: ['English'],
      hourlyRate: 20,
      experience: 5,
      bio: 'English language instructor',
      user: {
        create: {
          organization: { connect: { id: org.id } },
          email: 'teacher.eng@demo.medu.test',
          passwordHash: await bcrypt.hash(teacherPassword, 10),
          firstName: 'Nodira',
          lastName: 'Rahimova',
          role: 'TEACHER',
          settings: { create: {} },
        },
      },
    },
  });

  // Groups
  const groupA = await tx.group.create({
    data: {
      organizationId: org.id,
      name: 'Math Group A',
      courseId: math.id,
      teacherId: teacher1.id,
      capacity: 20,
      room: 'Room 101',
      startDate: new Date('2026-01-10'),
    },
  });
  const groupB = await tx.group.create({
    data: {
      organizationId: org.id,
      name: 'English Group B',
      courseId: eng.id,
      teacherId: teacher2.id,
      capacity: 15,
      room: 'Room 202',
      startDate: new Date('2026-02-01'),
    },
  });

  await tx.schedule.createMany({
    data: [
      { groupId: groupA.id, dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '10:30', room: 'Room 101' },
      { groupId: groupA.id, dayOfWeek: 'WEDNESDAY', startTime: '09:00', endTime: '10:30', room: 'Room 101' },
      { groupId: groupB.id, dayOfWeek: 'TUESDAY', startTime: '14:00', endTime: '15:30', room: 'Room 202' },
      { groupId: groupB.id, dayOfWeek: 'THURSDAY', startTime: '14:00', endTime: '15:30', room: 'Room 202' },
    ],
  });

  // Students
  const studentNames = [
    ['Aziz', 'Karimov', 'aziz.demo@medu.test', 'MALE', '1998-03-12'],
    ['Malika', 'Ergasheva', 'malika.demo@medu.test', 'FEMALE', '1999-07-24'],
    ['Jasur', 'Toshpulatov', 'jasur.demo@medu.test', 'MALE', '2000-01-05'],
    ['Dilnoza', 'Saidova', 'dilnoza.demo@medu.test', 'FEMALE', '1997-11-30'],
    ['Bekzod', 'Umarov', 'bekzod.demo@medu.test', 'MALE', '2001-05-18'],
    ['Gulnora', 'Nazarova', 'gulnora.demo@medu.test', 'FEMALE', '1998-09-02'],
  ];

  const students = [];
  for (const [first, last, mail, gender, dob] of studentNames) {
    const student = await tx.student.create({
      data: {
        organization: { connect: { id: org.id } },
        dateOfBirth: new Date(dob),
        gender: gender as 'MALE' | 'FEMALE',
        address: 'Tashkent, Uzbekistan',
        parentName: `Parent of ${first}`,
        parentPhone: '+998 90 000 00 00',
        user: {
          create: {
            organization: { connect: { id: org.id } },
            email: mail,
            passwordHash: await bcrypt.hash(studentPassword, 10),
            firstName: first,
            lastName: last,
            role: 'STUDENT',
            settings: { create: {} },
          },
        },
      },
    });
    students.push(student);
  }

  // Assign students to groups
  const memberships = [
    [students[0].id, groupA.id],
    [students[1].id, groupA.id],
    [students[2].id, groupA.id],
    [students[3].id, groupB.id],
    [students[4].id, groupB.id],
    [students[5].id, groupB.id],
  ];
  for (const [studentId, groupId] of memberships) {
    await tx.studentGroup.create({ data: { organizationId: org.id, studentId, groupId, isActive: true } });
  }

  // Payments
  const now = new Date();
  const months = [0, 1, 2];
  for (let i = 0; i < students.length; i++) {
    const s = students[i];
    const course = i < 3 ? math : eng;
    for (const m of months) {
      const d = new Date(now.getFullYear(), now.getMonth() - m, 5);
      await tx.payment.create({
        data: {
          organizationId: org.id,
          studentId: s.id,
          amount: course.price,
          status: m === 0 ? (i === 0 ? 'PAID' : i === 1 ? 'PENDING' : 'PAID') : 'PAID',
          description: `${course.name} tuition`,
          dueDate: d,
          method: m === 0 ? 'CARD' : 'CASH',
          createdAt: d,
        },
      });
    }
  }

  // Leads
  await tx.lead.createMany({
    data: [
      { organizationId: org.id, firstName: 'Sardor', lastName: 'Alimov', phone: '+998 91 111 22 33', source: 'Instagram', stage: 'NEW', notes: 'Asked about math courses' },
      { organizationId: org.id, firstName: 'Zarina', lastName: 'Mirzaeva', phone: '+998 93 222 33 44', email: 'zarina@example.com', source: 'Referral', stage: 'CONTACTED' },
      { organizationId: org.id, firstName: 'Temur', lastName: 'Rasulov', phone: '+998 90 333 44 55', source: 'Website', stage: 'TRIAL_LESSON' },
      { organizationId: org.id, firstName: 'Shahnoza', lastName: 'Abdullaeva', phone: '+998 94 444 55 66', source: 'Instagram', stage: 'WON' },
    ],
  });

  // Attendance for the current week
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + 1); // Monday
  for (let i = 0; i < students.length; i++) {
    const s = students[i];
    const gid = i < 3 ? groupA.id : groupB.id;
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + (i % 3)); // spread across Mon-Wed
    await tx.attendance.create({
      data: {
        organizationId: org.id,
        studentId: s.id,
        groupId: gid,
        date: d,
        status: i % 4 === 3 ? 'LATE' : 'PRESENT',
        source: 'MANUAL',
      },
    });
  }

  // Expenses
  await tx.expense.createMany({
    data: [
      { organizationId: org.id, category: 'RENT', amount: 500, description: 'Office rent', date: new Date(now.getFullYear(), now.getMonth(), 1) },
      { organizationId: org.id, category: 'SALARY', amount: 800, description: 'Teacher salaries', date: new Date(now.getFullYear(), now.getMonth(), 5) },
      { organizationId: org.id, category: 'UTILITIES', amount: 120, description: 'Electricity and water', date: new Date(now.getFullYear(), now.getMonth(), 8) },
      { organizationId: org.id, category: 'MARKETING', amount: 200, description: 'Instagram ads', date: new Date(now.getFullYear(), now.getMonth(), 10) },
    ],
  });

  // Face enrollment for a couple of students (mock engine compatible)
  for (const s of [students[0], students[1]]) {
    await tx.faceEnrollment.create({
      data: {
        organizationId: org.id,
        studentId: s.id,
        enrolledBy: admin.id,
        status: 'ACTIVE',
        enrolledAt: now,
        activatedAt: now,
        faceTemplates: {
          create: {
            organizationId: org.id,
            studentId: s.id,
            templateData: '', // empty — real enrollment must be done via the face API
            templateHash: '',
            version: 1,
            status: 'ACTIVE',
            modelVersion: 'seed-placeholder',
          },
        },
      },
    });
  }

  // Notifications
  await tx.notification.createMany({
    data: [
      { userId: admin.id, organizationId: org.id, title: 'Welcome to M-EDU', message: 'Your demo organization is ready. Enroll student faces to enable automatic attendance.', type: 'info' },
      { userId: admin.id, organizationId: org.id, title: 'New leads', message: 'You have 4 new leads this week. Follow up to convert them.', type: 'info' },
      { userId: demoAdmin.id, organizationId: org.id, title: 'Welcome to M-EDU', message: 'You are signed in with the demo admin account. Explore students, groups, attendance and face recognition.', type: 'info' },
    ],
  });

  });
  console.log('Seed complete:');
  console.log(`  Admin:       ${email}`);
  console.log(`  Demo admin:  ${demoEmail}`);
  console.log(`  Teacher:     teacher.math@demo.medu.test`);
  console.log(`  Students:    *.demo@medu.test`);
  console.log(`  Org:         ${orgName}`);
  if (isProd) {
    console.log('  Passwords:   set via SEED_*_PASSWORD env vars (not printed in production)');
  } else {
    console.log('  Passwords:   (dev only, printed once)');
    console.log(`    admin=${password} demo=${demoPassword}`);
    console.log(`    teacher=${teacherPassword} student=${studentPassword}`);
    console.log('    Set SEED_ADMIN_PASSWORD / SEED_DEMO_PASSWORD / SEED_TEACHER_PASSWORD / SEED_STUDENT_PASSWORD to override.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
