import { DayOfWeek } from '@prisma/client';
import { ParentPortalService } from '../../parent-portal/parent-portal.service';
import { TelegramRequestContext } from './command.interface';
import { TelegramReply } from '../ui/telegram-ui.types';
import { CallbackCodes, childrenKeyboard, paginationKeyboard } from '../ui/keyboards';
import { escapeHtml, formatDate } from '../ui/format';
import { TelegramContext, TelegramContextFailure } from '../telegram-context.service';
import { TelegramCallbackService } from '../telegram-callback.service';
import { TelegramLanguage, t } from '../i18n/telegram-i18n';

/** A parent's child as returned by the parent portal (already authorized). */
export interface ParentChild {
  /** Position in the caller's own, deterministically ordered children list. */
  index: number;
  studentId: string;
  name: string;
  relationship: string;
  permissions: { grades: boolean; payments: boolean; attendance: boolean };
}

/**
 * Resolve the caller's children.
 *
 * The ONLY source of parent→child authorization is `ParentPortalService`,
 * which double-scopes by parent id AND organization. A child that is not
 * currently linked simply does not appear — so a removed relationship is
 * reflected on the very next interaction.
 */
export async function resolveChildren(
  parentPortal: ParentPortalService,
  ctx: TelegramContext,
): Promise<ParentChild[]> {
  if (ctx.kind !== 'PARENT_ACCOUNT' || !ctx.parentId) return [];
  const children = (await parentPortal.listChildren({
    parentId: ctx.parentId,
    organizationId: ctx.organizationId,
  })) as Array<Omit<ParentChild, 'index'>>;
  return children.map((child, index) => ({ ...child, index }));
}

/**
 * Resolve a child by its position in the caller's own children list.
 *
 * Telegram callbacks carry an INDEX, never a student id, so an attacker cannot
 * substitute a foreign student: the index is re-resolved against the caller's
 * freshly-authorized list on every press. An out-of-range index yields null.
 */
export async function resolveChildByIndex(
  parentPortal: ParentPortalService,
  ctx: TelegramContext,
  index: number,
): Promise<ParentChild | null> {
  if (!Number.isInteger(index) || index < 0) return null;
  const children = await resolveChildren(parentPortal, ctx);
  return children[index] ?? null;
}

/** `Select a child` reply with one button per child. */
export async function childPickerReply(
  request: TelegramRequestContext,
  parentPortal: ParentPortalService,
): Promise<TelegramReply> {
  const { ctx, tr } = request;
  const children = await resolveChildren(parentPortal, ctx);
  if (children.length === 0) {
    return { text: tr('children.empty') };
  }
  return {
    text: `${escapeHtml(tr('children.title'))}\n${escapeHtml(tr('children.select'))}`,
    keyboard: childrenKeyboard(
      { tr, cb: request.cb },
      children.map((child) => ({
        label: `${escapeHtml(child.name)}`,
      })),
    ),
  };
}

/** A title + lines reply, with pagination + menu controls when needed. */
export function listReply(
  request: TelegramRequestContext,
  options: {
    titleKey: string;
    lines: string[];
    emptyKey: string;
    /** When set, enables pagination controls for this list. */
    pagination?: { list: string; page: number; totalPages: number };
  },
): TelegramReply {
  const { tr } = request;
  const header = escapeHtml(tr(options.titleKey));

  if (options.lines.length === 0) {
    return {
      text: `${header}\n\n${escapeHtml(tr(options.emptyKey))}`,
      keyboard: paginationKeyboardIfNeeded(request, options.pagination),
    };
  }

  const body =
    options.pagination && options.pagination.totalPages > 1
      ? `${header}\n${escapeHtml(
          tr('common.page', {
            page: options.pagination.page,
            total: options.pagination.totalPages,
          }),
        )}\n\n${options.lines.join('\n')}`
      : `${header}\n\n${options.lines.join('\n')}`;

  return { text: body, keyboard: paginationKeyboardIfNeeded(request, options.pagination) };
}

