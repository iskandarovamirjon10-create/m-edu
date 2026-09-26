import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { BadRequestException } from '@nestjs/common';
import { UpdateUserSettingsDto } from '../../common/dto';
import { parseClock, isWithinQuietHours, nextQuietHoursEnd, CLOCK_PATTERN } from '../quiet-hours';
import { UsersService } from '../../users/users.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('Quiet Hours Validation (Phase 4 Hardening)', () => {
  describe('UpdateUserSettingsDto Class-Validator Enforcement', () => {
    const testCases: { value: string; valid: boolean; desc: string }[] = [
      { value: '22:00', valid: true, desc: 'standard evening time' },
      { value: '07:00', valid: true, desc: 'standard morning time' },
      { value: '00:00', valid: true, desc: 'midnight boundary' },
      { value: '23:59', valid: true, desc: 'end of day boundary' },
      { value: '12:30', valid: true, desc: 'midday' },
      { value: '24:00', valid: false, desc: 'hour 24 is out of 24h range' },
      { value: '25:99', valid: false, desc: 'impossible hours and minutes' },
      { value: '99:99', valid: false, desc: 'completely out of range' },
      { value: '1:30', valid: false, desc: 'single digit hour without leading zero' },
      { value: '12:60', valid: false, desc: 'minute 60 is invalid' },
      { value: 'abc', valid: false, desc: 'non-numeric' },
      { value: '12:00pm', valid: false, desc: '12h am/pm format rejected' },
      { value: '-01:00', valid: false, desc: 'negative hour' },
      { value: ' 22:00 ', valid: false, desc: 'untrimmed whitespace rejected' },
    ];

    testCases.forEach(({ value, valid, desc }) => {
      it(`should ${valid ? 'accept' : 'reject'} quietHoursStart: "${value}" (${desc})`, async () => {
        const dto = plainToInstance(UpdateUserSettingsDto, {
          quietHoursStart: value,
        });
        const errors = await validate(dto);
        if (valid) {
          expect(errors.filter(e => e.property === 'quietHoursStart')).toHaveLength(0);
        } else {
          const fieldError = errors.find(e => e.property === 'quietHoursStart');
          expect(fieldError).toBeDefined();
          expect(fieldError?.constraints?.matches).toBeDefined();
        }
      });

      it(`should ${valid ? 'accept' : 'reject'} quietHoursEnd: "${value}" (${desc})`, async () => {
        const dto = plainToInstance(UpdateUserSettingsDto, {
          quietHoursEnd: value,
        });
        const errors = await validate(dto);
        if (valid) {
          expect(errors.filter(e => e.property === 'quietHoursEnd')).toHaveLength(0);
        } else {
          const fieldError = errors.find(e => e.property === 'quietHoursEnd');
          expect(fieldError).toBeDefined();
          expect(fieldError?.constraints?.matches).toBeDefined();
        }
      });
    });
  });

  describe('UsersService.updateSettings Defense-in-Depth', () => {
    let usersService: UsersService;
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        user: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'u-1',
            organizationId: 'org-1',
            role: 'STUDENT',
          }),
        },
        userSettings: {
          findUnique: vi.fn().mockResolvedValue({
            userId: 'u-1',
            quietHoursEnabled: true,
            quietHoursStart: '22:00',
            quietHoursEnd: '07:00',
          }),
          update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ userId: 'u-1', ...data })),
          create: vi.fn(),
        },
      };

      usersService = new UsersService(mockPrisma as PrismaService);
    });

    it('should reject invalid quietHoursStart (25:99) with BadRequestException', async () => {
      await expect(
        usersService.updateSettings('org-1', 'u-1', { quietHoursStart: '25:99' }, 'u-1', 'STUDENT'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject invalid quietHoursEnd (abc) with BadRequestException', async () => {
      await expect(
        usersService.updateSettings('org-1', 'u-1', { quietHoursEnd: 'abc' }, 'u-1', 'STUDENT'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject single-digit hour (1:30) with BadRequestException', async () => {
      await expect(
        usersService.updateSettings('org-1', 'u-1', { quietHoursStart: '1:30' }, 'u-1', 'STUDENT'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept and persist valid quiet hours window (22:00 to 07:00)', async () => {
      const result = await usersService.updateSettings(
        'org-1',
        'u-1',
        { quietHoursStart: '22:00', quietHoursEnd: '07:00' },
        'u-1',
        'STUDENT',
      );

      expect(result.quietHoursStart).toBe('22:00');
      expect(result.quietHoursEnd).toBe('07:00');
      expect(mockPrisma.userSettings.update).toHaveBeenCalled();
    });
  });

  describe('Pure Clock Parsing and Window Calculation', () => {
    it('parseClock correctly handles valid and invalid strings', () => {
      expect(parseClock('00:00')).toBe(0);
      expect(parseClock('01:30')).toBe(90);
      expect(parseClock('23:59')).toBe(23 * 60 + 59);
      expect(parseClock('24:00')).toBeNull();
      expect(parseClock('25:99')).toBeNull();
      expect(parseClock('invalid')).toBeNull();
      expect(parseClock('')).toBeNull();
      expect(parseClock(null)).toBeNull();
      expect(parseClock(undefined)).toBeNull();
    });

    it('isWithinQuietHours returns false on malformed input (safe fail-open to deliver)', () => {
      const now = new Date('2026-06-01T23:00:00Z');
      expect(isWithinQuietHours(now, '25:99', '07:00', 'UTC')).toBe(false);
      expect(isWithinQuietHours(now, '22:00', 'invalid', 'UTC')).toBe(false);
    });

    it('isWithinQuietHours accurately evaluates windows crossing midnight', () => {
      // 22:00 to 07:00 UTC
      const atNight = new Date('2026-06-01T23:30:00Z');
      const inEarlyMorning = new Date('2026-06-02T05:00:00Z');
      const inDaytime = new Date('2026-06-02T14:00:00Z');

      expect(isWithinQuietHours(atNight, '22:00', '07:00', 'UTC')).toBe(true);
      expect(isWithinQuietHours(inEarlyMorning, '22:00', '07:00', 'UTC')).toBe(true);
      expect(isWithinQuietHours(inDaytime, '22:00', '07:00', 'UTC')).toBe(false);
    });
  });
});
