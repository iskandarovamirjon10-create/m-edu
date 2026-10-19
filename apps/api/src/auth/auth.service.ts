import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { SecurityEventService, SecurityEventType } from '../common/security/security-event.service';
import { errorMessage, GoogleProfile, TokenUser, GetMeResponse } from './types';
import { SecureLogger } from '@medu/face-security';
import * as bcrypt from 'bcryptjs';
import { randomBytes, createHash, timingSafeEqual } from 'crypto';
import * as nodemailer from 'nodemailer';
import {
  AcceptInvitationDto,
  AddToWhitelistDto,
  BootstrapDto,
  RegisterDto,
  UpdateAccessControlSettingsDto,
} from './dto';
import { isPlatformRole, isPrivilegedRole } from './authorization.policy';
import { escapeHtml, isPrismaUniqueError, normalizeEmail, resolveFrontendUrl } from './auth.utils';
import { authTtlMs } from './auth.ttl';
import { resolveBcryptRounds, PASSWORD_RESET_GENERIC_MESSAGE, PASSWORD_RESET_TTL_MS } from './auth.config';
import { Role } from '@prisma/client';

/**
 * May a passwordless M-EDU account be linked to a Google identity purely on
 * the strength of a Google-verified email match? (Account-linking policy
 * P0-2 — see `authorization.policy.ts` and the `User.googleLinkAllowed`
 * column.)
 *
 *  - Privileged roles (staff/admin) are NEVER auto-linked: a shared or
 *    mistyped mailbox must not silently become a teacher/admin login.
 *  - Every other role requires the account model's explicit opt-in flag.
 *
 * Accounts that already carry a password are refused earlier — this helper
 * only decides the passwordless case. Returning `false` never merges
 * identities; the caller answers with an actionable 409.
 */
export function canAutoLink(role: string | null | undefined, googleLinkAllowed: boolean): boolean {
  if (isPrivilegedRole(role)) return false;
  return googleLinkAllowed === true;
}

@Injectable()
export class AuthService implements OnModuleInit, OnModuleDestroy {
  private readonly AUTH_CODE_TTL_MS = 5 * 60 * 1000;
  private readonly CLEANUP_INTERVAL_MS = Number(process.env.SESSION_PURGE_INTERVAL_MS) || 60 * 1000;
  // Retention grace for expired sessions: by default expired rows are purged
  // on the next cleanup tick. Operators can keep a short audit trail with
  // SESSION_RETENTION_HOURS (e.g. "24").
  private readonly SESSION_RETENTION_HOURS = Number(process.env.SESSION_RETENTION_HOURS) || 0;
  // Validated at construction: an out-of-range value fails boot loudly rather
  // than silently minting weak hashes.
  private readonly BCRYPT_ROUNDS = resolveBcryptRounds();

  private readonly logger = new SecureLogger('info');
  private smtpTransporter: nodemailer.Transporter | null = null;

  /**
   * The single purge timer. Held as a field (not a constructor local) so it
   * can be released deterministically on shutdown — see `onModuleDestroy`.
   */
  private cleanupTimer: NodeJS.Timeout | undefined;

