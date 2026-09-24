import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UsersController } from '../users.controller';
import { UsersService } from '../users.service';
import { ChangePasswordDto, CreateUserDto, UpdateUserDto, UpdateUserSettingsDto } from '../../common/dto';
import { UserQuery } from '../../common/dto/query';
import { RequestUser } from '../../auth/types';
import { Role } from '@prisma/client';

describe('UsersController', () => {
  let controller: UsersController;
  let service: {
    findAll: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    changePassword: ReturnType<typeof vi.fn>;
    updateSettings: ReturnType<typeof vi.fn>;
  };

  const orgId = 'org-uuid-1';
  const mockUser: RequestUser = {
    sub: 'user-uuid-1',
    email: 'admin@edu.local',
    role: Role.SUPER_ADMIN,
    organizationId: orgId,
    sid: 'session-uuid-1',
  };

  beforeEach(() => {
    service = {
      findAll: vi.fn(),
      findOne: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      changePassword: vi.fn(),
      updateSettings: vi.fn(),
    };
    controller = new UsersController(service as unknown as UsersService);
  });

  it('findAll calls service.findAll', async () => {
    const query: UserQuery = { search: 'Test', page: '1', limit: '10' };
    const expected = { items: [], total: 0, page: 1, limit: 10, totalPages: 0 };
    service.findAll.mockResolvedValue(expected);

    const result = await controller.findAll(orgId, query);
    expect(result).toBe(expected);
    expect(service.findAll).toHaveBeenCalledWith(orgId, query);
  });

  it('findOne calls service.findOne', async () => {
    const expected = { id: 'u1', organizationId: orgId };
    service.findOne.mockResolvedValue(expected);

    const result = await controller.findOne(orgId, 'u1');
    expect(result).toBe(expected);
    expect(service.findOne).toHaveBeenCalledWith(orgId, 'u1');
  });

  it('create calls service.create', async () => {
    const dto: CreateUserDto = {
      email: 'new@edu.local',
      firstName: 'New',
      lastName: 'User',
      role: Role.TEACHER,
      password: 'password123',
    };
    const expected = { id: 'u2', email: dto.email };
    service.create.mockResolvedValue(expected);

    const result = await controller.create(orgId, Role.SUPER_ADMIN, dto);
    expect(result).toBe(expected);
    expect(service.create).toHaveBeenCalledWith(orgId, dto, Role.SUPER_ADMIN);
  });

  it('update calls service.update', async () => {
    const dto: UpdateUserDto = { firstName: 'Updated' };
    const expected = { id: 'u2', firstName: 'Updated' };
    service.update.mockResolvedValue(expected);

    const result = await controller.update(orgId, Role.SUPER_ADMIN, mockUser.sub, 'u2', dto);
    expect(result).toBe(expected);
    expect(service.update).toHaveBeenCalledWith(orgId, 'u2', dto, Role.SUPER_ADMIN, mockUser.sub);
  });

  it('remove calls service.remove', async () => {
    const expected = { message: 'User deleted successfully' };
    service.remove.mockResolvedValue(expected);

    const result = await controller.remove(orgId, mockUser.sub, Role.SUPER_ADMIN, 'u2');
    expect(result).toBe(expected);
    expect(service.remove).toHaveBeenCalledWith(orgId, 'u2', mockUser.sub, Role.SUPER_ADMIN);
  });

  it('changePassword calls service.changePassword with current session id', async () => {
    const dto: ChangePasswordDto = { currentPassword: 'old', newPassword: 'new' };
    const expected = { message: 'Password changed successfully' };
    service.changePassword.mockResolvedValue(expected);

    const result = await controller.changePassword({ user: mockUser } as any, dto);
    expect(result).toBe(expected);
    expect(service.changePassword).toHaveBeenCalledWith(
      orgId,
      'user-uuid-1',
      'old',
      'new',
      'session-uuid-1',
    );
  });

  it('updateSettings calls service.updateSettings', async () => {
    const dto: UpdateUserSettingsDto = { theme: 'dark' };
    const expected = { userId: 'u1', theme: 'dark' };
    service.updateSettings.mockResolvedValue(expected);

    const result = await controller.updateSettings(orgId, mockUser.sub, Role.SUPER_ADMIN, 'u1', dto);
    expect(result).toBe(expected);
    expect(service.updateSettings).toHaveBeenCalledWith(orgId, 'u1', dto, mockUser.sub, Role.SUPER_ADMIN);
  });
});
