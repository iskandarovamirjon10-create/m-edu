/**
 * Regression / contract tests for PrismaEnrollmentAdapter.
 *
 * Scope:
 *  - tenant isolation on every enrollment/template operation
 *  - explicit enrollment lifecycle (PENDING on create)
 *  - ACTIVE template lifecycle
 *  - ACTIVE -> REVOKED transition
 *  - pagination normalization and hard limits
 *  - filtering and ordering contracts
 *  - qualityScore mapping
 *  - defensive relation mapping
 *  - prevention of sensitive templateData exposure in student projections
 *
 * These tests intentionally verify the adapter's persistence contract rather
 * than Prisma itself.
 */

import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { PrismaEnrollmentAdapter } from '../adapters/prisma-enrollment.adapter';

function makePrisma() {
  const mock: any = {
    faceEnrollment: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },

    faceTemplate: {
      create: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },

    $executeRaw: vi.fn(),
  };
  mock.$transaction = vi.fn(async (fn: (tx: any) => Promise<unknown>) => fn(mock));
  return mock as unknown as PrismaClient & typeof mock;
}

function enrollmentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'enr-1',
    organizationId: 'org-1',
    studentId: 'stu-1',
    status: 'ACTIVE',

    enrolledBy: 'user-1',
    enrolledAt: new Date('2026-01-01T00:00:00Z'),

    activatedAt: new Date('2026-01-02T00:00:00Z'),

    revokedAt: null,
    revokedBy: null,
    revocationReason: null,

    metadata: null,

    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),

    ...overrides,
  };
}

function templateRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tpl-1',
    organizationId: 'org-1',
    enrollmentId: 'enr-1',
    studentId: 'stu-1',

    templateData: 'ciphertext',
    templateHash: 'sha256-hash',

    version: 1,
    status: 'ACTIVE',

    modelVersion: 'sface-2021dec',

    qualityScore: 0.87,

    enrolledAt: new Date('2026-01-02T00:00:00Z'),
    expiresAt: null,

    revokedAt: null,

    metadata: null,

    createdAt: new Date('2026-01-02T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),

    ...overrides,
  };
}

/* -------------------------------------------------------------------------- */
/* findById                                                                   */
/* -------------------------------------------------------------------------- */

describe('PrismaEnrollmentAdapter.findById', () => {
  it('scopes lookup by organizationId', async () => {
    const prisma = makePrisma();

    prisma.faceEnrollment.findFirst.mockResolvedValue(
      enrollmentRow({
        faceTemplates: [
          templateRow({ version: 2 }),
          templateRow({ version: 1 }),
        ],
      }),
    );

    const adapter = new PrismaEnrollmentAdapter(prisma);

    const result = await adapter.findById('org-1', 'enr-1');

    expect(prisma.faceEnrollment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'enr-1',
          organizationId: 'org-1',
        },
      }),
    );

    expect(result?.id).toBe('enr-1');

    expect(result?.templates.map((template) => template.version)).toEqual([
      2,
      1,
    ]);
  });

  it('returns null when the enrollment cannot be found', async () => {
    const prisma = makePrisma();

    prisma.faceEnrollment.findFirst.mockResolvedValue(null);

    const adapter = new PrismaEnrollmentAdapter(prisma);

    await expect(
      adapter.findById('org-1', 'missing-enrollment'),
    ).resolves.toBeNull();
  });

  it('does not allow an enrollment id from another tenant to be resolved', async () => {
    const prisma = makePrisma();

    prisma.faceEnrollment.findFirst.mockResolvedValue(null);

    const adapter = new PrismaEnrollmentAdapter(prisma);

    const result = await adapter.findById('org-2', 'enr-1');

    expect(result).toBeNull();

    expect(prisma.faceEnrollment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'enr-1',
          organizationId: 'org-2',
        },
      }),
    );
  });
});

/* -------------------------------------------------------------------------- */
/* findByStudentId                                                            */
/* -------------------------------------------------------------------------- */

