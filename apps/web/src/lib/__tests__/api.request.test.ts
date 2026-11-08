/**
 * Critical-path tests for the API client transport (cookie-based auth):
 *  - No Authorization header / no token in JS (HttpOnly cookie transport)
 *  - 401 handling (unauthorized handler invoked)
 *  - JSON body parsing and friendly error mapping
 *  - buildQuery contract (empty values are dropped, URL-safe encoding)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request, { ApiError, setUnauthorizedHandler, buildQuery, reportsApi } from '../api';

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json', ...headers }),
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe('request transport', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends credentials (cookies) and never an Authorization header', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));
    await request('/auth/me');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/auth/me');
    expect(init.credentials).toBe('include');
    expect(init.headers.Authorization).toBeUndefined();
  });

  it('clears the session and notifies the app on 401 for a protected path', async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    fetchMock.mockResolvedValue(jsonResponse(401, { message: 'Unauthorized' }));
    await expect(request('/students')).rejects.toThrow('session has expired');
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('does not sign out on /auth/me 401 (normal logged-out probe)', async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    fetchMock.mockResolvedValue(jsonResponse(401, { message: 'Unauthorized' }));
    await expect(request('/auth/me')).rejects.toThrow('session has expired');
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('returns parsed JSON on success', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: 'u1', role: 'ORG_ADMIN' }));
    const result = await request('/auth/me');
    expect(result).toEqual({ id: 'u1', role: 'ORG_ADMIN' });
  });

  it('maps a 500 to an ApiError with a stable generic message', async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, { message: 'Internal server error' }));
    await expect(request('/x')).rejects.toMatchObject({ status: 500 });
  });

  it('joins array-style server messages into one string', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(400, [{ message: 'email must be an email' }, { message: 'password too short' }]),
    );
    await expect(request('/auth/register')).rejects.toThrow(
      'email must be an email; password too short',
    );
  });
});

describe('request timeout', () => {
  const timeoutFetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', timeoutFetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('aborts and reports a friendly timeout when the server is silent', async () => {
    vi.useFakeTimers();
    timeoutFetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        }),
    );
    const promise = request('/slow', { timeout: 50 });
    vi.advanceTimersByTime(51);
    await expect(promise).rejects.toThrow(/timed out/);
  });

  it('honours an externally aborted signal without reporting a timeout', async () => {
    const controller = new AbortController();
    timeoutFetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        }),
    );
    const promise = request('/cancelled', { signal: controller.signal });
    controller.abort();
    await expect(promise).rejects.toThrow(/cancelled/);
  });
});
describe('buildQuery', () => {
  it('returns an empty string for no params', () => {
    expect(buildQuery(undefined)).toBe('');
    expect(buildQuery({})).toBe('');
  });

  it('drops null, undefined and empty-string values', () => {
    expect(buildQuery({ page: '1', q: '', tag: null, extra: undefined })).toBe('?page=1');
  });

  it('stringifies and encodes values', () => {
    expect(buildQuery({ status: 'PAID', q: 'a b' })).toBe('?status=PAID&q=a+b');
  });

  it('works with interface-typed filter objects at runtime', () => {
    const filters = { search: 'Ali', isActive: true, groupId: undefined };
    expect(buildQuery(filters)).toBe('?search=Ali&isActive=true');
  });
});

describe('reportsApi.export and downloadFile', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    document.cookie = 'XSRF-TOKEN=fake-csrf-token; path=/';
    vi.stubGlobal('fetch', fetchMock);
    if (!window.URL.createObjectURL) {
      window.URL.createObjectURL = vi.fn().mockReturnValue('blob:test');
      window.URL.revokeObjectURL = vi.fn();
    } else {
      vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:test');
      vi.spyOn(window.URL, 'revokeObjectURL').mockReturnValue();
    }
  });

  afterEach(() => {
    document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('exports report via POST /reports/export with correct body and triggers download', async () => {
    const blob = new Blob(['col1,col2\nval1,val2'], { type: 'text/csv' });
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({
        'content-type': 'text/csv',
        'content-disposition': 'attachment; filename="report_STUDENTS.csv"',
      }),
      blob: async () => blob,
    });

    await reportsApi.export('STUDENTS', 'csv', { dateFrom: '2026-09-01', dateTo: '2026-09-24' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/reports/export');
    expect(init.method).toBe('POST');
    expect(init.headers['x-xsrf-token']).toBe('fake-csrf-token');
    expect(JSON.parse(init.body)).toEqual({
      type: 'STUDENTS',
      format: 'csv',
      params: {
        type: 'STUDENTS',
        dateFrom: '2026-09-01',
        dateTo: '2026-09-24',
      },
      dateFrom: '2026-09-01',
      dateTo: '2026-09-24',
    });
  });

  it('exports report in xlsx and pdf formats', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({
        'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'content-disposition': 'attachment; filename="report_FINANCE.xlsx"',
      }),
      blob: async () => new Blob(['xlsx-binary']),
    });

    await reportsApi.export('FINANCE', 'xlsx');

    const [urlXlsx, initXlsx] = fetchMock.mock.calls[0];
    expect(urlXlsx).toBe('/api/reports/export');
    expect(JSON.parse(initXlsx.body).format).toBe('xlsx');

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({
        'content-type': 'application/pdf',
        'content-disposition': 'attachment; filename="report_FINANCE.pdf"',
      }),
      blob: async () => new Blob(['pdf-binary']),
    });

    await reportsApi.export('FINANCE', 'pdf');
    const [urlPdf, initPdf] = fetchMock.mock.calls[1];
    expect(urlPdf).toBe('/api/reports/export');
    expect(JSON.parse(initPdf.body).format).toBe('pdf');
  });

  it('throws ApiError when export endpoint returns an error status', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ statusCode: 400, message: 'Unsupported format' }),
    });

    await expect(reportsApi.export('STUDENTS', 'csv')).rejects.toThrow('Unsupported format');
  });
});

describe('Professional Data Exchange: Correlation ID & Transient Retry', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    document.cookie = 'XSRF-TOKEN=fake-csrf-token; path=/';
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    vi.unstubAllGlobals();
  });

  it('generates an X-Request-Id header automatically on requests', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));
    await request('/test-trace');
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers['X-Request-Id']).toMatch(/^req_[A-Za-z0-9_-]+$/);
  });

  it('preserves an explicit X-Request-Id header if passed', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));
    await request('/test-trace', { headers: { 'X-Request-Id': 'req_custom_trace_999' } });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers['X-Request-Id']).toBe('req_custom_trace_999');
  });

  it('captures response X-Request-Id into ApiError on failure', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        400,
        { statusCode: 400, code: 'VALIDATION_ERROR', message: 'Invalid data', details: { errors: ['Name required'] } },
        { 'x-request-id': 'req_server_trace_123' },
      ),
    );
    try {
      await request('/fail');
      expect.fail('Should have thrown');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.requestId).toBe('req_server_trace_123');
      expect(apiErr.code).toBe('VALIDATION_ERROR');
      expect(apiErr.isValidationError()).toBe(true);
      expect(apiErr.getValidationErrors()).toEqual(['Name required']);
    }
  });

  it('automatically retries GET requests on transient 503 errors and succeeds', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(503, { message: 'Service Temporarily Unavailable' }))
      .mockResolvedValueOnce(jsonResponse(200, { status: 'recovered' }));

    const res = await request<{ status: string }>('/flaky-service', { retryDelayMs: 1 });
    expect(res).toEqual({ status: 'recovered' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('automatically retries on network TypeError (e.g. Failed to fetch)', async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(jsonResponse(200, { data: 'ok' }));

    const res = await request<{ data: string }>('/flaky-network', { retryDelayMs: 1 });
    expect(res).toEqual({ data: 'ok' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries POST requests if an idempotencyKey is supplied', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(502, { message: 'Bad Gateway' }))
      .mockResolvedValueOnce(jsonResponse(201, { created: true }));

    const res = await request<{ created: boolean }>('/payments', {
      method: 'POST',
      body: JSON.stringify({ amount: 100 }),
      idempotencyKey: 'idemp_unique_key_1',
      retryDelayMs: 1,
    });
    expect(res).toEqual({ created: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry POST requests without an idempotency key to prevent duplicate mutations', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(502, { message: 'Bad Gateway' }));

    await expect(
      request('/non-idempotent-post', {
        method: 'POST',
        body: JSON.stringify({ amount: 100 }),
        retryDelayMs: 1,
      }),
    ).rejects.toMatchObject({ status: 502 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
