import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHmac } from 'node:crypto';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramWebAppAuthService } from '../telegram-webapp-auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../../auth/auth.service';
import { TelegramAttemptLimiter } from '../telegram-attempt-limiter.service';

function createSignedInitData(botToken: string, params: Record<string, string>): string {
  const sortedEntries = Object.entries(params).sort(([a], [b]) => a.localeCompare(b));
  const dataCheckString = sortedEntries.map(([k, v]) => `${k}=${v}`).join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  const searchParams = new URLSearchParams(params);
  searchParams.set('hash', hash);
  return searchParams.toString();
}

describe('TelegramWebAppAuthService', () => {
  const BOT_TOKEN = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';
  let configService: { get: ReturnType<typeof vi.fn> };
  let prisma: {
    telegramAccount: {
      findFirst: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };
  let authService: { issueToken: ReturnType<typeof vi.fn> };
  let limiter: { tryClaimOnce: ReturnType<typeof vi.fn> };
  let service: TelegramWebAppAuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    configService = {
      get: vi.fn((key: string) => {
        if (key === 'TELEGRAM_BOT_TOKEN') return BOT_TOKEN;
        if (key === 'TELEGRAM_AUTH_MAX_AGE_SECONDS') return '7200';
        return undefined;
      }),
    };
    prisma = {
      telegramAccount: {
        findFirst: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
      },
    };
    authService = {
      issueToken: vi.fn().mockResolvedValue({
        accessToken: 'mock_jwt_token_123',
        refreshToken: 'mock_refresh_123',
      }),
    };
    limiter = {
      tryClaimOnce: vi.fn().mockResolvedValue(true),
      isBlocked: vi.fn().mockResolvedValue(false),
      hit: vi.fn().mockResolvedValue(1),
    };

    service = new TelegramWebAppAuthService(
      configService as unknown as ConfigService,
      prisma as unknown as PrismaService,
      authService as unknown as AuthService,
      limiter as unknown as TelegramAttemptLimiter,
    );
  });

  describe('validateInitData', () => {
    it('throws BadRequestException if initData is empty or missing', () => {
      expect(() => service.validateInitData('')).toThrow(BadRequestException);
    });

    it('throws UnauthorizedException if hash is missing', () => {
      const raw = 'auth_date=1600000000&user=%7B%22id%22%3A123%7D';
      expect(() => service.validateInitData(raw)).toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException on invalid cryptographic signature', () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const valid = createSignedInitData(BOT_TOKEN, {
        auth_date: String(nowSec),
        user: JSON.stringify({ id: 98765, first_name: 'Alisher' }),
      });

      // Tamper with data without recalculating hash
      const tampered = valid.replace('Alisher', 'Bobur');
      expect(() => service.validateInitData(tampered)).toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when auth_date is older than 2 hours (replay attack)', () => {
      const expiredDate = Math.floor(Date.now() / 1000) - 7500; // > 2 hours ago (7200s limit)
      const initData = createSignedInitData(BOT_TOKEN, {
        auth_date: String(expiredDate),
        user: JSON.stringify({ id: 98765, first_name: 'Alisher' }),
      });

      expect(() => service.validateInitData(initData)).toThrow(
        /Telegram WebApp session has expired/,
      );
    });

    it('rejects mock=true in production environment even without bot token', () => {
      const prevEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';
        const unconfiguredService = new TelegramWebAppAuthService(
          { get: vi.fn().mockReturnValue('') } as unknown as ConfigService,
          prisma as unknown as PrismaService,
          authService as unknown as AuthService,
          limiter as unknown as TelegramAttemptLimiter,
        );

        expect(() => unconfiguredService.validateInitData('mock=true')).toThrow(
          UnauthorizedException,
        );
      } finally {
        process.env.NODE_ENV = prevEnv;
      }
    });

    it('successfully validates genuine signature and parses user', () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const userPayload = {
        id: 11223344,
        first_name: 'Azizbek',
        last_name: 'Karimov',
        username: 'aziz_dev',
        language_code: 'uz',
      };
      const initData = createSignedInitData(BOT_TOKEN, {
        auth_date: String(nowSec),
        user: JSON.stringify(userPayload),
        query_id: 'AAHdF60gAAAAAN0XrSC345',
      });

      const result = service.validateInitData(initData);
      expect(result.user.id).toBe(11223344);
      expect(result.user.first_name).toBe('Azizbek');
      expect(result.user.username).toBe('aziz_dev');
      expect(result.authDate).toBe(nowSec);
      expect(result.queryId).toBe('AAHdF60gAAAAAN0XrSC345');
    });
  });

  describe('authenticate', () => {
    it('returns authenticated: false if Telegram account is unlinked', async () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const initData = createSignedInitData(BOT_TOKEN, {
        auth_date: String(nowSec),
        user: JSON.stringify({ id: 554433, first_name: 'Jasur' }),
      });

      prisma.telegramAccount.findFirst.mockResolvedValue(null);

      const res = await service.authenticate(initData);
      expect(res.authenticated).toBe(false);
      expect(res.telegramUser.id).toBe(554433);
      expect(res.message).toContain('birorta profilga ulanmagan');
      expect(authService.issueToken).not.toHaveBeenCalled();
    });

    it('authenticates active teacher/admin user and returns JWT token', async () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const initData = createSignedInitData(BOT_TOKEN, {
        auth_date: String(nowSec),
        user: JSON.stringify({ id: 554433, first_name: 'Teacher' }),
      });

      const mockOrg = { id: 'org-1', name: 'Al-Xorazmiy School' };
      const mockUser = {
        id: 'usr-123',
        email: 'teacher@school.uz',
        firstName: 'Dilshod',
        lastName: 'Nurmatov',
        role: 'TEACHER',
        organizationId: 'org-1',
        organization: mockOrg,
        isActive: true,
      };

      prisma.telegramAccount.findFirst.mockResolvedValue({
        id: 'tg-acc-1',
        telegramUserId: '554433',
        status: 'ACTIVE',
        user: mockUser,
      });

      const res = await service.authenticate(initData);
      expect(res.authenticated).toBe(true);
      expect(res.accessToken).toBe('mock_jwt_token_123');
      expect(res.role).toBe('TEACHER');
      expect(res.user?.id).toBe('usr-123');
      expect(authService.issueToken).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'usr-123', role: 'TEACHER' }),
        undefined,
      );
      expect(prisma.telegramAccount.update).toHaveBeenCalledWith({
        where: { id: 'tg-acc-1' },
        data: expect.objectContaining({ lastSeenAt: expect.any(Date) }),
      });
    });

    it('throws UnauthorizedException if user account is deactivated', async () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const initData = createSignedInitData(BOT_TOKEN, {
        auth_date: String(nowSec),
        user: JSON.stringify({ id: 554433, first_name: 'Teacher' }),
      });

      prisma.telegramAccount.findFirst.mockResolvedValue({
        id: 'tg-acc-1',
        telegramUserId: '554433',
        status: 'ACTIVE',
        user: { id: 'usr-inactive', isActive: false },
      });

      await expect(service.authenticate(initData)).rejects.toThrow(
        /Hisobingiz faol emas/,
      );
    });

    it('authenticates linked parent account properly', async () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const initData = createSignedInitData(BOT_TOKEN, {
        auth_date: String(nowSec),
        user: JSON.stringify({ id: 778899, first_name: 'Parent' }),
      });

      const mockOrg = { id: 'org-1', name: 'Al-Xorazmiy School' };
      const mockParent = {
        id: 'parent-99',
        firstName: 'Olim',
        lastName: 'Boboyev',
        email: 'olim@medu.uz',
        phone: '+998901234567',
        organizationId: 'org-1',
        organization: mockOrg,
      };

      prisma.telegramAccount.findFirst.mockResolvedValue({
        id: 'tg-acc-parent',
        telegramUserId: '778899',
        status: 'ACTIVE',
        parentAccount: mockParent,
      });

      const res = await service.authenticate(initData);
      expect(res.authenticated).toBe(true);
      expect(res.role).toBe('PARENT');
      expect(res.user?.firstName).toBe('Olim');
      expect(res.user?.lastName).toBe('Boboyev');
      expect(authService.issueToken).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'parent-99', role: 'PARENT' }),
        undefined,
      );
    });

    it('supports idempotent re-authentication within the active freshness window without throwing replay error', async () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const initData = createSignedInitData(BOT_TOKEN, {
        auth_date: String(nowSec),
        user: JSON.stringify({ id: 887766, first_name: 'IdempotentUser' }),
      });

      const mockOrg = { id: 'org-1', name: 'Al-Xorazmiy School' };
      const mockUser = {
        id: 'usr-888',
        email: 'user888@school.uz',
        firstName: 'Idempotent',
        lastName: 'User',
        role: 'STUDENT',
        organizationId: 'org-1',
        organization: mockOrg,
        isActive: true,
      };

      prisma.telegramAccount.findFirst.mockResolvedValue({
        id: 'tg-acc-idem',
        telegramUserId: '887766',
        status: 'ACTIVE',
        user: mockUser,
      });

      // First authentication succeeds
      const firstRes = await service.authenticate(initData);
      expect(firstRes.authenticated).toBe(true);
      expect(firstRes.accessToken).toBe('mock_jwt_token_123');

      // Subsequent call with the exact same initData (e.g. client page refresh / retry)
      // returns the cached session seamlessly without failing claim
      const secondRes = await service.authenticate(initData);
      expect(secondRes.authenticated).toBe(true);
      expect(secondRes.accessToken).toBe(firstRes.accessToken);
    });

    it('throws UnauthorizedException when initData is replayed (tryClaimOnce returns false)', async () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const initData = createSignedInitData(BOT_TOKEN, {
        auth_date: String(nowSec),
        user: JSON.stringify({ id: 554433, first_name: 'Teacher' }),
      });

      limiter.tryClaimOnce.mockResolvedValue(false);

      await expect(service.authenticate(initData)).rejects.toThrow(
        /Telegram WebApp session has already been used/,
      );
    });
  });

  describe('WebAppAuthDto validation', () => {
    it('validates initData presence and rejects empty payloads', async () => {
      const { validate } = await import('class-validator');
      const { WebAppAuthDto } = await import('../telegram-webapp-auth.controller');

      const validDto = new WebAppAuthDto();
      validDto.initData = 'user=123&hash=abc';
      const errorsValid = await validate(validDto);
      expect(errorsValid.length).toBe(0);

      const invalidDto = new WebAppAuthDto();
      const errorsInvalid = await validate(invalidDto);
      expect(errorsInvalid.length).toBeGreaterThan(0);
    });
  });
});
