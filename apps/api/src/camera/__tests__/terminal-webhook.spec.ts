import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TerminalAuthGuard } from '../terminal-auth.guard';
import { TerminalWebhookController } from '../terminal-webhook.controller';
import { API_KEY_SCOPES_KEY, type ApiKeyGuard } from '../../api-keys/api-keys.guard';
import type { AttendanceDecisionEngine } from '../attendance-decision.engine';
import type { PrismaService } from '../../prisma/prisma.service';

/**
 * P0 regression: the hardware terminal webhook used to accept ANY non-empty
 * `x-terminal-token` value and to resolve the camera by id alone — so any
 * network peer could inject attendance events for any tenant.
 *
 * These tests pin the two halves of the fix:
 *   1. the token is a real, scoped credential (delegated to ApiKeyGuard), and
 *   2. the camera is resolved inside the token's organization only.
 */

describe('TerminalAuthGuard', () => {
  let apiKeyGuard: { canActivate: ReturnType<typeof vi.fn> };
  let guard: TerminalAuthGuard;
  let request: { headers: Record<string, string | undefined> };

  function context(): ExecutionContext {
    return {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => undefined,
      getClass: () => undefined,
      getType: () => 'http',
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    apiKeyGuard = { canActivate: vi.fn().mockResolvedValue(true) };
    guard = new TerminalAuthGuard(apiKeyGuard as unknown as ApiKeyGuard);
    request = { headers: {} };
  });

  it('rejects a request with no terminal token before touching the API-key verifier', async () => {
    request.headers = {};
    await expect(guard.canActivate(context())).rejects.toThrow(UnauthorizedException);
    expect(apiKeyGuard.canActivate).not.toHaveBeenCalled();
  });

  it('rejects an empty or whitespace-only terminal token', async () => {
    for (const value of ['', '    ']) {
      request.headers = { 'x-terminal-token': value };
      await expect(guard.canActivate(context())).rejects.toThrow('Terminal token is missing');
    }
    expect(apiKeyGuard.canActivate).not.toHaveBeenCalled();
  });

  it('maps the device header onto the standard ApiKey transport and delegates', async () => {
    request.headers = { 'x-terminal-token': 'medu_12345678_secret' };

    await expect(guard.canActivate(context())).resolves.toBe(true);

    expect(request.headers.authorization).toBe('ApiKey medu_12345678_secret');
    expect(apiKeyGuard.canActivate).toHaveBeenCalledTimes(1);
  });

  it('trims surrounding whitespace that terminals often append', async () => {
    request.headers = { 'x-terminal-token': '  medu_12345678_secret\n' };

    await guard.canActivate(context());

    expect(request.headers.authorization).toBe('ApiKey medu_12345678_secret');
  });

  it('returns the verifier result unchanged (revoked / expired / wrong scope propagate)', async () => {
    apiKeyGuard.canActivate.mockResolvedValue(false);
    request.headers = { 'x-terminal-token': 'medu_12345678_secret' };

    await expect(guard.canActivate(context())).resolves.toBe(false);
  });

  it('propagates verifier rejections instead of swallowing them', async () => {
    apiKeyGuard.canActivate.mockRejectedValue(new UnauthorizedException('Invalid API key'));
    request.headers = { 'x-terminal-token': 'medu_12345678_secret' };

    await expect(guard.canActivate(context())).rejects.toThrow('Invalid API key');
  });

  it('never overwrites an Authorization header the caller already sent', async () => {
    request.headers = {
      authorization: 'ApiKey existing',
      'x-terminal-token': 'medu_12345678_secret',
    };

    await guard.canActivate(context());

    expect(request.headers.authorization).toBe('ApiKey existing');
  });
});

