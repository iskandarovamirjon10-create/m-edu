import { Injectable } from '@nestjs/common';
import { ADMIN_ROLES } from '../../auth/authorization.policy';
import { UsersService } from '../../users/users.service';
import { StudentsService } from '../../students/students.service';
import { ScheduleService } from '../../schedule/schedule.service';
import { AttendanceService } from '../../attendance/attendance.service';
import { PaymentsService } from '../../payments/payments.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { ParentPortalService } from '../../parent-portal/parent-portal.service';
import { TelegramCommandHandler, TelegramRequestContext } from './command.interface';
import {
  ParentChild,
  attendanceLine,
  childPickerReply,
  listReply,
  scheduleLine,
} from './command-helpers';
import {
  CallbackCodes,
  backKeyboard,
  childActionsKeyboard,
  paginationKeyboard,
} from '../ui/keyboards';
import { escapeHtml, formatDate, formatMoney } from '../ui/format';
import { TelegramReply } from '../ui/telegram-ui.types';

const PAGE_SIZE = '6';

interface ListResult<T> {
  items: T[];
  totalPages: number;
  page: number;
}

/** `/profile` — the caller's own profile (never another user's). */
@Injectable()
export class ProfileCommand implements TelegramCommandHandler {
  readonly name = 'profile';
  readonly descriptionKey = 'profile.title';
  readonly roles = 'ALL' as const;
  readonly childActionCode = CallbackCodes.CHILD_PROFILE;

  constructor(
    private readonly users: UsersService,
    private readonly students: StudentsService,
    private readonly parentPortal: ParentPortalService,
  ) {}

  async handle(request: TelegramRequestContext): Promise<TelegramReply> {
    const { ctx, tr } = request;

    if (ctx.kind === 'PARENT_ACCOUNT') {
      const children = await this.parentPortal.listChildren({
        parentId: ctx.parentId as string,
        organizationId: ctx.organizationId,
      });
      return {
        text: [
          escapeHtml(tr('profile.title')),
          '',
          tr('profile.name', { name: escapeHtml(ctx.displayName) }),
          tr('profile.email', { email: escapeHtml(ctx.account.username ?? '—') }),
          tr('profile.children', { count: children.length }),
        ].join('\n'),
        keyboard: backKeyboard({ tr, cb: request.cb }),
      };
    }

    // Own User row only: the id comes from the verified JWT-equivalent context.
    const user = await this.users.findOne(ctx.organizationId, ctx.userId as string);
    const lines = [
      escapeHtml(tr('profile.title')),
      '',
      tr('profile.name', { name: escapeHtml(`${user.firstName} ${user.lastName}`.trim()) }),
      tr('profile.email', { email: escapeHtml(user.email) }),
      tr('profile.phone', { email: escapeHtml(user.phone ?? '—') }),
      tr('profile.role', { role: escapeHtml(user.role) }),
    ];

    if (ctx.isStudent && ctx.studentId) {
      const student = await this.students.findOne(ctx.organizationId, ctx.studentId);
      const groups = (student.groups ?? [])
        .map((g: { group?: { name?: string } }) => escapeHtml(g.group?.name ?? ''))
        .filter(Boolean)
        .join(', ');
      lines.push(
        tr('profile.balance', { balance: escapeHtml(formatMoney(student.balance)) }),
        tr('profile.groups', { groups: groups || escapeHtml(tr('common.none')) }),
      );
    }

    return {
      text: lines.join('\n'),
      keyboard: backKeyboard({ tr, cb: request.cb }),
    };
  }

  /** Parent selecting a child → show that child's summary. */
  async renderForChild(
    request: TelegramRequestContext,
    child: ParentChild,
  ): Promise<TelegramReply> {
    const { tr } = request;
    return {
      text: [
        escapeHtml(tr('profile.title')),
        '',
        tr('profile.name', { name: escapeHtml(child.name) }),
        tr('profile.children', { count: 1 }),
      ].join('\n'),
      keyboard: childActionsKeyboard({ tr, cb: request.cb }, child.index),
    };
  }
}

