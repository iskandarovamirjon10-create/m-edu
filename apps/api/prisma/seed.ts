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
    update: {},
    create: {
      id: 'global',
      inviteOnly: false,
      requireApproval: false,
    },
  });

  const existingOrg = await prisma.organization.findFirst({
    where: { OR: [{ name: orgName }, { email }] },
  });

  if (existingOrg) {
    console.log(`Seed: organization "${orgName}" already exists — checking admin user.`);
    const existingAdmin = await prisma.user.findFirst({
      where: { organizationId: existingOrg.id, email },
    });
    if (!existingAdmin) {
      const passwordHash = await bcrypt.hash(password, 10);
      await prisma.user.create({
        data: {
          organizationId: existingOrg.id,
          email,
          passwordHash,
          firstName: 'Admin',
          lastName: 'M-EDU',
          role: 'ORG_ADMIN',
          settings: { create: {} },
        },
      });
      console.log(`Created admin user "${email}" for existing organization.`);
    }
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

      // Optional Demo/Sandbox Seeding (Opt-in ONLY via SEED_DEMO_DATA=true)
      if (withDemoData) {
        console.log('Seeding sandbox demo data as requested by SEED_DEMO_DATA=true...');
        const teacherPassword = resolveSecret('SEED_TEACHER_PASSWORD');
        const studentPassword = resolveSecret('SEED_STUDENT_PASSWORD');

        const math = await tx.course.create({
          data: {
            organizationId: org.id,
            name: 'Matematika',
            price: 500000,
            duration: 6,
            level: 'Intermediate',
            description: 'Algebra va geometriya asoslari',
          },
        });

        const teacher = await tx.teacher.create({
          data: {
            organization: { connect: { id: org.id } },
            specializations: ['Matematika'],
            hourlyRate: 150000,
            experience: 5,
            bio: 'Oliy toifali matematika ustozi',
            user: {
              create: {
                organization: { connect: { id: org.id } },
                email: 'teacher@medu.test',
                passwordHash: await bcrypt.hash(teacherPassword, 10),
                firstName: 'Olim',
                lastName: 'Rahimov',
                role: 'TEACHER',
                settings: { create: {} },
              },
            },
          },
        });

        const group = await tx.group.create({
          data: {
            organizationId: org.id,
            name: 'Guruh M-1',
            courseId: math.id,
            teacherId: teacher.id,
            capacity: 15,
            room: '101-xona',
            startDate: new Date(),
          },
        });

        console.log(`Demo data seeded: Group ${group.name}, Teacher ${teacher.id}`);
      }
    },
    {
      maxWait: 10_000,
      timeout: 30_000,
    },
  );

  console.log('Seed complete:');
  console.log(`  Organization: ${orgName}`);
  console.log(`  Admin Email:  ${email}`);
  if (isProd) {
    console.log('  Password:     set via SEED_ADMIN_PASSWORD env var');
  } else {
    console.log(`  Password:     ${password}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