describe('PrismaEnrollmentAdapter.findByStudentId', () => {
  it('scopes by organizationId + studentId', async () => {
    const prisma = makePrisma();

    prisma.faceEnrollment.findFirst.mockResolvedValue(
      enrollmentRow(),
    );

    const adapter = new PrismaEnrollmentAdapter(prisma);

    await adapter.findByStudentId('org-1', 'stu-1');

    expect(prisma.faceEnrollment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: 'org-1',
          studentId: 'stu-1',
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
    );
  });

  it('returns the most recently created enrollment', async () => {
    const prisma = makePrisma();

    prisma.faceEnrollment.findFirst.mockResolvedValue(
      enrollmentRow({
        id: 'latest-enrollment',
      }),
    );

    const adapter = new PrismaEnrollmentAdapter(prisma);

    const result = await adapter.findByStudentId(
      'org-1',
      'stu-1',
    );

    expect(result?.id).toBe('latest-enrollment');

    expect(
      prisma.faceEnrollment.findFirst.mock.calls[0][0].orderBy,
    ).toEqual({
      createdAt: 'desc',
    });
  });

  it('returns null when the student has no enrollment', async () => {
    const prisma = makePrisma();

    prisma.faceEnrollment.findFirst.mockResolvedValue(null);

    const adapter = new PrismaEnrollmentAdapter(prisma);

    await expect(
      adapter.findByStudentId('org-1', 'stu-1'),
    ).resolves.toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* findActiveByStudentId                                                      */
/* -------------------------------------------------------------------------- */

describe('PrismaEnrollmentAdapter.findActiveByStudentId', () => {
  it('requests only ACTIVE enrollment', async () => {
    const prisma = makePrisma();

    prisma.faceEnrollment.findFirst.mockResolvedValue(
      enrollmentRow({
        status: 'ACTIVE',
        faceTemplates: [
          templateRow({
            id: 'tpl-active',
            status: 'ACTIVE',
          }),
        ],
      }),
    );

    const adapter = new PrismaEnrollmentAdapter(prisma);

    await adapter.findActiveByStudentId(
      'org-1',
      'stu-1',
    );

    const args =
      prisma.faceEnrollment.findFirst.mock.calls[0][0];

    expect(args.where).toEqual({
      organizationId: 'org-1',
      studentId: 'stu-1',
      status: 'ACTIVE',
    });
  });

  it('requests only ACTIVE templates', async () => {
    const prisma = makePrisma();

    prisma.faceEnrollment.findFirst.mockResolvedValue(
      enrollmentRow({
        faceTemplates: [
          templateRow({
            id: 'tpl-active',
            status: 'ACTIVE',
          }),
        ],
      }),
    );

    const adapter = new PrismaEnrollmentAdapter(prisma);

    await adapter.findActiveByStudentId(
      'org-1',
      'stu-1',
    );

    const args =
      prisma.faceEnrollment.findFirst.mock.calls[0][0];

    expect(args.include.faceTemplates.where).toEqual({
      status: 'ACTIVE',
    });
  });

  it('requests templates in newest-version-first order', async () => {
    const prisma = makePrisma();

    prisma.faceEnrollment.findFirst.mockResolvedValue(
      enrollmentRow({
        faceTemplates: [],
      }),
    );

    const adapter = new PrismaEnrollmentAdapter(prisma);

    await adapter.findActiveByStudentId(
      'org-1',
      'stu-1',
    );

    const args =
      prisma.faceEnrollment.findFirst.mock.calls[0][0];

    expect(args.include.faceTemplates.orderBy).toEqual({
      version: 'desc',
    });
  });

  it('returns null when there is no active enrollment', async () => {
    const prisma = makePrisma();

    prisma.faceEnrollment.findFirst.mockResolvedValue(null);

    const adapter = new PrismaEnrollmentAdapter(prisma);

    await expect(
      adapter.findActiveByStudentId(
        'org-1',
        'stu-1',
      ),
    ).resolves.toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* list                                                                       */
/* -------------------------------------------------------------------------- */

describe('PrismaEnrollmentAdapter.list', () => {
  it('applies tenant, status and student filters', async () => {
    const prisma = makePrisma();

    prisma.faceEnrollment.findMany.mockResolvedValue([
      enrollmentRow(),
    ]);

    prisma.faceEnrollment.count.mockResolvedValue(42);

    const adapter = new PrismaEnrollmentAdapter(prisma);

    const result = await adapter.list('org-1', {
      page: 2,
      limit: 10,
      status: 'ACTIVE',
      studentId: 'stu-1',
    });

    expect(prisma.faceEnrollment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: 'org-1',
          status: 'ACTIVE',
          studentId: 'stu-1',
        },
        skip: 10,
        take: 10,
        orderBy: {
          createdAt: 'desc',
        },
      }),
    );

    expect(result.total).toBe(42);
    expect(result.items).toHaveLength(1);
  });

  it('always includes organizationId in list queries', async () => {
    const prisma = makePrisma();

    prisma.faceEnrollment.findMany.mockResolvedValue([]);
    prisma.faceEnrollment.count.mockResolvedValue(0);

    const adapter = new PrismaEnrollmentAdapter(prisma);

    await adapter.list('org-security', {
      page: 1,
      limit: 20,
    });

    const findArgs =
      prisma.faceEnrollment.findMany.mock.calls[0][0];

    const countArgs =
      prisma.faceEnrollment.count.mock.calls[0][0];

    expect(findArgs.where.organizationId).toBe(
      'org-security',
    );

    expect(countArgs.where.organizationId).toBe(
      'org-security',
    );
  });

  it('does not add optional filters when they are absent', async () => {
    const prisma = makePrisma();

    prisma.faceEnrollment.findMany.mockResolvedValue([]);
    prisma.faceEnrollment.count.mockResolvedValue(0);

    const adapter = new PrismaEnrollmentAdapter(prisma);

    await adapter.list('org-1', {
      page: 1,
      limit: 10,
    });

    const args =
      prisma.faceEnrollment.findMany.mock.calls[0][0];

    expect(args.where).toEqual({
      organizationId: 'org-1',
    });
  });

  it('converts page and limit into skip/take correctly', async () => {
    const prisma = makePrisma();

    prisma.faceEnrollment.findMany.mockResolvedValue([]);
    prisma.faceEnrollment.count.mockResolvedValue(0);

    const adapter = new PrismaEnrollmentAdapter(prisma);

    await adapter.list('org-1', {
      page: 3,
      limit: 25,
    });

    const args =
      prisma.faceEnrollment.findMany.mock.calls[0][0];

    expect(args.skip).toBe(50);
    expect(args.take).toBe(25);
  });

  it('clamps page 0 to page 1', async () => {
    const prisma = makePrisma();

    prisma.faceEnrollment.findMany.mockResolvedValue([]);
    prisma.faceEnrollment.count.mockResolvedValue(0);

    const adapter = new PrismaEnrollmentAdapter(prisma);

    await adapter.list('org-1', {
      page: 0,
      limit: 10,
    });

    const args =
      prisma.faceEnrollment.findMany.mock.calls[0][0];

    expect(args.skip).toBe(0);
  });

  it('clamps negative page to page 1', async () => {
    const prisma = makePrisma();

    prisma.faceEnrollment.findMany.mockResolvedValue([]);
    prisma.faceEnrollment.count.mockResolvedValue(0);

    const adapter = new PrismaEnrollmentAdapter(prisma);

    await adapter.list('org-1', {
      page: -100,
      limit: 10,
    });

    const args =
      prisma.faceEnrollment.findMany.mock.calls[0][0];

    expect(args.skip).toBe(0);
  });

  it('clamps negative limit to the minimum page size', async () => {
    const prisma = makePrisma();

    prisma.faceEnrollment.findMany.mockResolvedValue([]);
    prisma.faceEnrollment.count.mockResolvedValue(0);

    const adapter = new PrismaEnrollmentAdapter(prisma);

    await adapter.list('org-1', {
      page: 1,
      limit: -5,
    });

    const args =
      prisma.faceEnrollment.findMany.mock.calls[0][0];

    expect(args.take).toBe(1);
  });

  it('clamps zero limit to the minimum page size', async () => {
    const prisma = makePrisma();

    prisma.faceEnrollment.findMany.mockResolvedValue([]);
    prisma.faceEnrollment.count.mockResolvedValue(0);

    const adapter = new PrismaEnrollmentAdapter(prisma);

    await adapter.list('org-1', {
      page: 1,
      limit: 0,
    });

    const args =
      prisma.faceEnrollment.findMany.mock.calls[0][0];

    expect(args.take).toBe(1);
  });

  it('caps oversized limit at 100', async () => {
    const prisma = makePrisma();

    prisma.faceEnrollment.findMany.mockResolvedValue([]);
    prisma.faceEnrollment.count.mockResolvedValue(0);

    const adapter = new PrismaEnrollmentAdapter(prisma);

    await adapter.list('org-1', {
      page: 1,
      limit: 100000,
    });

    const args =
      prisma.faceEnrollment.findMany.mock.calls[0][0];

    expect(args.take).toBe(100);
  });

  it('allows the maximum supported limit of 100', async () => {
    const prisma = makePrisma();

    prisma.faceEnrollment.findMany.mockResolvedValue([]);
    prisma.faceEnrollment.count.mockResolvedValue(0);

    const adapter = new PrismaEnrollmentAdapter(prisma);

    await adapter.list('org-1', {
      page: 1,
      limit: 100,
    });

    const args =
      prisma.faceEnrollment.findMany.mock.calls[0][0];

    expect(args.take).toBe(100);
  });

  it('returns an empty page without errors', async () => {
    const prisma = makePrisma();

    prisma.faceEnrollment.findMany.mockResolvedValue([]);
    prisma.faceEnrollment.count.mockResolvedValue(0);

    const adapter = new PrismaEnrollmentAdapter(prisma);

    const result = await adapter.list('org-1', {
      page: 1,
      limit: 10,
    });

    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('maps the total count correctly', async () => {
    const prisma = makePrisma();

    prisma.faceEnrollment.findMany.mockResolvedValue([]);
    prisma.faceEnrollment.count.mockResolvedValue(123);

    const adapter = new PrismaEnrollmentAdapter(prisma);

    const result = await adapter.list('org-1', {
      page: 1,
      limit: 10,
    });

    expect(result.total).toBe(123);
  });
});

/* -------------------------------------------------------------------------- */
/* create                                                                     */
/* -------------------------------------------------------------------------- */

describe('PrismaEnrollmentAdapter.create', () => {
  it('always creates a PENDING enrollment', async () => {
    const prisma = makePrisma() as any;

    prisma.faceEnrollment.findFirst.mockResolvedValue(null);
    prisma.faceEnrollment.create.mockResolvedValue(
      enrollmentRow({
        status: 'PENDING',
      }),
    );

    const adapter = new PrismaEnrollmentAdapter(prisma);

    const result = await adapter.create({
      organizationId: 'org-1',
      studentId: 'stu-1',
      enrolledBy: 'user-1',
    });

    expect(prisma.faceEnrollment.create).toHaveBeenCalledWith({
      data: {
        organizationId: 'org-1',
        studentId: 'stu-1',
        enrolledBy: 'user-1',
        status: 'PENDING',
      },
    });

    expect(result.status).toBe('PENDING');
  });

  it('persists the trusted organizationId supplied by the adapter caller', async () => {
    const prisma = makePrisma() as any;

    prisma.faceEnrollment.findFirst.mockResolvedValue(null);
    prisma.faceEnrollment.create.mockResolvedValue(
      enrollmentRow({
        organizationId: 'org-security',
        status: 'PENDING',
      }),
    );

    const adapter = new PrismaEnrollmentAdapter(prisma);

    await adapter.create({
      organizationId: 'org-security',
      studentId: 'stu-1',
      enrolledBy: 'user-1',
    });

    expect(
      prisma.faceEnrollment.create.mock.calls[0][0].data
        .organizationId,
    ).toBe('org-security');
  });

  it('never starts a new enrollment as ACTIVE', async () => {
    const prisma = makePrisma() as any;

    prisma.faceEnrollment.findFirst.mockResolvedValue(null);
    prisma.faceEnrollment.create.mockResolvedValue(
      enrollmentRow({
        status: 'PENDING',
      }),
    );

    const adapter = new PrismaEnrollmentAdapter(prisma);

    await adapter.create({
      organizationId: 'org-1',
      studentId: 'stu-1',
      enrolledBy: 'user-1',
    });

    const data =
      prisma.faceEnrollment.create.mock.calls[0][0].data;

    expect(data.status).toBe('PENDING');
    expect(data.status).not.toBe('ACTIVE');
  });

  it('rejects a duplicate active or pending enrollment', async () => {
    const prisma = makePrisma() as any;

    prisma.faceEnrollment.findFirst.mockResolvedValue(
      enrollmentRow({ status: 'ACTIVE' }),
    );

    const adapter = new PrismaEnrollmentAdapter(prisma);

    await expect(
      adapter.create({
        organizationId: 'org-1',
        studentId: 'stu-1',
        enrolledBy: 'user-1',
      }),
    ).rejects.toThrow(/already exists/i);

    expect(prisma.faceEnrollment.create).not.toHaveBeenCalled();
  });
});

/* -------------------------------------------------------------------------- */
/* updateStatus                                                               */
/* -------------------------------------------------------------------------- */

describe('PrismaEnrollmentAdapter.updateStatus', () => {
  it('scopes update by enrollment id', async () => {
    const prisma = makePrisma();

    prisma.faceEnrollment.update.mockResolvedValue(
      enrollmentRow({
        status: 'REVOKED',
      }),
    );

    const adapter = new PrismaEnrollmentAdapter(prisma);

    await adapter.updateStatus(
      'org-1',
      'enr-1',
      'REVOKED',
    );

    const args =
      prisma.faceEnrollment.update.mock.calls[0][0];

    expect(args.where).toEqual({
      id: 'enr-1',
      organizationId: 'org-1',
    });
  });

  it('updates using the enrollment id', async () => {
    const prisma = makePrisma();

    prisma.faceEnrollment.update.mockResolvedValue(
      enrollmentRow({
        status: 'REVOKED',
      }),
    );

    const adapter = new PrismaEnrollmentAdapter(prisma);

    await adapter.updateStatus(
      'org-security',
      'enr-1',
      'REVOKED',
    );

    const args =
      prisma.faceEnrollment.update.mock.calls[0][0];

    expect(args.where.id).toBe('enr-1');
    expect(args.where.organizationId).toBe('org-security');
  });

  it('writes only explicitly provided metadata fields', async () => {
    const prisma = makePrisma();

    prisma.faceEnrollment.update.mockResolvedValue(
      enrollmentRow({
        status: 'REVOKED',
      }),
    );

    const adapter = new PrismaEnrollmentAdapter(prisma);

    await adapter.updateStatus(
      'org-1',
      'enr-1',
      'REVOKED',
      {
        revokedAt: new Date(
          '2026-01-03T00:00:00Z',
        ),
        revokedBy: 'user-1',
        revocationReason: 'duplicate enrollment',
        activatedAt: undefined,
      },
    );

    const data =
      prisma.faceEnrollment.update.mock.calls[0][0].data;

    expect(data.status).toBe('REVOKED');

    expect(data.revokedAt).toEqual(
      new Date('2026-01-03T00:00:00Z'),
    );

    expect(data.revokedBy).toBe('user-1');

    expect(data.revocationReason).toBe(
      'duplicate enrollment',
    );

    expect(data).not.toHaveProperty('activatedAt');
  });
});

/* -------------------------------------------------------------------------- */
/* addTemplate                                                                */
/* -------------------------------------------------------------------------- */

describe('PrismaEnrollmentAdapter.addTemplate', () => {
  it('creates the template as ACTIVE', async () => {
    const prisma = makePrisma();

    prisma.faceTemplate.create.mockResolvedValue(
      templateRow({
        status: 'ACTIVE',
      }),
    );

    const adapter = new PrismaEnrollmentAdapter(prisma);

    const result = await adapter.addTemplate({
      organizationId: 'org-1',
      enrollmentId: 'enr-1',
      studentId: 'stu-1',

      templateData: 'encrypted-template',
      templateHash: 'hash',

      version: 3,
      modelVersion: 'v2',

      qualityScore: 0.92,

      expiresAt: null,
    });

    expect(
      prisma.faceTemplate.create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'ACTIVE',
        }),
      }),
    );

    expect(result.status).toBe('ACTIVE');
  });

  it('persists tenant identity on the template', async () => {
    const prisma = makePrisma();

    prisma.faceTemplate.create.mockResolvedValue(
      templateRow({
        organizationId: 'org-security',
      }),
    );

    const adapter = new PrismaEnrollmentAdapter(prisma);

    await adapter.addTemplate({
      organizationId: 'org-security',
      enrollmentId: 'enr-1',
      studentId: 'stu-1',

      templateData: 'encrypted-template',
      templateHash: 'hash',

      version: 1,
      modelVersion: 'v2',

      qualityScore: 0.9,

      expiresAt: null,
    });

    const data =
      prisma.faceTemplate.create.mock.calls[0][0].data;

    expect(data.organizationId).toBe(
      'org-security',
    );
  });

  it('maps qualityScore to a number', async () => {
    const prisma = makePrisma();

    prisma.faceTemplate.create.mockResolvedValue(
      templateRow({
        qualityScore: 0.92,
      }),
    );

    const adapter = new PrismaEnrollmentAdapter(prisma);

    const result = await adapter.addTemplate({
      organizationId: 'org-1',
      enrollmentId: 'enr-1',
      studentId: 'stu-1',

      templateData: 'enc',
      templateHash: 'hash',

      version: 3,
      modelVersion: 'v2',

      qualityScore: 0.92,

      expiresAt: null,
    });

    expect(result.qualityScore).toBe(0.92);
    expect(
      typeof result.qualityScore,
    ).toBe('number');
  });

  it('preserves encrypted template data for the recognition pipeline', async () => {
    const prisma = makePrisma();

    prisma.faceTemplate.create.mockResolvedValue(
      templateRow({
        templateData: 'encrypted-payload',
      }),
    );

    const adapter = new PrismaEnrollmentAdapter(prisma);

    const result = await adapter.addTemplate({
      organizationId: 'org-1',
      enrollmentId: 'enr-1',
      studentId: 'stu-1',

      templateData: 'encrypted-payload',
      templateHash: 'hash',

      version: 1,
      modelVersion: 'v2',

      qualityScore: 0.9,

      expiresAt: null,
    });

    expect(result.templateData).toBe(
      'encrypted-payload',
    );
  });
});

/* -------------------------------------------------------------------------- */
/* findActiveTemplatesByStudentId                                             */
/* -------------------------------------------------------------------------- */

describe(
  'PrismaEnrollmentAdapter.findActiveTemplatesByStudentId',
  () => {
    it('requests ACTIVE templates for the correct tenant and student', async () => {
      const prisma = makePrisma();

      prisma.faceTemplate.findMany.mockResolvedValue([
        templateRow(),
      ]);

      const adapter =
        new PrismaEnrollmentAdapter(prisma);

      await adapter.findActiveTemplatesByStudentId(
        'org-1',
        'stu-1',
      );

      expect(
        prisma.faceTemplate.findMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organizationId: 'org-1',
            studentId: 'stu-1',
            status: 'ACTIVE',
          },
          orderBy: {
            version: 'desc',
          },
        }),
      );
    });

    it('does not query another tenant', async () => {
      const prisma = makePrisma();

      prisma.faceTemplate.findMany.mockResolvedValue([]);

      const adapter =
        new PrismaEnrollmentAdapter(prisma);

      await adapter.findActiveTemplatesByStudentId(
        'org-2',
        'stu-1',
      );

      const args =
        prisma.faceTemplate.findMany.mock.calls[0][0];

      expect(args.where.organizationId).toBe(
        'org-2',
      );
    });

    it('returns an empty array when no active templates exist', async () => {
      const prisma = makePrisma();

      prisma.faceTemplate.findMany.mockResolvedValue([]);

      const adapter =
        new PrismaEnrollmentAdapter(prisma);

      const result =
        await adapter.findActiveTemplatesByStudentId(
          'org-1',
          'stu-1',
        );

      expect(result).toEqual([]);
    });

    it('requests newest template versions first', async () => {
      const prisma = makePrisma();

      prisma.faceTemplate.findMany.mockResolvedValue([
        templateRow({ version: 3 }),
        templateRow({ version: 2 }),
        templateRow({ version: 1 }),
      ]);

      const adapter =
        new PrismaEnrollmentAdapter(prisma);

      const result =
        await adapter.findActiveTemplatesByStudentId(
          'org-1',
          'stu-1',
        );

      expect(result.map((x) => x.version)).toEqual([
        3,
        2,
        1,
      ]);

      const args =
        prisma.faceTemplate.findMany.mock.calls[0][0];

      expect(args.orderBy).toEqual({
        version: 'desc',
      });
    });
  },
);

