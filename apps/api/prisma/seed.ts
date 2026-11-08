// M-EDU seed script — initializes a clean production-ready organization or optional demo data.
// Run: npm run db:seed  (or: npx prisma db seed)
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

function resolveSecret(envVar: string, fallback = 'Password123!'): string {
  const fromEnv = process.env[envVar];
  if (fromEnv && fromEnv.length >= 8) return fromEnv;
  if (!isProd) return fallback;
  return randomBytes(12).toString('base64url');
}

const isProd = process.env.NODE_ENV === 'production';
const withDemoData = process.env.SEED_DEMO_DATA === 'true';

async function main() {
  if (isProd && process.env.ALLOW_PRODUCTION_SEED !== 'true') {
    console.warn(
      'Seed: refusing to run in production without ALLOW_PRODUCTION_SEED=true.',
    );
    process.exit(0);
  }

  const email = process.env.SEED_ADMIN_EMAIL || 'admin@medu.test';
  const password = resolveSecret('SEED_ADMIN_PASSWORD');
  const orgName = process.env.SEED_ORG_NAME || "M-EDU Ta'lim Markazi";
  const orgPhone = process.env.SEED_ORG_PHONE || '+998 71 200 00 00';

  await prisma.accessControlConfig.upsert({
    where: { id: 'global' },
    update: {
      inviteOnly: true,
      requireApproval: true,
    },
    create: {
      id: 'global',
      inviteOnly: true,
      requireApproval: true,
    },
  });

  const existingOrg = await prisma.organization.findFirst({
    where: { OR: [{ name: orgName }, { email }] },
  });

  if (existingOrg) {
    console.log(`Seed: organization "${orgName}" already exists — ensuring all demo accounts.`);
    await ensureAllDemoAccounts(prisma, existingOrg.id);
    printSeedSummary(password);
    return;
  }

  await prisma.$transaction(
    async (tx) => {
      const passwordHash = await bcrypt.hash(password, 10);

      // 1. Create Clean Primary Organization
      const org = await tx.organization.create({
        data: {
          name: orgName,
          email,
          phone: orgPhone,
          timezone: 'Asia/Tashkent',
          language: 'uz',
          currency: 'UZS',
        },
      });

      // 2. Create Default Primary Branch
      const branch = await tx.branch.create({
        data: {
          organizationId: org.id,
          name: 'Asosiy Bino',
          address: 'Toshkent shahri',
          phone: orgPhone,
          isActive: true,
        },
      });

      // 3. Create Primary Administrator Account
      const admin = await tx.user.create({
        data: {
          organizationId: org.id,
          email,
          passwordHash,
          firstName: 'Admin',
          lastName: 'M-EDU',
          role: 'ORG_ADMIN',
          status: 'ACTIVE',
          isActive: true,
          settings: {
            create: {
              language: 'uz',
              theme: 'light',
              timezone: 'Asia/Tashkent',
            },
          },
        },
      });

      // 4. Create Initial Welcome Notification
      await tx.notification.create({
        data: {
          userId: admin.id,
          organizationId: org.id,
          title: "M-EDU tizimiga xush kelibsiz",
          message: "Tizim muvaffaqiyatli ishga tushirildi. O'quvchilar, o'qituvchilar va kurslarni kiritishni boshlashingiz mumkin.",
          type: 'info',
        },
      });

      // 5. Ensure all 4 Demo Accounts are ready for 1-click evaluation
      await ensureAllDemoAccounts(tx, org.id, branch.id);
    },
    {
      maxWait: 10_000,
      timeout: 30_000,
    },
  );

  printSeedSummary(password);
}

async function ensureMembership(db: any, orgId: string, userId: string, role: string) {
  if (db.organizationMembership?.upsert) {
    await db.organizationMembership.upsert({
      where: {
        userId_organizationId: {
          organizationId: orgId,
          userId,
        },
      },
      update: { role, status: 'ACTIVE' },
      create: {
        organizationId: orgId,
        userId,
        role,
        status: 'ACTIVE',
      },
    });
  }
}

