import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ValidationPipe } from '@nestjs/common';
import type { ArgumentMetadata } from '@nestjs/common';
import { ClientErrorsController } from '../client-errors.controller';
import { ClientErrorDto } from '../dto/client-error.dto';

describe('ClientErrorsController (production telemetry sink)', () => {
  let controller: ClientErrorsController;
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    controller = new ClientErrorsController();
    writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    writeSpy.mockRestore();
  });

  it('accepts a valid report and emits one structured log line', () => {
    const result = controller.report(
      {
        message: 'Cannot read properties of undefined',
        stack: 'Error: ... at App.tsx:10',
        route: '/dashboard',
        source: 'boundary',
        release: 'abc123',
      },
      { ip: '203.0.113.5', headers: { 'user-agent': 'vitest' } } as any,
    );

    expect(result).toEqual({ accepted: true });
    const logged = writeSpy.mock.calls.map((c) => String(c[0])).join('');
    expect(logged).toContain('client_error');
    expect(logged).toContain('Cannot read properties of undefined');
    expect(logged).toContain('boundary');
  });

  describe('DTO validation (whitelist + length caps)', () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
    const meta: ArgumentMetadata = { type: 'body', metatype: ClientErrorDto };

    it('accepts a minimal payload', async () => {
      const dto = await pipe.transform({ message: 'boom' }, meta);
      expect(dto).toBeInstanceOf(ClientErrorDto);
      expect(dto.message).toBe('boom');
    });

    it('rejects a message longer than 500 chars', async () => {
      await expect(
        pipe.transform({ message: 'm'.repeat(501) }, meta),
      ).rejects.toThrow();
    });

    it('rejects unknown properties (no arbitrary data injection)', async () => {
      await expect(
        pipe.transform({ message: 'boom', evil: '<script>' }, meta),
      ).rejects.toThrow();
    });

    it('rejects an unknown source value', async () => {
      await expect(
        pipe.transform({ message: 'boom', source: 'wat' }, meta),
      ).rejects.toThrow();
    });
  });
});
