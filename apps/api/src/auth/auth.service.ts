import {
  BadRequestException,
  ConflictException,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { errorMessage, GoogleProfile, TokenUser, GetMeResponse } from './types';
import { SecureLogger } from '@medu/face-security';
import * as bcrypt from 'bcryptjs';
import { randomBytes, createHash } from 'crypto';
import * as nodemailer from 'nodemailer';
import { BootstrapDto, RegisterDto } from './dto';
import { isPrivilegedRole } from './authorization.policy';
import { escapeHtml, isPrismaUniqueError, normalizeEmail, resolveFrontendUrl } from './auth.utils';
import { authTtlMs } from './auth.ttl';
import { resolveBcryptRounds, PASSWORD_RESET_GENERIC_MESSAGE, PASSWORD_RESET_TTL_MS } from './auth.config';

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
    const pass = process.env.SMTP_PASS;
    const secure = port === 465;
    if (!host) throw new Error('SMTP_HOST not configured');
    this.smtpTransporter = nodemailer.createTransport({
      host, port, secure,
      auth: user && pass ? { user, pass } : undefined,
    });
    return this.smtpTransporter;
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
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

  private generateSecureToken(bytes = 32): string {
    return randomBytes(bytes).toString('hex');
  }

  // ==================== Auth code exchange (CSRF-safe) ====================

  /**
   * Create the single-use code that hands the OAuth result to the SPA.
   *
   * The code itself is 256-bit random and carries no claim. What is persisted
   * is the SESSION id of the session `issueToken` just created — never the
   * signed JWT. A token stored in a table is a usable credential for its whole
   * lifetime regardless of when the row is purged; a session id is not: it is
   * useless without the signing key, and it stays revocable through the normal
   * `Session` lifecycle.
   */
  async generateAuthCode(accessToken: string, userId: string): Promise<string> {
    const code = this.generateSecureToken();
    const expiresAt = new Date(Date.now() + this.AUTH_CODE_TTL_MS);
    const sessionId = this.extractSessionId(accessToken);

    await this.prisma.authorizationCode.create({
      data: {
        code,
        sessionId,
        userId,
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

  async exchangeAuthCode(code: string): Promise<string> {
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

    // A code must be redeemable exactly ONCE. A separate read-then-write would
    // let two concurrent exchanges both observe `usedAt = null` and both walk
    // away with a session; the guarded update makes the loser fail closed.
    const claimed = await this.prisma.authorizationCode.updateMany({
      where: { id: entry.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (claimed.count !== 1) {
      throw new BadRequestException('Authorization code has already been used');
    }

    // Never mint a session for an account that was deactivated or deleted
    // between the OAuth callback and the exchange.
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

    // Purge expired DB sessions, password reset tokens, and authorization codes
    try {
      const cutoff = new Date(now - this.SESSION_RETENTION_HOURS * 60 * 60 * 1000);
      const [sessionResult, parentSessionResult, tokenResult, authCodeResult] = await Promise.all([
        this.prisma.session.deleteMany({ where: { expiresAt: { lt: cutoff } } }),
        this.prisma.parentSession.deleteMany({ where: { expiresAt: { lt: cutoff } } }),
        this.prisma.passwordResetToken.deleteMany({
          where: {
            OR: [
              { expiresAt: { lt: new Date(now) } },
              { usedAt: { not: null, lt: cutoff } },
            ],
          },
        }),
        this.prisma.authorizationCode.deleteMany({
          where: {
            OR: [
              { expiresAt: { lt: new Date(now) } },
              { usedAt: { not: null, lt: cutoff } },
            ],
          },
        }),
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
  async login(email: string, password: string): Promise<{ accessToken: string; user: TokenUser }> {
    // `User.email` is globally unique (see schema + the P2002 handling on
    // registration), so resolve it with the unique index rather than a
    // findFirst scan. Deactivation is checked explicitly to keep the same
    // outward behaviour (uniform "Invalid credentials" for inactive accounts).
    const user = await this.prisma.user.findUnique({
      where: { email: normalizeEmail(email) },
      include: { organization: true },
    });

    if (!user || !user.isActive || !user.passwordHash) {
      // Anti-timing attack delay without blocking event loop (DoS protection)
      await new Promise(resolve => setTimeout(resolve, 150 + Math.random() * 100));
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Issue a tracked session (sid in JWT) so the token can be revoked on logout.
    return await this.issueToken(user);
  }

  async register(data: RegisterDto): Promise<{ accessToken: string; user: TokenUser }> {
    const email = normalizeEmail(data.email);
    const passwordHash = await bcrypt.hash(data.password, this.BCRYPT_ROUNDS);

    let result;
    try {
      result = await this.prisma.$transaction(async (tx) => {
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

    // Issue a tracked session (sid in JWT) so the token can be revoked on logout.
    return await this.issueToken(result.user);
  }


  /**
   * One-time platform bootstrap: creates the FIRST SUPER_ADMIN.
   *
   * The SUPER_ADMIN role bypasses every permission check (authorization
   * adapter) and currently has no other provisioning path (the seed creates
   * ORG_ADMINs only, and ORG_ADMINs are forbidden from minting
   * SUPER_ADMINs). Without this endpoint a fresh deployment could never
   * reach admin control.
   *
   * Security model:
   *  - Locked forever once ANY SUPER_ADMIN exists (active or not) — a
   *    deactivated platform admin must be restored via ops, not re-booted.
   *  - Serialized with a Postgres advisory lock so two concurrent bootstrap
   *    requests cannot both pass the zero-SUPER_ADMIN check.
   *  - Heavily throttled at the controller (3/min per IP).
   */
  async bootstrap(data: BootstrapDto): Promise<{ accessToken: string; user: TokenUser }> {
    const superAdminCount = await this.prisma.user.count({
      where: { role: 'SUPER_ADMIN' },
    });
    if (superAdminCount > 0) {
      throw new ConflictException('Platform is already bootstrapped');
    }

    

    const email = normalizeEmail(data.email);
    const passwordHash = await bcrypt.hash(data.password, this.BCRYPT_ROUNDS);

    let result;
    try {
      result = await this.prisma.$transaction(async (tx) => {
        // Serialize concurrent first-bootstraps (advisory lock, per-connection).
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('medu_platform_bootstrap'))`;
        const recheck = await tx.user.count({ where: { role: 'SUPER_ADMIN' } });
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
            role: 'SUPER_ADMIN',
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

    return await this.issueToken(result.user);
  }

  // ==================== Google OAuth ====================

  /**
   * Google sign-in / account-linking policy (explicit, security-first).
   *
   * Identity chain: the OAuth2 authorization-code exchange with our client
   * secret proves the token was issued to OUR client (audience), Google's
   * token endpoint validates the code + token signature, and the userinfo
   * profile is fetched over TLS. On top of that we enforce claim checks:
   *   - `googleSubject` (sub) is mandatory and unique.
   *   - ONLY verified Google emails are accepted (email_verified === true).
   *     M-EDU local registration does NOT verify emails, so a Google email
   *     is the strongest ownership proof available.
   *
   * Account linking rules (never merge on email string match alone):
   *   1. Same googleSubject            -> login (established link).
   *   2. Same verified email           -> link ONLY when the account model
   *      explicitly permits auto-linking (`canAutoLink`); otherwise 409 with
   *      an actionable message.
   *   3. Same verified email, existing
   *      account HAS a passwordHash    -> 409, NO auto-merge. An attacker
   *      could register an unverified local row with the victim's email;
   *      auto-linking would confuse identities.
   *   4. No match                      -> create a new org + ORG_ADMIN.
   *
   * Duplicate protection: steps 2-4 race with a concurrent first login for
   * the SAME Google identity from another device. `User.googleSubject` and
   * `User.email` are unique, so exactly one transaction can win; the loser
   * gets a P2002 and is re-resolved onto the winner's row instead of
   * erroring out. One Google identity therefore always converges on exactly
   * one M-EDU User (see the retry loop in `googleLogin`).
   *
   * Inactive accounts are rejected at this layer (fail closed — no token).
   */
  async googleLogin(googleUser: GoogleProfile): Promise<{ accessToken: string; user: TokenUser }> {
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

    // A first-time login can lose the unique-index race to a concurrent
    // first login of the SAME Google identity on another device. Retry: once
    // the winner's row exists, the retry resolves onto it (rule 1) instead of
    // failing — one Google identity always converges on one M-EDU User.
    const MAX_RACE_RETRIES = 3;
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.googleLoginOnce(googleUser, email);
      } catch (error: unknown) {
        if (!isPrismaUniqueError(error) || attempt >= MAX_RACE_RETRIES) throw error;
      }
    }
  }

  /** Single attempt at the Google login policy documented above. */
  private async googleLoginOnce(
    googleUser: GoogleProfile,
    email: string,
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
      return await this.issueToken(bySubject);
    }

    // 2) Email match -> account-linking policy (rules 2 and 3 above).
    //    `User.email` is globally unique, so there is exactly one candidate.
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
      return await this.issueToken(linked);
    }

    // 3) Brand-new identity -> Google signup (new org + ORG_ADMIN).
    const displayName =
      [googleUser.firstName, googleUser.lastName].filter(Boolean).join(' ') ||
      'My Education Center';
    const orgName = `${displayName}'s Education Center`;

    // A P2002 here means a concurrent first login for the same Google
    // identity (or a concurrent local registration for the same email) won
    // the unique-index race. It is deliberately NOT translated into a 409:
    // the caller retries `googleLoginOnce`, which now resolves onto the
    // winner's row. Only an unrelated unique violation may surface.
    const result = await this.prisma.$transaction(async (tx) => {
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
          provider: 'google',
          googleSubject: googleUser.googleSubject,
          googleEmail: email,
          lastLoginAt: new Date(),
        },
        include: { organization: true },
      });
    });

    return await this.issueToken(result);
  }

  private async issueToken(user: TokenUser): Promise<{ accessToken: string; user: TokenUser }> {
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        organizationId: user.organizationId,
        expiresAt: new Date(Date.now() + authTtlMs()),
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
            where: { id: { in: excessSessions.map(s => s.id) } },
            data: { revokedAt: new Date(), revokedReason: 'excess_sessions' },
          });
        }
      } catch (err) {
        this.logger.error('Failed to cleanup excess sessions', { error: errorMessage(err) });
      }
    });

    const payload = {
      sub: user.id,
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
   * The token carries `role: 'PARENT'` and `accountType: 'parent'` so
   * JwtStrategy can resolve it against the correct table.
   */
  async issueParentToken(parent: {
    parentId: string;
    organizationId: string;
    firstName?: string;
    lastName?: string;
    email: string;
  }): Promise<string> {
    const session = await this.prisma.parentSession.create({
      data: {
        parentId: parent.parentId,
        organizationId: parent.organizationId,
        expiresAt: new Date(Date.now() + authTtlMs()),
      },
    });

    const payload = {
      sub: parent.parentId,
      email: parent.email,
      role: 'PARENT',
      organizationId: parent.organizationId,
      accountType: 'parent',
      sid: session.id,
    };
    return this.jwtService.sign(payload);
  }

  // Session lifetime lives in `auth.ttl.ts` (authTtlMs) so the JWT, the
  // session row and the cookie can never drift apart.

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

  /**
   * Rotate a presented session into a freshly minted one.
   *
   * SESSION-TYPE DISPATCH is explicit — the table is chosen by the token's
   * role claim, never by guessing which table might contain the id:
   *
   *   USER   (role !== 'PARENT'):
   *     sid -> Session        -> User         -> organization/role -> issue token
   *   PARENT (role === 'PARENT'):
   *     sid -> ParentSession  -> ParentAccount -> organization     -> issue parent token
   *
   * Each branch queries exactly ONE table and binds the session on its owning
   * id (userId / parentId) AND organizationId. A parent session id can
   * therefore never resolve through `Session`, a user session id can never
   * resolve through `ParentSession`, and a row owned by another principal or
   * another tenant fails closed with 401.
   *
   * ROTATION / REPLAY: the presented session is revoked (`token_refresh`)
   * before the replacement is issued, so refreshing once invalidates the JWT
   * that performed the refresh. Replaying that JWT afterwards is rejected
   * twice over — by JwtStrategy (revoked row) and here (no live session).
   */
  async refreshToken(
    userId: string,
    currentSessionId?: string,
    role?: string,
  ): Promise<{ accessToken: string; user: TokenUser }> {
    if (role === 'PARENT') {
      return this.refreshParentToken(userId, currentSessionId);
    }
    return this.refreshUserToken(userId, currentSessionId);
  }

  /** USER branch: sid -> Session -> User -> new Session + JWT. */
  private async refreshUserToken(
    userId: string,
    currentSessionId?: string,
  ): Promise<{ accessToken: string; user: TokenUser }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { organization: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    if (currentSessionId) {
      const live = await this.prisma.session.findFirst({
        where: {
          id: currentSessionId,
          userId: user.id,
          organizationId: user.organizationId,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        select: { id: true },
      });
      if (!live) {
        throw new UnauthorizedException('Session is invalid or expired');
      }

      // Rotate: revoke exactly the session that presented this token.
      await this.prisma.session.updateMany({
        where: { id: live.id, userId: user.id, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'token_refresh' },
      });
    }

    return this.issueToken(user);
  }

  /** PARENT branch: sid -> ParentSession -> ParentAccount -> new session + JWT. */
  private async refreshParentToken(
    parentId: string,
    currentSessionId?: string,
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
      const live = await this.prisma.parentSession.findFirst({
        where: {
          id: currentSessionId,
          parentId: parent.id,
          organizationId: parent.organizationId,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        select: { id: true },
      });
      if (!live) {
        throw new UnauthorizedException('Session is invalid or expired');
      }

      await this.prisma.parentSession.updateMany({
        where: { id: live.id, parentId: parent.id, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'token_refresh' },
      });
    }

    const accessToken = await this.issueParentToken({
      parentId: parent.id,
      organizationId: parent.organizationId,
      email: parent.email,
      firstName: parent.firstName,
      lastName: parent.lastName,
    });

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
          }
        },
        settings: true,
      }
    });

    if (!user) {
      // Defensive fallback check for ParentAccount if role was omitted
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

  /**
   * Request a password reset. Always returns a generic success message
   * regardless of whether the email exists — prevents user enumeration.
   * Supports both staff Users and ParentAccounts.
   */
  async forgotPassword(email: string): Promise<{ message: string }> {
    const normalizedEmail = normalizeEmail(email);

    // 1. Try finding a User
    const user = await this.prisma.user.findFirst({
      where: { email: normalizedEmail, isActive: true },
      select: { id: true, email: true, passwordHash: true },
    });

    if (user && user.passwordHash) {
      // Invalidate any previous unused reset tokens for this user
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

    // 2. Try finding ParentAccount(s)
    if (this.prisma.parentAccount) {
      const parents = await this.prisma.parentAccount.findMany({
        where: { email: normalizedEmail, isActive: true },
        select: { id: true, email: true, passwordHash: true },
      });

      const activeParentsWithPassword = parents.filter((p) => Boolean(p.passwordHash));

      if (activeParentsWithPassword.length > 0) {
        const parentIds = activeParentsWithPassword.map((p) => p.id);

        // Invalidate previous tokens
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
              this.logger.info('Password reset email sent to parent', { email: activeParentsWithPassword[0].email });
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

    // Always return success to prevent email enumeration
    await new Promise((resolve) => setTimeout(resolve, 150 + Math.random() * 100));
    return { message: PASSWORD_RESET_GENERIC_MESSAGE };
  }

  /** Atomically burn an undelivered reset token so it can never be redeemed. */
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

  /**
   * Reset password using a valid, unexpired, unused token.
   *
   * Consume-once guarantee: the token is claimed with a single guarded write
   * (`usedAt: null AND expiresAt > now`) whose `count` MUST be exactly 1.
   * Supports both User and ParentAccount reset tokens.
   */
  async resetPassword(token: string, newPassword: string) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const now = new Date();

    // 1. Check if token exists in User reset tokens
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

        // Revoke all active sessions — the old password is compromised
        await tx.session.updateMany({
          where: { userId: owner.id, revokedAt: null },
          data: { revokedAt: now, revokedReason: 'password_reset' },
        });
      });

      return { message: 'Password has been reset successfully. Please log in with your new password.' };
    }

    // 2. Check if token exists in Parent reset tokens
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

        // Find all active parent accounts matching this email across organizations
        const matchingParents = await tx.parentAccount.findMany({
          where: { email: owner.email, isActive: true },
          select: { id: true },
        });
        const parentIds = matchingParents.map((p) => p.id);

        await tx.parentAccount.updateMany({
          where: { id: { in: parentIds } },
          data: { passwordHash },
        });

        // Revoke all active parent sessions
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

    // Dynamic values only: every interpolation below is escaped for its HTML
    // context. Static markup/text is intentionally NOT escaped (double-escaping
    // would corrupt it).
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
}



