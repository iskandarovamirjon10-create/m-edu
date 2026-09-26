import { Injectable } from '@nestjs/common';
import { ADMIN_ROLES, TEACHING_ROLES } from '../../auth/authorization.policy';
import { StudentsService } from '../../students/students.service';
import { TeachersService } from '../../teachers/teachers.service';
import { GroupsService } from '../../groups/groups.service';
import { ScheduleService } from '../../schedule/schedule.service';
import { TelegramCommandHandler, TelegramRequestContext } from './command.interface';
import { listReply, scheduleLine } from './command-helpers';
import { adminMenuKeyboard, mainMenuKeyboard } from '../ui/keyboards';
import { escapeHtml } from '../ui/format';
import { TelegramReply } from '../ui/telegram-ui.types';

const PAGE_SIZE = '6';

const WEEKDAYS = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
] as const;

interface ListResult<T> {
  items: T[];
  totalPages: number;
  page: number;
}

/** `/admin` — safe admin entry point. Only service-backed actions are shown. */
@Injectable()
export class AdminCommand implements TelegramCommandHandler {
  readonly name = 'admin';
  readonly descriptionKey = 'menu.admin.title';
  readonly roles = ADMIN_ROLES;

  async handle(request: TelegramRequestContext): Promise<TelegramReply> {
    return {
      text: escapeHtml(request.tr('menu.admin.title')),
      keyboard: adminMenuKeyboard({ tr: request.tr, cb: request.cb }),
    };
  }
}

/** `/teacher` — teacher entry point (teaching roles only). */
@Injectable()
export class TeacherCommand implements TelegramCommandHandler {
  readonly name = 'teacher';
  readonly descriptionKey = 'menu.teacher.title';
  readonly roles = TEACHING_ROLES;

  async handle(request: TelegramRequestContext): Promise<TelegramReply> {
    const { ctx, tr } = request;
    return {
      text: `${escapeHtml(tr('menu.teacher.title'))}\n\n${tr('menu.subtitle', {
        name: escapeHtml(ctx.displayName),
      })}`,
      keyboard: mainMenuKeyboard(
        { tr, cb: request.cb },
        { isAdmin: ctx.isAdmin, isTeaching: true, isStudent: false, isParent: false },
      ),
    };
  }
}

/**
 * `/students` — paginated roster.
 *
 * A teacher only ever sees the students of their OWN groups: the scoping id
 * comes from the verified context (`ctx.teacherId`), never from the command
 * text. Admins see the organization roster, still tenant-scoped.
 */
@Injectable()
export class StudentsCommand implements TelegramCommandHandler {
  readonly name = 'students';
  readonly descriptionKey = 'btn.students';
  readonly roles = [...ADMIN_ROLES, ...TEACHING_ROLES];

  constructor(private readonly students: StudentsService) {}

  async handle(request: TelegramRequestContext): Promise<TelegramReply> {
    const { ctx, page } = request;
    const query: Record<string, string> = { limit: PAGE_SIZE, page: String(page) };
    if (ctx.isTeaching && ctx.teacherId) {
      query.teacherId = ctx.teacherId;
    }

    const result = (await this.students.findAll(
      ctx.organizationId,
      query,
    )) as ListResult<StudentRow>;

    const lines = (result.items ?? []).map((row) => {
      const name = `${row.user?.firstName ?? ''} ${row.user?.lastName ?? ''}`.trim() || '—';
      const groupNames = (row.groups ?? [])
        .map((g) => g.group?.name)
        .filter(Boolean)
        .join(', ');
      return groupNames ? `• ${escapeHtml(name)} · ${escapeHtml(groupNames)}` : `• ${escapeHtml(name)}`;
    });

    return listReply(request, {
      titleKey: 'btn.students',
      lines,
      emptyKey: 'error.not_found',
      pagination: {
        list: 'students',
        page: result.page ?? page,
        totalPages: result.totalPages ?? 1,
      },
    });
  }
}

