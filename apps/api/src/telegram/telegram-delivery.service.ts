import { Injectable, Logger } from '@nestjs/common';
import { TelegramAccountStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TelegramAuditActions } from './telegram.constants';
import type { TelegramSendResult } from './telegram.service';

/**
 * Provider failure categories, in the vocabulary the delivery-tracking model
 * stores. Mirrors `TelegramSendResult['errorCategory']` plus the local
 * `NOT_LINKED` / `NOT_ACTIVE` outcomes (no account to send to at all).
 */
export type TelegramFailureCategory =
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'RATE_LIMITED'
  | 'TELEGRAM_SERVER_ERROR'
  | 'BLOCKED_USER'
  | 'INVALID_CHAT'
  | 'UNAUTHORIZED'
  | 'NOT_CONFIGURED'
  | 'PERMANENT'
  | 'NOT_LINKED'
  | 'NOT_ACTIVE';

/**
 * Permanent failures that mean "this chat can never receive from this bot
 * again" — the user blocked the bot (403) or the chat no longer exists (400).
 *
 * These MUST stop future delivery and mark the account, otherwise the worker
 * retries a dead chat forever.
 *
 * Deliberately NOT included:
 *   - `UNAUTHORIZED` / `NOT_CONFIGURED`: the bot credential is wrong/missing —
 *     an operator problem affecting EVERY account, never a user relationship.
 *     Blocking accounts for it would destroy working links.
 *   - `PERMANENT`: Telegram's generic 4xx that we could not classify further.
 *     Treated as permanent-for-this-attempt (no retry) but NOT an account
 *     relationship failure, because misclassifying it would block a healthy
 *     account. It is recorded so operators can see the pattern.
 */
const PERMANENT_RELATIONSHIP_CATEGORIES: ReadonlySet<string> = new Set([
  'BLOCKED_USER',
  'INVALID_CHAT',
]);

/** Transport/provider failures where retry/backoff is correct. */
const TRANSIENT_CATEGORIES: ReadonlySet<string> = new Set([
  'NETWORK_ERROR',
  'TIMEOUT',
  'RATE_LIMITED',
  'TELEGRAM_SERVER_ERROR',
]);

export function isPermanentRelationshipFailure(category: string): boolean {
  return PERMANENT_RELATIONSHIP_CATEGORIES.has(category);
}

export function isTransientFailure(category: string): boolean {
  return TRANSIENT_CATEGORIES.has(category);
}

/** A resolved, currently-deliverable Telegram destination. */
export interface TelegramDeliveryTarget {
  accountId: string;
  organizationId: string;
  chatId: string;
  languageCode: string | null;
  userId: string | null;
  parentAccountId: string | null;
}

export type PrincipalRef =
  | { type: 'USER'; userId: string }
  | { type: 'PARENT_ACCOUNT'; parentAccountId: string };

/**
 * Lifecycle-aware Telegram delivery addressing.
 *
 * The authoritative delivery identity is `TelegramAccount` — NOT the legacy
 * `User.telegramChatId` / `ParentAccount.telegramChatId` mirror. Every lookup
 * here:
 *   - filters to `status = ACTIVE` (a DISCONNECTED / BLOCKED / SUSPENDED
 *     account is never a delivery target),
 *   - requires the caller's `organizationId` to match the account's, so a
 *     mis-scoped event can never reach another tenant's chat (fail closed),
 *   - re-resolves on every event, so a stale legacy chat id is never used.
 *
 * It also owns the inverse transition: a permanent provider failure marks the
 * account `BLOCKED`, which is the ONLY way (besides an explicit admin action)
 * delivery stops — and the ONLY way back is the normal re-link flow, which
 * activates the account atomically.
 */
