import {
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DayOfWeek } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

const DOW_TO_ICS: Record<DayOfWeek, string> = {
  [DayOfWeek.MONDAY]: 'MO',
  [DayOfWeek.TUESDAY]: 'TU',
  [DayOfWeek.WEDNESDAY]: 'WE',
  [DayOfWeek.THURSDAY]: 'TH',
  [DayOfWeek.FRIDAY]: 'FR',
  [DayOfWeek.SATURDAY]: 'SA',
  [DayOfWeek.SUNDAY]: 'SU',
};

const DOW_TO_NUMBER: Record<DayOfWeek, number> = {
  [DayOfWeek.MONDAY]: 1,
  [DayOfWeek.TUESDAY]: 2,
  [DayOfWeek.WEDNESDAY]: 3,
  [DayOfWeek.THURSDAY]: 4,
  [DayOfWeek.FRIDAY]: 5,
  [DayOfWeek.SATURDAY]: 6,
  [DayOfWeek.SUNDAY]: 7,
};

export interface IcsScheduleItem {
  id: string;
  dayOfWeek?: DayOfWeek | string | null;
  startTime?: string | null;
  endTime?: string | null;
  room?: string | null;
  group?: {
    name?: string | null;
    course?: { name?: string | null } | null;
    teacher?: {
      user?: { firstName?: string | null; lastName?: string | null } | null;
    } | null;
  } | null;
}

@Injectable()
export class TelegramCalendarService {
  private readonly logger = new Logger(TelegramCalendarService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly configService?: ConfigService,
  ) {}

  private getSecret(): string {
    const secret =
      this.configService?.get<string>('TELEGRAM_CALENDAR_SECRET') ||
      this.configService?.get<string>('JWT_SECRET') ||
      process.env.TELEGRAM_CALENDAR_SECRET ||
      process.env.JWT_SECRET;

    if (!secret || secret.trim() === '') {
      this.logger.error('Calendar feed secret is not configured (missing TELEGRAM_CALENDAR_SECRET / JWT_SECRET)');
      throw new UnauthorizedException('Calendar service is not configured (missing secret)');
    }
    return secret.trim();
  }

  isConfigured(): boolean {
    const secret =
      this.configService?.get<string>('TELEGRAM_CALENDAR_SECRET') ||
      this.configService?.get<string>('JWT_SECRET') ||
      process.env.TELEGRAM_CALENDAR_SECRET ||
      process.env.JWT_SECRET;
    return Boolean(secret && secret.trim().length > 0);
  }

  generateHmacSignature(userId: string): string {
    return createHmac('sha256', this.getSecret())
      .update(`medu_cal_feed_${userId}`)
      .digest('hex')
      .slice(0, 32);
  }

  /**
   * Generates a cryptographically secure stateless HMAC subscription token for calendar feed.
   * Format: <userId>.<hmacSignature>
   * Tamper-proof, zero full-table scans, O(1) indexed lookup, stateless across multi-pod deployments.
   */
  async getOrCreateCalendarToken(userId: string): Promise<string> {
    this.getSecret(); // Ensure service is properly configured before querying DB

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const sig = this.generateHmacSignature(user.id);
    return `${user.id}.${sig}`;
  }

