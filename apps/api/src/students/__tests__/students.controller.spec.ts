import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { StudentsController } from '../students.controller';
import { StudentsService } from '../students.service';
import { CreateStudentDto, UpdateStudentDto } from '../../common/dto';
import { StudentQuery } from '../../common/dto/query';
import { RolesGuard } from '../../auth/roles.guard';
import { ROLES_KEY } from '../../auth/roles.decorator';

describe('StudentsController', () => {
  let controller: StudentsController;
  let service: {
    findAll: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    assignToGroup: ReturnType<typeof vi.fn>;
    removeFromGroup: ReturnType<typeof vi.fn>;
  };

  const orgId = 'org-uuid-1';

  beforeEach(() => {
    service = {
      findAll: vi.fn(),
      findOne: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      assignToGroup: vi.fn(),
      removeFromGroup: vi.fn(),
    };
    controller = new StudentsController(service as unknown as StudentsService);
  });

  it('delegates findAll to service', async () => {
    const query: StudentQuery = { search: 'John', page: '1', limit: '10' };
    const expected = { items: [], total: 0, page: 1, limit: 10, totalPages: 0 };
    service.findAll.mockResolvedValue(expected);

    const result = await controller.findAll(orgId, query);
    expect(result).toBe(expected);
    expect(service.findAll).toHaveBeenCalledWith(orgId, query);
  });

  it('delegates findOne to service', async () => {
    const expected = { id: 's1', organizationId: orgId };
    service.findOne.mockResolvedValue(expected);

    const result = await controller.findOne(orgId, 's1');
    expect(result).toBe(expected);
    expect(service.findOne).toHaveBeenCalledWith(orgId, 's1');
  });

  it('delegates create to service', async () => {
    const dto: CreateStudentDto = { firstName: 'Ali', lastName: 'Valiyev' };
    const expected = { id: 's1', organizationId: orgId };
    service.create.mockResolvedValue(expected);

    const result = await controller.create(orgId, dto);
    expect(result).toBe(expected);
    expect(service.create).toHaveBeenCalledWith(orgId, dto);
  });

  it('delegates update to service', async () => {
    const dto: UpdateStudentDto = { address: 'Tashkent' };
    const expected = { id: 's1', address: 'Tashkent' };
    service.update.mockResolvedValue(expected);

    const result = await controller.update(orgId, 's1', dto);
    expect(result).toBe(expected);
    expect(service.update).toHaveBeenCalledWith(orgId, 's1', dto);
  });

  it('delegates remove to service', async () => {
    const expected = { message: 'Student deleted successfully' };
    service.remove.mockResolvedValue(expected);

    const result = await controller.remove(orgId, 's1');
    expect(result).toBe(expected);
    expect(service.remove).toHaveBeenCalledWith(orgId, 's1');
  });

  it('delegates assignToGroup to service', async () => {
    const expected = { id: 'm1' };
    service.assignToGroup.mockResolvedValue(expected);

    const result = await controller.assignToGroup(orgId, 's1', 'g1');
    expect(result).toBe(expected);
    expect(service.assignToGroup).toHaveBeenCalledWith(orgId, 's1', 'g1');
  });

  it('delegates removeFromGroup to service', async () => {
    const expected = { id: 'm1', isActive: false };
    service.removeFromGroup.mockResolvedValue(expected);

    const result = await controller.removeFromGroup(orgId, 's1', 'g1');
    expect(result).toBe(expected);
    expect(service.removeFromGroup).toHaveBeenCalledWith(orgId, 's1', 'g1');
  });

  describe('Parent Associations', () => {
    it('delegates getParents to service', async () => {
      const expected = [{ id: 'p1', parent: { email: 'parent@example.com' } }];
      (service as any).getStudentParents = vi.fn().mockResolvedValue(expected);

      const result = await controller.getParents(orgId, 's1');
      expect(result).toBe(expected);
      expect((service as any).getStudentParents).toHaveBeenCalledWith(orgId, 's1');
    });

    it('delegates createParent to service', async () => {
      const dto = { email: 'parent@example.com', firstName: 'John', lastName: 'Doe' };
      const expected = { id: 'link-1' };
      (service as any).createOrLinkParent = vi.fn().mockResolvedValue(expected);

      const result = await controller.createParent(orgId, 's1', dto as any);
      expect(result).toBe(expected);
      expect((service as any).createOrLinkParent).toHaveBeenCalledWith(orgId, 's1', dto);
    });

    it('delegates updateParentLink to service', async () => {
      const dto = { relationship: 'mother' };
      const expected = { id: 'link-1', relationship: 'mother' };
      (service as any).updateParentLink = vi.fn().mockResolvedValue(expected);

      const result = await controller.updateParentLink(orgId, 's1', 'p1', dto as any);
      expect(result).toBe(expected);
      expect((service as any).updateParentLink).toHaveBeenCalledWith(orgId, 's1', 'p1', dto);
    });

    it('delegates unlinkParent to service', async () => {
      const expected = { success: true };
      (service as any).unlinkParent = vi.fn().mockResolvedValue(expected);

      const result = await controller.unlinkParent(orgId, 's1', 'p1');
      expect(result).toBe(expected);
      expect((service as any).unlinkParent).toHaveBeenCalledWith(orgId, 's1', 'p1');
    });
  });
});

describe('StudentsController — Parent Routes RBAC Authorization', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  function makeContext(user?: { role?: string; organizationId?: string }): ExecutionContext {
    return {
      getHandler: () => StudentsController.prototype.getParents,
      getClass: () => StudentsController,
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  }

  it('declares STAFF_ROLES on getParents', () => {
    const roles = reflector.get(ROLES_KEY, StudentsController.prototype.getParents);
    expect(roles).toBeDefined();
    expect(roles).toContain(Role.SUPER_ADMIN);
    expect(roles).toContain(Role.ORG_ADMIN);
    expect(roles).toContain(Role.TEACHER);
    expect(roles).toContain(Role.MANAGER);
    expect(roles).toContain(Role.ASSISTANT);
  });

  it('allows SUPER_ADMIN to access getParents', () => {
    expect(guard.canActivate(makeContext({ role: Role.SUPER_ADMIN, organizationId: 'org-1' }))).toBe(true);
  });

  it('allows ORG_ADMIN to access getParents', () => {
    expect(guard.canActivate(makeContext({ role: Role.ORG_ADMIN, organizationId: 'org-1' }))).toBe(true);
  });

  it('allows TEACHER to access getParents', () => {
    expect(guard.canActivate(makeContext({ role: Role.TEACHER, organizationId: 'org-1' }))).toBe(true);
  });

  it('allows MANAGER to access getParents', () => {
    expect(guard.canActivate(makeContext({ role: Role.MANAGER, organizationId: 'org-1' }))).toBe(true);
  });

  it('denies PARENT role from accessing getParents', () => {
    expect(guard.canActivate(makeContext({ role: Role.PARENT, organizationId: 'org-1' }))).toBe(false);
  });

  it('denies STUDENT role from accessing getParents', () => {
    expect(guard.canActivate(makeContext({ role: Role.STUDENT, organizationId: 'org-1' }))).toBe(false);
  });

  it('denies unauthenticated request with no token / no user', () => {
    expect(guard.canActivate(makeContext(undefined))).toBe(false);
  });
});