/** `/schedule` — own schedule, a child's schedule, or the org/teacher schedule. */
@Injectable()
export class ScheduleCommand implements TelegramCommandHandler {
  readonly name = 'schedule';
  readonly descriptionKey = 'schedule.title';
  readonly roles = 'ALL' as const;
  readonly childActionCode = CallbackCodes.CHILD_SCHEDULE;

  constructor(
    private readonly schedule: ScheduleService,
    private readonly parentPortal: ParentPortalService,
  ) {}

  async handle(request: TelegramRequestContext): Promise<TelegramReply> {
    const { ctx, page } = request;

    if (ctx.isParent) {
      return childPickerReply(request, this.parentPortal);
    }

    const query: Record<string, string> = { limit: PAGE_SIZE, page: String(page) };
    let result: unknown;
    if (ctx.isStudent) {
      // ScheduleService applies the student's own enrolment scope itself; a
      // student principal without a User id fails closed to an empty list.
      if (!ctx.userId) return emptyListReply(request, { titleKey: 'schedule.title', emptyKey: 'schedule.empty' });
      result = await this.schedule.findAll(ctx.organizationId, query, {
        role: 'STUDENT',
        id: ctx.userId,
      });
    } else if (ctx.isTeaching) {
      if (!ctx.teacherId) return emptyListReply(request, { titleKey: 'schedule.title', emptyKey: 'schedule.empty' });
      result = await this.schedule.findAll(ctx.organizationId, {
        ...query,
        teacherId: ctx.teacherId,
      });
    } else {
      result = await this.schedule.findAll(ctx.organizationId, query);
    }

    const pageResult = result as ListResult<ScheduleRow>;
    const lines = (pageResult.items ?? []).map((row) => this.renderRow(request, row));
    return listReply(request, {
      titleKey: 'schedule.title',
      lines,
      emptyKey: 'schedule.empty',
      pagination: {
        list: 'schedule',
        page: pageResult.page ?? page,
        totalPages: pageResult.totalPages ?? 1,
      },
    });
  }

  async renderForChild(
    request: TelegramRequestContext,
    child: ParentChild,
  ): Promise<TelegramReply> {
    // getChildSchedule re-verifies the parent→child link and the visibility
    // flag server-side; a manipulated index therefore yields "not found".
    const rows = (await this.parentPortal.getChildSchedule(
      { parentId: request.ctx.parentId as string, organizationId: request.ctx.organizationId },
      child.studentId,
    )) as ScheduleRow[];

    return {
      text: `${escapeHtml(request.tr('schedule.title'))} · ${escapeHtml(child.name)}\n\n${
        rows.length === 0
          ? escapeHtml(request.tr('schedule.empty'))
          : rows.map((row) => this.renderRow(request, row)).join('\n')
      }`,
      keyboard: childActionsKeyboard(
        { tr: request.tr, cb: request.cb },
        child.index,
      ),
    };
  }

  private renderRow(request: TelegramRequestContext, row: ScheduleRow): string {
    return scheduleLine(request, row);
  }
}

/** `/attendance` — own, child's, teacher's groups', or org-wide. */
@Injectable()
export class AttendanceCommand implements TelegramCommandHandler {
  readonly name = 'attendance';
  readonly descriptionKey = 'attendance.title';
  readonly roles = 'ALL' as const;
  readonly childActionCode = CallbackCodes.CHILD_ATTENDANCE;

  constructor(
    private readonly attendance: AttendanceService,
    private readonly parentPortal: ParentPortalService,
  ) {}