/** `/teachers` — paginated staff roster (admins only). */
@Injectable()
export class TeachersCommand implements TelegramCommandHandler {
  readonly name = 'teachers';
  readonly descriptionKey = 'btn.teachers';
  readonly roles = ADMIN_ROLES;

  constructor(private readonly teachers: TeachersService) {}

  async handle(request: TelegramRequestContext): Promise<TelegramReply> {
    const { ctx, page } = request;
    const result = (await this.teachers.findAll(ctx.organizationId, {
      limit: PAGE_SIZE,
      page: String(page),
    })) as ListResult<TeacherRow>;

    const lines = (result.items ?? []).map((row) => {
      const name = `${row.user?.firstName ?? ''} ${row.user?.lastName ?? ''}`.trim() || '—';
      return `• ${escapeHtml(name)}`;
    });

    return listReply(request, {
      titleKey: 'btn.teachers',
      lines,
      emptyKey: 'error.not_found',
      pagination: {
        list: 'teachers',
        page: result.page ?? page,
        totalPages: result.totalPages ?? 1,
      },
    });
  }
}

/** `/groups` — a teacher's own groups, or the organization's for admins. */
@Injectable()
export class GroupsCommand implements TelegramCommandHandler {
  readonly name = 'groups';
  readonly descriptionKey = 'btn.groups';
  readonly roles = [...ADMIN_ROLES, ...TEACHING_ROLES];

  constructor(private readonly groups: GroupsService) {}

  async handle(request: TelegramRequestContext): Promise<TelegramReply> {
    const { ctx, page } = request;
    const query: Record<string, string> = { limit: PAGE_SIZE, page: String(page) };
    if (ctx.isTeaching && ctx.teacherId) {
      query.teacherId = ctx.teacherId;
    }

    const result = (await this.groups.findAll(
      ctx.organizationId,
      query,
    )) as ListResult<GroupRow>;

    const lines = (result.items ?? []).map((row) => {
      const students = row._count?.enrollments ?? 0;
      return `• ${escapeHtml(row.name)} · ${students}`;
    });

    return listReply(request, {
      titleKey: 'btn.groups',
      lines,
      emptyKey: 'error.not_found',
      pagination: {
        list: 'groups',
        page: result.page ?? page,
        totalPages: result.totalPages ?? 1,
      },
    });
  }
}

/** `/today` — lessons for the current weekday (teacher's groups, or org-wide). */
@Injectable()
export class TodayCommand implements TelegramCommandHandler {
  readonly name = 'today';
  readonly descriptionKey = 'btn.today';
  readonly roles = [...ADMIN_ROLES, ...TEACHING_ROLES];

  constructor(private readonly schedule: ScheduleService) {}

  async handle(request: TelegramRequestContext): Promise<TelegramReply> {
    const { ctx } = request;
    const dayOfWeek = WEEKDAYS[new Date().getUTCDay()];

    const query: Record<string, string> = { dayOfWeek, limit: '10' };
    if (ctx.isTeaching && ctx.teacherId) {
      query.teacherId = ctx.teacherId;
    }

    const result = (await this.schedule.findAll(
      ctx.organizationId,
      query,
    )) as ListResult<ScheduleRow>;

    const lines = (result.items ?? []).map((row) => scheduleLine(request, row));
    return listReply(request, {
      titleKey: 'btn.today',
      lines,
      emptyKey: 'schedule.empty',
    });
  }
}

interface StudentRow {
  user?: { firstName?: string | null; lastName?: string | null } | null;
  groups?: Array<{ group?: { name?: string | null } | null }>;
}

interface TeacherRow {
  user?: { firstName?: string | null; lastName?: string | null } | null;
}

interface GroupRow {
  name: string;
  _count?: { enrollments?: number };
}

interface ScheduleRow {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  room?: string | null;
  group?: { name?: string | null } | null;
}