function paginationKeyboardIfNeeded(
  request: TelegramRequestContext,
  pagination?: { list: string; page: number; totalPages: number },
) {
  if (!pagination) {
    return { inline_keyboard: [[menuButton(request)]] };
  }
  return paginationKeyboard(
    { tr: request.tr, cb: request.cb },
    pagination.list,
    pagination.page,
    pagination.totalPages,
  );
}

function menuButton(request: TelegramRequestContext) {
  return { text: request.tr('btn.menu'), callback_data: request.cb(CallbackCodes.MAIN_MENU) };
}

/**
 * Build the request object handed to handlers.
 *
 * Centralised so both routers construct identical contexts: translator bound
 * to the resolved language, callback encoder bound to this chat, and only the
 * resolved context as the source of identity.
 */
export function buildRequest(params: {
  chatId: string;
  ctx: TelegramContext;
  callbacks: TelegramCallbackService;
  args?: string;
  page?: number;
  language?: TelegramLanguage;
}): TelegramRequestContext {
  const language = params.language ?? params.ctx.language;
  return {
    chatId: params.chatId,
    ctx: params.ctx,
    language,
    tr: (key, values) => t(language, key, values),
    cb: (code, arg) => params.callbacks.encode(code, arg ?? null, params.chatId),
    args: params.args ?? '',
    page: params.page ?? 1,
  };
}

/** Map a context-resolution failure to a localized, non-leaking message key. */
export function errorKeyForContextFailure(code: TelegramContextFailure): string {
  switch (code) {
    case 'DISCONNECTED':
      return 'error.disconnected';
    case 'BLOCKED':
      return 'error.blocked';
    case 'SUSPENDED':
      return 'error.suspended';
    case 'INACTIVE':
    case 'TENANT_MISMATCH':
      return 'error.unauthorized';
    case 'NOT_LINKED':
    default:
      return 'error.notLinked';
  }
}

/** One-line summary of a schedule entry. */
export function scheduleLine(
  request: TelegramRequestContext,
  row: {
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    room?: string | null;
    group?: { name?: string | null } | null;
  },
): string {
  const room = row.room ? ` · ${escapeHtml(row.room)}` : '';
  return escapeHtml(
    request.tr('schedule.line', {
      day: request.tr(`day.${row.dayOfWeek}`),
      start: row.startTime,
      end: row.endTime,
      group: escapeHtml(row.group?.name ?? ''),
      room,
    }),
  );
}

/** One-line summary of an attendance record. */
export function attendanceLine(
  request: TelegramRequestContext,
  row: { date: unknown; status: string; group?: { name?: string | null } | null },
): string {
  // Escape each dynamic value, then interpolate into the TRUSTED template.
  // Escaping the rendered template instead would double-escape these values.
  const group = row.group?.name ? ` · ${escapeHtml(row.group.name)}` : '';
  return request.tr('attendance.line', {
    date: formatDate(row.date),
    status: escapeHtml(row.status),
    group,
  });
}

/**
 * Resolves the uppercase DayOfWeek in the specified timezone (default Asia/Tashkent).
 * Ensures UTC midnight boundary drift does not cause yesterday's or tomorrow's
 * schedule to be served to users.
 */
export function getWeekdayInTimezone(
  date: Date = new Date(),
  timeZone = 'Asia/Tashkent',
): DayOfWeek {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'long',
    });
    const weekday = formatter.format(date).toUpperCase();
    return (DayOfWeek as any)[weekday] ?? DayOfWeek.MONDAY;
  } catch {
    const dowMap = [
      DayOfWeek.SUNDAY,
      DayOfWeek.MONDAY,
      DayOfWeek.TUESDAY,
      DayOfWeek.WEDNESDAY,
      DayOfWeek.THURSDAY,
      DayOfWeek.FRIDAY,
      DayOfWeek.SATURDAY,
    ];
    return dowMap[date.getDay()] ?? DayOfWeek.MONDAY;
  }
}