  async handle(request: TelegramRequestContext): Promise<TelegramReply> {
    const { ctx, page } = request;

    if (ctx.isParent) {
      return childPickerReply(request, this.parentPortal);
    }

    const query: Record<string, string> = { limit: PAGE_SIZE, page: String(page) };
    if (ctx.isStudent) {
      // Scope to the caller's OWN student row — fail closed when the row is
      // missing rather than falling through to the org-wide query.
      if (!ctx.studentId) return emptyListReply(request, { titleKey: 'attendance.title', emptyKey: 'attendance.empty' });
      query.studentId = ctx.studentId;
    } else if (ctx.isTeaching) {
      if (!ctx.teacherId) return emptyListReply(request, { titleKey: 'attendance.title', emptyKey: 'attendance.empty' });
      query.teacherId = ctx.teacherId;
    }

    const result = (await this.attendance.findAll(
      ctx.organizationId,
      query,
    )) as ListResult<AttendanceRow>;

    const lines = (result.items ?? []).map((row) => attendanceLine(request, row));
    return listReply(request, {
      titleKey: 'attendance.title',
      lines,
      emptyKey: 'attendance.empty',
      pagination: {
        list: 'attendance',
        page: result.page ?? page,
        totalPages: result.totalPages ?? 1,
      },
    });
  }

  async renderForChild(
    request: TelegramRequestContext,
    child: ParentChild,
  ): Promise<TelegramReply> {
    const rows = (await this.parentPortal.getChildAttendance(
      { parentId: request.ctx.parentId as string, organizationId: request.ctx.organizationId },
      child.studentId,
    )) as AttendanceRow[];

    return {
      text: `${escapeHtml(request.tr('attendance.title'))} · ${escapeHtml(child.name)}\n\n${
        rows.length === 0
          ? escapeHtml(request.tr('attendance.empty'))
          : rows.slice(0, 10).map((row) => attendanceLine(request, row)).join('\n')
      }`,
      keyboard: childActionsKeyboard(
        { tr: request.tr, cb: request.cb },
        child.index,
      ),
    };
  }
}

/**
 * Guards against a linked account whose role expects a resource row that does
 * not exist (e.g. a STUDENT User without a matching Student record).
 *
 * Fail-closed: such an account gets its own (empty) view, never the
 * organization-wide list — a missing row must not widen access.
 */
function emptyListReply(
  request: TelegramRequestContext,
  options: { titleKey: string; emptyKey: string },
): TelegramReply {
  return listReply(request, {
    titleKey: options.titleKey,
    lines: [],
    emptyKey: options.emptyKey,
  });
}

/**
 * `/payments` — financial data.
 *
 * Teaching roles are excluded from the role list, so a teacher can never reach
 * payment data through Telegram even though they can read attendance.
 */
@Injectable()
export class PaymentsCommand implements TelegramCommandHandler {
  readonly name = 'payments';
  readonly descriptionKey = 'payments.title';
  readonly roles = [...ADMIN_ROLES, 'STUDENT', 'PARENT'] as const;
  readonly childActionCode = CallbackCodes.CHILD_PAYMENTS;

  constructor(
    private readonly payments: PaymentsService,
    private readonly parentPortal: ParentPortalService,
  ) {}

  async handle(request: TelegramRequestContext): Promise<TelegramReply> {
    const { ctx, page } = request;

    if (ctx.isParent) {
      return childPickerReply(request, this.parentPortal);
    }

    const query: Record<string, string> = { limit: PAGE_SIZE, page: String(page) };
    if (ctx.isStudent) {
      if (!ctx.studentId) return emptyListReply(request, { titleKey: 'payments.title', emptyKey: 'payments.empty' });
      query.studentId = ctx.studentId;
    }

    const result = (await this.payments.findAll(
      ctx.organizationId,
      query,
    )) as ListResult<PaymentRow>;

    const lines = (result.items ?? []).map((row) =>
      request.tr('payments.line', {
        date: formatDate(row.createdAt),
        amount: escapeHtml(formatMoney(row.amount)),
        status: escapeHtml(row.status),
      }),
    );

    return listReply(request, {
      titleKey: 'payments.title',
      lines,
      emptyKey: 'payments.empty',
      pagination: {
        list: 'payments',
        page: result.page ?? page,
        totalPages: result.totalPages ?? 1,
      },
    });
  }

