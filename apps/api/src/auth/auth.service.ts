import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { errorMessage, GoogleProfile, TokenUser } from './types';
import { SecureLogger } from '@medu/face-security';
import * as bcrypt from 'bcryptjs';
import { randomBytes, createHash } from 'crypto';
import * as nodemailer from 'nodemailer';
import { BootstrapDto, RegisterDto } from './dto';



@Injectable()
export class AuthService {

  private readonly AUTH_CODE_TTL_MS = 5 * 60 * 1000;
  private readonly CLEANUP_INTERVAL_MS = Number(process.env.SESSION_PURGE_INTERVAL_MS) || 60 * 1000;
  // Retention grace for expired sessions: by default expired rows are purged
  // on the next cleanup tick. Operators can keep a short audit trail with
  // SESSION_RETENTION_HOURS (e.g. "24").
  private readonly SESSION_RETENTION_HOURS = Number(process.env.SESSION_RETENTION_HOURS) || 0;

  private readonly logger = new SecureLogger('info');

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {
    setInterval(() => this.cleanupExpiredEntries(), this.CLEANUP_INTERVAL_MS);
  }

  // ==================== Auth code exchange (CSRF-safe) ====================

  async generateAuthCode(accessToken: string, userId: string): Promise<string> {
    const code = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + this.AUTH_CODE_TTL_MS);

    await this.prisma.authorizationCode.create({
      data: {
        code,
        accessToken,
        userId,
        expiresAt,
      },
    });

    return code;
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

    await this.prisma.authorizationCode.update({
      where: { id: entry.id },
      data: { usedAt: new Date() },
    });

