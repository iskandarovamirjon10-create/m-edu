/**
 * Critical-path tests for the API client transport (cookie-based auth):
 *  - No Authorization header / no token in JS (HttpOnly cookie transport)
 *  - 401 handling (unauthorized handler invoked)
 *  - JSON body parsing and friendly error mapping
 *  - buildQuery contract (empty values are dropped, URL-safe encoding)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request, { setUnauthorizedHandler, buildQuery } from '../api';

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

  it('clears the session and notifies the app on 401', async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    fetchMock.mockResolvedValue(jsonResponse(401, { message: 'Unauthorized' }));
    await expect(request('/auth/me')).rejects.toThrow('session has expired');
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
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
