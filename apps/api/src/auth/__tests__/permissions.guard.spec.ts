import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { PermissionsGuard } from '../permissions.guard';
import { Permissions } from '@medu/contracts';

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: { getAllAndOverride: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    reflector = {
      getAllAndOverride: vi.fn(),
    };
    guard = new PermissionsGuard(reflector as unknown as Reflector);
  });

  function makeContext(user?: unknown): ExecutionContext {
    return {
      getHandler: () => () => {},
      getClass: () => class {},
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  }

  it('allows access when no permissions are required', () => {
    reflector.getAllAndOverride.mockReturnValue(null);
    const ctx = makeContext();
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws UnauthorizedException when user is missing or has no role', () => {
    reflector.getAllAndOverride.mockReturnValue([Permissions.CAMERA_VIEW]);
    const ctx = makeContext(undefined);
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);

    const ctxNoRole = makeContext({ email: 'a@b.com' });
    expect(() => guard.canActivate(ctxNoRole)).toThrow(UnauthorizedException);
  });

  it('throws ForbiddenException when role has no permissions registered', () => {
    reflector.getAllAndOverride.mockReturnValue([Permissions.CAMERA_VIEW]);
    const ctx = makeContext({ role: 'UNKNOWN_ROLE' });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when role lacks required permission', () => {
    reflector.getAllAndOverride.mockReturnValue([Permissions.CAMERA_MANAGE]);
    const ctx = makeContext({ role: 'TEACHER' });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('allows access when role has all required permissions', () => {
    reflector.getAllAndOverride.mockReturnValue([Permissions.CAMERA_VIEW]);
    const ctx = makeContext({ role: 'ORG_ADMIN' });
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
