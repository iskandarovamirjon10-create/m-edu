import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExecutionContext } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { WsJwtGuard } from '../ws-jwt.guard';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

describe('WsJwtGuard', () => {
  let guard: WsJwtGuard;
  let mockJwtService: { verify: ReturnType<typeof vi.fn> };
  let mockPrisma: { user: { findUnique: ReturnType<typeof vi.fn> } };
  let mockConfig: { get: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockJwtService = {
      verify: vi.fn(),
    };
    mockPrisma = {
      user: {
        findUnique: vi.fn(),
      },
    };
    mockConfig = {
      get: vi.fn().mockReturnValue('super-secret-jwt-key'),
    };

    guard = new WsJwtGuard(
      mockJwtService as unknown as JwtService,
      mockPrisma as unknown as PrismaService,
      mockConfig as unknown as ConfigService,
    );
  });

  function createMockContext(handshake: {
    headers?: Record<string, string>;
    auth?: Record<string, string>;
  }): {
    context: ExecutionContext;
    client: { handshake: typeof handshake; user?: unknown };
  } {
    const client = {
      handshake: {
        headers: handshake.headers || {},
        auth: handshake.auth || {},
      },
      user: undefined,
    };

    const context = {
      switchToWs: () => ({
        getClient: () => client,
      }),
    } as unknown as ExecutionContext;

    return { context, client };
  }

  it('should authenticate via Bearer authorization header', async () => {
    const { context, client } = createMockContext({
      headers: { authorization: 'Bearer valid.jwt.token' },
    });

    mockJwtService.verify.mockReturnValue({ sub: 'user-1' });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      organizationId: 'org-1',
      role: 'STUDENT',
      isActive: true,
    });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(mockJwtService.verify).toHaveBeenCalledWith('valid.jwt.token', {
      secret: 'super-secret-jwt-key',
    });
    expect(client.user).toEqual({
      id: 'user-1',
      email: 'user@example.com',
      organizationId: 'org-1',
      role: 'STUDENT',
      isActive: true,
    });
  });

  it('should authenticate via handshake.auth.token', async () => {
    const { context, client } = createMockContext({
      auth: { token: 'auth.payload.token' },
    });

    mockJwtService.verify.mockReturnValue({ sub: 'user-2' });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-2',
      email: 'admin@example.com',
      organizationId: 'org-2',
      role: 'ORG_ADMIN',
      isActive: true,
    });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(mockJwtService.verify).toHaveBeenCalledWith('auth.payload.token', {
      secret: 'super-secret-jwt-key',
    });
    expect(client.user).toBeDefined();
  });

  it('should authenticate via cookie header', async () => {
    const { context, client } = createMockContext({
      headers: { cookie: 'other=123; access_token=cookie.jwt.token; lang=en' },
    });

    mockJwtService.verify.mockReturnValue({ sub: 'user-3' });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-3',
      email: 'teacher@example.com',
      organizationId: 'org-1',
      role: 'TEACHER',
      isActive: true,
    });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(mockJwtService.verify).toHaveBeenCalledWith('cookie.jwt.token', {
      secret: 'super-secret-jwt-key',
    });
    expect(client.user).toBeDefined();
  });

  it('should throw WsException when token is missing', async () => {
    const { context } = createMockContext({});

    await expect(guard.canActivate(context)).rejects.toThrow(WsException);
  });

  it('should throw WsException when JWT_SECRET is not configured', async () => {
    mockConfig.get.mockReturnValue(undefined);
    const { context } = createMockContext({
      headers: { authorization: 'Bearer any.token' },
    });

    await expect(guard.canActivate(context)).rejects.toThrow(WsException);
  });

  it('should throw WsException when token verification fails', async () => {
    mockJwtService.verify.mockImplementation(() => {
      throw new Error('invalid token');
    });

    const { context } = createMockContext({
      headers: { authorization: 'Bearer corrupted.token' },
    });

    await expect(guard.canActivate(context)).rejects.toThrow(WsException);
  });

  it('should throw WsException when user is not found in database', async () => {
    mockJwtService.verify.mockReturnValue({ sub: 'deleted-user' });
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const { context } = createMockContext({
      headers: { authorization: 'Bearer valid.jwt.token' },
    });

    await expect(guard.canActivate(context)).rejects.toThrow(WsException);
  });
});
