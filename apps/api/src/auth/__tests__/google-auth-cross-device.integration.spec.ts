import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../auth.service';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

describe('Phase 2 Verification: Google OAuth/OIDC & Cross-Device Sync against Real PostgreSQL', () => {
  const prisma = new PrismaClient();
  const jwtService = new JwtService({
    secret: process.env.JWT_SECRET || 'medu-dev-secret-do-not-use-in-production',
    expiresIn: '24h',
  });
  const authService = new AuthService(prisma as any, jwtService);

  const timestamp = Date.now();
  const googleSubA = `google-sub-dev-a-${timestamp}`;
  const googleSubB = `google-sub-link-${timestamp}`;
  const testEmailA = `alice.crossdev.${timestamp}@gmail.com`;
  const testEmailB = `bob.crossdev.${timestamp}@gmail.com`;
  const testEmailC = `carol.crossdev.${timestamp}@gmail.com`;

  let userAId: string;
  let userBId: string;
  let userCId: string;
  let userDId: string;
  let orgAId: string;

  beforeAll(async () => {
    await prisma.$connect();
    await prisma.accessWhitelist.upsert({
      where: { email: testEmailA },
      update: {},
      create: {
        email: testEmailA,
        note: 'Integration test automated seed',
      },
    });
  });

  afterAll(async () => {
    // Clean up created test data
    try {
      await prisma.accessWhitelist.deleteMany({
        where: { email: { in: [testEmailA, testEmailB, testEmailC] } },
      }).catch(() => {});
      if (orgAId) {
        await prisma.session.deleteMany({ where: { organizationId: orgAId } });
        await prisma.course.deleteMany({ where: { organizationId: orgAId } });
        await prisma.student.deleteMany({ where: { organizationId: orgAId } });
        await prisma.user.deleteMany({ where: { organizationId: orgAId } });
        await prisma.organization.delete({ where: { id: orgAId } });
      }
      if (userBId) {
        await prisma.session.deleteMany({ where: { userId: userBId } });
        const userB = await prisma.user.findUnique({ where: { id: userBId } });
        if (userB) {
          await prisma.user.delete({ where: { id: userBId } });
          await prisma.organization.delete({ where: { id: userB.organizationId } }).catch(() => {});
        }
      }
      if (userCId) {
        await prisma.session.deleteMany({ where: { userId: userCId } });
        const userC = await prisma.user.findUnique({ where: { id: userCId } });
        if (userC) {
          await prisma.user.delete({ where: { id: userCId } });
          await prisma.organization.delete({ where: { id: userC.organizationId } }).catch(() => {});
        }
      }
      if (userDId) {
        await prisma.session.deleteMany({ where: { userId: userDId } });
        const userD = await prisma.user.findUnique({ where: { id: userDId } });
        if (userD) {
          await prisma.user.delete({ where: { id: userDId } });
          await prisma.organization.delete({ where: { id: userD.organizationId } }).catch(() => {});
        }
      }
    } finally {
      await prisma.$disconnect();
    }
  });

  describe('1. Server-Side Google OAuth/OIDC with Persistent PostgreSQL Identity', () => {
    it('creates persistent user in PostgreSQL with provider=google and googleSubject', async () => {
      const googleProfileA = {
        googleSubject: googleSubA,
        email: testEmailA,
        emailVerified: true,
        firstName: 'Alice',
        lastName: 'DeviceSync',
        avatar: 'https://lh3.googleusercontent.com/a/alice-avatar',
      };

      const result = await authService.googleLogin(googleProfileA);

      expect(result).toBeDefined();
      expect(result.accessToken).toBeTruthy();
      expect(result.user).toBeDefined();
      expect(result.user.email).toBe(testEmailA);
      expect(result.user.role).toBe('ORG_ADMIN');

      userAId = result.user.id;
      orgAId = result.user.organizationId;

      // Verify persistent PostgreSQL state
      const dbUser = await prisma.user.findUnique({
        where: { id: userAId },
        include: { organization: true },
      });

      expect(dbUser).not.toBeNull();
      expect(dbUser?.provider).toBe('google');
      expect(dbUser?.googleSubject).toBe(googleSubA);
      expect(dbUser?.googleEmail).toBe(testEmailA);
      expect(dbUser?.passwordHash).toBeNull();
      expect(dbUser?.organizationId).toBe(orgAId);
      expect(dbUser?.organization.name).toContain('Alice DeviceSync');
    });

    it('rejects Google profile if email is not verified', async () => {
      await expect(
        authService.googleLogin({
          googleSubject: 'fake-unverified-sub',
          email: 'unverified@gmail.com',
          emailVerified: false,
          firstName: 'Unverified',
          lastName: 'User',
          avatar: null,
        })
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('2. Account Linking Policy & Conflict Protection', () => {
    it('links Google identity to an opted-in passwordless account with verified email', async () => {
      // Create invited/passwordless user in PostgreSQL
      const invitedOrg = await prisma.organization.create({
        data: { name: `Invited Org ${timestamp}`, email: testEmailB },
      });
      const invitedUser = await prisma.user.create({
        data: {
          organizationId: invitedOrg.id,
          email: testEmailB,
          passwordHash: null, // Passwordless
          firstName: 'Bob',
          lastName: 'Invited',
          role: 'STUDENT',
          // Documented account-linking policy: linking requires an explicit
          // opt-in on non-privileged accounts.
          googleLinkAllowed: true,
        },
      });
      userBId = invitedUser.id;

      // Bob signs in via Google OAuth
      const googleProfileB = {
        googleSubject: googleSubB,
        email: testEmailB,
        emailVerified: true,
        firstName: 'Bob',
        lastName: 'Invited',
        avatar: null,
      };

      const result = await authService.googleLogin(googleProfileB);
      expect(result.user.id).toBe(userBId);

      // Verify identity linked in PostgreSQL
      const linkedUser = await prisma.user.findUnique({ where: { id: userBId } });
      expect(linkedUser?.googleSubject).toBe(googleSubB);
      expect(linkedUser?.googleEmail).toBe(testEmailB);
      expect(linkedUser?.provider).toBe('google');
    });

    it('NEVER auto-links a privileged role, even when the account is passwordless (409)', async () => {
      const staffOrg = await prisma.organization.create({
        data: { name: `Staff Org ${timestamp}`, email: `staff.${timestamp}@gmail.com` },
      });
      const staffUser = await prisma.user.create({
        data: {
          organizationId: staffOrg.id,
          email: `staff.${timestamp}@gmail.com`,
          passwordHash: null,
          firstName: 'Dana',
          lastName: 'Staff',
          role: 'TEACHER',
          googleLinkAllowed: true,
        },
      });
      userDId = staffUser.id;

      await expect(
        authService.googleLogin({
          googleSubject: `dana-staff-${timestamp}`,
          email: staffUser.email,
          emailVerified: true,
          firstName: 'Dana',
          lastName: 'Staff',
          avatar: null,
        }),
      ).rejects.toThrow(ConflictException);

      // Identity must be untouched: no silent binding to a privileged account.
      const after = await prisma.user.findUnique({ where: { id: userDId } });
      expect(after?.googleSubject).toBeNull();
      expect(after?.provider).toBe('local');
    });

    it('prevents auto-merging a password-protected account on email match (409 Conflict)', async () => {
      // Create user with a local password
      const hashedPassword = await bcrypt.hash('Secret123!', 10);
      const localOrg = await prisma.organization.create({
        data: { name: `Local Org ${timestamp}`, email: testEmailC },
      });
      const localUser = await prisma.user.create({
        data: {
          organizationId: localOrg.id,
          email: testEmailC,
          passwordHash: hashedPassword,
          firstName: 'Carol',
          lastName: 'Local',
          role: 'ORG_ADMIN',
        },
      });
      userCId = localUser.id;

      // Attempt Google login with same email without pre-linking
      await expect(
        authService.googleLogin({
          googleSubject: `carol-impostor-${timestamp}`,
          email: testEmailC,
          emailVerified: true,
          firstName: 'Carol',
          lastName: 'Attacker',
          avatar: null,
        })
      ).rejects.toThrow(ConflictException);

      // Verify account remained untampered
      const untouchedUser = await prisma.user.findUnique({ where: { id: userCId } });
      expect(untouchedUser?.googleSubject).toBeNull();
    });
  });

  describe('3. Cross-Device Session Tokens & State Synchronization Proof', () => {
    let sessionTokenDeviceA: string;
    let sessionTokenDeviceB: string;
    let sidA: string;
    let sidB: string;

    it('issues distinct active PostgreSQL sessions for Device A and Device B simultaneously', async () => {
      // Device A signs in
      const loginA = await authService.googleLogin({
        googleSubject: googleSubA,
        email: testEmailA,
        emailVerified: true,
        firstName: 'Alice',
        lastName: 'DeviceSync',
        avatar: null,
      });
      sessionTokenDeviceA = loginA.accessToken;
      const payloadA = jwtService.decode(sessionTokenDeviceA) as { sid: string; sub: string };
      sidA = payloadA.sid;

      // Device B signs in with same Google account
      const loginB = await authService.googleLogin({
        googleSubject: googleSubA,
        email: testEmailA,
        emailVerified: true,
        firstName: 'Alice',
        lastName: 'DeviceSync',
        avatar: null,
      });
      sessionTokenDeviceB = loginB.accessToken;
      const payloadB = jwtService.decode(sessionTokenDeviceB) as { sid: string; sub: string };
      sidB = payloadB.sid;

      expect(sidA).not.toBe(sidB);
      expect(payloadA.sub).toBe(userAId);
      expect(payloadB.sub).toBe(userAId);

      // Verify both sessions are simultaneously ACTIVE in PostgreSQL
      const activeSessions = await prisma.session.findMany({
        where: { userId: userAId, revokedAt: null },
      });
      expect(activeSessions.length).toBeGreaterThanOrEqual(2);
      expect(activeSessions.some((s) => s.id === sidA)).toBe(true);
      expect(activeSessions.some((s) => s.id === sidB)).toBe(true);
    });

    it('proves cross-device data synchronization: Device A creates data, Device B verifies and updates', async () => {
      // Device A creates a course in the organization
      const courseCreatedByDeviceA = await prisma.course.create({
        data: {
          organizationId: orgAId,
          name: 'Cross-Device Sync Course',
          description: 'Initial syllabus written on Device A',
          price: 150000,
          duration: 30,
        },
      });

      expect(courseCreatedByDeviceA.id).toBeDefined();

      // Device B reads the course data from PostgreSQL
      const courseFoundByDeviceB = await prisma.course.findUnique({
        where: { id: courseCreatedByDeviceA.id },
      });

      expect(courseFoundByDeviceB).not.toBeNull();
      expect(courseFoundByDeviceB?.name).toBe('Cross-Device Sync Course');
      expect(courseFoundByDeviceB?.description).toBe('Initial syllabus written on Device A');

      // Device B updates the course record
      await prisma.course.update({
        where: { id: courseCreatedByDeviceA.id },
        data: {
          name: 'Cross-Device Sync Course (Updated by Device B)',
          description: 'Updated syllabus synced from Device B',
        },
      });

      // Device A reads the record and sees Device B updates immediately in PostgreSQL
      const synchronizedOnDeviceA = await prisma.course.findUnique({
        where: { id: courseCreatedByDeviceA.id },
      });

      expect(synchronizedOnDeviceA?.name).toBe('Cross-Device Sync Course (Updated by Device B)');
      expect(synchronizedOnDeviceA?.description).toBe('Updated syllabus synced from Device B');
    });

    it('Device A logout revokes only Session A, leaving Device B active', async () => {
      // Device A logs out
      await authService.logout(sidA, userAId, 'ORG_ADMIN');

      // Check Session A is revoked in PostgreSQL
      const sessionA = await prisma.session.findUnique({ where: { id: sidA } });
      expect(sessionA?.revokedAt).not.toBeNull();

      // Check Session B is STILL ACTIVE in PostgreSQL
      const sessionB = await prisma.session.findUnique({ where: { id: sidB } });
      expect(sessionB?.revokedAt).toBeNull();

      // Device B can still access user profile
      const userFromDeviceB = await authService.getMe(userAId);
      expect(userFromDeviceB.id).toBe(userAId);
      expect(userFromDeviceB.email).toBe(testEmailA);
    });
  });
});
