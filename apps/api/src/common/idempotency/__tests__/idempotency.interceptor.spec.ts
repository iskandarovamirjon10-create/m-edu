import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExecutionContext, CallHandler, BadRequestException, ConflictException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of, throwError } from 'rxjs';
import { IdempotencyInterceptor } from '../idempotency.interceptor';
import { RedisPubSubService } from '../../redis/redis-pubsub.service';
import { IDEMPOTENT_OPTIONS_KEY } from '../idempotency.decorator';

describe('IdempotencyInterceptor', () => {
  let interceptor: IdempotencyInterceptor;
  let redis: RedisPubSubService;
  let reflector: Reflector;

  beforeEach(() => {
    redis = {
      get: vi.fn(),
      set: vi.fn(),
      setIfNotExists: vi.fn(),
      delete: vi.fn(),
    } as unknown as RedisPubSubService;

    reflector = {
      getAllAndOverride: vi.fn(),
    } as unknown as Reflector;

    interceptor = new IdempotencyInterceptor(redis, reflector);
  });

  function createMockContext(headers: Record<string, string> = {}, user: any = { organizationId: 'org-123' }) {
    const request = {
      headers,
      user,
      method: 'POST',
      baseUrl: '/api/v1/payments',
      path: '/api/v1/payments',
    };
    const response = {
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      statusCode: 200,
    };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
      response,
      request,
    } as unknown as ExecutionContext & { response: any; request: any };
  }

  it('bypasses idempotency check when no header is present and not required', async () => {
    vi.mocked(reflector.getAllAndOverride).mockReturnValue({});
    const context = createMockContext({});
    const next: CallHandler = {
      handle: vi.fn().mockReturnValue(of({ success: true })),
    };

    const result$ = await interceptor.intercept(context, next);
    const result = await new Promise((resolve) => result$.subscribe(resolve));

    expect(result).toEqual({ success: true });
    expect(redis.get).not.toHaveBeenCalled();
    expect(redis.setIfNotExists).not.toHaveBeenCalled();
  });

  it('throws BadRequestException if key is missing when required: true', () => {
    vi.mocked(reflector.getAllAndOverride).mockReturnValue({ required: true });
    const context = createMockContext({});
    const next: CallHandler = { handle: vi.fn() };

    expect(() => interceptor.intercept(context, next)).toThrow(BadRequestException);
  });

  it('throws BadRequestException if key is less than 8 characters', () => {
    vi.mocked(reflector.getAllAndOverride).mockReturnValue({});
    const context = createMockContext({ 'idempotency-key': 'short' });
    const next: CallHandler = { handle: vi.fn() };

    expect(() => interceptor.intercept(context, next)).toThrow(BadRequestException);
  });

  it('acquires lock and caches successful response', async () => {
    vi.mocked(reflector.getAllAndOverride).mockReturnValue({ ttlSeconds: 3600 });
    vi.mocked(redis.get).mockResolvedValue(null);
    vi.mocked(redis.setIfNotExists).mockResolvedValue(true);
    vi.mocked(redis.set).mockResolvedValue();

    const context = createMockContext({ 'idempotency-key': 'tx-unique-12345' });
    const next: CallHandler = {
      handle: vi.fn().mockReturnValue(of({ paymentId: 'pay-999', amount: 50000 })),
    };

    const result$ = await interceptor.intercept(context, next);
    const result = await new Promise((resolve) => result$.subscribe(resolve));

    expect(result).toEqual({ paymentId: 'pay-999', amount: 50000 });
    expect(redis.setIfNotExists).toHaveBeenCalledWith(
      'idempotency:org-123:POST:/api/v1/payments:tx-unique-12345',
      expect.stringContaining('"state":"PROCESSING"'),
      60000,
    );
    expect(redis.set).toHaveBeenCalledWith(
      'idempotency:org-123:POST:/api/v1/payments:tx-unique-12345',
      expect.stringContaining('"state":"COMPLETED"'),
      3600000,
    );
    expect(context.response.setHeader).toHaveBeenCalledWith('X-Idempotency-Key', 'tx-unique-12345');
  });

  it('returns cached response directly when request was already COMPLETED', async () => {
    vi.mocked(reflector.getAllAndOverride).mockReturnValue({});
    const cachedData = { paymentId: 'pay-999', amount: 50000, status: 'PAID' };
    vi.mocked(redis.get).mockResolvedValue(
      JSON.stringify({
        state: 'COMPLETED',
        statusCode: 201,
        data: cachedData,
        createdAt: Date.now() - 5000,
      }),
    );

    const context = createMockContext({ 'idempotency-key': 'tx-unique-12345' });
    const next: CallHandler = { handle: vi.fn() };

    const result$ = await interceptor.intercept(context, next);
    const result = await new Promise((resolve) => result$.subscribe(resolve));

    expect(result).toEqual(cachedData);
    expect(context.response.setHeader).toHaveBeenCalledWith('X-Idempotency-Replayed', 'true');
    expect(context.response.status).toHaveBeenCalledWith(201);
    expect(next.handle).not.toHaveBeenCalled();
  });

  it('throws ConflictException when request is currently PROCESSING in-flight', async () => {
    vi.mocked(reflector.getAllAndOverride).mockReturnValue({});
    vi.mocked(redis.get).mockResolvedValue(
      JSON.stringify({
        state: 'PROCESSING',
        statusCode: 0,
        data: null,
        createdAt: Date.now() - 1000,
      }),
    );

    const context = createMockContext({ 'idempotency-key': 'tx-unique-12345' });
    const next: CallHandler = { handle: vi.fn() };

    const result$ = await interceptor.intercept(context, next);
    await expect(new Promise((_, reject) => result$.subscribe({ error: reject }))).rejects.toThrow(
      ConflictException,
    );
  });

  it('deletes lock when the handler throws an error so client can retry', async () => {
    vi.mocked(reflector.getAllAndOverride).mockReturnValue({});
    vi.mocked(redis.get).mockResolvedValue(null);
    vi.mocked(redis.setIfNotExists).mockResolvedValue(true);
    vi.mocked(redis.delete).mockResolvedValue();

    const context = createMockContext({ 'idempotency-key': 'tx-unique-12345' });
    const next: CallHandler = {
      handle: vi.fn().mockReturnValue(throwError(() => new Error('DB connection dropped'))),
    };

    const result$ = await interceptor.intercept(context, next);
    await expect(new Promise((_, reject) => result$.subscribe({ error: reject }))).rejects.toThrow(
      'DB connection dropped',
    );

    expect(redis.delete).toHaveBeenCalledWith(
      'idempotency:org-123:POST:/api/v1/payments:tx-unique-12345',
    );
  });
});
