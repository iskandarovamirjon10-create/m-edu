import { Injectable, Logger } from '@nestjs/common';
import { rolePermissionsForRole } from '@medu/contracts';
import { PrismaService } from '../prisma/prisma.service';
import {
  ADMIN_ROLES,
  FAMILY_ROLES,
  STAFF_ROLES,
  TEACHING_ROLES,
} from '../auth/authorization.policy';
import { TelegramLanguage, resolveLanguage } from './i18n/telegram-i18n';

export type TelegramPrincipalKind = 'USER' | 'PARENT_ACCOUNT';

export type TelegramContextFailure =
  | 'NOT_LINKED'
  | 'DISCONNECTED'
  | 'BLOCKED'
  | 'SUSPENDED'
  | 'INACTIVE'
  | 'TENANT_MISMATCH';

/** Raised when a chat cannot be resolved to a usable M-EDU principal. */
export class TelegramContextError extends Error {
  constructor(readonly code: TelegramContextFailure) {
    super(code);
    this.name = 'TelegramContextError';
  }
}

/**
 * The single, reusable authenticated Telegram request context.
 *
 * Every command and callback resolves through this service — no handler ever
 * touches the Telegram payload for identity. The chain is:
 *
 *   Telegram chatId -> TelegramAccount -> M-EDU principal (User | ParentAccount)
 *                   -> organization -> role -> permission flags
 *
 * Identity is resolved FRESH on every request (no caching), so a role
 * downgrade, deactivation, organization move or removed parent-child link in
 * the web app is reflected immediately — reconnecting Telegram is never
 * required. No Telegram-supplied field is trusted: only the chat id is used
 * as a lookup key, and the authoritative role/tenant come from M-EDU tables.
 *
 * This is the Telegram equivalent of `JwtStrategy.validate`, and like that
 * strategy it reads identity directly from Prisma (its job is to *establish*
 * identity, not to serve business data).
 */
@Injectable()
export class TelegramContextService {
  private readonly logger = new Logger(TelegramContextService.name);

  constructor(private readonly prisma: PrismaService) {}

  async resolve(chatId: string): Promise<TelegramContext> {
    const account = await this.prisma.telegramAccount.findUnique({
      where: { chatId },
    });
    if (!account) throw new TelegramContextError('NOT_LINKED');

    // Lifecycle enforcement: only ACTIVE links may run normal commands.
    if (account.status !== 'ACTIVE') {
      throw new TelegramContextError(
        account.status as 'DISCONNECTED' | 'BLOCKED' | 'SUSPENDED',
      );
    }

    if (account.userId) {
      return this.resolveUserContext(account, account.userId);
    }
    if (account.parentAccountId) {
      return this.resolveParentContext(account, account.parentAccountId);
    }
    // A row with neither principal is corrupt — treat as unlinked.
    throw new TelegramContextError('NOT_LINKED');
  }

  private async resolveUserContext(
    account: ResolvedAccount,
    userId: string,
  ): Promise<TelegramContext> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        organizationId: true,
        isActive: true,
        student: { select: { id: true, balance: true } },
        teacher: { select: { id: true } },
        settings: { select: { language: true } },
        organization: { select: { language: true } },
      },
    });
    if (!user || !user.isActive) throw new TelegramContextError('INACTIVE');
    this.assertSameTenant(account, user.organizationId);

    const role = user.role as string;
    this.touch(account.id);

    return {
      account,
      kind: 'USER',
      principalId: user.id,
      organizationId: user.organizationId,
      role,
      permissions: rolePermissionsForRole(role),
      isAdmin: ADMIN_ROLES.includes(role as never),
      isStaff: STAFF_ROLES.includes(role as never),
      isTeaching: TEACHING_ROLES.includes(role as never),
      isFamily: FAMILY_ROLES.includes(role as never),
      isStudent: role === 'STUDENT',
      isParent: false,
      displayName: `${user.firstName} ${user.lastName}`.trim(),
      language: resolveLanguage(
        user.settings?.language,
        user.organization?.language,
        account.languageCode,
      ),
      studentId: user.student?.id ?? null,
      teacherId: user.teacher?.id ?? null,
      userId: user.id,
      parentId: null,
    };
  }

  private async resolveParentContext(
    account: ResolvedAccount,
    parentId: string,
  ): Promise<TelegramContext> {
    const parent = await this.prisma.parentAccount.findUnique({
      where: { id: parentId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        organizationId: true,
        isActive: true,
        organization: { select: { language: true } },
      },
    });
    if (!parent || !parent.isActive) throw new TelegramContextError('INACTIVE');
    this.assertSameTenant(account, parent.organizationId);
    this.touch(account.id);

    return {
      account,
      kind: 'PARENT_ACCOUNT',
      principalId: parent.id,
      organizationId: parent.organizationId,
      role: 'PARENT',
      // PARENT is a family role with no capability grants of its own; its
      // access is entirely derived from verified ParentStudent links.
      permissions: rolePermissionsForRole('PARENT'),
      isAdmin: false,
      isStaff: false,
      isTeaching: false,
      isFamily: true,
      isStudent: false,
      isParent: true,
      displayName: `${parent.firstName} ${parent.lastName}`.trim(),
      language: resolveLanguage(
        null,
        parent.organization?.language,
        account.languageCode,
      ),
      studentId: null,
      teacherId: null,
      userId: null,
      parentId: parent.id,
    };
  }

  /**
   * Tenant integrity: the principal's organization must equal the
   * organization recorded on the link. A mismatch means the account was moved
   * between organizations after linking — deny rather than guess.
   */
  private assertSameTenant(account: ResolvedAccount, organizationId: string): void {
    if (account.organizationId !== organizationId) {
      this.logger.warn(
        JSON.stringify({
          event: 'telegram_tenant_mismatch',
          accountId: account.id,
          organizationId,
        }),
      );
      throw new TelegramContextError('TENANT_MISMATCH');
    }
  }

  /** Best-effort presence update; never blocks or fails a command. */
  private touch(accountId: string): void {
    void this.prisma.telegramAccount
      .update({ where: { id: accountId }, data: { lastSeenAt: new Date() } })
      .catch(() => undefined);
  }
}

type ResolvedAccount = {
  id: string;
  organizationId: string;
  username: string | null;
  languageCode: string | null;
  userId: string | null;
  parentAccountId: string | null;
};

export interface TelegramContext {
  account: ResolvedAccount;
  kind: TelegramPrincipalKind;
  principalId: string;
  organizationId: string;
  role: string;
  permissions: readonly string[];
  isAdmin: boolean;
  isStaff: boolean;
  isTeaching: boolean;
  isFamily: boolean;
  isStudent: boolean;
  /** True for a ParentAccount principal (never for a family STUDENT). */
  isParent: boolean;
  displayName: string;
  language: TelegramLanguage;
  /** The principal's own Student row id (STUDENT role only). */
  studentId: string | null;
  /** The principal's own Teacher row id (teaching roles only). */
  teacherId: string | null;
  userId: string | null;
  parentId: string | null;
}