/* -------------------------------------------------------------------------- */
/* findAllActiveTemplates                                                     */
/* -------------------------------------------------------------------------- */

describe(
  'PrismaEnrollmentAdapter.findAllActiveTemplates',
  () => {
    it('requests only ACTIVE templates for the tenant', async () => {
      const prisma = makePrisma();

      prisma.faceTemplate.findMany.mockResolvedValue([]);

      const adapter =
        new PrismaEnrollmentAdapter(prisma);

      await adapter.findAllActiveTemplates('org-1');

      const args =
        prisma.faceTemplate.findMany.mock.calls[0][0];

      expect(args.where.organizationId).toBe(
        'org-1',
      );

      expect(args.where.status).toBe('ACTIVE');
    });

    it('joins student display information', async () => {
      const prisma = makePrisma();

      prisma.faceTemplate.findMany.mockResolvedValue([
        templateRow({
          student: {
            id: 'stu-1',
            user: {
              firstName: 'Aziz',
              lastName: 'Demo',
            },
          },
        }),
      ]);

      const adapter =
        new PrismaEnrollmentAdapter(prisma);

      const [result] =
        await adapter.findAllActiveTemplates(
          'org-1',
        );

      expect(result.student).toEqual({
        id: 'stu-1',
        firstName: 'Aziz',
        lastName: 'Demo',
      });
    });

    it('does not expose encrypted templateData through student projection', async () => {
      const prisma = makePrisma();

      prisma.faceTemplate.findMany.mockResolvedValue([
        templateRow({
          templateData: 'SECRET-ENCRYPTED-DATA',
          student: {
            id: 'stu-1',
            user: {
              firstName: 'Aziz',
              lastName: 'Demo',
            },
          },
        }),
      ]);

      const adapter =
        new PrismaEnrollmentAdapter(prisma);

      const [result] =
        await adapter.findAllActiveTemplates(
          'org-1',
        );

      expect(result.student).toEqual({
        id: 'stu-1',
        firstName: 'Aziz',
        lastName: 'Demo',
      });

      /*
       * The student projection must remain limited to display fields.
       * This assertion protects the public mapping contract even if the
       * underlying Prisma row contains sensitive biometric material.
       */
      expect(result.student).not.toHaveProperty(
        'templateData',
      );
    });

    it('preserves template hash mapping', async () => {
      const prisma = makePrisma();

      prisma.faceTemplate.findMany.mockResolvedValue([
        templateRow({
          templateHash: 'sha256-hash',
          student: {
            id: 'stu-1',
            user: {
              firstName: 'Aziz',
              lastName: 'Demo',
            },
          },
        }),
      ]);

      const adapter =
        new PrismaEnrollmentAdapter(prisma);

      const [result] =
        await adapter.findAllActiveTemplates(
          'org-1',
        );

      expect(result.templateHash).toBe(
        'sha256-hash',
      );
    });

    it('returns an empty collection when no active templates exist', async () => {
      const prisma = makePrisma();

      prisma.faceTemplate.findMany.mockResolvedValue([]);

      const adapter =
        new PrismaEnrollmentAdapter(prisma);

      await expect(
        adapter.findAllActiveTemplates('org-1'),
      ).resolves.toEqual([]);
    });
  },
);

