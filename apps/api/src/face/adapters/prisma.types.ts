import { Prisma } from '@prisma/client';

export const userSummarySelect = {
  select: {
    id: true,
    firstName: true,
    lastName: true,
    email: true,
    isActive: true,
  },
} satisfies Prisma.UserArgs;

export const auditEventInclude = {
  user: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  },
} satisfies Prisma.FaceAuditEventInclude;

export const studentInclude = {
  user: userSummarySelect,
} satisfies Prisma.StudentInclude;

export const studentGroupWithGroupInclude = {
  group: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.StudentGroupInclude;

export const studentGroupWithStudentInclude = {
  student: {
    include: {
      user: userSummarySelect,
    },
  },
} satisfies Prisma.StudentGroupInclude;

export const enrollmentWithTemplatesInclude = {
  faceTemplates: {
    orderBy: {
      version: 'desc' as const,
    },
  },
  student: {
    include: {
      user: userSummarySelect,
    },
  },
} satisfies Prisma.FaceEnrollmentInclude;

export const activeEnrollmentWithTemplatesInclude = {
  faceTemplates: {
    where: {
      status: 'ACTIVE',
    },
    orderBy: {
      version: 'desc' as const,
    },
  },
  student: {
    include: {
      user: userSummarySelect,
    },
  },
} satisfies Prisma.FaceEnrollmentInclude;

export const templateWithStudentInclude = {
  student: {
    select: {
      id: true,
      user: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  },
} satisfies Prisma.FaceTemplateInclude;

export const attemptWithStudentInclude = {
  student: {
    select: {
      id: true,
      user: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  },
} satisfies Prisma.RecognitionAttemptInclude;