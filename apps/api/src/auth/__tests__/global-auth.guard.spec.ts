import { Controller, Get, type INestApplication } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import type { AddressInfo } from 'net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { AllowPublic } from '../public.decorator';
import { GlobalAuthGuard } from '../global-auth.guard';
import { JwtStrategy } from '../jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Runtime proof that authentication is fail-closed.
 *
 * Boots a real Nest HTTP application with `GlobalAuthGuard` registered as the
 * `APP_GUARD` and the REAL `JwtStrategy` behind it (Prisma replaced by an
 * in-memory double), so every assertion below travels the exact production
 * path: Express → global guard → passport `jwt` strategy → `validate()` →
 * controller. Nothing is stubbed at the guard boundary.
 */

const SECRET = 'unit-test-secret-32-chars-minimum!!';

const USER = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'guard.probe@medu.test',
  role: 'ORG_ADMIN',
  organizationId: '22222222-2222-2222-2222-222222222222',
  isActive: true,
  status: 'ACTIVE',
};

const SESSION = {
  id: '33333333-3333-3333-3333-333333333333',
  revokedAt: null as Date | null,
  expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  userId: USER.id,
  organizationId: USER.organizationId,
};

function makePrismaDouble() {
  return {
    user: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        where.id === USER.id ? USER : null,
      ),
    },
    session: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        where.id === SESSION.id ? SESSION : null,
      ),
    },
  };
}

@AllowPublic()
@Controller('probe/class-open')
class ClassOpenController {
  @Get()
  ok() {
    return { ok: true };
  }
}

@Controller('probe/class-closed')
class ClassClosedController {
  @Get()
  ok() {
    return { ok: true };
  }

  @Get('handler-open')
  @AllowPublic()
  handlerOpen() {
    return { ok: true };
  }
}

describe('GlobalAuthGuard (fail-closed HTTP)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let prisma: ReturnType<typeof makePrismaDouble>;

  const sign = (payload: Record<string, unknown>, options: { expiresIn?: string; secret?: string } = {}) =>
    new JwtService({ secret: options.secret ?? SECRET }).sign(payload, {
      expiresIn: options.expiresIn ?? '1h',
    });

  const validPayload = () => ({
    sub: USER.id,
    email: USER.email,
    role: USER.role,
    organizationId: USER.organizationId,
    sid: SESSION.id,
  });

  const get = async (path: string, token?: string) => {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${baseUrl}${path}`, { headers });
    return res.status;
  };

  beforeAll(async () => {
    prisma = makePrismaDouble();

    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [ClassOpenController, ClassClosedController],
      providers: [
        {
          provide: APP_GUARD,
          useFactory: (reflector: Reflector) => new GlobalAuthGuard(reflector),
          inject: [Reflector],
        },
        {
          provide: JwtStrategy,
          useFactory: (cfg: ConfigService, pr: PrismaService) => new JwtStrategy(cfg, pr),
          inject: [ConfigService, PrismaService],
        },
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: (key: string) => (key === 'JWT_SECRET' ? SECRET : undefined) } },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.listen(0);
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('exposes a @AllowPublic() controller without any credential', async () => {
    expect(await get('/probe/class-open')).toBe(200);
  });

  it('keeps @AllowPublic() reachable even when a garbage credential is presented', async () => {
    expect(await get('/probe/class-open', 'not-a-jwt')).toBe(200);
  });

  it('rejects an anonymous request to a route that carries no @AllowPublic()', async () => {
    expect(await get('/probe/class-closed')).toBe(401);
  });

  it('exposes a @AllowPublic() route handler inside an otherwise closed controller', async () => {
    expect(await get('/probe/class-closed/handler-open')).toBe(200);
  });

  it('accepts a valid, unexpired JWT whose session is live', async () => {
    expect(await get('/probe/class-closed', sign(validPayload()))).toBe(200);
  });

  it('rejects a JWT signed with the wrong secret', async () => {
    expect(await get('/probe/class-closed', sign(validPayload(), { secret: 'attacker-controlled-secret-32ch' }))).toBe(401);
  });

  it('rejects an expired JWT', async () => {
    expect(await get('/probe/class-closed', sign(validPayload(), { expiresIn: '-1s' }))).toBe(401);
  });

  it('rejects a JWT whose session id does not exist (revoked / purged)', async () => {
    expect(await get('/probe/class-closed', sign({ ...validPayload(), sid: '99999999-9999-9999-9999-999999999999' }))).toBe(401);
  });

  it('rejects a JWT for a user the identity store does not know', async () => {
    expect(await get('/probe/class-closed', sign({ ...validPayload(), sub: '44444444-4444-4444-4444-444444444444' }))).toBe(401);
  });

  it('verifies the credential exactly once per request (global guard only)', async () => {
    prisma.user.findUnique.mockClear();
    prisma.session.findUnique.mockClear();

    expect(await get('/probe/class-closed', sign(validPayload()))).toBe(200);
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.session.findUnique).toHaveBeenCalledTimes(1);
  });

  it('lets non-HTTP contexts through so gateway guards stay authoritative', async () => {
    const guard = new GlobalAuthGuard(new Reflector());
    const context = {
      getType: () => 'ws',
      switchToHttp: () => {
        throw new Error('non-HTTP context must never reach the HTTP branch');
      },
      getHandler: () => undefined,
      getClass: () => undefined,
    } as never;

    expect(guard.canActivate(context)).toBe(true);
  });
});