/* -------------------------------------------------------------------------- */
/* revokeTemplates                                                            */
/* -------------------------------------------------------------------------- */

describe('PrismaEnrollmentAdapter.revokeTemplates', () => {
  it('revokes only ACTIVE templates', async () => {
    const prisma = makePrisma();

    prisma.faceTemplate.updateMany.mockResolvedValue({
      count: 1,
    });

    const adapter = new PrismaEnrollmentAdapter(prisma);

    await adapter.revokeTemplates(
      'org-1',
      'enr-1',
    );

    const args =
      prisma.faceTemplate.updateMany.mock.calls[0][0];

    expect(args.where).toEqual({
      organizationId: 'org-1',
      enrollmentId: 'enr-1',
      status: 'ACTIVE',
    });
  });

  it('is tenant-scoped', async () => {
    const prisma = makePrisma();

    prisma.faceTemplate.updateMany.mockResolvedValue({
      count: 0,
    });

    const adapter = new PrismaEnrollmentAdapter(prisma);

    await adapter.revokeTemplates(
      'org-security',
      'enr-1',
    );

    const args =
      prisma.faceTemplate.updateMany.mock.calls[0][0];

    expect(args.where.organizationId).toBe(
      'org-security',
    );
  });

  it('changes ACTIVE templates to REVOKED', async () => {
    const prisma = makePrisma();

    prisma.faceTemplate.updateMany.mockResolvedValue({
      count: 1,
    });

    const adapter = new PrismaEnrollmentAdapter(prisma);

    await adapter.revokeTemplates(
      'org-1',
      'enr-1',
    );

    const args =
      prisma.faceTemplate.updateMany.mock.calls[0][0];

    expect(args.data.status).toBe('REVOKED');
  });

  it('writes a fresh revocation timestamp', async () => {
    const prisma = makePrisma();

    prisma.faceTemplate.updateMany.mockResolvedValue({
      count: 1,
    });

    const adapter = new PrismaEnrollmentAdapter(prisma);

    const before = Date.now();

    await adapter.revokeTemplates(
      'org-1',
      'enr-1',
    );

    const after = Date.now();

    const args =
      prisma.faceTemplate.updateMany.mock.calls[0][0];

    expect(args.data.revokedAt).toBeInstanceOf(Date);

    expect(
      args.data.revokedAt.getTime(),
    ).toBeGreaterThanOrEqual(before);

    expect(
      args.data.revokedAt.getTime(),
    ).toBeLessThanOrEqual(after);
  });

  it('does not target already revoked templates', async () => {
    const prisma = makePrisma();

    prisma.faceTemplate.updateMany.mockResolvedValue({
      count: 0,
    });

    const adapter = new PrismaEnrollmentAdapter(prisma);

    await adapter.revokeTemplates(
      'org-1',
      'enr-1',
    );

    const args =
      prisma.faceTemplate.updateMany.mock.calls[0][0];

    expect(args.where.status).toBe('ACTIVE');
  });
});

