const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

const TITLES = [
  {
    slug: 'first-blood',
    name: 'Birinchi Zarb',
    description: "O'zining ilk duelida g'alaba qozongan yangi jangchi.",
    icon: '🗡️',
    rarity: 'COMMON',
    requirementType: 'DEFAULT',
    requirementValue: 1,
    isSystem: true,
  },
  {
    slug: 'speed-demon',
    name: 'Chaqmoq Fikr',
    description: "Savolga 3 soniyadan kamroq vaqtda birinchi bo'lib to'g'ri javob bergan.",
    icon: '⚡️',
    rarity: 'RARE',
    requirementType: 'ACCURACY',
    requirementValue: 3,
    isSystem: true,
  },
  {
    slug: 'sniper',
    name: 'Xatosiz Snayper',
    description: "Duel davomida birorta ham xatoga yo'l qo'ymasdan 100% aniqlik ko'rsatgan.",
    icon: '🎯',
    rarity: 'RARE',
    requirementType: 'ACCURACY',
    requirementValue: 100,
    isSystem: true,
  },
  {
    slug: 'streak-master',
    name: 'Yengilmas Silsila',
    description: "Ketma-ket 5 ta duelda mag'lubiyatsiz seriyani saqlab qolgan.",
    icon: '🔥',
    rarity: 'EPIC',
    requirementType: 'WIN_STREAK',
    requirementValue: 5,
    isSystem: true,
  },
  {
    slug: 'century-conqueror',
    name: 'Yuzlik Fath',
    description: "100 ta savolga to'g'ri javob bergan intellektual faxriy.",
    icon: '💯',
    rarity: 'EPIC',
    requirementType: 'TOTAL_QUESTIONS',
    requirementValue: 100,
    isSystem: true,
  },
  {
    slug: 'grandmaster',
    name: 'Katta Usta (Grandmaster)',
    description: "Mind Arena reytingida 1500+ ball to'plab, eng yuqori ligaga ko'tarilgan.",
    icon: '👑',
    rarity: 'LEGENDARY',
    requirementType: 'RATING',
    requirementValue: 1500,
    isSystem: true,
  },
];

async function seedMindArena() {
  console.log('🌱 Starting Idempotent Mind Arena Seed...');

  const manifestPath = path.resolve('apps/web/public/avatars/arena/manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error('Avatar manifest not found! Run scripts/generate-arena-assets.js first.');
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  const seededAvatars = [];
  let sortOrder = 1;

  for (const [slug, data] of Object.entries(manifest.avatars)) {
    const avatar = await prisma.arenaAvatar.upsert({
      where: { slug },
      update: {
        name: data.name,
        title: data.title,
        description: data.description,
        element: data.element,
        rarity: data.rarity,
        thumbnailUrl: data.assets.thumbnail.pngPath,
        defaultRenderUrl: data.assets.default.pngPath,
        battleRenderUrl: data.assets.battle.pngPath,
        victoryRenderUrl: data.assets.victory.pngPath,
        isDefault: true,
        isActive: true,
        sortOrder: sortOrder++,
        metadata: {
          colorPalette: data.colorPalette,
          assetVersion: manifest.version,
          hashes: {
            default: data.assets.default.contentHash,
            battle: data.assets.battle.contentHash,
            victory: data.assets.victory.contentHash,
            thumbnail: data.assets.thumbnail.contentHash,
          },
        },
      },
      create: {
        slug,
        name: data.name,
        title: data.title,
        description: data.description,
        element: data.element,
        rarity: data.rarity,
        thumbnailUrl: data.assets.thumbnail.pngPath,
        defaultRenderUrl: data.assets.default.pngPath,
        battleRenderUrl: data.assets.battle.pngPath,
        victoryRenderUrl: data.assets.victory.pngPath,
        isDefault: true,
        isActive: true,
        sortOrder: sortOrder++,
        metadata: {
          colorPalette: data.colorPalette,
          assetVersion: manifest.version,
          hashes: {
            default: data.assets.default.contentHash,
            battle: data.assets.battle.contentHash,
            victory: data.assets.victory.contentHash,
            thumbnail: data.assets.thumbnail.contentHash,
          },
        },
      },
    });
    seededAvatars.push(avatar);
  }
  console.log(`✅ Upserted ${seededAvatars.length} arena avatars.`);

  const seededTitles = [];
  for (const titleData of TITLES) {
    const title = await prisma.arenaTitle.upsert({
      where: { slug: titleData.slug },
      update: {
        name: titleData.name,
        description: titleData.description,
        icon: titleData.icon,
        rarity: titleData.rarity,
        requirementType: titleData.requirementType,
        requirementValue: titleData.requirementValue,
        isSystem: true,
        isActive: true,
      },
      create: {
        slug: titleData.slug,
        name: titleData.name,
        description: titleData.description,
        icon: titleData.icon,
        rarity: titleData.rarity,
        requirementType: titleData.requirementType,
        requirementValue: titleData.requirementValue,
        isSystem: true,
        isActive: true,
      },
    });
    seededTitles.push(title);
  }
  console.log(`✅ Upserted ${seededTitles.length} arena titles.`);

  // Find all active students and ensure duel profile and unlocks exist
  const students = await prisma.student.findMany({
    select: { id: true, organizationId: true },
  });

  const defaultAvatar = seededAvatars.find((a) => a.slug === 'cyber-scholar') || seededAvatars[0];
  const defaultTitle = seededTitles.find((t) => t.slug === 'first-blood') || seededTitles[0];

  let profilesCreated = 0;
  let unlocksCreated = 0;

  for (const student of students) {
    // 1. Ensure StudentDuelProfile
    await prisma.studentDuelProfile.upsert({
      where: { studentId: student.id },
      update: {},
      create: {
        studentId: student.id,
        organizationId: student.organizationId,
        activeAvatarId: defaultAvatar.id,
        activeTitleId: defaultTitle.id,
        rating: 1000,
        peakRating: 1000,
        totalDuels: 0,
        wins: 0,
        losses: 0,
        draws: 0,
      },
    });
    profilesCreated++;

    // 2. Unlock all 12 default avatars for the student
    for (const avatar of seededAvatars) {
      await prisma.studentAvatarUnlock.upsert({
        where: {
          studentId_avatarId: {
            studentId: student.id,
            avatarId: avatar.id,
          },
        },
        update: {},
        create: {
          studentId: student.id,
          organizationId: student.organizationId,
          avatarId: avatar.id,
          unlockedVia: 'INITIAL_CATALOG',
        },
      });
      unlocksCreated++;
    }

    // 3. Grant initial title (Birinchi Zarb)
    await prisma.studentArenaTitle.upsert({
      where: {
        studentId_titleId: {
          studentId: student.id,
          titleId: defaultTitle.id,
        },
      },
      update: {},
      create: {
        studentId: student.id,
        organizationId: student.organizationId,
        titleId: defaultTitle.id,
        earnedVia: 'STARTER_TITLE',
      },
    });
  }

  console.log(`✅ Student synchronization: Verified ${profilesCreated} student duel profiles, ${unlocksCreated} avatar unlocks.`);
  console.log('🎉 Mind Arena Seed completed successfully!');
}

if (require.main === module) {
  seedMindArena()
    .catch((err) => {
      console.error('❌ Seed failed:', err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}

module.exports = { seedMindArena };
