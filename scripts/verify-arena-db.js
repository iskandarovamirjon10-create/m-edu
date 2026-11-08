const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const orgCount = await prisma.organization.count();
  const studentCount = await prisma.student.count();
  const rewardCount = await prisma.gamificationReward.count();
  const avatarCount = await prisma.arenaAvatar.count();
  const titleCount = await prisma.arenaTitle.count();
  const profileCount = await prisma.studentDuelProfile.count();
  console.log('Orgs:', orgCount);
  console.log('Students:', studentCount);
  console.log('Rewards:', rewardCount);
  console.log('Avatars:', avatarCount);
  console.log('Titles:', titleCount);
  console.log('DuelProfiles:', profileCount);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