  /**
   * Generates an RFC 5545 iCalendar (.ics) string for a student or teacher.
   */
  async generateIcsFeed(token: string): Promise<string> {
    this.getSecret(); // Ensure service is configured with a valid secret

    const cleanToken = (token || '').trim();
    if (!cleanToken) {
      throw new UnauthorizedException('Missing calendar feed token');
    }

    let targetUserId: string | null = null;

    // Stateless signed token format: <userId>.<hmacSignature>
    if (cleanToken.includes('.')) {
      const dotIndex = cleanToken.lastIndexOf('.');
      const userId = cleanToken.slice(0, dotIndex);
      const sig = cleanToken.slice(dotIndex + 1);

      if (userId && sig) {
        const expectedSig = this.generateHmacSignature(userId);
        if (
          sig.length === expectedSig.length &&
          timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))
        ) {
          targetUserId = userId;
        } else {
          throw new UnauthorizedException('Invalid or forged calendar feed token');
        }
      }
    }

    // Crucial: Reject immediately if not verified by stateless HMAC.
    // NEVER perform a full-table scan across all users in the database (DoS prevention).
    if (!targetUserId) {
      throw new UnauthorizedException('Invalid or expired calendar feed token');
    }

    const targetUser = await this.prisma.user.findFirst({
      where: { id: targetUserId, isActive: true },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        organizationId: true,
      },
    });

    if (!targetUser) {
      throw new UnauthorizedException('User not found or inactive');
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: targetUser.organizationId },
      select: { name: true, timezone: true },
    });

    const tz = org?.timezone || 'Asia/Tashkent';
    const orgName = org?.name || 'M-EDU Education';

    // Fetch schedules based on user role
    let schedules: IcsScheduleItem[] = [];

    if (targetUser.role === 'TEACHER') {
      const teacher = await this.prisma.teacher.findFirst({
        where: { userId: targetUser.id },
      });
      if (teacher) {
        schedules = await this.prisma.schedule.findMany({
          where: {
            isActive: true,
            group: {
              teacherId: teacher.id,
              isActive: true,
            },
          },
          include: {
            group: {
              include: {
                course: true,
                teacher: {
                  include: { user: true },
                },
              },
            },
          },
        });
      }
    } else {
      // Find groups where student is enrolled
      const student = await this.prisma.student.findUnique({
        where: { userId: targetUser.id },
      });

      if (student) {
        const studentGroups = await this.prisma.studentGroup.findMany({
          where: { studentId: student.id, isActive: true },
          select: { groupId: true },
        });
        const groupIds = studentGroups.map((e) => e.groupId);

        schedules = await this.prisma.schedule.findMany({
          where: {
            groupId: { in: groupIds },
            isActive: true,
          },
          include: {
            group: {
              include: {
                course: true,
                teacher: {
                  include: { user: true },
                },
              },
            },
          },
        });
      }
    }

    return this.buildIcsDocument({
      user: targetUser,
      schedules,
      orgName,
      timezone: tz,
    });
  }

  private buildIcsDocument(params: {
    user: unknown;
    schedules: IcsScheduleItem[];
    orgName: string;
    timezone: string;
  }): string {
    const { schedules, orgName, timezone } = params;
    const now = new Date();
    const dtstamp = this.formatIcsDateTime(now);

    const lines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//M-EDU//Academic Calendar v2.0//UZ',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${this.escapeIcs(`${orgName} — Dars Jadvali`)}`,
      `X-WR-TIMEZONE:${timezone}`,
      'X-PUBLISHED-TTL:PT1H',
    ];

    for (const s of schedules) {
      const subject = s.group?.course?.name || s.group?.name || 'Dars';
      const roomName = s.room || 'Asosiy xona';
      const teacherName = s.group?.teacher?.user
        ? `${s.group.teacher.user.firstName} ${s.group.teacher.user.lastName}`
        : '';
      const dayCode = (s.dayOfWeek && DOW_TO_ICS[s.dayOfWeek as DayOfWeek]) || 'MO';

      // Base date calculated for next matching weekday
      const startTimeParts = (s.startTime || '09:00').split(':').map(Number);
      const endTimeParts = (s.endTime || '10:30').split(':').map(Number);

      const baseDate = new Date();
      const currentDay = baseDate.getDay() || 7;
      const targetDay = (s.dayOfWeek && DOW_TO_NUMBER[s.dayOfWeek as DayOfWeek]) || 1;
      const diff = (targetDay - currentDay + 7) % 7;
      baseDate.setDate(baseDate.getDate() + diff);
      baseDate.setHours(startTimeParts[0] || 9, startTimeParts[1] || 0, 0, 0);

      const endDate = new Date(baseDate);
      endDate.setHours(endTimeParts[0] || 10, endTimeParts[1] || 30, 0, 0);

      const dtstart = this.formatIcsDateTime(baseDate);
      const dtend = this.formatIcsDateTime(endDate);
      const uid = `medu-sched-${s.id}@medu.uz`;

      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${uid}`);
      lines.push(`DTSTAMP:${dtstamp}`);
      lines.push(`DTSTART;TZID=${timezone}:${dtstart}`);
      lines.push(`DTEND;TZID=${timezone}:${dtend}`);
      lines.push(`RRULE:FREQ=WEEKLY;BYDAY=${dayCode}`);
      lines.push(`SUMMARY:${this.escapeIcs(`${subject} (${s.group?.name || ''})`)}`);
      lines.push(`LOCATION:${this.escapeIcs(roomName)}`);
      lines.push(
        `DESCRIPTION:${this.escapeIcs(`Dars: ${subject}\\nXona: ${roomName}${teacherName ? `\\nO'qituvchi: ${teacherName}` : ''}\\nPlatforma: M-EDU`)}`,
      );
      lines.push('STATUS:CONFIRMED');

      // 15-minute advance alarm notification on phone
      lines.push('BEGIN:VALARM');
      lines.push('TRIGGER:-PT15M');
      lines.push('ACTION:DISPLAY');
      lines.push(`DESCRIPTION:${this.escapeIcs(`Dars 15 daqiqadan so'ng boshlanadi: ${subject}`)}`);
      lines.push('END:VALARM');

      lines.push('END:VEVENT');
    }

    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }

  private formatIcsDateTime(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return (
      date.getFullYear() +
      pad(date.getMonth() + 1) +
      pad(date.getDate()) +
      'T' +
      pad(date.getHours()) +
      pad(date.getMinutes()) +
      pad(date.getSeconds())
    );
  }

  private escapeIcs(str: string): string {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');
  }
}
