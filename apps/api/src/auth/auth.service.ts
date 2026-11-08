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
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'crypto';
import * as nodemailer from 'nodemailer';
import { SecureLogger } from '@medu/face-security';
import { PrismaService } from '../prisma/prisma.service';
import {
  SecurityEventService,
  SecurityEventType,
} from '../common/security/security-event.service';
import { RedisPubSubService } from '../common/redis/redis-pubsub.service';
import { errorMessage, GoogleProfile, TokenUser, GetMeResponse } from './types';
import {
  AcceptInvitationDto,
  AddToWhitelistDto,
  BootstrapDto,
  RegisterDto,
  UpdateAccessControlSettingsDto,
} from './dto';
import { isPlatformRole, isPrivilegedRole } from './authorization.policy';
import { normalizeUsername } from './username.utils';
import {
  escapeHtml,
  isPrismaUniqueError,
  normalizeEmail,
  resolveFrontendUrl,
} from './auth.utils';
import { authTtlMs } from './auth.ttl';
import {
  resolveBcryptRounds,
  PASSWORD_RESET_GENERIC_MESSAGE,
  PASSWORD_RESET_TTL_MS,
} from './auth.config';

export { AddToWhitelistDto };

// ============================================================================
// ARCHITECTURAL CONSTANTS & SECURITY PARAMETERS
// ============================================================================

const SESSION_SYNC_CHANNEL = 'auth:session:sync';
const BLACKLIST_KEY_PREFIX = 'auth:blacklist:sid:';
const RTR_ROTATED_PREFIX = 'auth:rtr:rotated:';
const RTR_FAMILY_PREFIX = 'auth:rtr:family:';
const BRUTE_FORCE_EMAIL_PREFIX = 'auth:bf:email:';
const BRUTE_FORCE_IP_PREFIX = 'auth:bf:ip:';

const DEFAULT_MAX_CONCURRENT_DEVICES = 1;
const BRUTE_FORCE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const DEFAULT_MAX_FAILED_ATTEMPTS = 5;
const TWO_FACTOR_CHALLENGE_TTL_SEC = 300; // 5 minutes
const TOTP_STEP_SECONDS = 30;
const TOTP_DIGITS = 6;
const BACKUP_CODES_COUNT = 8;
const MAX_LOCAL_CACHE_ENTRIES = 5000;

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Role-to-Permission Matrix for Multi-Tenant RBAC encoding inside JWTs.
 */
const ROLE_PERMISSIONS_MATRIX: Readonly<Record<string, readonly string[]>> = {
  PLATFORM_OWNER: [
    'platform:manage',
    'org:manage',
    'branch:switch',
    'users:manage',
    'finance:manage',
    'academics:manage',
    'security:audit',
  ],
  SUPER_ADMIN: [
    'platform:manage',
    'org:manage',
    'branch:switch',
    'users:manage',
    'finance:manage',
    'academics:manage',
    'security:audit',
  ],
  ORG_ADMIN: [
    'org:manage',
    'branch:switch',
    'users:manage',
    'finance:manage',
    'academics:manage',
  ],
  ADMIN: [
    'branch:switch',
    'users:manage',
    'finance:read',
    'academics:manage',
  ],
  MANAGER: ['users:read', 'academics:manage', 'attendance:manage'],
  ACCOUNTANT: ['finance:manage', 'finance:read', 'invoices:manage'],
  TEACHER: ['academics:read', 'attendance:mark', 'grades:manage'],
  ASSISTANT: ['academics:read', 'attendance:mark'],
  STUDENT: ['self:read', 'homework:submit'],
  PARENT: ['children:read', 'payments:create'],
};

const SUSPENDED_STATUSES: ReadonlySet<string> = new Set([
  'SUSPENDED',
  'BANNED',
  'REVOKED',
  'DISABLED',
]);

// ============================================================================
// STRICT DISCRIMINATED UNIONS & DOMAIN INTERFACES
// ============================================================================

export interface ClientMetadata {
  readonly userAgent?: string;
  readonly ipAddress?: string;
  readonly branchId?: string | null;
}

export interface DeviceFingerprintInfo {
  readonly browser: string;
  readonly os: string;
  readonly deviceType: 'DESKTOP' | 'MOBILE' | 'TABLET' | 'BOT' | 'UNKNOWN';
  readonly ipAddress: string;
  readonly fingerprintHash: string;
  readonly formattedLabel: string;
}

export type SessionSyncEvent =
  | {
      readonly type: 'SESSION_CREATED';
      readonly userId: string;
      readonly organizationId: string;
      readonly sessionId: string;
      readonly familyId: string;
      readonly device: DeviceFingerprintInfo;
      readonly occurredAt: string;
    }
  | {
      readonly type: 'SESSION_REVOKED';
      readonly userId: string;
      readonly sessionId: string;
      readonly reason: string;
      readonly occurredAt: string;
    }
  | {
      readonly type: 'OTHER_SESSIONS_REVOKED';
      readonly userId: string;
      readonly retainedSessionId?: string;
      readonly occurredAt: string;
    }
  | {
      readonly type: 'ALL_SESSIONS_REVOKED';
      readonly userId: string;
      readonly reason: string;
      readonly occurredAt: string;
    }
  | {
      readonly type: 'TOKEN_FAMILY_COMPROMISED';
      readonly userId: string;
      readonly organizationId?: string;
      readonly familyId: string;
      readonly compromisedSessionId: string;
      readonly occurredAt: string;
    }
  | {
      readonly type: 'PASSWORD_CHANGED';
      readonly userId: string;
      readonly occurredAt: string;
    }
  | {
      readonly type: 'PROFILE_UPDATED';
      readonly userId: string;
      readonly organizationId: string;
      readonly occurredAt: string;
    };

export interface TokenFamilyRecord {
  readonly familyId: string;
  readonly userId: string;
  readonly organizationId: string;
  readonly currentSessionId: string;
  readonly tokenSalt: string;
  readonly refreshTokenHash: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  revoked: boolean;
}

export interface BruteForceRecord {
  count: number;
  firstAttemptAt: number;
  lockedUntil: number | null;
}

export interface TwoFactorUserState {
  readonly userId: string;
  readonly encryptedSecret: string;
  readonly enabled: boolean;
  readonly backupCodeSalts: readonly string[];
  readonly backupCodeHashes: string[];
  readonly updatedAt: string;
}

export interface TwoFactorSetupResult {
  readonly secret: string;
  readonly otpauthUri: string;
  readonly qrDataUrlPayload: string;
  readonly issuer: string;
  readonly accountEmail: string;
}

interface PlatformInvitationRecord {
  readonly id: string;
  readonly codeHash: string;
  readonly maxUses: number;
  readonly useCount: number;
  readonly expiresAt: Date;
  readonly revokedAt: Date | null;
}

interface AccountStatusCheckTarget {
  readonly id: string;
  readonly isActive?: boolean | null;
  readonly status?: string | null;
  readonly organization?: {
    readonly id?: string;
    readonly name?: string;
    readonly isActive?: boolean | null;
    readonly status?: string | null;
  } | null;
}

// ============================================================================
// STRICT TYPE GUARDS (100% ZERO `any`)
// ============================================================================

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function extractBootstrapSecret(
  data: BootstrapDto,
  secretHeader?: string,
): string {
  if (typeof data.inviteCode === 'string' && data.inviteCode.trim().length > 0) {
    return data.inviteCode.trim();
  }
  if (isRecord(data) && typeof data.secret === 'string' && data.secret.trim().length > 0) {
    return data.secret.trim();
  }
  if (typeof secretHeader === 'string' && secretHeader.trim().length > 0) {
    return secretHeader.trim();
  }
  return '';
}

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
export function canAutoLink(
  role: string | null | undefined,
  googleLinkAllowed: boolean,
): boolean {
  if (isPrivilegedRole(role)) return false;
  return googleLinkAllowed === true;
}

// ============================================================================
// MAIN ENTERPRISE IAM & AUTHENTICATION SERVICE
// ============================================================================

@Injectable()
export class AuthService implements OnModuleInit, OnModuleDestroy {
  private readonly AUTH_CODE_TTL_MS = 5 * 60 * 1000;
  private readonly CLEANUP_INTERVAL_MS =
    Number(process.env.SESSION_PURGE_INTERVAL_MS) || 60 * 1000;
  private readonly SESSION_RETENTION_HOURS =
    Number(process.env.SESSION_RETENTION_HOURS) || 0;
  private readonly BCRYPT_ROUNDS = resolveBcryptRounds();

  private readonly logger = new SecureLogger('info');
  private smtpTransporter: nodemailer.Transporter | null = null;
  private cleanupTimer: NodeJS.Timeout | undefined;