@Injectable()
export class TelegramDeliveryService {
  private readonly logger = new Logger(TelegramDeliveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Resolve the ACTIVE account for one principal inside one organization. */
  async resolveActiveTarget(
    organizationId: string,
    principal: PrincipalRef,
  ): Promise<TelegramDeliveryTarget | null> {
    const account = await this.prisma.telegramAccount.findFirst({
      where: {
        organizationId,
        status: TelegramAccountStatus.ACTIVE,
        ...(principal.type === 'USER'
          ? { userId: principal.userId }
          : { parentAccountId: principal.parentAccountId }),
      },
      select: {
        id: true,
        organizationId: true,
        chatId: true,
        languageCode: true,
        userId: true,
        parentAccountId: true,
      },
    });
    if (!account) return null;
    return {
      accountId: account.id,
      organizationId: account.organizationId,
      chatId: account.chatId,
      languageCode: account.languageCode,
      userId: account.userId,
      parentAccountId: account.parentAccountId,
    };
  }

  /**
   * Batch variant for the notification worker: resolve the ACTIVE accounts of
   * many principals in ONE query, scoped to the organization.
   *
   * Returns a Map keyed by principal id so the caller can keep the per-parent
   * SMS fallback for principals without a usable Telegram link.
   */
  async resolveActiveTargetsForPrincipals(
    organizationId: string,
    principals: PrincipalRef[],
  ): Promise<Map<string, TelegramDeliveryTarget>> {
    const result = new Map<string, TelegramDeliveryTarget>();
    if (principals.length === 0) return result;

    const userIds = principals
      .filter((p): p is { type: 'USER'; userId: string } => p.type === 'USER')
      .map((p) => p.userId);
    const parentIds = principals
      .filter(
        (p): p is { type: 'PARENT_ACCOUNT'; parentAccountId: string } =>
          p.type === 'PARENT_ACCOUNT',
      )
      .map((p) => p.parentAccountId);

    const accounts = await this.prisma.telegramAccount.findMany({
      where: {
        organizationId,
        status: TelegramAccountStatus.ACTIVE,
        OR: [
          ...(userIds.length > 0 ? [{ userId: { in: userIds } }] : []),
          ...(parentIds.length > 0 ? [{ parentAccountId: { in: parentIds } }] : []),
        ],
      },
      select: {
        id: true,
        organizationId: true,
        chatId: true,
        languageCode: true,
        userId: true,
        parentAccountId: true,
      },
    });

    for (const account of accounts) {
      const key = account.userId ?? account.parentAccountId;
      if (!key) continue;
      // Defensive: `OR` above is already org-scoped, but a tenant mismatch is
      // a hard fail-closed condition rather than something to "fix up".
      if (account.organizationId !== organizationId) continue;
      if (!result.has(key)) {
        result.set(key, {
          accountId: account.id,
          organizationId: account.organizationId,
          chatId: account.chatId,
          languageCode: account.languageCode,
          userId: account.userId,
          parentAccountId: account.parentAccountId,
        });
      }
    }

    return result;
  }

  /**
   * Record a PERMANENT relationship failure: stop future delivery.
   *
   * Race-safe: the transition is a conditional `updateMany` guarded on
   * `status = ACTIVE`, so two concurrent worker instances cannot both "win" —
   * and a re-link that already reactivated the account is never clobbered.
   * The legacy mirror pointer is cleared in the same transaction so the old
   * consumer cannot keep delivering either.
   *
   * @returns true when this call performed the ACTIVE -> BLOCKED transition.
   */
  async markUndeliverable(
    accountId: string,
    category: TelegramFailureCategory,
    reason: string,
  ): Promise<boolean> {
    const account = await this.prisma.telegramAccount.findUnique({
      where: { id: accountId },
      select: {
        id: true,
        organizationId: true,
        chatId: true,
        status: true,
        userId: true,
        parentAccountId: true,
      },
    });
    if (!account || account.status !== TelegramAccountStatus.ACTIVE) return false;

    const transitioned = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.telegramAccount.updateMany({
        where: { id: account.id, status: TelegramAccountStatus.ACTIVE },
        data: {
          status: TelegramAccountStatus.BLOCKED,
          disconnectedAt: new Date(),
        },
      });
      if (updated.count !== 1) return false;

      // Clear the legacy mirror only when it still points at THIS chat — never
      // wipe a pointer that a newer re-link has already replaced.
      if (account.userId) {
        await tx.user.updateMany({
          where: { id: account.userId, telegramChatId: account.chatId },
          data: { telegramChatId: null },
        });
      }
      if (account.parentAccountId) {
        await tx.parentAccount.updateMany({
          where: { id: account.parentAccountId, telegramChatId: account.chatId },
          data: { telegramChatId: null },
        });
      }
      return true;
    });

    if (!transitioned) return false;

    this.logger.warn(
      JSON.stringify({
        event: 'telegram_account_blocked',
        organizationId: account.organizationId,
        accountId: account.id,
        category,
      }),
    );

    try {
      await this.audit.record({
        organizationId: account.organizationId,
        userId: account.userId,
        action: TelegramAuditActions.BLOCKED,
        resource: 'TELEGRAM_ACCOUNT',
        resourceId: account.id,
        // Categorized reason only — never a raw provider body or chat id.
        changes: {
          status: { old: 'ACTIVE', new: 'BLOCKED' },
          category: { old: null, new: category },
          reason: { old: null, new: reason },
        },
      });
    } catch (err: unknown) {
      this.logger.error(
        JSON.stringify({
          event: 'telegram_block_audit_failed',
          accountId: account.id,
          message: err instanceof Error ? err.message : String(err),
        }),
      );
    }

    return true;
  }

  /** Classify a send result and apply the permanent-failure transition. */
  async applyFailure(
    target: TelegramDeliveryTarget,
    result: TelegramSendResult,
  ): Promise<TelegramFailureCategory> {
    const category = (result.errorCategory ?? 'PERMANENT') as TelegramFailureCategory;
    if (isPermanentRelationshipFailure(category)) {
      await this.markUndeliverable(
        target.accountId,
        category,
        category === 'BLOCKED_USER' ? 'bot blocked by user' : 'chat not reachable',
      );
    }
    return category;
  }
}
