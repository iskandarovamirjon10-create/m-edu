import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramCalendarService } from '../telegram-calendar.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('TelegramCalendarService', () => {
  let prisma: {
    user: {
      findUnique: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    };
    organization: {
      findUnique: ReturnType<typeof vi.fn>;
    };
    teacher: {
      findFirst: ReturnType<typeof vi.fn>;
    };
    student: {
      findUnique: ReturnType<typeof vi.fn>;
    };
    studentGroup: {
      findMany: ReturnType<typeof vi.fn>;
    };
    schedule: {
      findMany: ReturnType<typeof vi.fn>;
    };
  };
  let configService: {
    get: ReturnType<typeof vi.fn>;
  };
  let service: TelegramCalendarService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = {
      user: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      organization: {
        findUnique: vi.fn(),
      },
      teacher: {
        findFirst: vi.fn(),
      },
      student: {
        findUnique: vi.fn(),
      },
      studentGroup: {
        findMany: vi.fn(),
      },
      schedule: {
        findMany: vi.fn(),
      },
    };

    configService = {
      get: vi.fn((key: string) => {
        if (key === 'JWT_SECRET' || key === 'TELEGRAM_CALENDAR_SECRET') {
          return 'test-calendar-secret-key-32-chars!!';
        }
        return null;
      }),
    };

    service = new TelegramCalendarService(
      prisma as unknown as PrismaService,
      configService as unknown as ConfigService,
    );
  });

  describe('Secret configuration & Fallback elimination (SEC-TG-01)', () => {
    it('throws UnauthorizedException when secret is not configured at all', async () => {
      const unconfiguredConfig = { get: vi.fn(() => null) };
      const unconfiguredService = new TelegramCalendarService(
        prisma as unknown as PrismaService,
        unconfiguredConfig as unknown as ConfigService,
      );

      // Temporarily ensure process.env has no JWT_SECRET fallback
      const origJwt = process.env.JWT_SECRET;
      const origTgCal = process.env.TELEGRAM_CALENDAR_SECRET;
      delete process.env.JWT_SECRET;
      delete process.env.TELEGRAM_CALENDAR_SECRET;

      try {
        expect(unconfiguredService.isConfigured()).toBe(false);
        await expect(unconfiguredService.getOrCreateCalendarToken('usr-123')).rejects.toThrow(
          UnauthorizedException,
        );
        await expect(unconfiguredService.generateIcsFeed('usr-123.sig')).rejects.toThrow(
          UnauthorizedException,
        );
      } finally {
        if (origJwt) process.env.JWT_SECRET = origJwt;
        if (origTgCal) process.env.TELEGRAM_CALENDAR_SECRET = origTgCal;
      }
    });

    it('reports isConfigured() as true when secret is provided', () => {
      expect(service.isConfigured()).toBe(true);
    });
  });

  describe('getOrCreateCalendarToken', () => {
    it('throws NotFoundException if user is not in database', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.getOrCreateCalendarToken('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns cryptographically signed HMAC token for user', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'usr-123',
        email: 'student@medu.uz',
      });

      const token = await service.getOrCreateCalendarToken('usr-123');
      expect(token).toContain('usr-123.');
      const [userId, sig] = token.split('.');
      expect(userId).toBe('usr-123');
      expect(sig.length).toBe(32);
    });
  });

  describe('generateIcsFeed', () => {
    it('throws UnauthorizedException and prevents full table scan on wrong token', async () => {
      await expect(service.generateIcsFeed('wrong-token')).rejects.toThrow(
        UnauthorizedException,
      );
      // Verify that full-table user scanning is completely eliminated (DoS defense)
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });

    it('rejects forged HMAC token signatures without database access', async () => {
      await expect(service.generateIcsFeed('usr-123.forgedsignature1234567890123456')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prisma.user.findFirst).not.toHaveBeenCalled();
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });

    it('verifies token created on Instance A on a fresh Instance B without shared in-memory cache', async () => {
      const studentUser = {
        id: 'usr-student-stateless',
        email: 'stateless@medu.uz',
        firstName: 'Farrux',
        lastName: 'Zokirov',
        role: 'STUDENT',
        organizationId: 'org-1',
        isActive: true,
      };

      prisma.user.findUnique.mockResolvedValue(studentUser);
      // Instance A creates token
      const tokenFromInstanceA = await service.getOrCreateCalendarToken('usr-student-stateless');

      // Instance B is a completely separate instance with same config secret but zero shared memory
      const instanceB = new TelegramCalendarService(
        prisma as unknown as PrismaService,
        configService as unknown as ConfigService,
      );

      prisma.user.findFirst.mockResolvedValue(studentUser);
      prisma.organization.findUnique.mockResolvedValue({
        name: 'Test Academy',
        timezone: 'Asia/Tashkent',
      });
      prisma.student.findUnique.mockResolvedValue({ id: 's-1', userId: 'usr-student-stateless' });
      prisma.studentGroup.findMany.mockResolvedValue([]);
      prisma.schedule.findMany.mockResolvedValue([]);

      const ics = await instanceB.generateIcsFeed(tokenFromInstanceA);
      expect(ics).toContain('BEGIN:VCALENDAR');
      expect(ics).toContain('Test Academy');
    });

    it('generates valid RFC 5545 iCalendar feed with alarms for Teacher', async () => {
      const teacherUser = {
        id: 'usr-teacher',
        email: 'teacher@medu.uz',
        firstName: 'Farhod',
        lastName: 'Rahmatov',
        role: 'TEACHER',
        organizationId: 'org-1',
        isActive: true,
      };

      prisma.user.findUnique.mockResolvedValue(teacherUser);
      const validToken = await service.getOrCreateCalendarToken('usr-teacher');

      prisma.user.findFirst.mockResolvedValue(teacherUser);
      prisma.organization.findUnique.mockResolvedValue({
        name: 'Registon Academy',
        timezone: 'Asia/Tashkent',
      });
      prisma.teacher.findFirst.mockResolvedValue({ id: 'teacher-db-1', userId: 'usr-teacher' });
      prisma.schedule.findMany.mockResolvedValue([
        {
          id: 'sched-1',
          dayOfWeek: 'MONDAY',
          startTime: '09:00',
          endTime: '10:30',
          room: 'Room 101',
          group: {
            name: 'Group-A',
            course: { name: 'IELTS Advanced' },
            teacher: {
              user: { firstName: 'Farhod', lastName: 'Rahmatov' },
            },
          },
        },
      ]);

      const ics = await service.generateIcsFeed(validToken);

      expect(ics).toContain('BEGIN:VCALENDAR');
      expect(ics).toContain('VERSION:2.0');
      expect(ics).toContain('X-WR-CALNAME:Registon Academy — Dars Jadvali');
      expect(ics).toContain('X-WR-TIMEZONE:Asia/Tashkent');
      expect(ics).toContain('BEGIN:VEVENT');
      expect(ics).toContain('SUMMARY:IELTS Advanced (Group-A)');
      expect(ics).toContain('LOCATION:Room 101');
      expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO');
      expect(ics).toContain('BEGIN:VALARM');
      expect(ics).toContain('TRIGGER:-PT15M');
      expect(ics).toContain('END:VALARM');
      expect(ics).toContain('END:VEVENT');
      expect(ics).toContain('END:VCALENDAR');
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });

    it('generates valid iCalendar feed for Student enrolled in groups', async () => {
      const studentUser = {
        id: 'usr-student',
        email: 'student@medu.uz',
        firstName: 'Madina',
        lastName: 'Saidova',
        role: 'STUDENT',
        organizationId: 'org-1',
        isActive: true,
      };

      prisma.user.findUnique.mockResolvedValue(studentUser);
      const validToken = await service.getOrCreateCalendarToken('usr-student');

      prisma.user.findFirst.mockResolvedValue(studentUser);
      prisma.organization.findUnique.mockResolvedValue({
        name: 'Oxford Learning Center',
        timezone: 'Asia/Tashkent',
      });
      prisma.student.findUnique.mockResolvedValue({ id: 'stud-1', userId: 'usr-student' });
      prisma.studentGroup.findMany.mockResolvedValue([{ groupId: 'grp-10' }]);
      prisma.schedule.findMany.mockResolvedValue([
        {
          id: 'sched-2',
          dayOfWeek: 'WEDNESDAY',
          startTime: '14:00',
          endTime: '15:30',
          room: 'Lab 3',
          group: {
            name: 'Web-01',
            course: { name: 'Frontend React' },
            teacher: {
              user: { firstName: 'Sherzod', lastName: 'Aliyev' },
            },
          },
        },
      ]);

      const ics = await service.generateIcsFeed(validToken);

      expect(ics).toContain('BEGIN:VCALENDAR');
      expect(ics).toContain('SUMMARY:Frontend React (Web-01)');
      expect(ics).toContain('LOCATION:Lab 3');
      expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=WE');
      expect(ics).toContain('Sherzod Aliyev');
      expect(ics).toContain('END:VCALENDAR');
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });
  });
});