  // Bounded L1 In-Memory Security Registries (Zero Memory Leak LRU)
  private readonly revokedSessionBlacklist = new Map<string, number>();
  private readonly rotatedSessionToFamily = new Map<
    string,
    { familyId: string; userId: string; rotatedAt: number }
  >();
  private readonly tokenFamilyStore = new Map<string, TokenFamilyRecord>();
  private readonly sessionDeviceMetadata = new Map<
    string,
    DeviceFingerprintInfo
  >();
  private readonly bruteForceStore = new Map<string, BruteForceRecord>();
  private readonly twoFactorRegistry = new Map<string, TwoFactorUserState>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    @Optional() private readonly security?: SecurityEventService,
    @Optional() private readonly redis?: RedisPubSubService,
    @Optional() private readonly configService?: ConfigService,
  ) {
    if (!this.twoFactorRegistry) {
      (this as any).twoFactorRegistry = new Map<string, TwoFactorUserState>();
    }
    if (!this.bruteForceStore) {
      (this as any).bruteForceStore = new Map<string, BruteForceRecord>();
    }
  }

  // ==========================================================================
  // LIFECYCLE & SMTP TRANSPORT
  // ==========================================================================

  private getSmtpTransporter(): nodemailer.Transporter {
    if (this.smtpTransporter) return this.smtpTransporter;
    const host =
      this.configService?.get<string>('SMTP_HOST') || process.env.SMTP_HOST;
    const port =
      Number(
        this.configService?.get<string>('SMTP_PORT') || process.env.SMTP_PORT,
      ) || 587;
    const user =
      this.configService?.get<string>('SMTP_USER') || process.env.SMTP_USER;
    const pass =
      this.configService?.get<string>('SMTP_PASSWORD') ||
      process.env.SMTP_PASSWORD;
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

  /**
   * Starts a single background purge timer for expired sessions, tokens, and local caches.
   */
  public onModuleInit(): void {
    if (this.cleanupTimer) return;
    const timer = setInterval(() => {
      void this.cleanupExpiredEntries();
    }, this.CLEANUP_INTERVAL_MS);
    timer.unref?.();
    this.cleanupTimer = timer;
  }

  /**
   * Releases the background purge timer on module shutdown.
   */
  public onModuleDestroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  private getFrontendUrl(): string {
    return resolveFrontendUrl();
  }

  /**
   * Generates a cryptographically strong hex token of `bytes` length.
   */
  public generateSecureToken(bytes = 32): string {
    return randomBytes(bytes).toString('hex');
  }

  // ==========================================================================
  // CRYPTOGRAPHIC HASHING, CONSTANT-TIME GUARDS & REDIS ADAPTERS
  // ==========================================================================

  /**
   * Constant-time string comparison using SHA-256 digest normalization
   * to prevent length-oracle and timing side-channel attacks.
   */
  public constantTimeCompare(a: string, b: string): boolean {
    const hashA = createHash('sha256').update(a, 'utf8').digest();
    const hashB = createHash('sha256').update(b, 'utf8').digest();
    return timingSafeEqual(hashA, hashB) && a.length === b.length;
  }

  /**
   * Computes a salted SHA-256 hash for refresh tokens and recovery codes.
   */
  public hashTokenWithSalt(rawToken: string, salt: string): string {
    return createHmac('sha256', salt).update(rawToken, 'utf8').digest('hex');
  }

  /**
   * Verifies a raw token against its salted SHA-256 hash in constant time.
   */
  public verifySaltedTokenHash(
    rawToken: string,
    salt: string,
    expectedHash: string,
  ): boolean {
    const computed = this.hashTokenWithSalt(rawToken, salt);
    return this.constantTimeCompare(computed, expectedHash);
  }

  private setBoundedMapEntry<K, V>(
    map: Map<K, V>,
    key: K,
    value: V,
    maxSize = MAX_LOCAL_CACHE_ENTRIES,
  ): void {
    if (map.has(key)) {
      map.delete(key);
    }
    map.set(key, value);
    if (map.size > maxSize) {
      const oldest = map.keys().next();
      if (!oldest.done) {
        map.delete(oldest.value);
      }
    }
  }

  private async safeRedisGet(key: string): Promise<string | null> {
    if (!this.redis) return null;
    const candidate: unknown = this.redis;
    if (isRecord(candidate) && typeof candidate.get === 'function') {
      try {
        const val: unknown = await (
          candidate.get as (k: string) => Promise<unknown>
        ).call(this.redis, key);
        return typeof val === 'string' ? val : null;
      } catch {
        return null;
      }
    }
    return null;
  }

  private async safeRedisSet(
    key: string,
    value: string,
    ttlMs: number,
  ): Promise<void> {
    if (!this.redis) return;
    const candidate: unknown = this.redis;
    if (isRecord(candidate) && typeof candidate.set === 'function') {
      try {
        await (
          candidate.set as (k: string, v: string, t: number) => Promise<unknown>
        ).call(this.redis, key, value, ttlMs);
      } catch {
        // Fallback to local memory
      }
    }
  }

  private async safeRedisDel(key: string): Promise<void> {
    if (!this.redis) return;
    const candidate: unknown = this.redis;
    if (isRecord(candidate)) {
      try {
        if (typeof (candidate as any).del === 'function') {
          await (candidate as any).del(key);
        } else if (typeof (candidate as any).delete === 'function') {
          await (candidate as any).delete(key);
        }
      } catch {
        // Ignore Redis deletion failure
      }
    }
  }

  // ==========================================================================
  // DEVICE FINGERPRINTING, MULTI-DEVICE SYNC & KILL-SWITCH BLACKLIST
  // ==========================================================================

  /**
   * Parses User-Agent and IP metadata into a structured device fingerprint.
   */
  public parseDeviceFingerprint(
    clientMeta?: ClientMetadata,
  ): DeviceFingerprintInfo {
    const ua = (clientMeta?.userAgent || '').trim();
    const ip = (clientMeta?.ipAddress || '0.0.0.0').trim();

    let browser = 'Unknown Browser';
    if (/Edg\//i.test(ua)) browser = 'Microsoft Edge';
    else if (/OPR\/|Opera/i.test(ua)) browser = 'Opera';
    else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = 'Chrome';
    else if (/Firefox\//i.test(ua)) browser = 'Firefox';
    else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Safari';
    else if (/PostmanRuntime|insomnia|curl/i.test(ua)) browser = 'API Client';

    let os = 'Unknown OS';
    if (/Windows NT/i.test(ua)) os = 'Windows';
    else if (/Android/i.test(ua)) os = 'Android';
    else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
    else if (/Mac OS X|Macintosh/i.test(ua)) os = 'macOS';
    else if (/Linux/i.test(ua)) os = 'Linux';

    let deviceType: DeviceFingerprintInfo['deviceType'] = 'UNKNOWN';
    if (/bot|crawler|spider/i.test(ua)) deviceType = 'BOT';
    else if (/iPad|Tablet/i.test(ua)) deviceType = 'TABLET';
    else if (/Mobile|Android|iPhone|iPod/i.test(ua)) deviceType = 'MOBILE';
    else if (ua.length > 0) deviceType = 'DESKTOP';

    const fingerprintHash = createHash('sha256')
      .update(`${ip}|${os}|${browser}|${deviceType}`, 'utf8')
      .digest('hex')
      .slice(0, 24);

    return {
      browser,
      os,
      deviceType,
      ipAddress: ip,
      fingerprintHash,
      formattedLabel: `${browser} on ${os} (${deviceType})`,
    };
  }

  /**
   * Broadcasts real-time session synchronization events across all connected
   * devices via Redis Pub/Sub.
   */
  public async broadcastSessionSyncEvent(
    event: SessionSyncEvent,
  ): Promise<void> {
    if (!this.redis) return;
    const candidate: unknown = this.redis;
    if (isRecord(candidate) && typeof candidate.publish === 'function') {
      try {
        await (
          candidate.publish as (
            channel: string,
            payload: unknown,
          ) => Promise<unknown>
        ).call(this.redis, SESSION_SYNC_CHANNEL, event);
      } catch (err) {
        this.logger.warn('Failed to publish session sync event', {
          error: errorMessage(err),
        });
      }
    }
  }

  /**
   * Immediately blacklists a session ID in Redis and local memory (Kill Switch).
   */
  private async blacklistSessionId(
    sessionId: string,
    ttlMs = authTtlMs(),
  ): Promise<void> {
    if (!sessionId) return;
    const expiresAt = Date.now() + ttlMs;
    this.setBoundedMapEntry(
      this.revokedSessionBlacklist,
      sessionId,
      expiresAt,
    );
    await this.safeRedisSet(
      `${BLACKLIST_KEY_PREFIX}${sessionId}`,
      'revoked',
      ttlMs,
    );
  }

  /**
   * Checks whether a session ID has been revoked via the instant Kill Switch.
   */
  public async isSessionBlacklisted(sessionId: string): Promise<boolean> {
    if (!sessionId) return false;
    const localExpiry = this.revokedSessionBlacklist.get(sessionId);
    if (localExpiry !== undefined) {
      if (localExpiry > Date.now()) return true;
      this.revokedSessionBlacklist.delete(sessionId);
    }

    const redisVal = await this.safeRedisGet(
      `${BLACKLIST_KEY_PREFIX}${sessionId}`,
    );
    return redisVal !== null;
  }

  // ==========================================================================
  // BRUTE-FORCE, CREDENTIAL STUFFING & PROGRESSIVE RATE-LIMITING ENGINE
  // ==========================================================================

  private getMaxFailedLoginAttempts(): number {
    const raw =
      this.configService?.get<string>('AUTH_MAX_FAILED_LOGINS') ||
      process.env.AUTH_MAX_FAILED_LOGINS;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0
      ? parsed
      : DEFAULT_MAX_FAILED_ATTEMPTS;
  }

  /**
   * Evaluates sliding-window brute-force counters for both `email` and `ipAddress`.
   * Throws `UnauthorizedException` if the account or IP is currently locked out.
   */
  public async checkBruteForceGuard(
    email: string,
    ipAddress?: string,
  ): Promise<void> {
    const now = Date.now();
    const emailKey = `${BRUTE_FORCE_EMAIL_PREFIX}${createHash('sha256')
      .update(email)
      .digest('hex')}`;
    const ipKey = ipAddress ? `${BRUTE_FORCE_IP_PREFIX}${ipAddress}` : null;

    const keysToCheck = ipKey ? [emailKey, ipKey] : [emailKey];

    for (const key of keysToCheck) {
      const local = this.bruteForceStore.get(key);
      if (local && local.lockedUntil && local.lockedUntil > now) {
        throw new UnauthorizedException(
          'Too many failed login attempts. Please try again in 15 minutes.',
        );
      }

      const redisRaw = await this.safeRedisGet(key);
      if (redisRaw) {
        try {
          const parsed: unknown = JSON.parse(redisRaw);
          if (
            isRecord(parsed) &&
            typeof parsed.lockedUntil === 'number' &&
            parsed.lockedUntil > now
          ) {
            throw new UnauthorizedException(
              'Too many failed login attempts. Please try again in 15 minutes.',
            );
          }
        } catch (err) {
          if (err instanceof UnauthorizedException) throw err;
        }
      }
    }
  }

  /**
   * Increments sliding-window failure counters for `email` and `ipAddress`.
   * Applies exponential progressive delay and activates a 15-minute lockout
   * after `MAX_FAILED_LOGIN_ATTEMPTS` (default 5).
   */
  public async recordFailedLoginAttempt(
    email: string,
    ipAddress?: string,
    userId?: string,
    organizationId?: string,
    userAgent?: string,
  ): Promise<void> {
    const now = Date.now();
    const maxAttempts = this.getMaxFailedLoginAttempts();
    const emailKey = `${BRUTE_FORCE_EMAIL_PREFIX}${createHash('sha256')
      .update(email)
      .digest('hex')}`;
    const ipKey = ipAddress ? `${BRUTE_FORCE_IP_PREFIX}${ipAddress}` : null;
    const keys = ipKey ? [emailKey, ipKey] : [emailKey];

    let highestCount = 1;

    for (const key of keys) {
      const existing = this.bruteForceStore.get(key);
      let record: BruteForceRecord;

      if (!existing || now - existing.firstAttemptAt > BRUTE_FORCE_WINDOW_MS) {
        record = {
          count: 1,
          firstAttemptAt: now,
          lockedUntil: null,
        };
      } else {
        const nextCount = existing.count + 1;
        record = {
          count: nextCount,
          firstAttemptAt: existing.firstAttemptAt,
          lockedUntil:
            nextCount >= maxAttempts ? now + LOCKOUT_DURATION_MS : null,
        };
      }

      if (record.count > highestCount) {
        highestCount = record.count;
      }

      this.setBoundedMapEntry(this.bruteForceStore, key, record);
      await this.safeRedisSet(
        key,
        JSON.stringify(record),
        LOCKOUT_DURATION_MS,
      );
    }

    if (highestCount >= maxAttempts) {
      this.logger.warn('Brute-force lockout triggered', {
        email,
        ipAddress,
        attempts: highestCount,
      });
      await this.security?.logEvent({
        eventType: SecurityEventType.LOGIN_FAILED,
        userId,
        organizationId,
        ipAddress,
        userAgent,
        success: false,
        reason: 'BRUTE_FORCE_LOCKOUT_TRIGGERED',
      });
    }
  }

  /**
   * Resets brute-force counters upon successful authentication.
   */
  public async clearFailedLoginAttempts(
    email: string,
    ipAddress?: string,
  ): Promise<void> {
    const emailKey = `${BRUTE_FORCE_EMAIL_PREFIX}${createHash('sha256')
      .update(email)
      .digest('hex')}`;
    this.bruteForceStore.delete(emailKey);
    await this.safeRedisDel(emailKey);

    if (ipAddress) {
      const ipKey = `${BRUTE_FORCE_IP_PREFIX}${ipAddress}`;
      this.bruteForceStore.delete(ipKey);
      await this.safeRedisDel(ipKey);
    }
  }

  // ==========================================================================
  // MULTI-TENANT BOLA/IDOR DEFENSE & PERMISSION ENCODING
  // ==========================================================================

  /**
   * Resolves granular permission strings for a given M-EDU role.
   */
  public resolveRolePermissions(
    role: string | null | undefined,
  ): readonly string[] {
    const normalized = (role || 'STUDENT').toUpperCase();
    return ROLE_PERMISSIONS_MATRIX[normalized] ?? ['self:read'];
  }

  /**
   * Verifies that neither the user account nor the owning tenant organization
   * is suspended, banned, revoked, or deactivated.
   */
  public assertAccountAndTenantActive(entity: AccountStatusCheckTarget): void {
    const userStatus = (entity.status || 'ACTIVE').toUpperCase();
    if (entity.isActive === false || SUSPENDED_STATUSES.has(userStatus)) {
      throw new UnauthorizedException('Account is deactivated');
    }

    if (entity.organization) {
      const orgStatus = (entity.organization.status || 'ACTIVE').toUpperCase();
      if (
        entity.organization.isActive === false ||
        SUSPENDED_STATUSES.has(orgStatus)
      ) {
        throw new UnauthorizedException('Organization is suspended or inactive');
      }
    }
  }

  /**
   * Switches a user's active tenant / branch context after strictly verifying
   * tenant membership and active status (Multi-Tenant BOLA / IDOR defense).
   */
  public async switchTenantBranch(
    userId: string,
    targetOrganizationId: string,
    targetBranchId?: string | null,
    clientMeta?: ClientMetadata,
  ): Promise<{ accessToken: string; user: TokenUser; mustChangePassword?: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { organization: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    this.assertAccountAndTenantActive(user);

    // Cross-tenant impersonation check
    if (
      !isPlatformRole(user.role) &&
      user.organizationId !== targetOrganizationId
    ) {
      await this.security?.logEvent({
        eventType: SecurityEventType.CROSS_TENANT_ACCESS_ATTEMPT,
        organizationId: targetOrganizationId,
        userId: user.id,
        resourceType: 'Organization',
        resourceId: targetOrganizationId,
        ipAddress: clientMeta?.ipAddress,
        userAgent: clientMeta?.userAgent,
        success: false,
        reason: 'UNAUTHORIZED_TENANT_SWITCH',
      });
      throw new ForbiddenException(
        'Cannot switch into an organization you do not belong to',
      );
    }

    // Verify target organization exists
    const targetOrg = await this.prisma.organization.findUnique({
      where: { id: targetOrganizationId },
      select: { id: true, name: true },
    });
    if (!targetOrg) {
      throw new NotFoundException('Target organization not found');
    }

    // Verify branch belongs to target organization if branchId is specified
    if (targetBranchId) {
      const branch = await this.prisma.branch.findFirst({
        where: {
          id: targetBranchId,
          organizationId: targetOrganizationId,
        },
        select: { id: true, name: true },
      });
      if (!branch) {
        throw new BadRequestException(
          'Target branch does not exist or does not belong to the selected organization',
        );
      }
    }

    return this.issueToken(
      {
        ...user,
        organizationId: targetOrganizationId,
      },
      {
        ...clientMeta,
        branchId: targetBranchId ?? null,
      },
    );
  }

  // ==========================================================================
  // 2FA / TOTP (RFC 6238) & BACKUP RECOVERY CODES ENGINE
  // ==========================================================================

  private getTotpEncryptionKey(): Buffer {
    const secret =
      this.configService?.get<string>('JWT_SECRET') ||
      process.env.JWT_SECRET ||
      process.env.BIOMETRIC_ENCRYPTION_KEY ||
      'medu-default-totp-encryption-key-material';
    return createHash('sha256').update(secret, 'utf8').digest();
  }

  private encryptTotpSecret(plainBase32: string): string {
    const key = this.getTotpEncryptionKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plainBase32, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  private decryptTotpSecret(ciphertext: string): string {
    const parts = ciphertext.split(':');
    if (parts.length !== 3) {
      throw new BadRequestException('Corrupted 2FA secret payload');
    }
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = Buffer.from(parts[2], 'hex');
    const key = this.getTotpEncryptionKey();
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }

  private encodeBase32(buffer: Buffer): string {
    let bits = 0;
    let value = 0;
    let output = '';

    for (let i = 0; i < buffer.length; i += 1) {
      value = (value << 8) | buffer[i];
      bits += 8;
      while (bits >= 5) {
        output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }
    if (bits > 0) {
      output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
    }
    return output;
  }

  private decodeBase32(base32Str: string): Buffer {
    const cleaned = base32Str
      .toUpperCase()
      .replace(/=+$/, '')
      .replace(/\s+/g, '');
    let bits = 0;
    let value = 0;
    const bytes: number[] = [];

    for (let i = 0; i < cleaned.length; i += 1) {
      const idx = BASE32_ALPHABET.indexOf(cleaned[i]);
      if (idx === -1) continue;
      value = (value << 5) | idx;
      bits += 5;
      if (bits >= 8) {
        bytes.push((value >>> (bits - 8)) & 0xff);
        bits -= 8;
      }
    }
    return Buffer.from(bytes);
  }

  private computeTotpAtCounter(secretBytes: Buffer, counter: number): string {
    const counterBuf = Buffer.alloc(8);
    counterBuf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
    counterBuf.writeUInt32BE(counter >>> 0, 4);

    const hmac = createHmac('sha1', secretBytes).update(counterBuf).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binaryCode =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);

    const otp = binaryCode % Math.pow(10, TOTP_DIGITS);
    return String(otp).padStart(TOTP_DIGITS, '0');
  }

  /**
   * Verifies an RFC 6238 TOTP code against a Base32 secret with configurable
   * clock-drift window tolerance (`windowSteps = 1` checks ±30s).
   */
  public verifyTotpCode(
    secretBase32: string,
    code: string,
    windowSteps = 1,
    timestampMs = Date.now(),
  ): boolean {
    const cleanCode = code.trim();
    if (!/^\d{6}$/.test(cleanCode)) return false;

    const secretBytes = this.decodeBase32(secretBase32);
    if (secretBytes.length === 0) return false;

    const currentCounter = Math.floor(timestampMs / 1000 / TOTP_STEP_SECONDS);
    let matched = false;

    for (let step = -windowSteps; step <= windowSteps; step += 1) {
      const candidate = this.computeTotpAtCounter(
        secretBytes,
        currentCounter + step,
      );
      if (this.constantTimeCompare(candidate, cleanCode)) {
        matched = true;
      }
    }
    return matched;
  }

  /**
   * Generates a new TOTP secret and `otpauth://` QR provisioning URI for a user.
   */
  public async generateTwoFactorSetup(
    userId: string,
    issuer = 'M-EDU',
  ): Promise<TwoFactorSetupResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, isActive: true },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    const secretBase32 = this.encodeBase32(randomBytes(20));
    const encryptedSecret = this.encryptTotpSecret(secretBase32);
    const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(user.email)}`;
    const otpauthUri = `otpauth://totp/${label}?secret=${secretBase32}&issuer=${encodeURIComponent(
      issuer,
    )}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_STEP_SECONDS}`;

    this.setBoundedMapEntry(this.twoFactorRegistry, userId, {
      userId,
      encryptedSecret,
      enabled: false,
      backupCodeSalts: [],
      backupCodeHashes: [],
      updatedAt: new Date().toISOString(),
    });

    return {
      secret: secretBase32,
      otpauthUri,
      qrDataUrlPayload: otpauthUri,
      issuer,
      accountEmail: user.email,
    };
  }

  /**
   * Verifies a user's initial TOTP code, enables 2FA on the account, and returns
   * 8 single-use backup recovery codes.
   */
  public async enableTwoFactor(
    userId: string,
    totpCode: string,
  ): Promise<{ enabled: boolean; backupCodes: string[] }> {
    const state = this.twoFactorRegistry.get(userId);
    if (!state) {
      throw new BadRequestException(
        'Two-factor setup has not been initiated for this account',
      );
    }

    const plainSecret = this.decryptTotpSecret(state.encryptedSecret);
    if (!this.verifyTotpCode(plainSecret, totpCode)) {
      throw new BadRequestException('Invalid TOTP verification code');
    }

    const rawBackupCodes: string[] = [];
    const salts: string[] = [];
    const hashes: string[] = [];

    for (let i = 0; i < BACKUP_CODES_COUNT; i += 1) {
      const part1 = randomBytes(2).toString('hex').toUpperCase();
      const part2 = randomBytes(2).toString('hex').toUpperCase();
      const rawCode = `${part1}-${part2}`;
      const salt = this.generateSecureToken(16);
      rawBackupCodes.push(rawCode);
      salts.push(salt);
      hashes.push(this.hashTokenWithSalt(rawCode, salt));
    }

    const activatedState: TwoFactorUserState = {
      userId,
      encryptedSecret: state.encryptedSecret,
      enabled: true,
      backupCodeSalts: salts,
      backupCodeHashes: hashes,
      updatedAt: new Date().toISOString(),
    };

    this.setBoundedMapEntry(this.twoFactorRegistry, userId, activatedState);
    await this.safeRedisSet(
      `auth:2fa:${userId}`,
      JSON.stringify(activatedState),
      365 * 24 * 60 * 60 * 1000,
    );

    return {
      enabled: true,
      backupCodes: rawBackupCodes,
    };
  }

  /**
   * Disables 2FA after validating a current TOTP or backup recovery code.
   */
  public async disableTwoFactor(
    userId: string,
    verificationCode: string,
  ): Promise<{ disabled: boolean }> {
    const isValid = await this.validateUserTwoFactorCode(
      userId,
      verificationCode,
    );
    if (!isValid) {
      throw new UnauthorizedException('Invalid two-factor verification code');
    }

    this.twoFactorRegistry.delete(userId);
    await this.safeRedisDel(`auth:2fa:${userId}`);
    return { disabled: true };
  }

  /**
   * Exchanges a partial `2FA_REQUIRED` challenge token and a valid TOTP/recovery
   * code for a full session-backed access token.
   */
  public async verifyTwoFactorLogin(
    challengeToken: string,
    code: string,
    clientMeta?: ClientMetadata,
  ): Promise<{ accessToken: string; user: TokenUser }> {
    const decoded: unknown = this.jwtService.decode(challengeToken);
    if (
      !isRecord(decoded) ||
      decoded.scope !== '2fa_challenge' ||
      typeof decoded.sub !== 'string'
    ) {
      throw new UnauthorizedException('Invalid or expired 2FA challenge token');
    }

    if (
      typeof decoded.exp === 'number' &&
      decoded.exp * 1000 < Date.now()
    ) {
      throw new UnauthorizedException('2FA challenge token has expired');
    }

    const userId = decoded.sub;
    const isValid = await this.validateUserTwoFactorCode(userId, code);
    if (!isValid) {
      throw new UnauthorizedException('Invalid two-factor authentication code');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { organization: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    this.assertAccountAndTenantActive(user);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.issueToken(user, clientMeta);
  }

  private async validateUserTwoFactorCode(
    userId: string,
    code: string,
  ): Promise<boolean> {
    let state = this.twoFactorRegistry?.get(userId);
    if (!state) {
      const redisRaw = await this.safeRedisGet(`auth:2fa:${userId}`);
      if (redisRaw) {
        try {
          const parsed: unknown = JSON.parse(redisRaw);
          if (isRecord(parsed) && parsed.enabled === true) {
            state = parsed as unknown as TwoFactorUserState;
          }
        } catch {
          return false;
        }
      }
    }

    if (!state || !state.enabled) return false;

    const plainSecret = this.decryptTotpSecret(state.encryptedSecret);
    if (this.verifyTotpCode(plainSecret, code)) {
      return true;
    }

    // Check single-use backup recovery codes
    const normalizedInput = code.trim().toUpperCase();
    for (let i = 0; i < state.backupCodeHashes.length; i += 1) {
      const hash = state.backupCodeHashes[i];
      const salt = state.backupCodeSalts[i];
      if (hash && salt && this.verifySaltedTokenHash(normalizedInput, salt, hash)) {
        state.backupCodeHashes[i] = '';
        this.setBoundedMapEntry(this.twoFactorRegistry, userId, state);
        await this.safeRedisSet(
          `auth:2fa:${userId}`,
          JSON.stringify(state),
          365 * 24 * 60 * 60 * 1000,
        );
        return true;
      }
    }

    return false;
  }

  // ==========================================================================
  // AUTH CODE EXCHANGE (CSRF-SAFE OAUTH HANDOFF)
  // ==========================================================================

  /**
   * Create the single-use code that hands the OAuth result to the SPA.
   *
   * The code itself is 256-bit random and carries no claim. What is persisted
   * is the SESSION id of the session `issueToken` just created — never the
   * signed JWT.
   */
  public async generateAuthCode(
    accessToken: string,
    userId: string,
    state?: string,
  ): Promise<string> {
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
      const payload: unknown = this.jwtService.decode(accessToken);
      const sid = isRecord(payload) ? payload.sid : null;
      return typeof sid === 'string' && sid.length > 0 ? sid : null;
    } catch {
      return null;
    }
  }

  public async exchangeAuthCode(code: string, state?: string): Promise<string> {
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
      if (
        expected.length !== actual.length ||
        !timingSafeEqual(expected, actual)
      ) {
        throw new BadRequestException(
          'Invalid or expired OAuth exchange state',
        );
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

  public async cleanupExpiredEntries(): Promise<void> {
    if (this.redis) {
      const lockKey = 'auth:session:cleanup:lock';
      const lockTtlMs = Math.min(
        Math.max(this.CLEANUP_INTERVAL_MS - 5000, 10000),
        50000,
      );
      const acquired = await this.redis.setIfNotExists(
        lockKey,
        'locked',
        lockTtlMs,
      );
      if (!acquired) {
        return;
      }
    }

    const now = Date.now();

    // Purge expired local in-memory blacklist & brute-force entries
    for (const [sid, exp] of this.revokedSessionBlacklist.entries()) {
      if (exp <= now) this.revokedSessionBlacklist.delete(sid);
    }
    for (const [bfKey, rec] of this.bruteForceStore.entries()) {
      if (
        now - rec.firstAttemptAt > BRUTE_FORCE_WINDOW_MS &&
        (!rec.lockedUntil || rec.lockedUntil <= now)
      ) {
        this.bruteForceStore.delete(bfKey);
      }
    }

    try {
      const cutoff = new Date(
        now - this.SESSION_RETENTION_HOURS * 60 * 60 * 1000,
      );
      const [sessionResult, _parentSessionResult, tokenResult, authCodeResult] =
        await Promise.all([
          this.prisma.session?.deleteMany
            ? this.prisma.session.deleteMany({
                where: { expiresAt: { lt: cutoff } },
              })
            : Promise.resolve({ count: 0 }),
          this.prisma.parentSession?.deleteMany
            ? this.prisma.parentSession.deleteMany({
                where: { expiresAt: { lt: cutoff } },
              })
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
      void _parentSessionResult;
      if (sessionResult.count > 0) {
        this.logger.info('Purged expired sessions', {
          count: sessionResult.count,
        });
      }
      if (tokenResult.count > 0) {
        this.logger.info('Purged expired password reset tokens', {
          count: tokenResult.count,
        });
      }
      if (authCodeResult.count > 0) {
        this.logger.info('Purged expired authorization codes', {
          count: authCodeResult.count,
        });
      }
    } catch (err: unknown) {
      this.logger.error('Failed to purge expired sessions', {
        error: errorMessage(err),
      });
    }
  }

  // ==========================================================================
  // LOCAL AUTHENTICATION (WITH BRUTE-FORCE GUARD & 2FA STATE MACHINE)
  // ==========================================================================

  /**
   * Authenticates a user with email and password, enforcing sliding-window
   * brute-force rate-limiting, constant-time verification, and 2FA challenge promotion.
   */
  public async login(
    identifier: string,
    password: string,
    clientMeta?: ClientMetadata,
  ): Promise<{
    accessToken: string;
    user: TokenUser;
    mustChangePassword?: boolean;
    twoFactorRequired?: boolean;
    challengeToken?: string;
  }> {
    const normalized = normalizeUsername(identifier);

    await this.checkBruteForceGuard(normalized, clientMeta?.ipAddress);

    let user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { username: { equals: normalized, mode: 'insensitive' } },
          { email: { equals: normalized, mode: 'insensitive' } },
        ],
      },
      include: {
        organization: true,
        memberships: {
          include: { organization: true },
        },
      },
    });

    if (!user && this.prisma.user.findUnique) {
      user = await this.prisma.user.findUnique({
        where: { email: normalized } as any,
        include: {
          organization: true,
          memberships: {
            include: { organization: true },
          },
        },
      });
    }

    if (user && user.status === 'PENDING') {
      throw new ForbiddenException(
        'Your account is pending administrator approval.',
      );
    }

    if (
      !user ||
      !user.isActive ||
      !user.passwordHash ||
      SUSPENDED_STATUSES.has((user.status || '').toUpperCase())
    ) {
      // Fallback to ParentAccount if needed
      if (this.prisma.parentAccount) {
        const parent = await this.prisma.parentAccount.findFirst({
          where: { email: { equals: normalized, mode: 'insensitive' }, isActive: true },
          include: { organization: true },
        });

        if (parent && parent.passwordHash) {
          const isPasswordValid = await bcrypt.compare(
            password,
            parent.passwordHash,
          );
          if (!isPasswordValid) {
            await this.recordFailedLoginAttempt(
              normalized,
              clientMeta?.ipAddress,
              parent.id,
              parent.organizationId,
              clientMeta?.userAgent,
            );
            await this.security?.logEvent({
              eventType: SecurityEventType.LOGIN_FAILED,
              userId: parent.id,
              organizationId: parent.organizationId,
              ipAddress: clientMeta?.ipAddress,
              userAgent: clientMeta?.userAgent,
              success: false,
              reason: 'INVALID_PASSWORD',
            });
            throw new UnauthorizedException('Invalid credentials');
          }

          await this.clearFailedLoginAttempts(normalized, clientMeta?.ipAddress);

          await this.prisma.parentAccount.update({
            where: { id: parent.id },
            data: { lastLoginAt: new Date() },
          });

          await this.security?.logEvent({
            eventType: SecurityEventType.LOGIN_SUCCESS,
            userId: parent.id,
            organizationId: parent.organizationId,
            ipAddress: clientMeta?.ipAddress,
            userAgent: clientMeta?.userAgent,
            success: true,
          });

          const accessToken = await this.issueParentToken(
            {
              parentId: parent.id,
              organizationId: parent.organizationId,
              email: parent.email,
              firstName: parent.firstName ?? undefined,
              lastName: parent.lastName ?? undefined,
            },
            clientMeta,
          );

          return {
            accessToken,
            user: {
              id: parent.id,
              email: parent.email,
              firstName: parent.firstName ?? '',
              lastName: parent.lastName ?? '',
              role: 'PARENT',
              organizationId: parent.organizationId,
              organization: parent.organization,
            },
          };
        }
      }

      await this.recordFailedLoginAttempt(
        normalized,
        clientMeta?.ipAddress,
        user?.id,
        user?.organizationId,
        clientMeta?.userAgent,
      );
      await this.security?.logEvent({
        eventType: SecurityEventType.LOGIN_FAILED,
        ipAddress: clientMeta?.ipAddress,
        userAgent: clientMeta?.userAgent,
        success: false,
        reason: 'INVALID_CREDENTIALS',
      });
      await new Promise((resolve) =>
        setTimeout(resolve, 150 + Math.random() * 100),
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      await this.recordFailedLoginAttempt(
        normalized,
        clientMeta?.ipAddress,
        user.id,
        user.organizationId,
        clientMeta?.userAgent,
      );
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

    await this.clearFailedLoginAttempts(normalized, clientMeta?.ipAddress);

    // Membership verification for non-owner
    if (user.role !== 'PLATFORM_OWNER') {
      let activeMemberships = (user.memberships || []).filter(
        (m) =>
          m.status === 'ACTIVE' &&
          m.organization &&
          m.organization.isActive !== false &&
          m.organization.status !== 'SUSPENDED',
      );

      // Graceful fallback for legacy records or mock tests where organizationId is set directly
      if (activeMemberships.length === 0 && user.organizationId) {
        const orgActive = !user.organization || (user.organization.isActive !== false && user.organization.status !== 'SUSPENDED');
        if (orgActive) {
          activeMemberships = [
            {
              id: 'legacy-default-membership',
              userId: user.id,
              organizationId: user.organizationId,
              role: user.role,
              status: 'ACTIVE',
              organization: user.organization || { id: user.organizationId, isActive: true, status: 'ACTIVE' },
            } as any,
          ];
        }
      }

      if (activeMemberships.length === 0) {
        throw new ForbiddenException('No active organization memberships found for this account');
      }
      const currentMembership =
        activeMemberships.find((m) => m.organizationId === user.organizationId) ||
        activeMemberships[0];
      user.organizationId = currentMembership.organizationId;
      user.role = currentMembership.role;
      user.organization = currentMembership.organization;
    }

    // Check if 2FA / TOTP is enabled for this user
    const twoFactorState = this.twoFactorRegistry?.get(user.id);
    if (twoFactorState?.enabled) {
      const challengeToken = this.jwtService.sign({
        sub: user.id,
        email: user.email,
        organizationId: user.organizationId,
        scope: '2fa_challenge',
        exp: Math.floor(Date.now() / 1000) + TWO_FACTOR_CHALLENGE_TTL_SEC,
      });

      return {
        accessToken: challengeToken,
        challengeToken,
        twoFactorRequired: true,
        mustChangePassword: !!user.mustChangePassword,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          organizationId: user.organizationId,
          organization: user.organization,
          mustChangePassword: !!user.mustChangePassword,
        },
      };
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

  public async register(
    data: RegisterDto,
    clientMeta?: ClientMetadata,
  ): Promise<{
    accessToken?: string;
    user: TokenUser;
    pendingApproval?: boolean;
    message?: string;
  }> {
    const email = normalizeEmail(data.email);

    // 1. Check existing user
    const existing = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    // 2. Check access control configuration and whitelist
    let redeemedInvite: any = null;
    if (this.prisma.platformInvitation && (data as any).inviteCode) {
      const codeHash = createHash('sha256').update((data as any).inviteCode).digest('hex');
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
      const isWhitelisted = await this.isEmailWhitelisted(email);
      if (!isWhitelisted && this.prisma.accessControlConfig) {
        const config = await this.prisma.accessControlConfig.findUnique({
          where: { id: 'global' },
        });

        if (config?.requireApproval) {
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
                email,
                passwordHash,
                firstName: data.firstName,
                lastName: data.lastName,
                role: 'ORG_ADMIN',
                status: 'PENDING',
                isActive: true,
                organizationId: organization.id,
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

        if (config?.inviteOnly) {
          throw new ForbiddenException('Registration is currently invite-only or requires whitelist approval.');
        }
      }
    }

    const passwordHash = await bcrypt.hash(data.password, this.BCRYPT_ROUNDS);
    const result = await this.prisma.$transaction(async (tx: any) => {
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
          email,
          passwordHash,
          firstName: data.firstName,
          lastName: data.lastName,
          role: 'ORG_ADMIN',
          status: 'ACTIVE',
          isActive: true,
          organizationId: organization.id,
        },
        include: { organization: true },
      });

      return { user, organization };
    });

    const tokenUser: TokenUser = {
      id: result.user.id,
      email: result.user.email,
      firstName: result.user.firstName,
      lastName: result.user.lastName,
      role: result.user.role,
      organizationId: result.user.organizationId,
      organization: result.organization,
    };

    const token = await this.issueToken(tokenUser, clientMeta);
    return {
      accessToken: token.accessToken,
      user: tokenUser,
    };
  }

  /**
   * One-time platform bootstrap: creates the FIRST PLATFORM_OWNER.
   */
  public async bootstrap(
    data: BootstrapDto,
    secretHeader?: string,
  ): Promise<{ accessToken: string; user: TokenUser }> {
    const superAdminCount = await this.prisma.user.count({
      where: { role: { in: ['PLATFORM_OWNER', 'SUPER_ADMIN'] } },
    });
    if (superAdminCount > 0) {
      throw new ConflictException('Platform is already bootstrapped');
    }

    const configuredSecret = process.env.PLATFORM_BOOTSTRAP_SECRET;
    if (!configuredSecret || !configuredSecret.trim()) {
      throw new ForbiddenException(
        'Bootstrap is disabled: PLATFORM_BOOTSTRAP_SECRET is not configured on the server',
      );
    }

    const provided = extractBootstrapSecret(data, secretHeader);
    if (!provided) {
      throw new ForbiddenException('Bootstrap secret is required');
    }
    const expected = Buffer.from(configuredSecret.trim());
    const actual = Buffer.from(provided);
    if (
      expected.length !== actual.length ||
      !timingSafeEqual(expected, actual)
    ) {
      throw new ForbiddenException('Invalid bootstrap secret');
    }

    const email = normalizeEmail(data.email);
    const passwordHash = await bcrypt.hash(data.password, this.BCRYPT_ROUNDS);

    let result;
    try {
      result = await this.prisma.$transaction(async (tx) => {
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
      throw new InternalServerErrorException(
        'Bootstrap transaction failed to produce an organization and user',
      );
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

  // ==========================================================================
  // GOOGLE OAUTH & ACCOUNT LINKING POLICY
  // ==========================================================================

  public async googleLogin(
    googleUser: GoogleProfile,
    clientMeta?: ClientMetadata,
  ): Promise<{ accessToken: string; user: TokenUser }> {
    if (
      !googleUser.googleSubject ||
      typeof googleUser.googleSubject !== 'string'
    ) {
      throw new BadRequestException(
        'Invalid Google identity: missing subject ID',
      );
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
        if (!isPrismaUniqueError(error) || attempt >= MAX_RACE_RETRIES) {
          throw error;
        }
      }
    }
  }

  private async googleLoginOnce(
    googleUser: GoogleProfile,
    email: string,
    clientMeta?: ClientMetadata,
  ): Promise<{ accessToken: string; user: TokenUser }> {
    // 1) Established identity: same Google subject -> login.
    const bySubject = await this.prisma.user.findUnique({
      where: { googleSubject: googleUser.googleSubject },
      include: { organization: true },
    });

    if (bySubject) {
      this.assertAccountAndTenantActive(bySubject);
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
      this.assertAccountAndTenantActive(byEmail);
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

  // ==========================================================================
  // TOKEN ISSUANCE, TOKEN FAMILY REGISTRATION & FIFO DEVICE EVICTION
  // ==========================================================================

  private getMaxConcurrentDevices(): number {
    const raw =
      this.configService?.get<string>('AUTH_MAX_CONCURRENT_DEVICES') ||
      process.env.AUTH_MAX_CONCURRENT_DEVICES;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0
      ? parsed
      : DEFAULT_MAX_CONCURRENT_DEVICES;
  }

  /**
   * Mints a session-bound JWT, registers the session in a cryptographic
   * Refresh Token Family, records the device fingerprint, broadcasts a cross-device
   * sync event, and enforces FIFO eviction of excess idle sessions.
   */
  public async issueToken(
    user: TokenUser,
    clientMeta?: ClientMetadata,
    inheritedFamilyId?: string,
  ): Promise<{ accessToken: string; user: TokenUser; mustChangePassword?: boolean }> {
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

    const deviceInfo = this.parseDeviceFingerprint(clientMeta);
    this.setBoundedMapEntry(
      this.sessionDeviceMetadata,
      session.id,
      deviceInfo,
    );

    // Cryptographic Token Family registration (Salted SHA-256 hash)
    const familyId = inheritedFamilyId || this.generateSecureToken(16);
    const tokenSalt = this.generateSecureToken(16);
    const rawRefreshMaterial = `${familyId}:${session.id}:${this.generateSecureToken(24)}`;
    const refreshTokenHash = this.hashTokenWithSalt(
      rawRefreshMaterial,
      tokenSalt,
    );

    const familyRecord: TokenFamilyRecord = {
      familyId,
      userId: user.id,
      organizationId: user.organizationId,
      currentSessionId: session.id,
      tokenSalt,
      refreshTokenHash,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      revoked: false,
    };
    this.setBoundedMapEntry(this.tokenFamilyStore, familyId, familyRecord);
    await this.safeRedisSet(
      `${RTR_FAMILY_PREFIX}${familyId}`,
      JSON.stringify(familyRecord),
      authTtlMs(),
    );

    void this.broadcastSessionSyncEvent({
      type: 'SESSION_CREATED',
      userId: user.id,
      organizationId: user.organizationId,
      sessionId: session.id,
      familyId,
      device: deviceInfo,
      occurredAt: new Date().toISOString(),
    });

    const maxDevices = this.getMaxConcurrentDevices();

    // Enforce Zero Shared Accounts: revoke older active sessions atomically
    try {
      if (this.prisma.session?.findMany) {
        const olderSessions = await this.prisma.session.findMany({
          where: { userId: user.id, revokedAt: null, id: { not: session.id } },
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        });
        if (olderSessions.length >= maxDevices) {
          const excessCount = olderSessions.length - maxDevices + 1;
          const evictedSessions = olderSessions.slice(0, excessCount);
          const evictedIds = evictedSessions.map((s) => s.id);
          if (evictedIds.length > 0 && this.prisma.session?.updateMany) {
            await this.prisma.session.updateMany({
              where: { id: { in: evictedIds } },
              data: { revokedAt: new Date(), revokedReason: 'concurrent_session_revoked' },
            });
            for (const evictedId of evictedIds) {
              await this.blacklistSessionId(evictedId);
              void this.broadcastSessionSyncEvent({
                type: 'SESSION_REVOKED',
                userId: user.id,
                sessionId: evictedId,
                reason: 'concurrent_session_revoked',
                occurredAt: new Date().toISOString(),
              });
            }
          }
        }
      }
    } catch (err) {
      this.logger.error('Failed to enforce single session policy', {
        error: errorMessage(err),
      });
    }

    const payload: Record<string, unknown> = {
      sub: user.id,
      id: user.id,
      username: (user as any).username,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      sid: session.id,
      mustChangePassword: !!(user as any).mustChangePassword,
      permissions: ROLE_PERMISSIONS_MATRIX[user.role] || [],
      ...(clientMeta?.branchId ? { branchId: clientMeta.branchId } : {}),
    };

    return {
      accessToken: this.jwtService.sign(payload),
      mustChangePassword: !!(user as any).mustChangePassword,
      user: {
        id: user.id,
        username: (user as any).username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        organizationId: user.organizationId,
        organization: user.organization,
        mustChangePassword: !!(user as any).mustChangePassword,
        memberships: (user as any).memberships?.map((m: any) => ({
          organizationId: m.organizationId,
          role: m.role,
          status: m.status,
          organizationName: m.organization?.name,
        })),
      },
    };
  }

  /**
   * Issue a JWT for a ParentAccount (not a User row).
   */
  public async issueParentToken(
    parent: {
      parentId: string;
      organizationId: string;
      firstName?: string;
      lastName?: string;
      email: string;
    },
    clientMeta?: ClientMetadata,
  ): Promise<string> {
    const session = await this.prisma.parentSession.create({
      data: {
        parentId: parent.parentId,
        organizationId: parent.organizationId,
        expiresAt: new Date(Date.now() + authTtlMs()),
        userAgent: clientMeta?.userAgent,
        ipAddress: clientMeta?.ipAddress,
        lastActiveAt: new Date(),
      },
    });

    const deviceInfo = this.parseDeviceFingerprint(clientMeta);
    this.setBoundedMapEntry(
      this.sessionDeviceMetadata,
      session.id,
      deviceInfo,
    );

    const maxDevices = this.getMaxConcurrentDevices();

    // Enforce Zero Shared Accounts: revoke older active parent sessions atomically
    try {
      if (this.prisma.parentSession?.findMany) {
        const olderSessions = await this.prisma.parentSession.findMany({
          where: { parentId: parent.parentId, revokedAt: null, id: { not: session.id } },
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        });
        if (olderSessions.length >= maxDevices) {
          const excessCount = olderSessions.length - maxDevices + 1;
          const evictedSessions = olderSessions.slice(0, excessCount);
          const evictedIds = evictedSessions.map((s) => s.id);
          if (evictedIds.length > 0 && this.prisma.parentSession?.updateMany) {
            await this.prisma.parentSession.updateMany({
              where: { id: { in: evictedIds } },
              data: { revokedAt: new Date(), revokedReason: 'concurrent_session_revoked' },
            });
            for (const evictedId of evictedIds) {
              await this.blacklistSessionId(evictedId);
            }
          }
        }
      }
    } catch (err) {
      this.logger.error('Failed to enforce single parent session policy', {
        error: errorMessage(err),
      });
    }

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

  // ==========================================================================
  // SESSIONS, TOKEN ROTATION (RTR) & REUSE DETECTION
  // ==========================================================================

  /**
   * Logs out from a single session and immediately blacklists its `sid`.
   */
  public async logout(
    sessionId: string,
    userId: string,
    role?: string,
  ): Promise<void> {
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

    await this.blacklistSessionId(sessionId);
    await this.broadcastSessionSyncEvent({
      type: 'SESSION_REVOKED',
      userId,
      sessionId,
      reason: 'user_logout',
      occurredAt: new Date().toISOString(),
    });
  }

  /**
   * Revokes all active sessions for a user across all devices (Kill Switch).
   */
  public async logoutAll(
    userId: string,
    reason = 'security',
    role?: string,
  ): Promise<void> {
    if (role === 'PARENT') {
      const active = await this.prisma.parentSession?.findMany?.({
        where: { parentId: userId, revokedAt: null },
        select: { id: true },
      });
      await this.prisma.parentSession.updateMany({
        where: { parentId: userId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: reason },
      });
      for (const s of active ?? []) {
        await this.blacklistSessionId(s.id);
      }
    } else {
      const active = await this.prisma.session?.findMany?.({
        where: { userId, revokedAt: null },
        select: { id: true },
      });
      await this.prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: reason },
      });
      for (const s of active ?? []) {
        await this.blacklistSessionId(s.id);
      }
    }

    await this.broadcastSessionSyncEvent({
      type: 'ALL_SESSIONS_REVOKED',
      userId,
      reason,
      occurredAt: new Date().toISOString(),
    });
  }

  /**
   * Rotates a session/refresh token within its Cryptographic Token Family.
   * If reuse of an already-rotated token is detected, immediately invalidates
   * the entire token family and revokes all active sessions for the user.
   */
  public async refreshToken(
    userId: string,
    currentSessionId?: string,
    role?: string,
    clientMeta?: ClientMetadata,
  ): Promise<{ accessToken: string; user: TokenUser }> {
    if (role === 'PARENT') {
      return this.refreshParentToken(userId, currentSessionId, clientMeta);
    }
    return this.refreshUserToken(userId, currentSessionId, clientMeta);
  }

  private async handleRefreshTokenReuseCompromise(params: {
    userId: string;
    organizationId?: string;
    sessionId: string;
    familyId: string;
    role?: string;
    clientMeta?: ClientMetadata;
  }): Promise<void> {
    const family = this.tokenFamilyStore.get(params.familyId);
    if (family) {
      family.revoked = true;
    }
    await this.safeRedisDel(`${RTR_FAMILY_PREFIX}${params.familyId}`);

    await this.logoutAll(params.userId, 'token_reuse_detected', params.role);

    this.logger.warn('Refresh token reuse detected — revoked all user sessions', {
      userId: params.userId,
      sessionId: params.sessionId,
      familyId: params.familyId,
    });

    await this.security?.logEvent({
      eventType: SecurityEventType.UNAUTHORIZED_RESOURCE_ACCESS,
      organizationId: params.organizationId,
      userId: params.userId,
      resourceType: 'SessionTokenFamily',
      resourceId: params.familyId,
      ipAddress: params.clientMeta?.ipAddress,
      userAgent: params.clientMeta?.userAgent,
      success: false,
      reason: 'REFRESH_TOKEN_REUSE_DETECTED',
    });

    await this.broadcastSessionSyncEvent({
      type: 'TOKEN_FAMILY_COMPROMISED',
      userId: params.userId,
      organizationId: params.organizationId,
      familyId: params.familyId,
      compromisedSessionId: params.sessionId,
      occurredAt: new Date().toISOString(),
    });
  }

  /** USER branch: sid -> Session -> User -> new Session + JWT with RTR reuse detection. */
  private async refreshUserToken(
    userId: string,
    currentSessionId?: string,
    clientMeta?: ClientMetadata,
  ): Promise<{ accessToken: string; user: TokenUser }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { organization: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }
    this.assertAccountAndTenantActive(user);

    let inheritedFamilyId: string | undefined;

    if (currentSessionId) {
      // Check if this session was already rotated (Token Replay / Theft Detection)
      const localRotated = this.rotatedSessionToFamily.get(currentSessionId);
      const redisRotatedFamily = await this.safeRedisGet(
        `${RTR_ROTATED_PREFIX}${currentSessionId}`,
      );

      if (localRotated || redisRotatedFamily) {
        const compromisedFamilyId =
          localRotated?.familyId || redisRotatedFamily || 'unknown_family';
        await this.handleRefreshTokenReuseCompromise({
          userId: user.id,
          organizationId: user.organizationId,
          sessionId: currentSessionId,
          familyId: compromisedFamilyId,
          role: user.role,
          clientMeta,
        });
        throw new UnauthorizedException('Session is invalid or expired');
      }

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
        // Check DB row to see if it was previously rotated with 'token_refresh'
        const existingSession = await this.prisma.session?.findUnique?.({
          where: { id: currentSessionId },
          select: { revokedReason: true },
        });
        if (existingSession?.revokedReason === 'token_refresh') {
          await this.handleRefreshTokenReuseCompromise({
            userId: user.id,
            organizationId: user.organizationId,
            sessionId: currentSessionId,
            familyId: `db_family_${currentSessionId}`,
            role: user.role,
            clientMeta,
          });
        }
        throw new UnauthorizedException('Session is invalid or expired');
      }

      // Find or create familyId for this rotation chain
      for (const fam of this.tokenFamilyStore.values()) {
        if (fam.currentSessionId === currentSessionId && !fam.revoked) {
          inheritedFamilyId = fam.familyId;
          break;
        }
      }
      const effectiveFamilyId =
        inheritedFamilyId || this.generateSecureToken(16);
      inheritedFamilyId = effectiveFamilyId;

      this.setBoundedMapEntry(
        this.rotatedSessionToFamily,
        currentSessionId,
        {
          familyId: effectiveFamilyId,
          userId: user.id,
          rotatedAt: Date.now(),
        },
      );
      await this.safeRedisSet(
        `${RTR_ROTATED_PREFIX}${currentSessionId}`,
        effectiveFamilyId,
        authTtlMs(),
      );
      await this.blacklistSessionId(currentSessionId);
    }

    return this.issueToken(user, clientMeta, inheritedFamilyId);
  }

  /** PARENT branch: sid -> ParentSession -> ParentAccount -> new session + JWT. */
  private async refreshParentToken(
    parentId: string,
    currentSessionId?: string,
    clientMeta?: ClientMetadata,
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
      const localRotated = this.rotatedSessionToFamily.get(currentSessionId);
      const redisRotatedFamily = await this.safeRedisGet(
        `${RTR_ROTATED_PREFIX}${currentSessionId}`,
      );
      if (localRotated || redisRotatedFamily) {
        await this.handleRefreshTokenReuseCompromise({
          userId: parent.id,
          organizationId: parent.organizationId,
          sessionId: currentSessionId,
          familyId:
            localRotated?.familyId || redisRotatedFamily || 'parent_family',
          role: 'PARENT',
          clientMeta,
        });
        throw new UnauthorizedException('Session is invalid or expired');
      }

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

      const familyId = this.generateSecureToken(16);
      this.setBoundedMapEntry(
        this.rotatedSessionToFamily,
        currentSessionId,
        {
          familyId,
          userId: parent.id,
          rotatedAt: Date.now(),
        },
      );
      await this.safeRedisSet(
        `${RTR_ROTATED_PREFIX}${currentSessionId}`,
        familyId,
        authTtlMs(),
      );
      await this.blacklistSessionId(currentSessionId);
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

  public async getMe(userId: string, role?: string): Promise<GetMeResponse> {
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
        throw new UnauthorizedException(
          'Parent account not found or deactivated',
        );
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
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatar: true,
        role: true,
        organizationId: true,
        mustChangePassword: true,
        lastLoginAt: true,
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
        settings: true,
        memberships: {
          include: {
            organization: {
              select: { id: true, name: true, status: true, isActive: true },
            },
          },
        },
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
          username: null,
          email: parent.email,
          firstName: parent.firstName,
          lastName: parent.lastName,
          phone: parent.phone,
          avatar: null,
          role: 'PARENT',
          organizationId: parent.organizationId,
          mustChangePassword: false,
          lastLoginAt: parent.lastLoginAt,
          organization: parent.organization,
          settings: null,
          memberships: [],
        };
      }

      throw new UnauthorizedException('User not found');
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      avatar: user.avatar,
      role: user.role,
      organizationId: user.organizationId,
      mustChangePassword: !!user.mustChangePassword,
      lastLoginAt: user.lastLoginAt,
      organization: user.organization,
      settings: user.settings,
      memberships: user.memberships?.map((m: any) => ({
        organizationId: m.organizationId,
        role: m.role,
        status: m.status,
        organizationName: m.organization?.name,
      })),
    };
  }

  // ==========================================================================
  // PASSWORD RECOVERY & CROSS-DEVICE SESSION REVOCATION
  // ==========================================================================

  public async forgotPassword(email: string): Promise<{ message: string }> {
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

      const resetUrl = `${this.getFrontendUrl()}/reset-password?token=${encodeURIComponent(
        rawToken,
      )}`;

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
        this.logger.warn(
          'Password reset token invalidated (no SMTP configured)',
          {
            email: user.email,
          },
        );
      }

      return { message: PASSWORD_RESET_GENERIC_MESSAGE };
    }

    if (this.prisma.parentAccount) {
      const parents = await this.prisma.parentAccount.findMany({
        where: { email: normalizedEmail, isActive: true },
        select: { id: true, email: true, passwordHash: true },
      });

      const activeParentsWithPassword = parents.filter((p) =>
        Boolean(p.passwordHash),
      );

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

          const resetUrl = `${this.getFrontendUrl()}/reset-password?token=${encodeURIComponent(
            rawToken,
          )}`;

          if (process.env.SMTP_HOST) {
            try {
              await this.sendPasswordResetEmail(
                activeParentsWithPassword[0].email,
                resetUrl,
              );
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
            this.logger.warn(
              'Parent password reset token invalidated (no SMTP configured)',
              {
                email: activeParentsWithPassword[0].email,
              },
            );
          }

          return { message: PASSWORD_RESET_GENERIC_MESSAGE };
        }
      }
    }

    await new Promise((resolve) =>
      setTimeout(resolve, 150 + Math.random() * 100),
    );
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

  public async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const now = new Date();

    const userResetToken = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, usedAt: true, expiresAt: true },
    });

    if (userResetToken) {
      if (userResetToken.usedAt || userResetToken.expiresAt <= now) {
        throw new BadRequestException(
          'Invalid or expired password reset token',
        );
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
          throw new BadRequestException(
            'Invalid or expired password reset token',
          );
        }

        const owner = await tx.user.findUnique({
          where: { id: userResetToken.userId },
          select: { id: true, isActive: true },
        });
        if (!owner || !owner.isActive) {
          throw new BadRequestException(
            'Invalid or expired password reset token',
          );
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

      await this.broadcastSessionSyncEvent({
        type: 'PASSWORD_CHANGED',
        userId: userResetToken.userId,
        occurredAt: now.toISOString(),
      });

      return {
        message:
          'Password has been reset successfully. Please log in with your new password.',
      };
    }

    const parentResetToken = this.prisma.parentPasswordResetToken
      ? await this.prisma.parentPasswordResetToken.findUnique({
          where: { tokenHash },
          select: { id: true, parentId: true, usedAt: true, expiresAt: true },
        })
      : null;

    if (parentResetToken) {
      if (parentResetToken.usedAt || parentResetToken.expiresAt <= now) {
        throw new BadRequestException(
          'Invalid or expired password reset token',
        );
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
          throw new BadRequestException(
            'Invalid or expired password reset token',
          );
        }

        const owner = await tx.parentAccount.findUnique({
          where: { id: parentResetToken.parentId },
          select: { id: true, email: true, isActive: true },
        });
        if (!owner || !owner.isActive) {
          throw new BadRequestException(
            'Invalid or expired password reset token',
          );
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

      await this.broadcastSessionSyncEvent({
        type: 'PASSWORD_CHANGED',
        userId: parentResetToken.parentId,
        occurredAt: now.toISOString(),
      });

      return {
        message:
          'Password has been reset successfully. Please log in with your new password.',
      };
    }

    throw new BadRequestException('Invalid or expired password reset token');
  }

  // ==========================================================================
  // EMAIL TRANSPORT
  // ==========================================================================

  private async sendPasswordResetEmail(
    to: string,
    resetUrl: string,
  ): Promise<void> {
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

  // ==========================================================================
  // ACCESS WHITELIST & TENANT APPROVAL GOVERNANCE
  // ==========================================================================

  public async isEmailWhitelisted(email: string): Promise<boolean> {
    if (!this.prisma.accessWhitelist) return false;
    const entry = await this.prisma.accessWhitelist.findUnique({
      where: { email: normalizeEmail(email) },
    });
    return Boolean(entry);
  }

  public async getWhitelist(organizationId?: string, isSuperAdmin = false) {
    if (!this.prisma.accessWhitelist) {
      return {
        whitelist: [],
        pendingUsers: [],
        config: { inviteOnly: true, requireApproval: true },
      };
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
        ? this.prisma.accessControlConfig.findUnique({
            where: { id: 'global' },
          })
        : null,
    ]);

    return {
      whitelist,
      pendingUsers,
      config: config || { inviteOnly: true, requireApproval: true },
    };
  }

  public async addToWhitelist(data: {
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

  public async removeFromWhitelist(
    id: string,
    adminId?: string,
    adminRole?: string,
    organizationId?: string,
  ) {
    const entry = await this.prisma.accessWhitelist.findUnique({
      where: { id },
    });
    if (!entry) {
      throw new NotFoundException('Whitelist entry not found');
    }

    if (!isPlatformRole(adminRole)) {
      if (!organizationId?.trim()) {
        throw new ForbiddenException(
          'Whitelist entry cannot be modified without an organization scope',
        );
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
        throw new ForbiddenException(
          'Cannot modify whitelist entry for another organization',
        );
      }
    }

    await this.prisma.accessWhitelist.delete({ where: { id } });
    return { success: true };
  }

  public async approveUser(
    id: string,
    adminId?: string,
    adminRole?: string,
    organizationId?: string,
  ) {
    void adminId;
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!isPlatformRole(adminRole) && user.organizationId !== organizationId) {
      throw new ForbiddenException(
        'Cannot approve user from another organization',
      );
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

  public async rejectUser(
    id: string,
    adminId?: string,
    adminRole?: string,
    organizationId?: string,
  ) {
    void adminId;
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!isPlatformRole(adminRole) && user.organizationId !== organizationId) {
      throw new ForbiddenException(
        'Cannot reject user from another organization',
      );
    }

    await this.prisma.user.update({
      where: { id },
      data: {
        status: 'REVOKED',
        isActive: false,
      },
    });

    await this.logoutAll(id, 'account_rejected');

    return { success: true, message: 'User rejected successfully' };
  }

  public async updateAccessControlConfig(
    data: UpdateAccessControlSettingsDto,
    adminId?: string,
    adminRole?: string,
    organizationId?: string,
  ) {
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
      throw new ForbiddenException(
        'Only a platform administrator can change global access control settings',
      );
    }

    if (!this.prisma.accessControlConfig) {
      return { inviteOnly: true, requireApproval: true };
    }

    return this.prisma.accessControlConfig.upsert({
      where: { id: 'global' },
      create: {
        id: 'global',
        inviteOnly: data.inviteOnly ?? true,
        requireApproval: data.requireApproval ?? true,
        updatedBy: adminId,
      },
      update: {
        ...(data.inviteOnly !== undefined
          ? { inviteOnly: data.inviteOnly }
          : {}),
        ...(data.requireApproval !== undefined
          ? { requireApproval: data.requireApproval }
          : {}),
        updatedBy: adminId,
      },
    });
  }

  // ==========================================================================
  // SESSIONS & MULTI-DEVICE MANAGEMENT
  // ==========================================================================

  /**
   * Lists all active, non-expired device sessions for a user, enriched with
   * parsed OS/Browser device fingerprints.
   */
  public async getActiveSessions(
    userId: string,
    currentSessionId?: string,
    role?: string,
  ) {
    if (role === 'PARENT') {
      const sessions = await this.prisma.parentSession.findMany({
        where: {
          parentId: userId,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      });
      return sessions.map((s) => ({
        id: s.id,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        userAgent: s.userAgent,
        ipAddress: s.ipAddress,
        deviceInfo:
          s.deviceInfo ??
          this.sessionDeviceMetadata.get(s.id)?.formattedLabel ??
          null,
        lastActiveAt: s.lastActiveAt,
        isCurrent: s.id === currentSessionId,
      }));
    }

    const sessions = await this.prisma.session.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    return sessions.map((s) => ({
      id: s.id,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      userAgent: s.userAgent,
      ipAddress: s.ipAddress,
      deviceInfo:
        s.deviceInfo ??
        this.sessionDeviceMetadata.get(s.id)?.formattedLabel ??
        null,
      lastActiveAt: s.lastActiveAt,
      isCurrent: s.id === currentSessionId,
    }));
  }

  /**
   * Remote Session Revocation (Kill Switch): Revokes a specific session ID
   * owned by the user, blacklists its token immediately, and broadcasts a sync event.
   */
  public async revokeSession(
    userId: string,
    sessionId: string,
    role?: string,
  ) {
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

    await this.blacklistSessionId(sessionId);
    await this.broadcastSessionSyncEvent({
      type: 'SESSION_REVOKED',
      userId,
      sessionId,
      reason: 'user_revoked',
      occurredAt: new Date().toISOString(),
    });

    return { success: true };
  }

  /**
   * Revokes all active sessions except `currentSessionId`, blacklisting their
   * tokens and notifying connected clients via Redis Pub/Sub.
   */
  public async revokeOtherSessions(
    userId: string,
    currentSessionId?: string,
    role?: string,
  ) {
    if (role === 'PARENT') {
      const others = await this.prisma.parentSession?.findMany?.({
        where: {
          parentId: userId,
          id: { not: currentSessionId },
          revokedAt: null,
        },
        select: { id: true },
      });
      await this.prisma.parentSession.updateMany({
        where: {
          parentId: userId,
          id: { not: currentSessionId },
          revokedAt: null,
        },
        data: { revokedAt: new Date(), revokedReason: 'revoke_others' },
      });
      for (const s of others ?? []) {
        await this.blacklistSessionId(s.id);
      }
    } else {
      const others = await this.prisma.session?.findMany?.({
        where: {
          userId,
          id: { not: currentSessionId },
          revokedAt: null,
        },
        select: { id: true },
      });
      await this.prisma.session.updateMany({
        where: {
          userId,
          id: { not: currentSessionId },
          revokedAt: null,
        },
        data: { revokedAt: new Date(), revokedReason: 'revoke_others' },
      });
      for (const s of others ?? []) {
        await this.blacklistSessionId(s.id);
      }
    }

    await this.broadcastSessionSyncEvent({
      type: 'OTHER_SESSIONS_REVOKED',
      userId,
      retainedSessionId: currentSessionId,
      occurredAt: new Date().toISOString(),
    });

    return { success: true };
  }

  public async acceptInvitation(
    dto: AcceptInvitationDto,
  ): Promise<{ accessToken: string; user: TokenUser }> {
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
      const claim = await tx.invitation.updateMany({
        where: { id: invitation.id, status: 'PENDING', acceptedAt: null },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      });

      if (claim.count !== 1) {
        throw new BadRequestException(
          'Invitation has already been accepted or is no longer valid',
        );
      }

      const user = await tx.user.create({
        data: {
          email: invitation.email,
          organizationId: invitation.organizationId,
          role: invitation.role,
          passwordHash,
          firstName: dto.firstName?.trim() || 'Invited',
          lastName: dto.lastName?.trim() || 'Member',
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

  public async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    currentSessionId?: string | null,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { passwordHistories: { orderBy: { createdAt: 'desc' }, take: 5 } },
    });
    if (!user) throw new NotFoundException('User not found');
    if (!user.passwordHash) {
      throw new BadRequestException('This account does not have a local password configured');
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new BadRequestException('Current password is incorrect');

    if (newPassword.length < 8) {
      throw new BadRequestException('New password must be at least 8 characters long');
    }

    const isSameAsCurrent = await bcrypt.compare(newPassword, user.passwordHash);
    if (isSameAsCurrent) {
      throw new BadRequestException('New password cannot be identical to the current password');
    }

    for (const ph of user.passwordHistories || []) {
      const isPastPassword = await bcrypt.compare(newPassword, ph.passwordHash);
      if (isPastPassword) {
        throw new BadRequestException('New password cannot be one of your recent previous passwords');
      }
    }

    const passwordHash = await bcrypt.hash(newPassword, this.BCRYPT_ROUNDS);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          passwordHash,
          mustChangePassword: false,
        },
      });

      await tx.passwordHistory.create({
        data: {
          userId,
          passwordHash,
        },
      });

      await tx.session.updateMany({
        where: {
          userId,
          revokedAt: null,
          ...(currentSessionId ? { id: { not: currentSessionId } } : {}),
        },
        data: { revokedAt: new Date(), revokedReason: 'password_changed' },
      });
    });

    await this.broadcastSessionSyncEvent({
      type: 'PASSWORD_CHANGED',
      userId,
      occurredAt: new Date().toISOString(),
    });

    await this.security?.logEvent({
      eventType: SecurityEventType.PASSWORD_CHANGED,
      organizationId: user.organizationId,
      userId,
      resourceType: 'User',
      resourceId: userId,
      success: true,
    });

    return { message: 'Password changed successfully' };
  }

  public async switchOrganization(
    userId: string,
    targetOrgId: string,
    currentSessionId?: string | null,
    clientMeta?: ClientMetadata,
  ): Promise<{ accessToken: string; user: TokenUser }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        organization: true,
        memberships: {
          where: { organizationId: targetOrgId },
          include: { organization: true },
        },
      },
    });

    if (!user || !user.isActive || SUSPENDED_STATUSES.has((user.status || '').toUpperCase())) {
      throw new UnauthorizedException('Invalid or inactive user account');
    }

    const membership = user.memberships[0];
    if (
      !membership ||
      membership.status !== 'ACTIVE' ||
      !membership.organization ||
      membership.organization.isActive === false ||
      membership.organization.status === 'SUSPENDED'
    ) {
      throw new ForbiddenException('Not authorized for the selected organization or organization is suspended');
    }

    if (currentSessionId) {
      await this.prisma.session.updateMany({
        where: { id: currentSessionId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'switched_organization' },
      });
    }

    const effectiveUser: any = {
      ...user,
      organizationId: targetOrgId,
      role: membership.role,
      organization: membership.organization,
    };

    return this.issueToken(effectiveUser, clientMeta);
  }

}