    return entry.accessToken;
  }

  private async cleanupExpiredEntries() {
    const now = Date.now();

    // Purge expired DB sessions, password reset tokens, and authorization codes
    try {
      const cutoff = new Date(now - this.SESSION_RETENTION_HOURS * 60 * 60 * 1000);
      const [sessionResult, tokenResult, authCodeResult] = await Promise.all([
        this.prisma.session.deleteMany({ where: { expiresAt: { lt: cutoff } } }),
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

  async login(email: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: { email, isActive: true },
      include: { organization: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.passwordHash) {
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

  async register(data: RegisterDto) {
    const existingUser = await this.prisma.user.findFirst({
      where: { email: data.email },
    });
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    const result = await this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: data.organizationName,
          email: data.email,
          phone: data.phone,
        },
      });

      const user = await tx.user.create({
        data: {
          organizationId: organization.id,
          email: data.email,
          passwordHash,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          role: 'ORG_ADMIN',
        },
        include: { organization: true },
      });

      return { user, organization };
    });

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
  async bootstrap(data: BootstrapDto) {
    const superAdminCount = await this.prisma.user.count({
      where: { role: 'SUPER_ADMIN' },
    });
    if (superAdminCount > 0) {
      throw new ConflictException('Platform is already bootstrapped');
    }

    const existingUser = await this.prisma.user.findFirst({
      where: { email: data.email },
    });
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    const result = await this.prisma.$transaction(async (tx) => {
      // Serialize concurrent first-bootstraps (advisory lock, per-connection).
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('medu_platform_bootstrap'))`;
      const recheck = await tx.user.count({ where: { role: 'SUPER_ADMIN' } });
      if (recheck > 0) {
        throw new ConflictException('Platform is already bootstrapped');
      }

      const organization = await tx.organization.create({
        data: {
          name: data.organizationName,
          email: data.email,
          phone: data.phone,
        },
      });

      const user = await tx.user.create({
        data: {
          organizationId: organization.id,
          email: data.email,
          passwordHash,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          role: 'SUPER_ADMIN',
        },
        include: { organization: true },
      });

      return { user, organization };
    });

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
   *   2. Same verified email, existing
   *      account has NO passwordHash   -> link Google identity to it. Such
   *      accounts were themselves created via Google or are passwordless,
   *      and Google verified email ownership.
   *   3. Same verified email, existing
   *      account HAS a passwordHash    -> 409, NO auto-merge. An attacker
   *      could register an unverified local row with the victim's email;
   *      auto-linking would confuse identities. User must sign in locally
   *      and connect Google explicitly.
   *   4. No match                      -> create a new org + ORG_ADMIN.
   *
   * Inactive accounts are rejected at this layer (fail closed — no token).
   */
  async googleLogin(googleUser: GoogleProfile) {
    if (!googleUser.googleSubject || typeof googleUser.googleSubject !== 'string') {
      throw new BadRequestException('Invalid Google identity: missing subject ID');
    }
    if (!googleUser.email || typeof googleUser.email !== 'string') {
      throw new BadRequestException('Google account must have an email address');
    }
    if (googleUser.emailVerified !== true) {
      throw new UnauthorizedException('Google email must be verified');
    }
    const email = googleUser.email.toLowerCase().trim();

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
    const byEmail = await this.prisma.user.findFirst({
      where: { email },
      include: { organization: true },
      orderBy: { createdAt: 'desc' },
    });

    if (byEmail) {
      if (!byEmail.isActive) {
        throw new UnauthorizedException('Account is deactivated');
      }
      if (byEmail.passwordHash) {
        throw new ConflictException(
          'An account with this email already exists. Please sign in with your email and password, then connect your Google account in Settings.',
        );
      }
      // Passwordless account -> safe to link (Google verified the email).
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

    const result = await this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: orgName,
          email,
        },
      });

      const newUser = await tx.user.create({
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

      return newUser;
    });

    return await this.issueToken(result);
  }

  private async issueToken(user: TokenUser) {
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        organizationId: user.organizationId,
        expiresAt: new Date(Date.now() + this.sessionTtlMs()),
      },
    });

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
        data: { revokedAt: new Date() },
      });
    }

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
   * Session lifetime in ms, derived from JWT_EXPIRES_IN so the DB session
   * row and the JWT always expire together. Supports plain milliseconds
   * ("86400000") or unit suffixes ("24h", "30m", "7d", "900s"). Falls back
   * to 24h when unset or unparseable (matches the historical default).
   */
  private sessionTtlMs(): number {
    const raw = process.env.JWT_EXPIRES_IN;
    if (!raw) return 24 * 60 * 60 * 1000;
    const m = /^(\d+)\s*(ms|s|m|h|d)?$/i.exec(raw.trim());
    if (!m) return 24 * 60 * 60 * 1000;
    const value = parseInt(m[1], 10);
    const unit = (m[2] || 'ms').toLowerCase();
    const mult: Record<string, number> = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
    const ttl = value * mult[unit];
    // Guard against absurd values (negative / zero / > 365 days).
    if (!Number.isFinite(ttl) || ttl <= 0 || ttl > 365 * 86_400_000) {
      return 24 * 60 * 60 * 1000;
    }
    return ttl;
  }

  // ==================== Sessions ====================

  async logout(sessionId: string, userId: string) {
    await this.prisma.session.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: 'user_logout' },
    });
  }

  async logoutAll(userId: string, reason = 'security') {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }

  async refreshToken(userId: string, currentSessionId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { organization: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    if (currentSessionId) {
      await this.prisma.session.updateMany({
        where: { id: currentSessionId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    return await this.issueToken(user);
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { organization: true, settings: true },
    });

    if (!user) {
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
      organization: user.organization,
      settings: user.settings,
      lastLoginAt: user.lastLoginAt,
    };
  }

  // ==================== Password recovery ====================

  /**
   * Request a password reset. Always returns a generic success message
   * regardless of whether the email exists — prevents user enumeration.
   */
  async forgotPassword(email: string) {
    const user = await this.prisma.user.findFirst({
      where: { email: email.toLowerCase().trim(), isActive: true },
    });

    // Always return success to prevent email enumeration
    if (!user || !user.passwordHash) {
      return { message: 'If an account with that email exists, a password reset link has been sent.' };
    }

    // Invalidate any previous unused reset tokens for this user
    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    // Send the reset link via email (production) or log it (dev).
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password?token=${rawToken}`;
    if (process.env.SMTP_HOST) {
      try {
        await this.sendPasswordResetEmail(user.email, resetUrl);
        this.logger.info('Password reset email sent', { email: user.email });
      } catch (err: unknown) {
        // Log the failure but do NOT reveal it to the caller (anti-enumeration).
        this.logger.error('Failed to send password reset email', {
          email: user.email,
          error: errorMessage(err),
        });
      }
    } else {
      this.logger.warn('Password reset link generated (no SMTP configured)', {
        email: user.email,
      });
    }

    return { message: 'If an account with that email exists, a password reset link has been sent.' };
  }

  /**
   * Reset password using a valid, unexpired, unused token.
   * Revokes all existing sessions for the user after reset.
   */
  async resetPassword(token: string, newPassword: string) {
    const tokenHash = createHash('sha256').update(token).digest('hex');

    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      });

      await tx.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      });

      // Revoke all active sessions — the old password is compromised
      await tx.session.updateMany({
        where: { userId: resetToken.userId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'password_reset' },
      });
    });

    return { message: 'Password has been reset successfully. Please log in with your new password.' };
  }

  // ==================== Email transport ====================

  private async sendPasswordResetEmail(to: string, resetUrl: string) {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT) || 587;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM || user || 'noreply@medu.app';
    const secure = port === 465;

    if (!host) throw new Error('SMTP_HOST not configured');

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const orgName = process.env.ORGANIZATION_NAME || 'M-EDU';

    await transporter.sendMail({
      from,
      to,
      subject: `Reset your ${orgName} password`,
      html: `
        <div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px">
          <h2 style="color:#1d1d1f;margin-bottom:16px">Reset your password</h2>
          <p style="color:#6e6e73;font-size:15px;line-height:1.6">
            You requested a password reset for your ${orgName} account.
            Click the button below to set a new password. This link expires in 1 hour.
          </p>
          <a href="${resetUrl}"
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
      text: `Reset your ${orgName} password\n\nClick the link to reset your password (expires in 1 hour):\n\n${resetUrl}\n\nIf you didn't request this, ignore this email.`,
    });
  }
}
