import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BadRequestException, HttpStatus } from '@nestjs/common';
import {
  EnrollmentNotFoundError,
  FaceNotDetectedError,
  LivenessFailedError,
  LivenessUnavailableError,
  TenantMismatchError,
} from '@medu/core';
import { GlobalExceptionFilter } from './http-exception.filter';
import { OAuthRedirectException } from '../auth/oauth-redirect.exception';

function createMockHost() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const response = { status };
  const request = { method: 'POST', url: '/api/face/test' };
  const host: any = {
    switchToHttp: () => ({ getResponse: () => response, getRequest: () => request }),
  };
  return { host, status, json, request };
}

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  beforeEach(() => {
    filter = new GlobalExceptionFilter();
    vi.spyOn(LoggerMock(), 'error').mockImplementation(() => undefined);
  });

  function LoggerMock() {
    return filter['logger'];
  }

  it('maps FacePlatformError to its domain httpStatus + client-safe code/message', () => {
    const { host, status, json } = createMockHost();
    filter.catch(new EnrollmentNotFoundError('abc-123'), host);
    expect(status).toHaveBeenCalledWith(404);
    const body = json.mock.calls[0][0];
    expect(body.code).toBe('ENROLLMENT_NOT_FOUND');
    expect(body.statusCode).toBe(404);
    expect(body.message).toContain('Enrollment not found');
  });

  it('maps liveness failure to 422 with LIVENESS_FAILED code', () => {
    const { host, status, json } = createMockHost();
    filter.catch(new LivenessFailedError('spoof'), host);
    expect(status).toHaveBeenCalledWith(422);
    expect(json.mock.calls[0][0].code).toBe('LIVENESS_FAILED');
  });

  it('maps liveness unavailable to 503 (fail-closed)', () => {
    const { host, status, json } = createMockHost();
    filter.catch(new LivenessUnavailableError(), host);
    expect(status).toHaveBeenCalledWith(503);
    expect(json.mock.calls[0][0].code).toBe('LIVENESS_UNAVAILABLE');
  });

  it('maps face-not-detected to 422', () => {
    const { host, status } = createMockHost();
    filter.catch(new FaceNotDetectedError(), host);
    expect(status).toHaveBeenCalledWith(422);
  });

  it('maps tenant mismatch to 403', () => {
    const { host, status } = createMockHost();
    filter.catch(new TenantMismatchError(), host);
    expect(status).toHaveBeenCalledWith(403);
  });

  it('passes HttpException through', () => {
    const { host, status, json } = createMockHost();
    filter.catch(new BadRequestException('bad input'), host);
    expect(status).toHaveBeenCalledWith(400);
    expect(json.mock.calls[0][0].message).toBe('bad input');
  });

  it('maps body-parser entity.too.large errors to 413 (not 500)', () => {
    const { host, status, json } = createMockHost();
    const err = new Error('request entity too large');
    (err as any).type = 'entity.too.large';
    filter.catch(err, host);
    expect(status).toHaveBeenCalledWith(413);
    expect(json.mock.calls[0][0].message).toBe('Request payload too large');
  });

  it('returns 500 for unexpected errors with a generic-safe body', () => {
    const { host, status, json } = createMockHost();
    filter.catch(new Error('secret internal stack detail'), host);
    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    const body = json.mock.calls[0][0];
    expect(body.statusCode).toBe(500);
    expect(body.code).toBeUndefined();
  });

  it('NEVER exposes raw internal error messages in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    try {
      const { host, status, json } = createMockHost();
      filter.catch(new Error('Invalid `prisma.x.findMany()` invocation in /srv/app/dist/…'), host);
      expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      const body = json.mock.calls[0][0];
      expect(body.message).toBe('Internal server error');
      expect(body.message).not.toContain('prisma');
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('exposes raw error messages outside production (debug aid)', () => {
    vi.stubEnv('NODE_ENV', 'development');
    try {
      const { host, json } = createMockHost();
      filter.catch(new Error('dev-only detail'), host);
      expect(json.mock.calls[0][0].message).toBe('dev-only detail');
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe('GlobalExceptionFilter — OAuth redirect + headers-sent guard', () => {
  let filter: GlobalExceptionFilter;
  beforeEach(() => {
    filter = new GlobalExceptionFilter();
  });

  it('turns OAuthRedirectException into a single clean 302 redirect', () => {
    const redirect = vi.fn();
    const response = { redirect };
    const host: any = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => ({ method: 'GET', url: '/api/auth/google' }),
      }),
    };
    filter.catch(new OAuthRedirectException('http://front.test/auth/callback?error=x'), host);
    expect(redirect).toHaveBeenCalledWith(302, 'http://front.test/auth/callback?error=x');
  });

  it('never writes to a response whose headers are already sent (no ERR_HTTP_HEADERS_SENT)', () => {
    const json = vi.fn().mockImplementation(() => {
      throw new Error('should not be called');
    });
    const response = { headersSent: true, status: vi.fn().mockReturnValue({ json }) };
    const host: any = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => ({ method: 'GET', url: '/api/auth/google' }),
      }),
    };
    // Must not throw even though json() would throw if invoked.
    expect(() => filter.catch(new Error('boom'), host)).not.toThrow();
    expect(json).not.toHaveBeenCalled();
  });

  it('never writes to a response that is already ended (writableEnded)', () => {
    const json = vi.fn();
    const response = { writableEnded: true, status: vi.fn().mockReturnValue({ json }) };
    const host: any = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => ({ method: 'GET', url: '/api/anything' }),
      }),
    };
    expect(() => filter.catch(new Error('boom'), host)).not.toThrow();
    expect(json).not.toHaveBeenCalled();
  });
});
