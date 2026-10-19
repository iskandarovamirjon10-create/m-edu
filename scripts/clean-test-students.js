const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { StudentsService } = require('../apps/api/dist/students/students.service.js');
const service = new StudentsService(prisma);

async function clean() {
  const testStudents = await prisma.student.findMany({
    where: {
      OR: [
        { user: { email: { contains: 'test.student' } } },
        { user: { firstName: { in: ['Test', 'Historical'] } } },
      ]
    }
  });
  for (const s of testStudents) {
    await service.remove(s.organizationId, s.id);
    console.log('Removed test student:', s.id);
  }
}

clean().finally(() => prisma.$disconnect());