describe('TerminalWebhookController', () => {
  const ORG_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const ORG_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const CAMERA_A = '11111111-1111-1111-1111-111111111111';
  const CAMERA_B = '22222222-2222-2222-2222-222222222222';
  const STUDENT = '33333333-3333-3333-3333-333333333333';

  let prisma: { camera: { findFirst: ReturnType<typeof vi.fn> } };
  let engine: { processRecognition: ReturnType<typeof vi.fn> };
  let controller: TerminalWebhookController;

  const payload = (deviceId: string) => ({
    deviceId,
    userId: STUDENT,
    timestamp: new Date().toISOString(),
    confidence: 0.99,
  });

  const call = (organizationId: string | undefined, deviceId: string) =>
    controller.handleTerminalEvent(
      { user: organizationId ? { organizationId } : {} } as never,
      payload(deviceId) as never,
    );

  beforeEach(() => {
    prisma = { camera: { findFirst: vi.fn() } };
    engine = { processRecognition: vi.fn().mockResolvedValue(undefined) };
    controller = new TerminalWebhookController(
      engine as unknown as AttendanceDecisionEngine,
      prisma as unknown as PrismaService,
    );
  });

  it('declares the attendance:write scope requirement on the webhook route', () => {
    const scopes = Reflect.getMetadata(
      API_KEY_SCOPES_KEY,
      TerminalWebhookController.prototype.handleTerminalEvent,
    );
    expect(scopes).toEqual(['attendance:write']);
  });

  it('refuses to run without an authenticated organization', async () => {
    await expect(call(undefined, CAMERA_A)).rejects.toThrow(UnauthorizedException);
    expect(prisma.camera.findFirst).not.toHaveBeenCalled();
    expect(engine.processRecognition).not.toHaveBeenCalled();
  });

  it('scopes the camera lookup to the token organization (cross-tenant id is invisible)', async () => {
    prisma.camera.findFirst.mockResolvedValue(null);

    await expect(call(ORG_A, CAMERA_B)).rejects.toThrow(UnauthorizedException);

    expect(prisma.camera.findFirst).toHaveBeenCalledWith({
      where: { id: CAMERA_B, organizationId: ORG_A },
      select: { id: true, organizationId: true },
    });
    expect(engine.processRecognition).not.toHaveBeenCalled();
  });

  it('answers identically for an out-of-tenant id and an unknown id (no enumeration oracle)', async () => {
    prisma.camera.findFirst.mockResolvedValue(null);
    const outOfTenant = await call(ORG_A, CAMERA_B).catch((e: unknown) => e);
    const unknown = await call(ORG_A, '99999999-9999-9999-9999-999999999999').catch((e: unknown) => e);

    expect(outOfTenant).toBeInstanceOf(UnauthorizedException);
    expect(unknown).toBeInstanceOf(UnauthorizedException);
    expect((outOfTenant as UnauthorizedException).message).toBe(
      (unknown as UnauthorizedException).message,
    );
  });

  it('rejects a malformed device id before it reaches Prisma (no 500, no oracle)', async () => {
    for (const bad of ['', 'not-a-uuid', '../../etc/passwd', '11111111111111111111111111111111']) {
      prisma.camera.findFirst.mockClear();
      await expect(call(ORG_A, bad)).rejects.toThrow(UnauthorizedException);
      expect(prisma.camera.findFirst).not.toHaveBeenCalled();
    }
  });

  it('processes an event for a camera inside the token organization', async () => {
    prisma.camera.findFirst.mockResolvedValue({ id: CAMERA_A, organizationId: ORG_A });

    const result = await call(ORG_A, CAMERA_A);

    expect(result).toEqual({ success: true });
    expect(engine.processRecognition).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG_A,
        cameraId: CAMERA_A,
        studentId: STUDENT,
      }),
    );
  });

  it('never lets a foreign organizationId reach the attendance engine', async () => {
    // Even if a caller somehow injected ORG_B, the camera row resolved under
    // ORG_A carries ORG_A and that is what the engine is given.
    prisma.camera.findFirst.mockResolvedValue({ id: CAMERA_A, organizationId: ORG_A });

    await call(ORG_A, CAMERA_A);

    expect(engine.processRecognition).not.toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: ORG_B }),
    );
  });

  it('rejects an unparseable timestamp instead of silently shifting attendance', async () => {
    prisma.camera.findFirst.mockResolvedValue({ id: CAMERA_A, organizationId: ORG_A });
    await expect(
      controller.handleTerminalEvent(
        { user: { organizationId: ORG_A } } as never,
        { deviceId: CAMERA_A, userId: STUDENT, timestamp: 'not-a-date' } as never,
      ),
    ).rejects.toThrow('Invalid timestamp');
    expect(engine.processRecognition).not.toHaveBeenCalled();
  });

  it('converts engine failures into a non-retryable 200 (no retry storm)', async () => {
    prisma.camera.findFirst.mockResolvedValue({ id: CAMERA_A, organizationId: ORG_A });
    engine.processRecognition.mockRejectedValue(new Error('db down'));

    await expect(call(ORG_A, CAMERA_A)).resolves.toEqual({
      success: false,
      error: 'Internal processing error',
    });
  });

  it('is reachable without a user session but never without a scoped API key', () => {
    // The route is @AllowPublic() (hardware has no user JWT); the API-key
    // requirement is what actually closes it.
    expect(Reflect.getMetadata('isPublic', TerminalWebhookController)).toBe(true);
    expect(apiKeyGuardIsApplied()).toBe(true);
  });
});

function apiKeyGuardIsApplied(): boolean {
  const guards: unknown[] = Reflect.getMetadata(GUARDS_METADATA, TerminalWebhookController) ?? [];
  return guards.includes(TerminalAuthGuard);
}