  async renderForChild(
    request: TelegramRequestContext,
    child: ParentChild,
  ): Promise<TelegramReply> {
    const data = (await this.parentPortal.getChildInvoices(
      { parentId: request.ctx.parentId as string, organizationId: request.ctx.organizationId },
      child.studentId,
    )) as {
      invoices: Array<{ number?: string | null; status: string; total: unknown }>;
      outstanding: number;
    };

    const lines = (data.invoices ?? [])
      .slice(0, 10)
      .map((invoice) =>
        request.tr('payments.line', {
          date: escapeHtml(invoice.number ?? '—'),
          amount: escapeHtml(formatMoney(invoice.total)),
          status: escapeHtml(invoice.status),
        }),
      );

    return {
      text: [
        `${escapeHtml(request.tr('payments.title'))} · ${escapeHtml(child.name)}`,
        '',
        lines.length > 0 ? lines.join('\n') : escapeHtml(request.tr('payments.empty')),
        '',
        request.tr('payments.balance', { balance: escapeHtml(formatMoney(data.outstanding)) }),
      ].join('\n'),
      keyboard: childActionsKeyboard(
        { tr: request.tr, cb: request.cb },
        child.index,
      ),
    };
  }
}

/**
 * `/notifications` — the caller's own in-app notifications.
 *
 * Scoping rules that make this safe:
 *   - the query is keyed by `ctx.userId`, the id resolved from the chat's own
 *     link — `callback_data`/command text can never name another user,
 *   - pagination goes through the same signed, chat-bound PAGE callback as
 *     every other list, and the list name is whitelisted server-side,
 *   - titles are HTML-escaped before interpolation,
 *   - no internal ids, no raw payloads: only date, read state and title.
 *
 * Telegram is a READ surface here — the web app remains the source of truth.
 */
@Injectable()
export class NotificationsCommand implements TelegramCommandHandler {
  readonly name = 'notifications';
  readonly descriptionKey = 'notifications.title';
  readonly roles = 'ALL' as const;

  constructor(private readonly notifications: NotificationsService) {}

  async handle(request: TelegramRequestContext): Promise<TelegramReply> {
    const { ctx, page, tr } = request;

    // Notifications are User-scoped; ParentAccount has no User row, so the
    // honest answer is "no notifications", never another principal's list.
    if (ctx.kind === 'PARENT_ACCOUNT' || !ctx.userId) {
      return { text: tr('notifications.empty') };
    }

    const result = (await this.notifications.findAll(ctx.userId, {
      limit: PAGE_SIZE,
      page: String(page),
    })) as ListResult<NotificationRow> & { unread: number };

    const header = escapeHtml(tr('notifications.title'));
    const lines = (result.items ?? []).map((row) => {
      const marker = row.isRead ? '✅' : '🔔';
      return `${marker} ${tr('notifications.line', {
        date: formatDate(row.createdAt),
        title: escapeHtml(row.title),
      })}`;
    });

    if (lines.length === 0) {
      return {
        text: `${header}\n\n${escapeHtml(tr('notifications.empty'))}`,
        keyboard: backKeyboard({ tr, cb: request.cb }),
      };
    }

    const totalPages = result.totalPages ?? 1;
    const currentPage = result.page ?? page;
    const text = [
      header,
      tr('notifications.unread', { count: result.unread ?? 0 }),
      ...(totalPages > 1
        ? [escapeHtml(tr('common.page', { page: currentPage, total: totalPages }))]
        : []),
      '',
      ...lines,
    ].join('\n');

    return {
      text,
      keyboard:
        totalPages > 1
          ? paginationKeyboard(
              { tr, cb: request.cb },
              'notifications',
              currentPage,
              totalPages,
            )
          : backKeyboard({ tr, cb: request.cb }),
    };
  }
}

interface ScheduleRow {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  room?: string | null;
  group?: { name?: string | null } | null;
}

interface AttendanceRow {
  date: unknown;
  status: string;
  group?: { name?: string | null } | null;
}

interface PaymentRow {
  createdAt: unknown;
  amount: unknown;
  status: string;
}

interface NotificationRow {
  createdAt: unknown;
  title: string;
  isRead: boolean;
}
