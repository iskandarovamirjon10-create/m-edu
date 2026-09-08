/**
 * Unit tests for AuditService — deterministic, rule-based, no AI.
 * Tests filter mapping, hydration of actors, mapping of actions, entity history.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuditService } from '../audit.service';

function makePrisma() {
  return {
    auditLog: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  } as any;
}

describe('AuditService', () => {
  let svc: AuditService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
    svc = new AuditService(prisma);
    vi.clearAllMocks();
  });

  describe('findAll — tenant isolation', () => {
    it('always filters by organizationId', async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);
      prisma.auditLog.count.mockResolvedValue(0);
      await svc.findAll('org-xyz', {} as any);
      const where = prisma.auditLog.findMany.mock.calls[0][0].where;
      expect(where.organizationId).toBe('org-xyz');
    });
  });

  describe('findAll — filter mapping', () => {
    it('maps action filter', async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);
      prisma.auditLog.count.mockResolvedValue(0);
      await svc.findAll('org-1', { action: 'CREATE' } as any);
      const where = prisma.auditLog.findMany.mock.calls[0][0].where;
      expect(where.action).toBe('CREATE');
    });

    it('maps entityType → resource', async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);
      prisma.auditLog.count.mockResolvedValue(0);
      await svc.findAll('org-1', { entityType: 'STUDENT' } as any);
      const where = prisma.auditLog.findMany.mock.calls[0][0].where;
      expect(where.resource).toBe('STUDENT');
    });

    it('maps entityId → resourceId', async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);
      prisma.auditLog.count.mockResolvedValue(0);
      await svc.findAll('org-1', { entityId: 'ent-1' } as any);
      const where = prisma.auditLog.findMany.mock.calls[0][0].where;
      expect(where.resourceId).toBe('ent-1');
    });

    it('maps actorId → userId', async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);
      prisma.auditLog.count.mockResolvedValue(0);
      await svc.findAll('org-1', { actorId: 'u-1' } as any);
      const where = prisma.auditLog.findMany.mock.calls[0][0].where;
      expect(where.userId).toBe('u-1');
    });

    it('maps search to OR clause across resource/path/method', async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);
      prisma.auditLog.count.mockResolvedValue(0);
      await svc.findAll('org-1', { search: 'student' } as any);
      const where = prisma.auditLog.findMany.mock.calls[0][0].where;
      expect(where.OR).toBeDefined();
      expect(where.OR).toHaveLength(3);
    });

    it('maps date range to timestamp filter', async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);
      prisma.auditLog.count.mockResolvedValue(0);
      await svc.findAll('org-1', { fromDate: '2024-01-01', toDate: '2024-12-31' } as any);
      const where = prisma.auditLog.findMany.mock.calls[0][0].where;
      expect(where.timestamp.gte).toBeInstanceOf(Date);
      expect(where.timestamp.lte).toBeInstanceOf(Date);
    });
  });

  describe('findAll — actor hydration', () => {
    it('hydrates actor names from userIds', async () => {
      prisma.auditLog.findMany.mockResolvedValue([
        {
          id: 'a1', organizationId: 'org-1', userId: 'u-1', action: 'CREATE',
          resource: 'STUDENT', resourceId: 's1', changes: null,
          ipAddress: '127.0.0.1', userAgent: 'jest', method: 'POST', path: '/api/students',
          statusCode: 201, timestamp: new Date(),
        },
      ]);
      prisma.auditLog.count.mockResolvedValue(1);
      prisma.user.findMany.mockResolvedValue([
        { id: 'u-1', firstName: 'Ali', lastName: 'Karim', email: 'ali@x.com' },
      ]);

      const r = await svc.findAll('org-1', {} as any);
      expect(r.items[0].actorName).toBe('Ali Karim');
    });

    it('falls back to email when name is empty', async () => {
      prisma.auditLog.findMany.mockResolvedValue([
        {
          id: 'a1', organizationId: 'org-1', userId: 'u-1', action: 'CREATE',
          resource: 'STUDENT', resourceId: 's1', changes: null,
          ipAddress: null, userAgent: null, method: 'POST', path: null,
          statusCode: 201, timestamp: new Date(),
        },
      ]);
      prisma.auditLog.count.mockResolvedValue(1);
      prisma.user.findMany.mockResolvedValue([
        { id: 'u-1', firstName: '', lastName: '', email: 'a@x.com' },
      ]);

      const r = await svc.findAll('org-1', {} as any);
      expect(r.items[0].actorName).toBe('a@x.com');
    });

    it('leaves actorName null when no userId', async () => {
      prisma.auditLog.findMany.mockResolvedValue([
        {
          id: 'a1', organizationId: 'org-1', userId: null, action: 'CREATE',
          resource: 'STUDENT', resourceId: 's1', changes: null,
          ipAddress: null, userAgent: null, method: 'POST', path: null,
          statusCode: 201, timestamp: new Date(),
        },
      ]);
      prisma.auditLog.count.mockResolvedValue(1);

      const r = await svc.findAll('org-1', {} as any);
      expect(r.items[0].actorName).toBeNull();
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });
  });

  describe('findAll — change shape', () => {
    it('expands changes JSON into previousValue/newValue/changedFields', async () => {
      prisma.auditLog.findMany.mockResolvedValue([
        {
          id: 'a1', organizationId: 'org-1', userId: null, action: 'UPDATE',
          resource: 'STUDENT', resourceId: 's1',
          changes: { firstName: { old: 'Ali', new: 'Alisher' }, status: { old: 'ACTIVE', new: 'PAUSED' } },
          ipAddress: null, userAgent: null, method: 'PUT', path: null,
          statusCode: 200, timestamp: new Date(),
        },
      ]);
      prisma.auditLog.count.mockResolvedValue(1);

      const r = await svc.findAll('org-1', {} as any);
      expect(r.items[0].changedFields).toEqual(['firstName', 'status']);
      expect(r.items[0].previousValue).toEqual({ firstName: 'Ali', status: 'ACTIVE' });
      expect(r.items[0].newValue).toEqual({ firstName: 'Alisher', status: 'PAUSED' });
    });

    it('handles null changes gracefully', async () => {
      prisma.auditLog.findMany.mockResolvedValue([
        {
          id: 'a1', organizationId: 'org-1', userId: null, action: 'LOGIN',
          resource: 'AUTH', resourceId: null, changes: null,
          ipAddress: null, userAgent: null, method: 'POST', path: null,
          statusCode: 200, timestamp: new Date(),
        },
      ]);
      prisma.auditLog.count.mockResolvedValue(1);

      const r = await svc.findAll('org-1', {} as any);
      expect(r.items[0].changedFields).toBeNull();
      expect(r.items[0].previousValue).toBeNull();
      expect(r.items[0].newValue).toBeNull();
    });
  });

  describe('findAll — action mapping', () => {
    const cases: Array<[string, 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'EXPORT' | 'IMPORT' | 'CUSTOM']> = [
      ['CREATE_STUDENT', 'CREATE'],
      ['POST', 'CREATE'],
      ['UPDATE_TEACHER', 'UPDATE'],
      ['PUT', 'UPDATE'],
      ['PATCH', 'UPDATE'],
      ['DELETE_GROUP', 'DELETE'],
      ['DELETE', 'DELETE'],
      ['LOGIN_SUCCESS', 'LOGIN'],
      ['LOGOUT', 'LOGOUT'],
      ['EXPORT_PAYMENTS', 'EXPORT'],
      ['IMPORT_LEADS', 'IMPORT'],
      ['RANDOM_ACTION', 'CUSTOM'],
    ];

    it.each(cases)('maps raw %s to %s', async (raw, expected) => {
      prisma.auditLog.findMany.mockResolvedValue([
        {
          id: 'a1', organizationId: 'org-1', userId: null, action: raw,
          resource: 'X', resourceId: null, changes: null,
          ipAddress: null, userAgent: null, method: null, path: null,
          statusCode: 200, timestamp: new Date(),
        },
      ]);
      prisma.auditLog.count.mockResolvedValue(1);

      const r = await svc.findAll('org-1', {} as any);
      expect(r.items[0].action).toBe(expected);
    });
  });

  describe('findAll — pagination', () => {
    it('returns page/limit/total/totalPages', async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);
      prisma.auditLog.count.mockResolvedValue(45);
      const r = await svc.findAll('org-1', { page: '2', limit: '10' } as any);
      expect(r.page).toBe(2);
      expect(r.limit).toBe(10);
      expect(r.total).toBe(45);
      expect(r.totalPages).toBe(5);
    });
  });

  describe('findOne', () => {
    it('returns mapped event', async () => {
      prisma.auditLog.findFirst.mockResolvedValue({
        id: 'a1', organizationId: 'org-1', userId: 'u-1', action: 'CREATE_STUDENT',
        resource: 'STUDENT', resourceId: 's1', changes: { firstName: { old: null, new: 'Ali' } },
        ipAddress: '127.0.0.1', userAgent: 'jest', method: 'POST', path: '/api/students',
        statusCode: 201, timestamp: new Date(),
      });
      prisma.user.findUnique.mockResolvedValue({
        firstName: 'Ali', lastName: 'Karim', email: 'ali@x.com',
      });

      const r = await svc.findOne('org-1', 'a1');
      expect(r.id).toBe('a1');
      expect(r.actorName).toBe('Ali Karim');
      expect(r.changedFields).toEqual(['firstName']);
    });

    it('throws NotFoundException when missing', async () => {
      prisma.auditLog.findFirst.mockResolvedValue(null);
      await expect(svc.findOne('org-1', 'nope')).rejects.toThrow('not found');
    });

    it('always includes organizationId in where', async () => {
      prisma.auditLog.findFirst.mockResolvedValue(null);
      try { await svc.findOne('org-xyz', 'a1'); } catch {}
      const where = prisma.auditLog.findFirst.mock.calls[0][0].where;
      expect(where.organizationId).toBe('org-xyz');
      expect(where.id).toBe('a1');
    });
  });

  describe('getEntityHistory', () => {
    it('filters by resource and resourceId', async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);
      await svc.getEntityHistory('org-1', 'STUDENT', 's1');
      const where = prisma.auditLog.findMany.mock.calls[0][0].where;
      expect(where.resource).toBe('STUDENT');
      expect(where.resourceId).toBe('s1');
      expect(where.organizationId).toBe('org-1');
    });

    it('orders by timestamp desc and caps at 200', async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);
      await svc.getEntityHistory('org-1', 'STUDENT', 's1');
      const args = prisma.auditLog.findMany.mock.calls[0][0];
      expect(args.orderBy).toEqual({ timestamp: 'desc' });
      expect(args.take).toBe(200);
    });
  });

  describe('record', () => {
    it('creates an audit log entry', async () => {
      prisma.auditLog.create.mockResolvedValue({ id: 'a1' });
      await svc.record({
        organizationId: 'org-1',
        userId: 'u-1',
        action: 'CREATE_STUDENT',
        resource: 'STUDENT',
        resourceId: 's1',
        changes: { firstName: { old: null, new: 'Ali' } },
        ipAddress: '127.0.0.1',
        method: 'POST',
        path: '/api/students',
        statusCode: 201,
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: 'org-1',
            userId: 'u-1',
            action: 'CREATE_STUDENT',
            resource: 'STUDENT',
            resourceId: 's1',
            statusCode: 201,
          }),
        }),
      );
    });
  });
});