/* -------------------------------------------------------------------------- */
/* counts                                                                     */
/* -------------------------------------------------------------------------- */

describe('PrismaEnrollmentAdapter.countActive', () => {
  it('counts only ACTIVE enrollments for the tenant', async () => {
    const prisma = makePrisma();

    prisma.faceEnrollment.count.mockResolvedValue(5);

    const adapter = new PrismaEnrollmentAdapter(prisma);

    const result =
      await adapter.countActive('org-1');

    expect(result).toBe(5);

    expect(
      prisma.faceEnrollment.count,
    ).toHaveBeenCalledWith({
      where: {
        organizationId: 'org-1',
        status: 'ACTIVE',
      },
    });
  });
});

describe('PrismaEnrollmentAdapter.countTotal', () => {
  it('counts all enrollments for the tenant only', async () => {
    const prisma = makePrisma();

    prisma.faceEnrollment.count.mockResolvedValue(9);

    const adapter = new PrismaEnrollmentAdapter(prisma);

    const result =
      await adapter.countTotal('org-1');

    expect(result).toBe(9);

    expect(
      prisma.faceEnrollment.count,
    ).toHaveBeenCalledWith({
      where: {
        organizationId: 'org-1',
      },
    });
  });
});

/* -------------------------------------------------------------------------- */
/* defensive mapping                                                          */
/* -------------------------------------------------------------------------- */

