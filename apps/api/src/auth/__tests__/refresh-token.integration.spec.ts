import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import type { Response } from 'express';
import * as bcrypt from 'bcryptjs';

import { AuthService } from '../auth.service';
import { AuthController } from '../auth.controller';
import { JwtStrategy } from '../jwt.strategy';
import { ParentPortalService } from '../../parent-portal/parent-portal.service';
import { authTtlSeconds } from '../auth.ttl';
import type { RequestUser } from '../types';

/**
 * Refresh-token session lifecycle against a REAL PostgreSQL instance.
 *
 * The contract under test is that the session table is chosen EXPLICITLY from
 * the token's role claim and never guessed from the id:
 *
 *   USER   -> sid -> Session        -> User          -> new Session + JWT
 *   PARENT -> sid -> ParentSession  -> ParentAccount -> new ParentSession + JWT
 *
 * Every failure mode must fail CLOSED with 401 rather than resolving against
 * the wrong table or the wrong tenant.
 */
describe('Refresh token: session-type distinction (real PostgreSQL)', () => {
  const prisma = new PrismaClient();
  const jwtSecret = process.env.JWT_SECRET || 'medu-dev-secret-do-not-use-in-production';
  const jwtService = new JwtService({
    secret: jwtSecret,
    signOptions: { expiresIn: authTtlSeconds() },
  });

  const authService = new AuthService(prisma as never, jwtService);
  const parentPortalService = new ParentPortalService(prisma as never);
  const controller = new AuthController(authService, parentPortalService);
  const jwtStrategy = new JwtStrategy(
    { get: (key: string) => process.env[key] } as never,
    prisma as never,
  );

  const stamp = Date.now();
  const PARENT_PASSWORD = `ParentPass-${stamp}!`;
  const USER_PASSWORD = `UserPass-${stamp}!`;

  let orgAId: string;
  let orgBId: string;
  let parentId: string;
  let otherParentId: string;
  let userAId: string;
  let userBId: string;
  const parentEmail = `parent.refresh.${stamp}@test.local`;
  const otherParentEmail = `parent2.refresh.${stamp}@test.local`;
  const userEmail = `user.refresh.${stamp}@test.local`;
  const otherUserEmail = `user2.refresh.${stamp}@test.local`;

  const mockResponse = () => {
    const res = {
      cookie: vi.fn().mockReturnThis(),
      clearCookie: vi.fn().mockReturnThis(),
      redirect: vi.fn().mockReturnThis(),
    };
    return res as unknown as Response & {
      cookie: ReturnType<typeof vi.fn>;
      clearCookie: ReturnType<typeof vi.fn>;
    };
  };

  /** Read the sid out of a cookie value set by the controller. */
  const sidOf = (token: string): string => {
    const payload = jwtService.decode(token) as { sid?: string } | null;
    expect(payload?.sid).toBeTruthy();
    return payload!.sid!;
  };

  /** Build the `req.user` shape JwtStrategy would attach for a given token. */
  const principalFor = (token: string, role: string): RequestUser => {
    const payload = jwtService.decode(token) as Record<string, unknown>;
    return {
      sub: payload.sub as string,
      email: payload.email as string,
      role,
      organizationId: payload.organizationId as string,
      sid: (payload.sid as string) ?? null,
    };
  };

  const future = () => new Date(Date.now() + 60 * 60 * 1000);

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash(USER_PASSWORD, 4);
    const parentHash = await bcrypt.hash(PARENT_PASSWORD, 4);

    const orgA = await prisma.organization.create({
      data: { name: `Refresh Org A ${stamp}`, email: `org-a.${stamp}@test.local` },
    });
    orgAId = orgA.id;

    const orgB = await prisma.organization.create({
      data: { name: `Refresh Org B ${stamp}`, email: `org-b.${stamp}@test.local` },
    });
    orgBId = orgB.id;

    const parent = await prisma.parentAccount.create({
      data: {
        organizationId: orgAId,
        email: parentEmail,
        firstName: 'Parent',
        lastName: 'Alpha',
        passwordHash: parentHash,
      },
    });
    parentId = parent.id;

    const otherParent = await prisma.parentAccount.create({
      data: {
        organizationId: orgAId,
        email: otherParentEmail,
        firstName: 'Parent',
        lastName: 'Beta',
        passwordHash: parentHash,
      },
    });
    otherParentId = otherParent.id;

    const userA = await prisma.user.create({
      data: {
        organizationId: orgAId,
        email: userEmail,
        firstName: 'User',
        lastName: 'Alpha',
        passwordHash,
        role: 'STUDENT',
      },
    });
    userAId = userA.id;

    const userB = await prisma.user.create({
      data: {
        organizationId: orgBId,
        email: otherUserEmail,
        firstName: 'User',
        lastName: 'Beta',
        passwordHash,
        role: 'STUDENT',
      },
    });
    userBId = userB.id;
  });

  afterAll(async () => {
    try {
      await prisma.authorizationCode.deleteMany({ where: { userId: { in: [userAId, userBId].filter(Boolean) } } });
      await prisma.passwordResetToken.deleteMany({
        where: { userId: { in: [userAId, userBId].filter(Boolean) } },
      });
      await prisma.session.deleteMany({
        where: { organizationId: { in: [orgAId, orgBId].filter(Boolean) } },
      });
      await prisma.parentSession.deleteMany({
        where: { organizationId: { in: [orgAId, orgBId].filter(Boolean) } },
      });
      await prisma.user.deleteMany({
        where: { organizationId: { in: [orgAId, orgBId].filter(Boolean) } },
      });
      await prisma.parentAccount.deleteMany({
        where: { organizationId: { in: [orgAId, orgBId].filter(Boolean) } },
      });
      await prisma.organization.deleteMany({
        where: { id: { in: [orgAId, orgBId].filter(Boolean) } },
      });
    } finally {
      await prisma.$disconnect();
    }
  });

  // ── 1 ────────────────────────────────────────────────────────────────────
  it('1. parent login -> refresh succeeds', async () => {
    const loginRes = mockResponse();
    const login = await controller.parentLogin(
      { email: parentEmail, password: PARENT_PASSWORD } as never,
      loginRes,
    );
    expect(login.user.role).toBe('PARENT');
    expect(login.user.id).toBe(parentId);

    const firstToken = loginRes.cookie.mock.calls[0][1] as string;
    const firstSid = sidOf(firstToken);

    const refreshRes = mockResponse();
    const refreshed = await controller.refresh(
      { user: principalFor(firstToken, 'PARENT') } as never,
      refreshRes,
    );

    expect(refreshed.user.role).toBe('PARENT');
    expect(refreshed.user.id).toBe(parentId);
    expect(refreshed.user.organizationId).toBe(orgAId);

    const secondToken = refreshRes.cookie.mock.calls[0][1] as string;
    const secondSid = sidOf(secondToken);
    expect(secondSid).not.toBe(firstSid);

    const oldSession = await prisma.parentSession.findUnique({ where: { id: firstSid } });
    expect(oldSession?.revokedAt).not.toBeNull();
    expect(oldSession?.revokedReason).toBe('token_refresh');

    const newSession = await prisma.parentSession.findUnique({ where: { id: secondSid } });
    expect(newSession?.revokedAt).toBeNull();
    expect(newSession?.parentId).toBe(parentId);
    expect(newSession?.organizationId).toBe(orgAId);
  });

  // ── 2 ────────────────────────────────────────────────────────────────────
  it('2. parent refresh with expired session -> 401', async () => {
    const expired = await prisma.parentSession.create({
      data: {
        parentId,
        organizationId: orgAId,
        expiresAt: new Date(Date.now() - 1000),
      },
    });

    await expect(authService.refreshToken(parentId, expired.id, 'PARENT')).rejects.toThrow(
      UnauthorizedException,
    );

    await prisma.parentSession.delete({ where: { id: expired.id } });
  });

  // ── 3 ────────────────────────────────────────────────────────────────────
  it('3. parent refresh with revoked session -> 401', async () => {
    const revoked = await prisma.parentSession.create({
      data: {
        parentId,
        organizationId: orgAId,
        expiresAt: future(),
        revokedAt: new Date(),
        revokedReason: 'user_logout',
      },
    });

    await expect(authService.refreshToken(parentId, revoked.id, 'PARENT')).rejects.toThrow(
      UnauthorizedException,
    );

    await prisma.parentSession.delete({ where: { id: revoked.id } });
  });

  // ── 4 ────────────────────────────────────────────────────────────────────
  it('4. parent refresh cannot resolve as a User session', async () => {
    const userSession = await prisma.session.create({
      data: { userId: userAId, organizationId: orgAId, expiresAt: future() },
    });

    // A parent principal must never walk into the `Session` table.
    await expect(
      authService.refreshToken(parentId, userSession.id, 'PARENT'),
    ).rejects.toThrow(UnauthorizedException);

    // ...and the user session must survive the failed parent attempt.
    const untouched = await prisma.session.findUnique({ where: { id: userSession.id } });
    expect(untouched?.revokedAt).toBeNull();

    await prisma.session.delete({ where: { id: userSession.id } });
  });

  // ── 5 ────────────────────────────────────────────────────────────────────
  it('5. user refresh cannot resolve as a ParentSession', async () => {
    const parentSession = await prisma.parentSession.create({
      data: { parentId, organizationId: orgAId, expiresAt: future() },
    });

    await expect(
      authService.refreshToken(userAId, parentSession.id, 'STUDENT'),
    ).rejects.toThrow(UnauthorizedException);

    const untouched = await prisma.parentSession.findUnique({ where: { id: parentSession.id } });
    expect(untouched?.revokedAt).toBeNull();

    await prisma.parentSession.delete({ where: { id: parentSession.id } });
  });

  // ── 6 ────────────────────────────────────────────────────────────────────
  it('6. wrong parent/session binding -> 401', async () => {
    const otherSession = await prisma.parentSession.create({
      data: { parentId: otherParentId, organizationId: orgAId, expiresAt: future() },
    });

    // Session belongs to Parent B; Principal A cannot spend it.
    await expect(
      authService.refreshToken(parentId, otherSession.id, 'PARENT'),
    ).rejects.toThrow(UnauthorizedException);

    const untouched = await prisma.parentSession.findUnique({ where: { id: otherSession.id } });
    expect(untouched?.revokedAt).toBeNull();

    await prisma.parentSession.delete({ where: { id: otherSession.id } });
  });

  // ── 7 ────────────────────────────────────────────────────────────────────
  it('7. wrong organization -> 401', async () => {
    // A session row for user A that is stamped with the OTHER tenant.
    const crossTenant = await prisma.session.create({
      data: { userId: userAId, organizationId: orgBId, expiresAt: future() },
    });

    await expect(
      authService.refreshToken(userAId, crossTenant.id, 'STUDENT'),
    ).rejects.toThrow(UnauthorizedException);

    await prisma.session.delete({ where: { id: crossTenant.id } });

    // Same guarantee for parents: a session stamped with another tenant fails.
    const crossTenantParent = await prisma.parentSession.create({
      data: { parentId, organizationId: orgBId, expiresAt: future() },
    });
    await expect(
      authService.refreshToken(parentId, crossTenantParent.id, 'PARENT'),
    ).rejects.toThrow(UnauthorizedException);
    await prisma.parentSession.delete({ where: { id: crossTenantParent.id } });
  });

  // ── 8 ────────────────────────────────────────────────────────────────────
  it('8. refresh rotation/replay protection', async () => {
    const login = await authService.login(userEmail, USER_PASSWORD);
    const originalSid = sidOf(login.accessToken);
    const originalPayload = jwtService.decode(login.accessToken) as Record<string, unknown>;

    // The original JWT is still valid before the rotation.
    await expect(jwtStrategy.validate(originalPayload as never)).resolves.toMatchObject({
      sub: userAId,
      sid: originalSid,
    });

    const refreshed = await authService.refreshToken(userAId, originalSid, 'STUDENT');
    const rotatedSid = sidOf(refreshed.accessToken);
    expect(rotatedSid).not.toBe(originalSid);

    // Replaying the session that was just spent fails at the service...
    await expect(authService.refreshToken(userAId, originalSid, 'STUDENT')).rejects.toThrow(
      UnauthorizedException,
    );

    // ...and fails at the strategy (the row is revoked), so the old JWT is dead.
    await expect(jwtStrategy.validate(originalPayload as never)).rejects.toThrow(
      UnauthorizedException,
    );

    // The rotated session is live and usable exactly once more.
    await expect(
      jwtStrategy.validate(jwtService.decode(refreshed.accessToken) as never),
    ).resolves.toMatchObject({ sid: rotatedSid });
  });

  // ── 9 ────────────────────────────────────────────────────────────────────
  it('9. logout invalidates the correct session type', async () => {
    const userLogin = await authService.login(userEmail, USER_PASSWORD);
    const userSid = sidOf(userLogin.accessToken);

    const parentLoginRes = mockResponse();
    await controller.parentLogin(
      { email: parentEmail, password: PARENT_PASSWORD } as never,
      parentLoginRes,
    );
    const parentSid = sidOf(parentLoginRes.cookie.mock.calls[0][1] as string);

    // Logging out the user must not touch the parent's session.
    await authService.logout(userSid, userAId, 'STUDENT');
    const userSession = await prisma.session.findUnique({ where: { id: userSid } });
    const parentSession = await prisma.parentSession.findUnique({ where: { id: parentSid } });
    expect(userSession?.revokedAt).not.toBeNull();
    expect(parentSession?.revokedAt).toBeNull();

    // Logging out the parent must not touch the user's (already revoked) rows
    // or any other parent session.
    await authService.logout(parentSid, parentId, 'PARENT');
    const parentSessionAfter = await prisma.parentSession.findUnique({ where: { id: parentSid } });
    expect(parentSessionAfter?.revokedAt).not.toBeNull();

    // A revoked parent session can no longer refresh.
    await expect(authService.refreshToken(parentId, parentSid, 'PARENT')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  // ── 10 ───────────────────────────────────────────────────────────────────
  it('10. fresh login on another device preserves the same canonical identity/data', async () => {
    const deviceA = await authService.login(userEmail, USER_PASSWORD);
    const deviceB = await authService.login(userEmail, USER_PASSWORD);

    const payloadA = jwtService.decode(deviceA.accessToken) as Record<string, unknown>;
    const payloadB = jwtService.decode(deviceB.accessToken) as Record<string, unknown>;

    // Distinct sessions, identical principal.
    expect(payloadA.sid).not.toBe(payloadB.sid);
    expect(payloadA.sub).toBe(userAId);
    expect(payloadB.sub).toBe(userAId);
    expect(deviceA.user.id).toBe(deviceB.user.id);
    expect(deviceA.user.email).toBe(deviceB.user.email);
    expect(deviceA.user.organizationId).toBe(deviceB.user.organizationId);

    // The canonical row itself is untouched by the second login.
    const meA = await authService.getMe(userAId);
    const meB = await authService.getMe(userAId);
    expect(meA).toEqual(meB);
    expect(meA.organization?.id).toBe(orgAId);

    const rows = await prisma.user.findMany({ where: { email: userEmail } });
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(userAId);
  });

  // ── 11 ───────────────────────────────────────────────────────────────────
  it('11. CONCURRENT refresh of one token mints exactly one live session', async () => {
    const login = await authService.login(userEmail, USER_PASSWORD);
    const sid = sidOf(login.accessToken);

    // Race three parallel rotations of the SAME session id. Sequential replay
    // was already covered (test 8); this pins the CONCURRENT case, where a
    // read-then-revoke implementation would let every caller issue a token.
    const results = await Promise.allSettled([
      authService.refreshToken(userAId, sid, 'STUDENT'),
      authService.refreshToken(userAId, sid, 'STUDENT'),
      authService.refreshToken(userAId, sid, 'STUDENT'),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(2);
    for (const r of rejected) {
      expect(r.reason).toBeInstanceOf(UnauthorizedException);
    }

    // The spent session is revoked and stayed revoked — no second live session
    // was minted from the same refresh token.
    const spent = await prisma.session.findUnique({ where: { id: sid } });
    expect(spent?.revokedAt).not.toBeNull();
    expect(spent?.revokedReason).toBe('token_refresh');
  });

  // ── 12 ───────────────────────────────────────────────────────────────────
  // ULTRA-DEEP CONCURRENCY STRESS SUITE (1, 2, 10, 50, 100 parallel requests)
  for (const concurrency of [2, 10, 50, 100]) {
    it(`12.${concurrency}. CONCURRENT refresh of one token with ${concurrency} parallel requests mints exactly one live session`, async () => {
      const login = await authService.login(userEmail, USER_PASSWORD);
      const sid = sidOf(login.accessToken);

      const requests = Array.from({ length: concurrency }, () =>
        authService.refreshToken(userAId, sid, 'STUDENT'),
      );

      const results = await Promise.allSettled(requests);
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(concurrency - 1);
      for (const r of rejected) {
        expect(r.reason).toBeInstanceOf(UnauthorizedException);
      }

      const spent = await prisma.session.findUnique({ where: { id: sid } });
      expect(spent?.revokedAt).not.toBeNull();
      expect(spent?.revokedReason).toBe('token_refresh');
    }, 45000);
  }
});