function printSeedSummary(password: string) {
  console.log('\n========================================================================');
  console.log('🎓 M-EDU Platform Seed Complete — Ready for Immediate Evaluation');
  console.log('========================================================================');
  console.log(`Default Password: ${password}\n`);
  console.log('Centralized IAM Demo Accounts (Username or Email Login):');
  console.log('  1. Platform Egasi:  login="owner",      rol="PLATFORM_OWNER" (Xavfsizlik Radari & Kill-Switch)');
  console.log('  2. Super Admin:     login="superadmin", rol="SUPER_ADMIN"');
  console.log('  3. Administrator:   login="admin",      rol="ORG_ADMIN"');
  console.log('  4. O\'qituvchi:      login="teacher",    rol="TEACHER"');
  console.log('  5. O\'quvchi:        login="student",    rol="STUDENT"');
  console.log('  6. Ota-ona:         login="parent@medu.test", rol="PARENT"');
  console.log('========================================================================\n');
}

async function ensureAllDemoAccounts(
  db: any,
  orgId: string,
  _branchId?: string,
): Promise<void> {
  const defaultPassword = 'Password123!';
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  // 1. Platform Owner (owner / owner@medu.uz)
  const ownerEmail = 'owner@medu.uz';
  let ownerUser = await db.user.findFirst({
    where: { OR: [{ email: ownerEmail }, { username: 'owner' }] },
  });
  if (!ownerUser) {
    ownerUser = await db.user.create({
      data: {
        organizationId: orgId,
        username: 'owner',
        email: ownerEmail,
        passwordHash,
        firstName: 'Platforma',
        lastName: 'Egasi',
        role: 'PLATFORM_OWNER',
        status: 'ACTIVE',
        isActive: true,
        mustChangePassword: false,
        settings: { create: { language: 'uz', theme: 'dark' } },
      },
    });
    console.log(`Created platform owner: owner (${ownerEmail})`);
  } else {
    ownerUser = await db.user.update({
      where: { id: ownerUser.id },
      data: {
        username: 'owner',
        email: ownerEmail,
        passwordHash,
        role: 'PLATFORM_OWNER',
        status: 'ACTIVE',
        isActive: true,
        mustChangePassword: false,
      },
    });
  }
  await ensureMembership(db, orgId, ownerUser.id, 'PLATFORM_OWNER');

  // 2. Super Admin (superadmin / superadmin@medu.uz)
  const superAdminEmail = 'superadmin@medu.uz';
  let superAdminUser = await db.user.findFirst({
    where: { OR: [{ email: superAdminEmail }, { username: 'superadmin' }] },
  });
  if (!superAdminUser) {
    superAdminUser = await db.user.create({
      data: {
        organizationId: orgId,
        username: 'superadmin',
        email: superAdminEmail,
        passwordHash,
        firstName: 'Super',
        lastName: 'Admin',
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
        isActive: true,
        mustChangePassword: false,
        settings: { create: { language: 'uz', theme: 'dark' } },
      },
    });
    console.log(`Created super admin: superadmin (${superAdminEmail})`);
  } else {
    superAdminUser = await db.user.update({
      where: { id: superAdminUser.id },
      data: {
        username: 'superadmin',
        email: superAdminEmail,
        passwordHash,
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
        isActive: true,
        mustChangePassword: false,
      },
    });
  }
  await ensureMembership(db, orgId, superAdminUser.id, 'SUPER_ADMIN');

  // 3. Organization Admin (admin / admin@medu.test)
  const adminEmail = 'admin@medu.test';
  let adminUser = await db.user.findFirst({
    where: { OR: [{ email: adminEmail }, { username: 'admin' }] },
  });
  if (!adminUser) {
    adminUser = await db.user.create({
      data: {
        organizationId: orgId,
        username: 'admin',
        email: adminEmail,
        passwordHash,
        firstName: 'Admin',
        lastName: 'M-EDU',
        role: 'ORG_ADMIN',
        status: 'ACTIVE',
        isActive: true,
        mustChangePassword: false,
        settings: { create: { language: 'uz', theme: 'light' } },
      },
    });
    console.log(`Created admin: admin (${adminEmail})`);
  } else {
    adminUser = await db.user.update({
      where: { id: adminUser.id },
      data: {
        username: 'admin',
        passwordHash,
        role: 'ORG_ADMIN',
        status: 'ACTIVE',
        isActive: true,
        mustChangePassword: false,
      },
    });
  }
  await ensureMembership(db, orgId, adminUser.id, 'ORG_ADMIN');

  // 4. Course & Group
  let course = await db.course.findFirst({
    where: { organizationId: orgId, name: 'Matematika' },
  });
  if (!course) {
    course = await db.course.create({
      data: {
        organizationId: orgId,
        name: 'Matematika',
        price: 500000,
        duration: 6,
        level: 'Intermediate',
        description: 'Algebra va geometriya asoslari',
      },
    });
  }

  // 5. Teacher account (teacher / teacher@medu.test)
  const teacherEmail = 'teacher@medu.test';
  let teacherUser = await db.user.findFirst({
    where: { OR: [{ email: teacherEmail }, { username: 'teacher' }] },
  });
  if (!teacherUser) {
    teacherUser = await db.user.create({
      data: {
        organizationId: orgId,
        username: 'teacher',
        email: teacherEmail,
        passwordHash,
        firstName: 'Olim',
        lastName: 'Rahimov',
        role: 'TEACHER',
        status: 'ACTIVE',
        isActive: true,
        mustChangePassword: false,
        settings: { create: {} },
      },
    });
    console.log(`Created teacher: teacher (${teacherEmail})`);
  } else {
    teacherUser = await db.user.update({
      where: { id: teacherUser.id },
      data: {
        username: 'teacher',
        passwordHash,
        status: 'ACTIVE',
        isActive: true,
        mustChangePassword: false,
      },
    });
  }
  await ensureMembership(db, orgId, teacherUser.id, 'TEACHER');

  let teacher = await db.teacher.findFirst({
    where: { organizationId: orgId, userId: teacherUser.id },
  });
  if (!teacher) {
    teacher = await db.teacher.create({
      data: {
        organizationId: orgId,
        userId: teacherUser.id,
        specializations: ['Matematika'],
        hourlyRate: 150000,
        experience: 5,
        bio: 'Oliy toifali matematika ustozi',
      },
    });
  }

  let group = await db.group.findFirst({
    where: { organizationId: orgId, name: 'Guruh M-1' },
  });
  if (!group) {
    group = await db.group.create({
      data: {
        organizationId: orgId,
        name: 'Guruh M-1',
        courseId: course.id,
        teacherId: teacher.id,
        capacity: 15,
        room: '101-xona',
        startDate: new Date(),
      },
    });
  }

  // 6. Student account (student / student@medu.test)
  const studentEmail = 'student@medu.test';
  let studentUser = await db.user.findFirst({
    where: { OR: [{ email: studentEmail }, { username: 'student' }] },
  });
  if (!studentUser) {
    studentUser = await db.user.create({
      data: {
        organizationId: orgId,
        username: 'student',
        email: studentEmail,
        passwordHash,
        firstName: 'Jasur',
        lastName: 'Aliyev',
        role: 'STUDENT',
        status: 'ACTIVE',
        isActive: true,
        mustChangePassword: false,
        settings: { create: {} },
      },
    });
    console.log(`Created student: student (${studentEmail})`);
  } else {
    studentUser = await db.user.update({
      where: { id: studentUser.id },
      data: {
        username: 'student',
        passwordHash,
        status: 'ACTIVE',
        isActive: true,
        mustChangePassword: false,
      },
    });
  }
  await ensureMembership(db, orgId, studentUser.id, 'STUDENT');

  let student = await db.student.findFirst({
    where: { organizationId: orgId, userId: studentUser.id },
  });
  if (!student) {
    student = await db.student.create({
      data: {
        organizationId: orgId,
        userId: studentUser.id,
        status: 'ACTIVE',
      },
    });
  }

  // Enroll student in group
  const existingEnrollment = await db.studentGroup.findFirst({
    where: {
      studentId: student.id,
      groupId: group.id,
    },
  });
  if (!existingEnrollment) {
    await db.studentGroup.create({
      data: {
        organizationId: orgId,
        studentId: student.id,
        groupId: group.id,
        isActive: true,
      },
    });
  }

  // 7. Parent account (parent@medu.test)
  const parentEmail = 'parent@medu.test';
  let parent = await db.parentAccount.findFirst({
    where: { email: parentEmail },
  });
  if (!parent) {
    parent = await db.parentAccount.create({
      data: {
        organizationId: orgId,
        email: parentEmail,
        passwordHash,
        firstName: 'Baxtiyor',
        lastName: 'Aliyev',
        phone: '+998901234568',
        isActive: true,
      },
    });
    console.log(`Created parent: ${parentEmail}`);
  } else {
    await db.parentAccount.update({
      where: { id: parent.id },
      data: { passwordHash, isActive: true },
    });
  }

  // Link parent to student
  const existingParentStudent = await db.parentStudent.findFirst({
    where: {
      parentId: parent.id,
      studentId: student.id,
    },
  });
  if (!existingParentStudent) {
    await db.parentStudent.create({
      data: {
        parentId: parent.id,
        studentId: student.id,
        relationship: 'father',
      },
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