describe(
  'PrismaEnrollmentAdapter defensive mapping',
  () => {
    it('does not throw when student relation is missing', async () => {
      const prisma = makePrisma();

      prisma.faceEnrollment.findFirst.mockResolvedValue(
        enrollmentRow({
          student: null,
          faceTemplates: [],
        }),
      );

      const adapter =
        new PrismaEnrollmentAdapter(prisma);

      const result =
        await adapter.findById(
          'org-1',
          'enr-1',
        );

      expect(result?.student).toEqual({
        id: '',
        firstName: '',
        lastName: '',
        studentId: null,
        isActive: false,
      });

      expect(result?.templates).toEqual([]);
    });

    it('does not throw when user relation is missing', async () => {
      const prisma = makePrisma();

      prisma.faceEnrollment.findFirst.mockResolvedValue(
        enrollmentRow({
          student: {
            id: 'stu-1',
            studentId: null,
            isActive: true,
            user: null,
          },
          faceTemplates: [],
        }),
      );

      const adapter =
        new PrismaEnrollmentAdapter(prisma);

      const result =
        await adapter.findById(
          'org-1',
          'enr-1',
        );

      expect(result?.student).toBeDefined();
      expect(result?.templates).toEqual([]);
    });

    it('maps an empty template relation to an empty array', async () => {
      const prisma = makePrisma();

      prisma.faceEnrollment.findFirst.mockResolvedValue(
        enrollmentRow({
          faceTemplates: [],
        }),
      );

      const adapter =
        new PrismaEnrollmentAdapter(prisma);

      const result =
        await adapter.findById(
          'org-1',
          'enr-1',
        );

      expect(result?.templates).toEqual([]);
    });
  },
);

