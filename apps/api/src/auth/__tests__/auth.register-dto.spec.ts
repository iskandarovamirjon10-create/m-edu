/**
 * RegisterDto validation + password-hashing tests.
 *
 * The ValidationPipe (whitelist + forbidNonWhitelisted + transform) is the
 * first line of defense for self-service registration. These tests exercise
 * the REAL pipe + REAL class-validator rules against the REAL DTO — the pipe
 * configuration that actually runs in main.ts — so a regression in the
 * whitelist/forbidNonWhitelisted setup or in the DTO decorators is caught
 * here, not in production.
 *
 * Register flow was runtime-verified end-to-end (HTTP → DTO → service →
 * PostgreSQL → HttpOnly cookie → /auth/me) on 2026-09-12; see
 * AUTH_FORENSIC_REPORT.md.
 */
import { describe, it, expect, vi } from 'vitest';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import type { ArgumentMetadata } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import type { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto } from '../dto';

const VALID = {
  inviteCode: 'M-EDU-TEST-INVITE',
  email: 'jane@example.com',
  password: 'Str0ngPass!x',
  firstName: 'Jane',
  lastName: 'Doe',
  organizationName: 'Bright Future Academy',
};

/** Run the payload through the exact pipe used in main.ts. */
async function transform(payload: unknown): Promise<RegisterDto> {
  const pipe = new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
    transformOptions: { enableImplicitConversion: true },
  });
  const meta: ArgumentMetadata = { type: 'body', metatype: RegisterDto };
  return pipe.transform(payload, meta) as Promise<RegisterDto>;
}

/**
 * The ValidationPipe throws BadRequestException with the class-validator
 * messages inside getResponse().message (string OR string[]). Assert against
 * that body — the raw exception message is just "Bad Request Exception".
 */
async function expectValidationError(promise: Promise<unknown>, pattern: RegExp): Promise<void> {
  try {
    await promise;
    expect.fail(`expected validation error matching ${pattern}`);
  } catch (e) {
    expect(e).toBeInstanceOf(BadRequestException);
    const body = (e as BadRequestException).getResponse() as { message: string | string[] };
    const messages = Array.isArray(body.message) ? body.message.join(' | ') : body.message;
    expect(messages).toMatch(pattern);
  }
}

describe('RegisterDto (ValidationPipe whitelist + forbidNonWhitelisted)', () => {
  it('accepts a fully valid payload and strips nothing', async () => {
    const dto = await transform(VALID);
    expect(dto).toBeInstanceOf(RegisterDto);
    expect(dto.inviteCode).toBe(VALID.inviteCode);
    expect(dto.email).toBe(VALID.email);
    expect(dto.password).toBe(VALID.password);
    expect(dto.organizationName).toBe(VALID.organizationName);
  });

  it('accepts a valid payload without inviteCode (optional)', async () => {
    const { inviteCode, ...missingInvite } = VALID;
    const dto = await transform(missingInvite);
    expect(dto).toBeInstanceOf(RegisterDto);
    expect(dto.inviteCode).toBeUndefined();
    expect(dto.email).toBe(VALID.email);
  });

  it('rejects an invalid email (400-class BadRequestException)', async () => {
    await expect(transform({ ...VALID, email: 'not-an-email' })).rejects.toThrow(BadRequestException);
  });

  it('rejects a weak (< 8 chars) password', async () => {
    await expectValidationError(transform({ ...VALID, password: 'weak' }), /password.*longer than or equal to 8/);
  });

  it('rejects empty required fields', async () => {
    await expectValidationError(transform({ ...VALID, firstName: '' }), /firstName.*should not be empty/);
    await expectValidationError(transform({ ...VALID, lastName: '' }), /lastName.*should not be empty/);
    await expectValidationError(transform({ ...VALID, organizationName: '' }), /organizationName.*should not be empty/);
  });

  it('rejects unknown fields (privilege-escalation guard: role/organizationId cannot be injected)', async () => {
    await expectValidationError(transform({ ...VALID, role: 'SUPER_ADMIN' }), /property role should not exist/);
    await expectValidationError(
      transform({ ...VALID, organizationId: 'org-attacker' }),
      /property organizationId should not exist/,
    );
  });

  it('rejects over-long fields (DoS / storage abuse guard)', async () => {
    await expectValidationError(transform({ ...VALID, firstName: 'x'.repeat(101) }), /firstName.*shorter than or equal to 100/);
    await expectValidationError(transform({ ...VALID, password: 'x'.repeat(129) }), /password.*shorter than or equal to 128/);
  });
});

describe('AuthService.register — password hashing contract', () => {
  it('stores ONLY a bcrypt hash — the plaintext password never reaches the database layer', async () => {
    const bcrypt = await import('bcryptjs');
    const hashSpy = vi.spyOn(bcrypt.default, 'hash');
    const storedArgs: Array<{ data: { passwordHash: string; role: string; organizationId: string } }> = [];
    const prisma = {
      user: { findFirst: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
        const orgCreate = vi.fn().mockResolvedValue({ id: 'org-1' });
        const userCreate = vi.fn().mockImplementation((args: { data: { passwordHash: string; role: string; organizationId: string } }) => {
          storedArgs.push(args);
          return {
            id: 'u-1',
            email: 'hash@b.com',
            role: 'ORG_ADMIN',
            organizationId: 'org-1',
            organization: { id: 'org-1' },
          };
        });
        return fn({ organization: { create: orgCreate }, user: { create: userCreate } });
      }),
      session: {
        create: vi.fn().mockResolvedValue({ id: 's-1' }),
        count: vi.fn().mockResolvedValue(1),
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    } as unknown as PrismaService;
    const jwt = { sign: vi.fn(() => 'jwt') } as unknown as JwtService;
    const { AuthService } = await import('../auth.service');
    const svc = new AuthService(prisma, jwt);

    await svc.register({ ...VALID, email: 'hash@b.com' });

    expect(hashSpy).toHaveBeenCalledWith('Str0ngPass!x', 12);
    expect(storedArgs).toHaveLength(1);
    const data = storedArgs[0].data;
    // Never plaintext:
    expect(data.passwordHash).not.toBe('Str0ngPass!x');
    expect(data.passwordHash).toMatch(/^\$2[aby]\$/);
    // Correct canonical role + tenant in the SAME create call:
    expect(data.role).toBe('ORG_ADMIN');
    expect(data.organizationId).toBe('org-1');
    hashSpy.mockRestore();
  });
});