  private getSmtpTransporter(): nodemailer.Transporter {
    if (this.smtpTransporter) return this.smtpTransporter;
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT) || 587;
    const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASSWORD;
    const secure = port === 465;
    if (!host) throw new Error('SMTP_HOST not configured');
    this.smtpTransporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
    });
    return this.smtpTransporter;
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    @Optional() private readonly security?: SecurityEventService,
  ) {}

  /**
   * Start exactly one background purge timer.
   *
   * Deliberately NOT done in the constructor: unit tests construct
   * `new AuthService(...)` directly and never run the Nest lifecycle, so a
   * constructor timer would leak an open handle in every spec file.
   */
  onModuleInit(): void {
    if (this.cleanupTimer) return; // idempotent — never a second timer
    const timer = setInterval(() => {
      void this.cleanupExpiredEntries();
    }, this.CLEANUP_INTERVAL_MS);
    // Do not hold the event loop open; a pending purge must not block shutdown.
    timer.unref?.();
    this.cleanupTimer = timer;
  }

  /** Release the purge timer so no handle survives application shutdown. */
  onModuleDestroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  private getFrontendUrl(): string {
    return resolveFrontendUrl();
  }

  public generateSecureToken(bytes = 32): string {
    return randomBytes(bytes).toString('hex');
  }

  // ==================== Auth code exchange (CSRF-safe) ====================

  /**
   * Create the single-use code that hands the OAuth result to the SPA.
   *
   * The code itself is 256-bit random and carries no claim. What is persisted
   * is the SESSION id of the session `issueToken` just created — never the
   * signed JWT.
   */
  async generateAuthCode(accessToken: string, userId: string, state?: string): Promise<string> {
    const code = this.generateSecureToken();
    const expiresAt = new Date(Date.now() + this.AUTH_CODE_TTL_MS);
    const sessionId = this.extractSessionId(accessToken);

    await this.prisma.authorizationCode.create({
      data: {
        code,
        sessionId,
        userId,
        state: state ?? null,
        expiresAt,
      },
    });

    return code;
  }

  /** `sid` claim of an M-EDU JWT, or null when the token is not ours. */
  private extractSessionId(accessToken: string): string | null {
    try {
      const payload = this.jwtService.decode(accessToken) as { sid?: unknown } | null;
      const sid = payload && typeof payload === 'object' ? payload.sid : null;
      return typeof sid === 'string' && sid.length > 0 ? sid : null;
    } catch {
      return null;
    }
  }

  async exchangeAuthCode(code: string, state?: string): Promise<string> {
    const entry = await this.prisma.authorizationCode.findUnique({
      where: { code },
    });

    if (!entry) {
      throw new BadRequestException('Invalid or expired authorization code');
    }
    if (entry.usedAt) {
      throw new BadRequestException('Authorization code has already been used');
    }
    if (new Date() > entry.expiresAt) {
      await this.prisma.authorizationCode.delete({ where: { id: entry.id } });
      throw new BadRequestException('Authorization code has expired');
    }

    if (entry.state) {
      if (!state) {
        throw new BadRequestException('OAuth exchange state is required');
      }
      const expected = Buffer.from(entry.state);
      const actual = Buffer.from(state);
      if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
        throw new BadRequestException('Invalid or expired OAuth exchange state');
      }
    }

    // A code must be redeemable exactly ONCE.
    const claimed = await this.prisma.authorizationCode.updateMany({
      where: { id: entry.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (claimed.count !== 1) {
      throw new BadRequestException('Authorization code has already been used');
    }

    // Never mint a session for an account that was deactivated or deleted
    const user = await this.prisma.user.findUnique({
      where: { id: entry.userId },
      select: {
        id: true,
        email: true,
        role: true,
        organizationId: true,
        isActive: true,
      },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // Preferred path: re-sign a token for the session pre-created at callback.
    if (entry.sessionId) {
      const session = await this.prisma.session.findUnique({
        where: { id: entry.sessionId },
        select: { id: true, revokedAt: true, expiresAt: true, userId: true },
      });
      if (
        session &&
        session.userId === user.id &&
        !session.revokedAt &&
        session.expiresAt > new Date()
      ) {
        return this.jwtService.sign({
          sub: user.id,
          id: user.id,
          email: user.email,
          role: user.role,
          organizationId: user.organizationId,
          sid: session.id,
        });
      }
      throw new UnauthorizedException('Session is no longer valid');
    }

    // Legacy rows created before session binding still carry their token.
    if (entry.accessToken) return entry.accessToken;

    throw new BadRequestException('Invalid or expired authorization code');
  }

  async cleanupExpiredEntries() {
    const now = Date.now();

    try {
      const cutoff = new Date(now - this.SESSION_RETENTION_HOURS * 60 * 60 * 1000);
      const [sessionResult, parentSessionResult, tokenResult, authCodeResult] = await Promise.all([
        this.prisma.session?.deleteMany
          ? this.prisma.session.deleteMany({ where: { expiresAt: { lt: cutoff } } })
          : Promise.resolve({ count: 0 }),
        this.prisma.parentSession?.deleteMany
          ? this.prisma.parentSession.deleteMany({ where: { expiresAt: { lt: cutoff } } })
          : Promise.resolve({ count: 0 }),
        this.prisma.passwordResetToken?.deleteMany
          ? this.prisma.passwordResetToken.deleteMany({
              where: {
                OR: [
                  { expiresAt: { lt: new Date(now) } },
                  { usedAt: { not: null, lt: cutoff } },
                ],
              },
            })
          : Promise.resolve({ count: 0 }),
        this.prisma.authorizationCode?.deleteMany
          ? this.prisma.authorizationCode.deleteMany({
              where: {
                OR: [
                  { expiresAt: { lt: new Date(now) } },
                  { usedAt: { not: null, lt: cutoff } },
                ],
              },
            })
          : Promise.resolve({ count: 0 }),
      ]);
      if (sessionResult.count > 0) {
        this.logger.info('Purged expired sessions', { count: sessionResult.count });
      }
      if (tokenResult.count > 0) {
        this.logger.info('Purged expired password reset tokens', { count: tokenResult.count });
      }
      if (authCodeResult.count > 0) {
        this.logger.info('Purged expired authorization codes', { count: authCodeResult.count });
      }
    } catch (err: unknown) {
      this.logger.error('Failed to purge expired sessions', {
        error: errorMessage(err),
      });
    }
  }

  // ==================== Local auth ====================

  /**
   * Login with email and password
   */
  async login(
    email: string,
    password: string,
    clientMeta?: { userAgent?: string; ipAddress?: string },
  ): Promise<{ accessToken: string; user: TokenUser }> {
    const normalized = normalizeEmail(email);
    const user = await this.prisma.user.findUnique({
      where: { email: normalized },
      include: { organization: true },
    });

    if (user && user.status === 'PENDING') {
      throw new ForbiddenException('Your account is pending administrator approval.');
    }

    if (!user || !user.isActive || !user.passwordHash) {
      await this.security?.logEvent({
        eventType: SecurityEventType.LOGIN_FAILED,
        ipAddress: clientMeta?.ipAddress,
        userAgent: clientMeta?.userAgent,
        success: false,
        reason: 'INVALID_CREDENTIALS',
      });
      // Anti-timing attack delay without blocking event loop (DoS protection)
      await new Promise((resolve) => setTimeout(resolve, 150 + Math.random() * 100));
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      await this.security?.logEvent({
        eventType: SecurityEventType.LOGIN_FAILED,
        userId: user.id,
        organizationId: user.organizationId,
        ipAddress: clientMeta?.ipAddress,
        userAgent: clientMeta?.userAgent,
        success: false,
        reason: 'INVALID_PASSWORD',
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await this.security?.logEvent({
      eventType: SecurityEventType.LOGIN_SUCCESS,
      userId: user.id,
      organizationId: user.organizationId,
      ipAddress: clientMeta?.ipAddress,
      userAgent: clientMeta?.userAgent,
      success: true,
    });

    return await this.issueToken(user, clientMeta);
  }

  async register(
    data: RegisterDto,
    clientMeta?: { userAgent?: string; ipAddress?: string },
  ): Promise<{ accessToken?: string; user: TokenUser; pendingApproval?: boolean; message?: string }> {
    const email = normalizeEmail(data.email);

    // 1. Platform invitation code check
    let redeemedInvite: any = null;
    if (this.prisma.platformInvitation && data.inviteCode && data.inviteCode.trim().length > 0) {
      const trimmedCode = data.inviteCode.trim();
      const codeHash = createHash('sha256').update(trimmedCode).digest('hex');
      const invite = await this.prisma.platformInvitation.findUnique({
        where: { codeHash },
      });

      if (!invite) {
        throw new ForbiddenException('Invalid platform invitation code');
      }
      if (invite.revokedAt) {
        throw new ForbiddenException('Platform invitation has been revoked');
      }
      if (invite.expiresAt <= new Date()) {
        throw new ForbiddenException('Platform invitation has expired');
      }
      if (invite.useCount >= invite.maxUses) {
        throw new ForbiddenException('Platform invitation code has already been used');
      }
      redeemedInvite = invite;
    } else {
      // If invitation code was not provided, check whitelist and access control configuration
      const isWhitelisted = await this.isEmailWhitelisted(email);
      if (!isWhitelisted && this.prisma.accessControlConfig) {
        const config = await this.prisma.accessControlConfig.findUnique({
          where: { id: 'global' },
        });

        // Fail-closed default: if configuration row is absent, default to inviteOnly: true, requireApproval: true
        const effectiveConfig = config ?? { inviteOnly: true, requireApproval: true };

        if (effectiveConfig.inviteOnly) {
          throw new ForbiddenException('Registration is currently invite-only or requires whitelist approval.');
        }

        if (effectiveConfig.requireApproval) {
          const passwordHash = await bcrypt.hash(data.password, this.BCRYPT_ROUNDS);
          const result = await this.prisma.$transaction(async (tx: any) => {
            const organization = await tx.organization.create({
              data: {
                name: data.organizationName,
                email,
                phone: data.phone,
              },
            });
            const user = await tx.user.create({
              data: {
                organizationId: organization.id,
                email,
                passwordHash,
                firstName: data.firstName,
                lastName: data.lastName,
                phone: data.phone,
                role: 'ORG_ADMIN',
                status: 'PENDING',
                isActive: false,
              },
              include: { organization: true },
            });
            return { user, organization };
          });

          return {
            user: {
              id: result.user.id,
              email: result.user.email,
              firstName: result.user.firstName,
              lastName: result.user.lastName,
              role: result.user.role,
              organizationId: result.user.organizationId,
              organization: result.organization,
            },
            pendingApproval: true,
            message: 'Account registered successfully. Pending administrator approval.',
          };
        }
      }
    }

    const passwordHash = await bcrypt.hash(data.password, this.BCRYPT_ROUNDS);

    let result;
    try {
      result = await this.prisma.$transaction(async (tx: any) => {
        if (redeemedInvite && tx.platformInvitation) {
          const claim = await tx.platformInvitation.updateMany({
            where: {
              id: redeemedInvite.id,
              useCount: { lt: redeemedInvite.maxUses },
              revokedAt: null,
              expiresAt: { gt: new Date() },
            },
            data: {
              useCount: { increment: 1 },
              usedAt: new Date(),
            },
          });
          if (claim.count !== 1) {
            throw new ForbiddenException('Platform invitation code has already been used');
          }
        }

        const organization = await tx.organization.create({
          data: {
            name: data.organizationName,
            email,
            phone: data.phone,
          },
        });

        const user = await tx.user.create({
          data: {
            organizationId: organization.id,
            email,
            passwordHash,
            firstName: data.firstName,
            lastName: data.lastName,
            phone: data.phone,
            role: 'ORG_ADMIN',
            status: 'ACTIVE',
            isActive: true,
            lastLoginAt: new Date(),
          },
          include: { organization: true },
        });

        return { user, organization };
      });
    } catch (error: unknown) {
      if (isPrismaUniqueError(error)) {
        throw new ConflictException('Email already registered');
      }
      throw error;
    }

    if (redeemedInvite) {
      await this.security?.logEvent({
        eventType: SecurityEventType.INVITE_REDEEMED,
        organizationId: result.organization.id,
        userId: result.user.id,
        resourceType: 'PlatformInvitation',
        resourceId: redeemedInvite.id,
        ipAddress: clientMeta?.ipAddress,
        userAgent: clientMeta?.userAgent,
        success: true,
      });
    }

    const issued = await this.issueToken(result.user, clientMeta);
    return {
      accessToken: issued.accessToken,
      user: issued.user,
    };
  }

  /**
   * One-time platform bootstrap: creates the FIRST PLATFORM_OWNER.
   *
   * Security model:
   *  - Locked forever once ANY PLATFORM_OWNER or SUPER_ADMIN exists
   *  - Serialized with a Postgres advisory lock so concurrent requests cannot race
   *  - Requires valid PLATFORM_BOOTSTRAP_SECRET if set in environment
   *  - Heavily throttled at controller
   *  - Audited via SecurityEvent
   */
  async bootstrap(data: BootstrapDto, secretHeader?: string): Promise<{ accessToken: string; user: TokenUser }> {
    const superAdminCount = await this.prisma.user.count({
      where: { role: { in: ['PLATFORM_OWNER', 'SUPER_ADMIN'] } },
    });
    if (superAdminCount > 0) {
      throw new ConflictException('Platform is already bootstrapped');
    }

    const configuredSecret = process.env.PLATFORM_BOOTSTRAP_SECRET;
    if (!configuredSecret || !configuredSecret.trim()) {
      throw new ForbiddenException('Bootstrap is disabled: PLATFORM_BOOTSTRAP_SECRET is not configured on the server');
    }

    const provided = (data.inviteCode || (data as any).secret || secretHeader || '').trim();
    if (!provided) {
      throw new ForbiddenException('Bootstrap secret is required');
    }
    const expected = Buffer.from(configuredSecret.trim());
    const actual = Buffer.from(provided);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      throw new ForbiddenException('Invalid bootstrap secret');
    }

    const email = normalizeEmail(data.email);
    const passwordHash = await bcrypt.hash(data.password, this.BCRYPT_ROUNDS);

    let result;
    try {
      result = await this.prisma.$transaction(async (tx: any) => {
        // Serialize concurrent first-bootstraps (advisory lock, per-connection).
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('medu_platform_bootstrap'))`;
        const recheck = await tx.user.count({
          where: { role: { in: ['PLATFORM_OWNER', 'SUPER_ADMIN'] } },
        });
        if (recheck > 0) {
          throw new ConflictException('Platform is already bootstrapped');
        }

        const organization = await tx.organization.create({
          data: {
            name: data.organizationName,
            email,
            phone: data.phone,
          },
        });

        const user = await tx.user.create({
          data: {
            organizationId: organization.id,
            email,
            passwordHash,
            firstName: data.firstName,
            lastName: data.lastName,
            phone: data.phone,
            role: 'PLATFORM_OWNER',
            status: 'ACTIVE',
            isActive: true,
            lastLoginAt: new Date(),
          },
          include: { organization: true },
        });

        return { user, organization };
      });
    } catch (error: unknown) {
      if (isPrismaUniqueError(error)) {
        throw new ConflictException('Email already registered');
      }
      throw error;
    }

    if (!result?.organization || !result?.user) {
      throw new InternalServerErrorException('Bootstrap transaction failed to produce an organization and user');
    }

    await this.security?.logEvent({
      eventType: SecurityEventType.PLATFORM_BOOTSTRAPPED,
      organizationId: result.organization.id,
      userId: result.user.id,
      resourceType: 'User',
      resourceId: result.user.id,
      success: true,
    });

    return await this.issueToken(result.user);
  }

  // ==================== Google OAuth ====================

  /**
   * Google sign-in / account-linking policy.
   *
   * Inactive accounts are rejected at this layer (fail closed — no token).
   */
  async googleLogin(
    googleUser: GoogleProfile,
    clientMeta?: { userAgent?: string; ipAddress?: string },
  ): Promise<{ accessToken: string; user: TokenUser }> {
    if (!googleUser.googleSubject || typeof googleUser.googleSubject !== 'string') {
      throw new BadRequestException('Invalid Google identity: missing subject ID');
    }
    if (!googleUser.email || typeof googleUser.email !== 'string') {
      throw new BadRequestException('Google account must have an email address');
    }
    if (googleUser.emailVerified !== true) {
      throw new UnauthorizedException('Google email must be verified');
    }
    const email = normalizeEmail(googleUser.email);

    const MAX_RACE_RETRIES = 3;
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.googleLoginOnce(googleUser, email, clientMeta);
      } catch (error: unknown) {
        if (!isPrismaUniqueError(error) || attempt >= MAX_RACE_RETRIES) throw error;
      }
    }
  }

  /** Single attempt at the Google login policy. */
  private async googleLoginOnce(
    googleUser: GoogleProfile,
    email: string,
    clientMeta?: { userAgent?: string; ipAddress?: string },
  ): Promise<{ accessToken: string; user: TokenUser }> {
    // 1) Established identity: same Google subject -> login.
    const bySubject = await this.prisma.user.findUnique({
      where: { googleSubject: googleUser.googleSubject },
      include: { organization: true },
    });

    if (bySubject) {
      if (!bySubject.isActive) {
        throw new UnauthorizedException('Account is deactivated');
      }
      await this.prisma.user.update({
        where: { id: bySubject.id },
        data: {
          lastLoginAt: new Date(),
          avatar: googleUser.avatar || bySubject.avatar,
          googleEmail: email,
        },
      });
      return await this.issueToken(bySubject, clientMeta);
    }

    // 2) Email match -> account-linking policy.
    const byEmail = await this.prisma.user.findUnique({
      where: { email },
      include: { organization: true },
    });

    if (byEmail) {
      if (!byEmail.isActive) {
        throw new UnauthorizedException('Account is deactivated');
      }
      if (byEmail.passwordHash) {
        throw new ConflictException(
          'An account with this email already exists. Please sign in with your email and password.',
        );
      }
      if (!canAutoLink(byEmail.role, byEmail.googleLinkAllowed)) {
        throw new ConflictException(
          'Google sign-in is not enabled for this account. Ask your administrator to enable Google sign-in or to set a password for this account.',
        );
      }

      const linked = await this.prisma.user.update({
        where: { id: byEmail.id },
        data: {
          googleSubject: googleUser.googleSubject,
          googleEmail: email,
          provider: 'google',
          lastLoginAt: new Date(),
          avatar: googleUser.avatar || byEmail.avatar,
        },
        include: { organization: true },
      });
      return await this.issueToken(linked, clientMeta);
    }

    // 3) Brand-new identity -> Requires valid invitation or whitelist approval
    const isWhitelisted = await this.isEmailWhitelisted(email);
    if (!isWhitelisted) {
      throw new ForbiddenException(
        'Registration requires a valid platform invitation. Please contact your platform administrator.',
      );
    }

    const displayName =
      [googleUser.firstName, googleUser.lastName].filter(Boolean).join(' ') ||
      'My Education Center';
    const orgName = `${displayName}'s Education Center`;

    const result = await this.prisma.$transaction(async (tx: any) => {
      const organization = await tx.organization.create({
        data: {
          name: orgName,
          email,
        },
      });

      return await tx.user.create({
        data: {
          organizationId: organization.id,
          email,
          passwordHash: null,
          firstName: googleUser.firstName,
          lastName: googleUser.lastName,
          avatar: googleUser.avatar,
          role: 'ORG_ADMIN',
          status: 'ACTIVE',
          isActive: true,
          provider: 'google',
          googleSubject: googleUser.googleSubject,
          googleEmail: email,
          lastLoginAt: new Date(),
        },
        include: { organization: true },
      });
    });

    return await this.issueToken(result, clientMeta);
  }

  private async issueToken(
    user: TokenUser,
    clientMeta?: { userAgent?: string; ipAddress?: string },
  ): Promise<{ accessToken: string; user: TokenUser }> {
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        organizationId: user.organizationId,
        expiresAt: new Date(Date.now() + authTtlMs()),
        userAgent: clientMeta?.userAgent,
        ipAddress: clientMeta?.ipAddress,
        lastActiveAt: new Date(),
      },
    });

    // Cleanup excess active sessions in background
    Promise.resolve().then(async () => {
      try {
        const activeSessions = await this.prisma.session.count({
          where: { userId: user.id, revokedAt: null },
        });
        if (activeSessions > 10) {
          const excessSessions = await this.prisma.session.findMany({
            where: { userId: user.id, revokedAt: null },
            orderBy: { createdAt: 'asc' },
            take: activeSessions - 10,
            select: { id: true },
          });
          await this.prisma.session.updateMany({
            where: { id: { in: excessSessions.map((s) => s.id) } },
            data: { revokedAt: new Date(), revokedReason: 'excess_sessions' },
          });
        }
      } catch (err) {
        this.logger.error('Failed to cleanup excess sessions', { error: errorMessage(err) });
      }
    });

    const payload = {
      sub: user.id,
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      sid: session.id,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        organizationId: user.organizationId,
        organization: user.organization,
      },
    };
  }

  /**
   * Issue a JWT for a ParentAccount (not a User row).
   */
  async issueParentToken(
    parent: {
      parentId: string;
      organizationId: string;
      firstName?: string;
      lastName?: string;
      email: string;
    },
    clientMeta?: { userAgent?: string; ipAddress?: string },
  ): Promise<string> {
    const session = await this.prisma.parentSession.create({
      data: {
        parentId: parent.parentId,
        organizationId: parent.organizationId,
        expiresAt: new Date(Date.now() + authTtlMs()),
      },
    });

    const payload = {
      sub: parent.parentId,
      id: parent.parentId,
      email: parent.email,
      role: 'PARENT',
      organizationId: parent.organizationId,
      accountType: 'parent',
      sid: session.id,
    };
    return this.jwtService.sign(payload);
  }

  // ==================== Sessions ====================

  async logout(sessionId: string, userId: string, role?: string) {
    if (role === 'PARENT') {
      await this.prisma.parentSession.updateMany({
        where: { id: sessionId, parentId: userId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'user_logout' },
      });
    } else {
      await this.prisma.session.updateMany({
        where: { id: sessionId, userId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'user_logout' },
      });
    }
  }

  async logoutAll(userId: string, reason = 'security', role?: string) {
    if (role === 'PARENT') {
      await this.prisma.parentSession.updateMany({
        where: { parentId: userId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: reason },
      });
    } else {
      await this.prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: reason },
      });
    }
  }

  async refreshToken(
    userId: string,
    currentSessionId?: string,
    role?: string,
    clientMeta?: { userAgent?: string; ipAddress?: string },
  ): Promise<{ accessToken: string; user: TokenUser }> {
    if (role === 'PARENT') {
      return this.refreshParentToken(userId, currentSessionId, clientMeta);
    }
    return this.refreshUserToken(userId, currentSessionId, clientMeta);
  }

  /** USER branch: sid -> Session -> User -> new Session + JWT. */
  private async refreshUserToken(
    userId: string,
    currentSessionId?: string,
    clientMeta?: { userAgent?: string; ipAddress?: string },
  ): Promise<{ accessToken: string; user: TokenUser }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { organization: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    if (currentSessionId) {
      const rotated = await this.prisma.session.updateMany({
        where: {
          id: currentSessionId,
          userId: user.id,
          organizationId: user.organizationId,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { revokedAt: new Date(), revokedReason: 'token_refresh' },
      });
      if (rotated.count !== 1) {
        throw new UnauthorizedException('Session is invalid or expired');
      }
    }

    return this.issueToken(user, clientMeta);
  }

  /** PARENT branch: sid -> ParentSession -> ParentAccount -> new session + JWT. */
  private async refreshParentToken(
    parentId: string,
    currentSessionId?: string,
    clientMeta?: { userAgent?: string; ipAddress?: string },
  ): Promise<{ accessToken: string; user: TokenUser }> {
    const parent = await this.prisma.parentAccount.findUnique({
      where: { id: parentId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        organizationId: true,
        isActive: true,
      },
    });

    if (!parent || !parent.isActive) {
      throw new UnauthorizedException('Parent account not found or inactive');
    }

    if (currentSessionId) {
      const rotated = await this.prisma.parentSession.updateMany({
        where: {
          id: currentSessionId,
          parentId: parent.id,
          organizationId: parent.organizationId,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { revokedAt: new Date(), revokedReason: 'token_refresh' },
      });
      if (rotated.count !== 1) {
        throw new UnauthorizedException('Session is invalid or expired');
      }
    }

    const accessToken = await this.issueParentToken(
      {
        parentId: parent.id,
        organizationId: parent.organizationId,
        email: parent.email,
        firstName: parent.firstName,
        lastName: parent.lastName,
      },
      clientMeta,
    );

    return {
      accessToken,
      user: {
        id: parent.id,
        email: parent.email,
        firstName: parent.firstName,
        lastName: parent.lastName,
        role: 'PARENT',
        organizationId: parent.organizationId,
      },
    };
  }

  async getMe(userId: string, role?: string): Promise<GetMeResponse> {
    if (role === 'PARENT') {
      const parent = await this.prisma.parentAccount.findUnique({
        where: { id: userId },
        include: {
          organization: {
            select: { id: true, name: true },
          },
        },
      });

      if (!parent || !parent.isActive) {
        throw new UnauthorizedException('Parent account not found or deactivated');
      }

      return {
        id: parent.id,
        email: parent.email,
        firstName: parent.firstName,
        lastName: parent.lastName,
        phone: parent.phone,
        avatar: null,
        role: 'PARENT',
        organizationId: parent.organizationId,
        lastLoginAt: parent.lastLoginAt,
        organization: parent.organization,
        settings: null,
      };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatar: true,
        role: true,
        organizationId: true,
        lastLoginAt: true,
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
        settings: true,
      },
    });

    if (!user) {
      const parent = await this.prisma.parentAccount.findUnique({
        where: { id: userId },
        include: {
          organization: {
            select: { id: true, name: true },
          },
        },
      });

      if (parent && parent.isActive) {
        return {
          id: parent.id,
          email: parent.email,
          firstName: parent.firstName,
          lastName: parent.lastName,
          phone: parent.phone,
          avatar: null,
          role: 'PARENT',
          organizationId: parent.organizationId,
          lastLoginAt: parent.lastLoginAt,
          organization: parent.organization,
          settings: null,
        };
      }

      throw new UnauthorizedException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      avatar: user.avatar,
      role: user.role,
      organizationId: user.organizationId,
      lastLoginAt: user.lastLoginAt,
      organization: user.organization,
      settings: user.settings,
    };
  }

  // ==================== Password recovery ====================

  async forgotPassword(email: string): Promise<{ message: string }> {
    const normalizedEmail = normalizeEmail(email);

    const user = await this.prisma.user.findFirst({
      where: { email: normalizedEmail, isActive: true },
      select: { id: true, email: true, passwordHash: true },
    });

    if (user && user.passwordHash) {
      await this.prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });

      const rawToken = this.generateSecureToken();
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

      await this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      });

      const resetUrl = `${this.getFrontendUrl()}/reset-password?token=${encodeURIComponent(rawToken)}`;

      if (process.env.SMTP_HOST) {
        try {
          await this.sendPasswordResetEmail(user.email, resetUrl);
          this.logger.info('Password reset email sent', { email: user.email });
        } catch (err: unknown) {
          await this.invalidateResetToken(tokenHash);
          this.logger.error('Failed to send password reset email', {
            email: user.email,
            error: errorMessage(err),
          });
        }
      } else {
        await this.invalidateResetToken(tokenHash);
        this.logger.warn('Password reset token invalidated (no SMTP configured)', {
          email: user.email,
        });
      }

      return { message: PASSWORD_RESET_GENERIC_MESSAGE };
    }

    if (this.prisma.parentAccount) {
      const parents = await this.prisma.parentAccount.findMany({
        where: { email: normalizedEmail, isActive: true },
        select: { id: true, email: true, passwordHash: true },
      });

      const activeParentsWithPassword = parents.filter((p) => Boolean(p.passwordHash));

      if (activeParentsWithPassword.length > 0) {
        const parentIds = activeParentsWithPassword.map((p) => p.id);

        if (this.prisma.parentPasswordResetToken) {
          await this.prisma.parentPasswordResetToken.updateMany({
            where: { parentId: { in: parentIds }, usedAt: null },
            data: { usedAt: new Date() },
          });

          const rawToken = this.generateSecureToken();
          const tokenHash = createHash('sha256').update(rawToken).digest('hex');
          const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

          await this.prisma.parentPasswordResetToken.create({
            data: {
              parentId: parentIds[0],
              tokenHash,
              expiresAt,
            },
          });

          const resetUrl = `${this.getFrontendUrl()}/reset-password?token=${encodeURIComponent(rawToken)}`;

          if (process.env.SMTP_HOST) {
            try {
              await this.sendPasswordResetEmail(activeParentsWithPassword[0].email, resetUrl);
              this.logger.info('Password reset email sent to parent', {
                email: activeParentsWithPassword[0].email,
              });
            } catch (err: unknown) {
              await this.invalidateResetToken(tokenHash);
              this.logger.error('Failed to send parent password reset email', {
                email: activeParentsWithPassword[0].email,
                error: errorMessage(err),
              });
            }
          } else {
            await this.invalidateResetToken(tokenHash);
            this.logger.warn('Parent password reset token invalidated (no SMTP configured)', {
              email: activeParentsWithPassword[0].email,
            });
          }

          return { message: PASSWORD_RESET_GENERIC_MESSAGE };
        }
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 150 + Math.random() * 100));
    return { message: PASSWORD_RESET_GENERIC_MESSAGE };
  }

  private async invalidateResetToken(tokenHash: string): Promise<void> {
    await this.prisma.passwordResetToken.updateMany({
      where: { tokenHash, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (this.prisma.parentPasswordResetToken) {
      await this.prisma.parentPasswordResetToken.updateMany({
        where: { tokenHash, usedAt: null },
        data: { usedAt: new Date() },
      });
    }
  }

  async resetPassword(token: string, newPassword: string) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const now = new Date();

    const userResetToken = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, usedAt: true, expiresAt: true },
    });

    if (userResetToken) {
      if (userResetToken.usedAt || userResetToken.expiresAt <= now) {
        throw new BadRequestException('Invalid or expired password reset token');
      }

      const passwordHash = await bcrypt.hash(newPassword, this.BCRYPT_ROUNDS);

      await this.prisma.$transaction(async (tx) => {
        const claimed = await tx.passwordResetToken.updateMany({
          where: {
            id: userResetToken.id,
            tokenHash,
            usedAt: null,
            expiresAt: { gt: now },
          },
          data: { usedAt: now },
        });
        if (claimed.count !== 1) {
          throw new BadRequestException('Invalid or expired password reset token');
        }

        const owner = await tx.user.findUnique({
          where: { id: userResetToken.userId },
          select: { id: true, isActive: true },
        });
        if (!owner || !owner.isActive) {
          throw new BadRequestException('Invalid or expired password reset token');
        }

        await tx.user.update({
          where: { id: owner.id },
          data: { passwordHash },
        });

        await tx.session.updateMany({
          where: { userId: owner.id, revokedAt: null },
          data: { revokedAt: now, revokedReason: 'password_reset' },
        });
      });

      return { message: 'Password has been reset successfully. Please log in with your new password.' };
    }

    const parentResetToken = this.prisma.parentPasswordResetToken
      ? await this.prisma.parentPasswordResetToken.findUnique({
          where: { tokenHash },
          select: { id: true, parentId: true, usedAt: true, expiresAt: true },
        })
      : null;

    if (parentResetToken) {
      if (parentResetToken.usedAt || parentResetToken.expiresAt <= now) {
        throw new BadRequestException('Invalid or expired password reset token');
      }

      const passwordHash = await bcrypt.hash(newPassword, this.BCRYPT_ROUNDS);

      await this.prisma.$transaction(async (tx) => {
        const claimed = await tx.parentPasswordResetToken.updateMany({
          where: {
            id: parentResetToken.id,
            tokenHash,
            usedAt: null,
            expiresAt: { gt: now },
          },
          data: { usedAt: now },
        });
        if (claimed.count !== 1) {
          throw new BadRequestException('Invalid or expired password reset token');
        }

        const owner = await tx.parentAccount.findUnique({
          where: { id: parentResetToken.parentId },
          select: { id: true, email: true, isActive: true },
        });
        if (!owner || !owner.isActive) {
          throw new BadRequestException('Invalid or expired password reset token');
        }

        const matchingParents = await tx.parentAccount.findMany({
          where: { email: owner.email, isActive: true },
          select: { id: true },
        });
        const parentIds = matchingParents.map((p) => p.id);

        await tx.parentAccount.updateMany({
          where: { id: { in: parentIds } },
          data: { passwordHash },
        });

        await tx.parentSession.updateMany({
          where: { parentId: { in: parentIds }, revokedAt: null },
          data: { revokedAt: now, revokedReason: 'password_reset' },
        });
      });

      return { message: 'Password has been reset successfully. Please log in with your new password.' };
    }

    throw new BadRequestException('Invalid or expired password reset token');
  }

  // ==================== Email transport ====================

  private async sendPasswordResetEmail(to: string, resetUrl: string) {
    const user = process.env.SMTP_USER;
    const from = process.env.SMTP_FROM || user || 'noreply@medu.app';

    const transporter = this.getSmtpTransporter();
    const appUrl = escapeHtml(resolveFrontendUrl());
    const orgName = escapeHtml(process.env.ORGANIZATION_NAME || 'M-EDU');
    const safeResetUrl = escapeHtml(resetUrl);

    await transporter.sendMail({
      from,
      to,
      subject: `Reset your ${process.env.ORGANIZATION_NAME || 'M-EDU'} password`,
      html: `
        <div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px">
          <h2 style="color:#1d1d1f;margin-bottom:16px">Reset your password</h2>
          <p style="color:#6e6e73;font-size:15px;line-height:1.6">
            You requested a password reset for your ${orgName} account.
            Click the button below to set a new password. This link expires in 1 hour.
          </p>
          <a href="${safeResetUrl}"
             style="display:inline-block;background:#2f4d9b;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:500;margin:16px 0">
            Reset Password
          </a>
          <p style="color:#86868b;font-size:13px;line-height:1.5">
            If you didn't request this, you can safely ignore this email.
            Your password won't change until you click the link and create a new one.
          </p>
          <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0" />
          <p style="color:#a1a1a6;font-size:12px">
            ${orgName} · <a href="${appUrl}" style="color:#2f4d9b">${appUrl}</a>
          </p>
        </div>
      `,
      text: `Reset your ${process.env.ORGANIZATION_NAME || 'M-EDU'} password\n\nClick the link to reset your password (expires in 1 hour):\n\n${resetUrl}\n\nIf you didn't request this, ignore this email.`,
    });
  }

  // ==================== Access Whitelist & Approval ====================

  async isEmailWhitelisted(email: string): Promise<boolean> {
    if (!this.prisma.accessWhitelist) return false;
    const entry = await this.prisma.accessWhitelist.findUnique({
      where: { email: normalizeEmail(email) },
    });
    return Boolean(entry);
  }

  async getWhitelist(organizationId?: string, isSuperAdmin = false) {
    if (!this.prisma.accessWhitelist) {
      return { whitelist: [], pendingUsers: [], config: { inviteOnly: true, requireApproval: true } };
    }

    const [whitelist, pendingUsers, config] = await Promise.all([
      this.prisma.accessWhitelist.findMany({
        where: isSuperAdmin ? {} : { organizationId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.findMany({
        where: {
          status: 'PENDING',
          ...(isSuperAdmin ? {} : { organizationId }),
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          organizationId: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.accessControlConfig
        ? this.prisma.accessControlConfig.findUnique({ where: { id: 'global' } })
        : null,
    ]);

    return {
      whitelist,
      pendingUsers,
      config: config || { inviteOnly: true, requireApproval: true },
    };
  }

  async addToWhitelist(data: {
    email: string;
    note?: string;
    role?: Role;
    addedBy?: string;
    organizationId?: string;
  }) {
    const normalized = normalizeEmail(data.email);
    const existing = await this.prisma.accessWhitelist.findUnique({
      where: { email: normalized },
    });
    if (existing) {
      throw new ConflictException('Email already whitelisted');
    }

    return this.prisma.accessWhitelist.create({
      data: {
        email: normalized,
        note: data.note,
        role: data.role || 'ORG_ADMIN',
        addedBy: data.addedBy,
        organizationId: data.organizationId || null,
      },
    });
  }

  async removeFromWhitelist(id: string, adminId?: string, adminRole?: string, organizationId?: string) {
    const entry = await this.prisma.accessWhitelist.findUnique({
      where: { id },
    });
    if (!entry) {
      throw new NotFoundException('Whitelist entry not found');
    }

    /*
     * Platform roles may delete every entry, including the tenant-less
     * (global) ones. Everyone else must BOTH be scoped to a tenant and own
     * the row:
     *
     *  - a missing `organizationId` used to fall through this guard because
     *    the comparison `entry.organizationId !== organizationId` was the ONLY
     *    thing standing between a foreign org admin and a shared row;
     *  - `entry.organizationId === null` (a global entry) used to skip the
     *    guard entirely, letting ANY org admin delete platform-wide policy.
     */
    if (!isPlatformRole(adminRole)) {
      if (!organizationId?.trim()) {
        throw new ForbiddenException('Whitelist entry cannot be modified without an organization scope');
      }
      if (entry.organizationId !== organizationId) {
        await this.security?.logEvent({
          eventType: SecurityEventType.CROSS_TENANT_ACCESS_ATTEMPT,
          organizationId,
          userId: adminId,
          resourceType: 'AccessWhitelist',
          resourceId: id,
          success: false,
          reason: 'WHITELIST_ENTRY_NOT_IN_ORGANIZATION',
        });
        throw new ForbiddenException('Cannot modify whitelist entry for another organization');
      }
    }

    await this.prisma.accessWhitelist.delete({ where: { id } });
    return { success: true };
  }

  async approveUser(id: string, adminId?: string, adminRole?: string, organizationId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!isPlatformRole(adminRole) && user.organizationId !== organizationId) {
      throw new ForbiddenException('Cannot approve user from another organization');
    }

    await this.prisma.user.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        isActive: true,
      },
    });

    return { success: true, message: 'User approved successfully' };
  }

  async rejectUser(id: string, adminId?: string, adminRole?: string, organizationId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!isPlatformRole(adminRole) && user.organizationId !== organizationId) {
      throw new ForbiddenException('Cannot reject user from another organization');
    }

    await this.prisma.user.update({
      where: { id },
      data: {
        status: 'REVOKED',
        isActive: false,
      },
    });

    return { success: true, message: 'User rejected successfully' };
  }

  async updateAccessControlConfig(
    data: UpdateAccessControlSettingsDto,
    adminId?: string,
    adminRole?: string,
    organizationId?: string,
  ) {
    /*
     * The row is keyed `id: 'global'`: ONE policy for the whole platform.
     * `organizationId` is therefore deliberately NOT accepted here — a tenant
     * admin must never be able to flip invite-only/approval for other tenants.
     * Fails closed when the caller's role was not supplied at all.
     */
    if (!isPlatformRole(adminRole)) {
      await this.security?.logEvent({
        eventType: SecurityEventType.UNAUTHORIZED_RESOURCE_ACCESS,
        organizationId: organizationId ?? undefined,
        userId: adminId,
        resourceType: 'AccessControlConfig',
        resourceId: 'global',
        success: false,
        reason: 'GLOBAL_ACCESS_CONTROL_WRITE_REQUIRES_PLATFORM_ROLE',
      });
      throw new ForbiddenException('Only a platform administrator can change global access control settings');
    }

    if (!this.prisma.accessControlConfig) return { inviteOnly: true, requireApproval: true };

    return this.prisma.accessControlConfig.upsert({
      where: { id: 'global' },
      create: {
        id: 'global',
        inviteOnly: data.inviteOnly ?? true,
        requireApproval: data.requireApproval ?? true,
        updatedBy: adminId,
      },
      update: {
        ...(data.inviteOnly !== undefined ? { inviteOnly: data.inviteOnly } : {}),
        ...(data.requireApproval !== undefined ? { requireApproval: data.requireApproval } : {}),
        updatedBy: adminId,
      },
    });
  }

  // ==================== Sessions & Device Management ====================

  async getActiveSessions(userId: string, currentSessionId?: string, role?: string) {
    if (role === 'PARENT') {
      const sessions = await this.prisma.parentSession.findMany({
        where: { parentId: userId, revokedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
      });
      return sessions.map((s) => ({
        id: s.id,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        isCurrent: s.id === currentSessionId,
      }));
    }

    const sessions = await this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    return sessions.map((s) => ({
      id: s.id,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      userAgent: s.userAgent,
      ipAddress: s.ipAddress,
      deviceInfo: s.deviceInfo,
      lastActiveAt: s.lastActiveAt,
      isCurrent: s.id === currentSessionId,
    }));
  }

  async revokeSession(userId: string, sessionId: string, role?: string) {
    if (role === 'PARENT') {
      await this.prisma.parentSession.updateMany({
        where: { id: sessionId, parentId: userId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'user_revoked' },
      });
    } else {
      await this.prisma.session.updateMany({
        where: { id: sessionId, userId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'user_revoked' },
      });
    }
    return { success: true };
  }

  async revokeOtherSessions(userId: string, currentSessionId?: string, role?: string) {
    if (role === 'PARENT') {
      await this.prisma.parentSession.updateMany({
        where: { parentId: userId, id: { not: currentSessionId }, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'revoke_others' },
      });
    } else {
      await this.prisma.session.updateMany({
        where: { userId, id: { not: currentSessionId }, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'revoke_others' },
      });
    }
    return { success: true };
  }

  async acceptInvitation(dto: AcceptInvitationDto): Promise<{ accessToken: string; user: TokenUser }> {
    const tokenHash = createHash('sha256').update(dto.token).digest('hex');
    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash },
    });

    if (
      !invitation ||
      invitation.status !== 'PENDING' ||
      invitation.acceptedAt ||
      invitation.expiresAt < new Date()
    ) {
      throw new BadRequestException('Invalid or expired invitation token');
    }

    const passwordHash = await bcrypt.hash(dto.password, this.BCRYPT_ROUNDS);

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      });

      const user = await tx.user.create({
        data: {
          email: invitation.email,
          organizationId: invitation.organizationId,
          role: invitation.role,
          passwordHash,
          firstName: 'Invited',
          lastName: 'Member',
          status: 'ACTIVE',
          isActive: true,
          lastLoginAt: new Date(),
        },
        include: { organization: true },
      });

      return user;
    });

    return this.issueToken(result);
  }
}