/* -------------------------------------------------------------------------- */
/* biometric lifecycle invariants                                             */
/* -------------------------------------------------------------------------- */

describe(
  'PrismaEnrollmentAdapter biometric lifecycle invariants',
  () => {
    it('new enrollment starts PENDING', async () => {
      const prisma = makePrisma() as any;

      prisma.faceEnrollment.findFirst.mockResolvedValue(null);
      prisma.faceEnrollment.create.mockResolvedValue(
        enrollmentRow({
          status: 'PENDING',
        }),
      );

      const adapter =
        new PrismaEnrollmentAdapter(prisma);

      await adapter.create({
        organizationId: 'org-1',
        studentId: 'stu-1',
        enrolledBy: 'user-1',
      });

      const data =
        prisma.faceEnrollment.create.mock.calls[0][0]
          .data;

      expect(data.status).toBe('PENDING');
    });

    it('new biometric template starts ACTIVE', async () => {
      const prisma = makePrisma();

      prisma.faceTemplate.create.mockResolvedValue(
        templateRow({
          status: 'ACTIVE',
        }),
      );

      const adapter =
        new PrismaEnrollmentAdapter(prisma);

      await adapter.addTemplate({
        organizationId: 'org-1',
        enrollmentId: 'enr-1',
        studentId: 'stu-1',

        templateData: 'enc',
        templateHash: 'hash',

        version: 1,
        modelVersion: 'v2',

        qualityScore: 0.95,

        expiresAt: null,
      });

      const data =
        prisma.faceTemplate.create.mock.calls[0][0]
          .data;

      expect(data.status).toBe('ACTIVE');
    });

    it('revocation targets ACTIVE templates only', async () => {
      const prisma = makePrisma();

      prisma.faceTemplate.updateMany.mockResolvedValue({
        count: 1,
      });

      const adapter =
        new PrismaEnrollmentAdapter(prisma);

      await adapter.revokeTemplates(
        'org-1',
        'enr-1',
      );

      const where =
        prisma.faceTemplate.updateMany.mock.calls[0][0]
          .where;

      expect(where.status).toBe('ACTIVE');
    });
  },
);

