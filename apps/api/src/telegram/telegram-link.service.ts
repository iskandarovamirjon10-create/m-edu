import {
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { Prisma, TelegramAccount, TelegramAccountStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TelegramService } from './telegram.service';
import { TelegramAttemptLimiter } from './telegram-attempt-limiter.service';
import {
  TELEGRAM_LINK_MAX_FAILED_ATTEMPTS,
  TELEGRAM_LINK_TOKEN_BYTES,
  TELEGRAM_LINK_TOKEN_PATTERN,
  TELEGRAM_LINK_TTL_MS,
  TelegramAuditActions,
} from './telegram.constants';
import { resolveLanguage, t } from './i18n/telegram-i18n';

/** Authenticated M-EDU principal requesting a link (from the JWT session). */
export interface TelegramPrincipal {
  sub: string;
  organizationId: string;
  role: string;
}

type LinkTarget =
  | { type: 'USER'; userId: string }
  | { type: 'PARENT_ACCOUNT'; parentAccountId: string };

/** Telegram-supplied identity (all untrusted) plus the raw deep-link token. */
export interface StartLinkInput {
  token: string;
  telegramUserId: string;
  chatId: string;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  languageCode?: string | null;
}

export type StartLinkResult =
  | {
      status: 'LINKED';
      entityType: 'USER' | 'PARENT_ACCOUNT';
      organizationId: string;
      alreadyLinked: boolean;
    }
  | { status: 'INVALID_TOKEN' }
  | { status: 'RATE_LIMITED' }
  | { status: 'IDENTITY_CONFLICT' };

export interface TelegramLinkStatus {
  linked: boolean;
  status: TelegramAccountStatus | null;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  languageCode: string | null;
  linkedAt: Date | null;
  lastSeenAt: Date | null;
  pendingLinkExpiresAt: Date | null;
}

const AUDIT_RESOURCE = 'TELEGRAM_ACCOUNT';

/**
 * Telegram account linking lifecycle.
 *
 * Security properties enforced here (see docs/TELEGRAM.md for the threat
 * model):
 *   - Deep-link tokens are 256-bit random values; only their SHA-256 hash is
 *     stored, so a database dump cannot be replayed.
 *   - Consumption is atomic (`updateMany` guarded on `usedAt IS NULL`), so
 *     concurrent/replayed webhook deliveries can never link twice.
 *   - A link token is only ever issued for the CALLER's own M-EDU principal,
 *     resolved from the authenticated session — Telegram-side data can never
 *     choose which account is linked (account-takeover protection).
 *   - A Telegram identity already linked to a different principal is refused;
 *     identities are never silently reassigned.
 */
@Injectable()
export class TelegramLinkService {
  private readonly logger = new Logger(TelegramLinkService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly telegram: TelegramService,
    private readonly limiter: TelegramAttemptLimiter,
  ) {}

  // ======================================================================
  // TOKEN CREATION (authenticated M-EDU side)
  // ======================================================================

  /**
   * Issue a new single-use deep-link token for the caller's own principal.
   *
   * Any previously-issued, unused token for the same principal is deleted so
   * only one link is ever live — a stale deep link cannot be used later.
   */
  async createLinkToken(principal: TelegramPrincipal): Promise<{
    token: string;
    deepLink: string;
    expiresAt: Date;
  }> {
    const target = this.targetOf(principal);
    await this.assertPrincipalActive(target);

    const botUsername = this.telegram.getBotUsername();
    if (!botUsername) {
      throw new ServiceUnavailableException(
        'Telegram is not configured (TELEGRAM_BOT_USERNAME is missing).',
      );
    }

    const token = randomBytes(TELEGRAM_LINK_TOKEN_BYTES).toString('hex');
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + TELEGRAM_LINK_TTL_MS);

    await this.prisma.$transaction(async (tx) => {
      // Invalidate older pending tokens for this principal.
      await tx.telegramLinkToken.deleteMany({
        where: {
          ...this.targetFilter(target),
          usedAt: null,
        },
      });

      await tx.telegramLinkToken.create({
        data: {
          organizationId: principal.organizationId,
          tokenHash,
          targetType: target.type,
          ...this.targetFilter(target),
          expiresAt,
        },
      });
    });

    await this.safeAudit({
      organizationId: principal.organizationId,
      userId: target.type === 'USER' ? target.userId : null,
      action: TelegramAuditActions.LINK_CREATED,
      resourceId: null,
    });

    this.logger.log(
      JSON.stringify({
        event: 'telegram_link_created',
        organizationId: principal.organizationId,
        targetType: target.type,
      }),
    );

    return { token, deepLink: `https://t.me/${botUsername}?start=${token}`, expiresAt };
  }

  // ======================================================================
  // TOKEN CONSUMPTION (webhook side, fully untrusted input)
  // ======================================================================

  /**
   * Consume a `/start <token>` deep link and link the Telegram identity.
   *
   * Every Telegram-sourced field is untrusted: the only thing that identifies
   * the M-EDU account is the token row, which was created from an authenticated
   * session.
   */
  async consumeStart(input: StartLinkInput): Promise<StartLinkResult> {
    const scope = `chat:${input.chatId}`;

    if (await this.limiter.isBlocked(scope, TELEGRAM_LINK_MAX_FAILED_ATTEMPTS)) {
      this.logger.warn(
        JSON.stringify({ event: 'telegram_link_rate_limited', chatId: input.chatId }),
      );
      return { status: 'RATE_LIMITED' };
    }

    // Shape check before touching the database.
    if (!TELEGRAM_LINK_TOKEN_PATTERN.test(input.token)) {
      await this.onFailedAttempt(scope, input.chatId, 'malformed');
      return { status: 'INVALID_TOKEN' };
    }

    const tokenHash = hashToken(input.token);
    const row = await this.prisma.telegramLinkToken.findUnique({ where: { tokenHash } });

    if (!row || row.usedAt !== null || row.expiresAt <= new Date()) {
      await this.onFailedAttempt(scope, input.chatId, 'unknown_or_expired');
      return { status: 'INVALID_TOKEN' };
    }

    // Atomically claim the token. Exactly one concurrent caller can win.
    const claimed = await this.prisma.telegramLinkToken.updateMany({
      where: { id: row.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (claimed.count !== 1) {
      await this.onFailedAttempt(scope, input.chatId, 'race_lost');
      return { status: 'INVALID_TOKEN' };
    }

    const target: LinkTarget =
      row.targetType === 'PARENT_ACCOUNT'
        ? { type: 'PARENT_ACCOUNT', parentAccountId: row.parentAccountId as string }
        : { type: 'USER', userId: row.userId as string };

    const result = await this.linkIdentity(target, row.organizationId, input, tokenHash);

    if (result.status === 'LINKED') {
      await this.limiter.clear(scope);
      await this.safeAudit({
        organizationId: row.organizationId,
        userId: target.type === 'USER' ? target.userId : null,
        action: TelegramAuditActions.LINK_CONSUMED,
        resourceId: null,
      });
    } else {
      await this.prisma.telegramLinkToken.updateMany({
        where: { id: row.id },
        data: { usedAt: null },
      });
    }

    return result;
  }

  /**
   * Link (or re-link) a Telegram identity to an M-EDU principal.
   *
   * Runs in a single transaction so the identity mapping and the legacy
   * delivery-pointer mirror can never diverge.
   */
  private async linkIdentity(
    target: LinkTarget,
    organizationId: string,
    input: StartLinkInput,
    tokenHash: string,
  ): Promise<StartLinkResult> {
    const targetFilter = this.targetFilter(target);

    try {
      return await this.prisma.$transaction(async (tx) => {
        // Verify the target still exists, is active and belongs to the token's
        // organization — it may have been deactivated or moved since the token
        // was issued.
        if (target.type === 'USER') {
          const user = await tx.user.findFirst({
            where: { id: target.userId, organizationId, isActive: true },
            select: { id: true },
          });
          if (!user) return { status: 'INVALID_TOKEN' as const };
        } else {
          const parent = await tx.parentAccount.findFirst({
            where: { id: target.parentAccountId, organizationId, isActive: true },
            select: { id: true },
          });
          if (!parent) return { status: 'INVALID_TOKEN' as const };
        }

        // Rows that already own the incoming Telegram identity / chat.
        const byTelegramUser = await tx.telegramAccount.findUnique({
          where: { telegramUserId: input.telegramUserId },
        });
        const byChat = await tx.telegramAccount.findUnique({
          where: { chatId: input.chatId },
        });

        if (byTelegramUser && byChat && byTelegramUser.id !== byChat.id) {
          // Two different M-EDU rows claim this identity — refuse rather than
          // guess (data anomaly; must never silently reassign).
          return { status: 'IDENTITY_CONFLICT' as const };
        }

        const owner = byTelegramUser ?? byChat;
        if (
          owner &&
          owner.status === TelegramAccountStatus.ACTIVE &&
          !this.rowBelongsTo(owner, target)
        ) {
          // This Telegram account is actively linked to a DIFFERENT principal.
          // Never reassign it — that is the account-takeover path.
          this.logger.warn(
            JSON.stringify({
              event: 'telegram_identity_conflict',
              organizationId,
              targetType: target.type,
            }),
          );
          return { status: 'IDENTITY_CONFLICT' as const };
        }

        const principalRows = await tx.telegramAccount.findMany({
          where: targetFilter,
        });
        const rowToActivate = owner ?? principalRows[0] ?? null;

        // Retire any other rows belonging to this principal (defensive: the
        // identity mapping is one-to-one, so this only clears legacy data).
        const stale = principalRows.filter(
          (r) => rowToActivate !== null && r.id !== rowToActivate.id,
        );
        if (stale.length > 0) {
          await tx.telegramAccount.updateMany({
            where: { id: { in: stale.map((r) => r.id) } },
            data: {
              status: TelegramAccountStatus.DISCONNECTED,
              disconnectedAt: new Date(),
            },
          });
        }

        const identity = {
          organizationId,
          telegramUserId: input.telegramUserId,
          chatId: input.chatId,
          username: input.username ?? null,
          firstName: input.firstName ?? null,
          lastName: input.lastName ?? null,
          languageCode: input.languageCode ?? null,
          status: TelegramAccountStatus.ACTIVE,
          disconnectedAt: null,
          lastSeenAt: new Date(),
          ...targetFilter,
        };

        if (rowToActivate) {
          await tx.telegramAccount.update({
            where: { id: rowToActivate.id },
            data: identity,
          });
        } else {
          await tx.telegramAccount.create({ data: identity });
        }

        // Mirror onto the legacy delivery pointer so the existing notification
        // worker keeps delivering without knowing about TelegramAccount.
        if (target.type === 'USER') {
          await tx.user.update({
            where: { id: target.userId },
            data: { telegramChatId: input.chatId },
          });
        } else {
          await tx.parentAccount.update({
            where: { id: target.parentAccountId },
            data: { telegramChatId: input.chatId },
          });
        }

        // Delivery audit trail (the raw token is never persisted).
        await this.writeLinkLog(tx, {
          organizationId,
          target,
          chatId: input.chatId,
          telegramUserId: input.telegramUserId,
          tokenHash,
          status: 'SUCCESS',
        });

        const wasAlreadyLinked = rowToActivate?.status === TelegramAccountStatus.ACTIVE;

        return {
          status: 'LINKED' as const,
          entityType: target.type,
          organizationId,
          alreadyLinked: wasAlreadyLinked,
        };
      });
    } catch (err: unknown) {
      if ((err as { code?: string })?.code === 'P2002') {
        // Lost a race against another instance linking the same identity.
        return { status: 'IDENTITY_CONFLICT' };
      }
      throw err;
    }
  }

  // ======================================================================
  // DISCONNECT
  // ======================================================================

  /** Disconnect the caller's own Telegram link (M-EDU settings side). */
  async unlink(principal: TelegramPrincipal): Promise<{ disconnected: boolean }> {
    const target = this.targetOf(principal);

    const account = await this.prisma.telegramAccount.findFirst({
      where: { ...this.targetFilter(target), status: TelegramAccountStatus.ACTIVE },
    });
    if (!account) {
      return { disconnected: false };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.telegramAccount.update({
        where: { id: account.id },
        data: {
          status: TelegramAccountStatus.DISCONNECTED,
          disconnectedAt: new Date(),
        },
      });
      // Cancel any pending link for this principal.
      await tx.telegramLinkToken.deleteMany({
        where: { ...this.targetFilter(target), usedAt: null },
      });
      // Stop the notification worker from delivering to this chat.
      if (target.type === 'USER') {
        await tx.user.update({
          where: { id: target.userId },
          data: { telegramChatId: null },
        });
      } else {
        await tx.parentAccount.update({
          where: { id: target.parentAccountId },
          data: { telegramChatId: null },
        });
      }
    });

    await this.safeAudit({
      organizationId: principal.organizationId,
      userId: target.type === 'USER' ? target.userId : null,
      action: TelegramAuditActions.DISCONNECTED,
      resourceId: account.id,
    });

    this.logger.log(
      JSON.stringify({
        event: 'telegram_disconnected',
        organizationId: principal.organizationId,
      }),
    );

    return { disconnected: true };
  }

  /**
   * Disconnect by chat id, driven by the `/unlink` bot command.
   *
   * No M-EDU session exists on the Telegram side, and disconnecting only ever
   * REDUCES access, so the chat owner is allowed to stop their own delivery
   * (fail-safe direction). Authorization to READ anything still requires a
   * server-resolved M-EDU identity.
   */
  async unlinkByChatId(chatId: string): Promise<{ found: boolean }> {
    const account = await this.prisma.telegramAccount.findUnique({
      where: { chatId },
    });
    if (!account) return { found: false };

    await this.prisma.$transaction(async (tx) => {
      await tx.telegramAccount.update({
        where: { id: account.id },
        data: {
          status: TelegramAccountStatus.DISCONNECTED,
          disconnectedAt: new Date(),
        },
      });
      if (account.userId) {
        await tx.user.update({
          where: { id: account.userId },
          data: { telegramChatId: null },
        });
      }
      if (account.parentAccountId) {
        await tx.parentAccount.update({
          where: { id: account.parentAccountId },
          data: { telegramChatId: null },
        });
      }
    });

    await this.safeAudit({
      organizationId: account.organizationId,
      userId: account.userId,
      action: TelegramAuditActions.DISCONNECTED,
      resourceId: account.id,
    });

    return { found: true };
  }

  // ======================================================================
  // READ / TEST
  // ======================================================================

  async getStatus(principal: TelegramPrincipal): Promise<TelegramLinkStatus> {
    const target = this.targetOf(principal);

    const account = await this.prisma.telegramAccount.findFirst({
      where: this.targetFilter(target),
      orderBy: [{ status: 'asc' }, { linkedAt: 'desc' }],
    });

    const pending = await this.prisma.telegramLinkToken.findFirst({
      where: { ...this.targetFilter(target), usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: { expiresAt: true },
    });

    return {
      linked: account?.status === TelegramAccountStatus.ACTIVE,
      status: account?.status ?? null,
      username: account?.username ?? null,
      firstName: account?.firstName ?? null,
      lastName: account?.lastName ?? null,
      languageCode: account?.languageCode ?? null,
      linkedAt: account?.linkedAt ?? null,
      lastSeenAt: account?.lastSeenAt ?? null,
      pendingLinkExpiresAt: pending?.expiresAt ?? null,
    };
  }

  /** Send a test notification to the caller's linked chat. */
  async sendTestMessage(principal: TelegramPrincipal): Promise<{ sent: boolean }> {
    const target = this.targetOf(principal);
    const account = await this.prisma.telegramAccount.findFirst({
      where: { ...this.targetFilter(target), status: TelegramAccountStatus.ACTIVE },
    });
    if (!account) return { sent: false };

    // Localized: the principal's language preference wins, then the org
    // default, then the Telegram client locale recorded at link time.
    const language = resolveLanguage(
      null,
      null,
      account.languageCode,
    );
    const sent = await this.telegram.sendMessage(
      account.chatId,
      t(language, 'settings.testNotification'),
    );
    if (sent) {
      await this.prisma.telegramAccount.update({
        where: { id: account.id },
        data: { lastSeenAt: new Date() },
      });
    }
    return { sent };
  }

  // ======================================================================
  // INTERNALS
  // ======================================================================

  private targetOf(principal: TelegramPrincipal): LinkTarget {
    if (!principal.sub) {
      throw new ForbiddenException('Authenticated principal is required.');
    }
    // `PARENT` is the role minted for a ParentAccount login (see jwt.strategy).
    if (principal.role === 'PARENT') {
      return { type: 'PARENT_ACCOUNT', parentAccountId: principal.sub };
    }
    return { type: 'USER', userId: principal.sub };
  }

  private targetFilter(target: LinkTarget): { userId: string } | { parentAccountId: string } {
    return target.type === 'USER'
      ? { userId: target.userId }
      : { parentAccountId: target.parentAccountId };
  }

  private rowBelongsTo(row: TelegramAccount, target: LinkTarget): boolean {
    return target.type === 'USER'
      ? row.userId === target.userId
      : row.parentAccountId === target.parentAccountId;
  }

  private async assertPrincipalActive(target: LinkTarget): Promise<void> {
    if (target.type === 'USER') {
      const user = await this.prisma.user.findFirst({
        where: { id: target.userId, isActive: true },
        select: { id: true },
      });
      if (!user) throw new ForbiddenException('Account is not active.');
      return;
    }
    const parent = await this.prisma.parentAccount.findFirst({
      where: { id: target.parentAccountId, isActive: true },
      select: { id: true },
    });
    if (!parent) throw new ForbiddenException('Account is not active.');
  }

  /**
   * A failed link attempt has no resolvable organization (the token is
   * unknown/expired), so it is structured-logged rather than written to the
   * tenant-scoped AuditLog. The count feeds the distributed abuse limiter.
   */
  private async onFailedAttempt(
    scope: string,
    chatId: string,
    reason: string,
  ): Promise<void> {
    const count = await this.limiter.registerFailure(scope);
    this.logger.warn(
      JSON.stringify({
        event: TelegramAuditActions.LINK_FAILED,
        chatId,
        reason,
        attempts: count,
      }),
    );
  }

  private async writeLinkLog(
    tx: Prisma.TransactionClient,
    params: {
      organizationId: string;
      target: LinkTarget;
      chatId: string;
      telegramUserId: string;
      tokenHash: string;
      status: string;
    },
  ): Promise<void> {
    const idempotencyKey = createHash('sha256')
      .update(`telegram-link:${params.tokenHash}:${params.chatId}`)
      .digest('hex');
    try {
      await tx.telegramLinkLog.create({
        data: {
          organizationId: params.organizationId,
          entityType: params.target.type,
          entityId:
            params.target.type === 'USER'
              ? params.target.userId
              : params.target.parentAccountId,
          userId: params.target.type === 'USER' ? params.target.userId : null,
          chatId: params.chatId,
          telegramUserId: params.telegramUserId,
          idempotencyKey,
          // Deliberately the HASH, never the raw token.
          linkToken: params.tokenHash,
          status: params.status,
        },
      });
    } catch (err: unknown) {
      // A duplicate audit row must not fail the link itself.
      if ((err as { code?: string })?.code !== 'P2002') throw err;
    }
  }

  /**
   * Audit writes must never break the flow they describe. A rejected webhook
   * has no resolvable organization, so those are structured-logged instead of
   * written to AuditLog (which requires an organizationId).
   */
  private async safeAudit(params: {
    organizationId: string | null;
    userId: string | null;
    action: string;
    resourceId: string | null;
  }): Promise<void> {
    const organizationId = params.organizationId;
    if (!organizationId) return;
    try {
      await this.audit.record({
        organizationId,
        userId: params.userId,
        action: params.action,
        resource: AUDIT_RESOURCE,
        resourceId: params.resourceId,
      });
    } catch (err: unknown) {
      this.logger.error(
        JSON.stringify({
          event: 'telegram_audit_failed',
          action: params.action,
          message: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }
}

/** SHA-256 hex of a raw link token. The raw value is never persisted. */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