/* -------------------------------------------------------------------------- */
/* streamActiveTemplates (memory-safe batched iteration)                     */
/* -------------------------------------------------------------------------- */

describe(
  'PrismaEnrollmentAdapter.streamActiveTemplates',
  () => {
    it('scopes all batches by organizationId and ACTIVE status', async () => {
      const prisma = makePrisma();
      prisma.faceTemplate.findMany.mockResolvedValue([]);

      const adapter = new PrismaEnrollmentAdapter(prisma);
      // Drain the generator so the first query is observed
      for await (const _batch of adapter.streamActiveTemplates('org-stream', 100)) {
        // noop
      }

      const args = prisma.faceTemplate.findMany.mock.calls[0][0];
      expect(args.where.organizationId).toBe('org-stream');
      expect(args.where.status).toBe('ACTIVE');
    });

    it('passes the requested batchSize as the take limit', async () => {
      const prisma = makePrisma();
      prisma.faceTemplate.findMany.mockResolvedValue([]);

      const adapter = new PrismaEnrollmentAdapter(prisma);
      for await (const _batch of adapter.streamActiveTemplates('org-1', 250)) {
        // noop
      }

      const args = prisma.faceTemplate.findMany.mock.calls[0][0];
      expect(args.take).toBe(250);
    });

    it('rejects batchSize outside the allowed range', async () => {
      const prisma = makePrisma();
      const adapter = new PrismaEnrollmentAdapter(prisma);

      await expect(
        (async () => {
          for await (const _batch of adapter.streamActiveTemplates('org-1', 0)) {
            // noop
          }
        })(),
      ).rejects.toThrow(/batchSize/);

      await expect(
        (async () => {
          for await (const _batch of adapter.streamActiveTemplates('org-1', 5000)) {
            // noop
          }
        })(),
      ).rejects.toThrow(/batchSize/);
    });

    it('iterates in multiple batches using cursor pagination on id', async () => {
      const prisma = makePrisma();

      // 3 batches: 3 rows, 2 rows, 0 rows (stop)
      prisma.faceTemplate.findMany
        .mockResolvedValueOnce([
          templateRow({ id: 'tpl-1' }),
          templateRow({ id: 'tpl-2' }),
          templateRow({ id: 'tpl-3' }),
        ])
        .mockResolvedValueOnce([
          templateRow({ id: 'tpl-4' }),
          templateRow({ id: 'tpl-5' }),
        ])
        .mockResolvedValueOnce([]);

      const adapter = new PrismaEnrollmentAdapter(prisma);
      const seenBatches: unknown[][] = [];
      for await (const batch of adapter.streamActiveTemplates('org-1', 3)) {
        seenBatches.push(batch);
      }

      expect(seenBatches.length).toBe(2);
      expect(seenBatches[0].length).toBe(3);
      expect(seenBatches[1].length).toBe(2);

      // First call: no cursor
      expect(prisma.faceTemplate.findMany.mock.calls[0][0].where).toEqual({
        organizationId: 'org-1',
        status: 'ACTIVE',
      });

      // Second call: cursor advances to last id of first batch
      expect(prisma.faceTemplate.findMany.mock.calls[1][0].where).toEqual({
        organizationId: 'org-1',
        status: 'ACTIVE',
        id: { gt: 'tpl-3' },
      });
    });

    it('terminates when a batch is smaller than the requested batchSize', async () => {
      const prisma = makePrisma();
      // Single under-sized batch → only one query
      prisma.faceTemplate.findMany.mockResolvedValueOnce([
        templateRow({ id: 'tpl-1' }),
      ]);

      const adapter = new PrismaEnrollmentAdapter(prisma);
      const batches: unknown[][] = [];
      for await (const batch of adapter.streamActiveTemplates('org-1', 100)) {
        batches.push(batch);
      }

      expect(batches.length).toBe(1);
      expect(prisma.faceTemplate.findMany).toHaveBeenCalledTimes(1);
    });
  },
);