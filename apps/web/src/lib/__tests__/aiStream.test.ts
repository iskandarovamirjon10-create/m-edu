/**
 * Regression tests for the AI stream transport (F-AI-001).
 *
 * Invariants:
 *  1. The stream request authenticates via HttpOnly cookies
 *     (`credentials: 'include'`) and the double-submit CSRF header — never
 *     via an `Authorization: Bearer` header read from storage.
 *  2. SSE frames split across network chunk boundaries are reassembled
 *     before parsing (no dropped deltas).
 *  3. A server-sent `error` event propagates as a thrown ApiError instead
 *     of being swallowed.
 *  4. Non-OK responses surface a status-carrying ApiError (401/403/429...).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { aiChatStream } from '../ai';
import { ApiError } from '../api';

function sseResponse(chunks: string[], init?: { ok?: boolean; status?: number; body?: object }) {
  const encoder = new TextEncoder();
  let i = 0;
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    headers: new Headers({ 'content-type': 'text/event-stream' }),
    json: async () => init?.body ?? {},
    body: {
      getReader: () => ({
        read: async () => {
          if (i < chunks.length) {
            const value = encoder.encode(chunks[i]);
            i += 1;
            return { value, done: false };
          }
          return { value: undefined, done: true };
        },
      }),
    },
  } as unknown as Response;
}

describe('aiChatStream — transport security & SSE parsing', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    localStorage.clear();
    document.cookie = 'XSRF-TOKEN=test-csrf-token; path=/';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    localStorage.clear();
  });

  it('authenticates with cookies + CSRF header and never sends a Bearer header', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      sseResponse(['event: done\ndata: {"conversationId":"c1"}\n\n']),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await aiChatStream([{ role: 'user', content: 'Salom' }], { onDelta: vi.fn() });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.credentials).toBe('include');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers['x-xsrf-token']).toBe('test-csrf-token');
    expect(headers['Authorization']).toBeUndefined();
    expect(String(fetchMock.mock.calls[0][0])).toContain('/ai/chat/stream');
  });

  it('reassembles SSE frames split across chunk boundaries (no dropped deltas)', async () => {
    // Two JSON deltas are each split mid-payload across network chunks.
    // Frame-based parsing must reassemble them before JSON.parse — the old
    // per-chunk parser silently dropped every split frame.
    const fetchMock = vi.fn().mockResolvedValue(
      sseResponse([
        'event: delta\ndata: {"content":"Hel',
        'lo"}\n\nevent: delta\ndata: {"content":" wor',
        'ld"}\n\nevent: done\ndata: {"conversationId":"c-42"}\n\n',
      ]),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const onDelta = vi.fn();
    const result = await aiChatStream([{ role: 'user', content: 'hi' }], { onDelta });

    // Deltas fire once per complete SSE frame (the server's unit).
    expect(onDelta.mock.calls.map((c) => c[0])).toEqual(['Hello', ' world']);
    expect(result.content).toBe('Hello world');
    expect(result.conversationId).toBe('c-42');
  });

  it('propagates a server-sent error event as a thrown error (not swallowed)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      sseResponse(['event: error\ndata: {"message":"Gemini quota exceeded"}\n\n']),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      aiChatStream([{ role: 'user', content: 'hi' }], { onDelta: vi.fn() }),
    ).rejects.toThrow(/Gemini quota exceeded/);
  });

  it('maps non-OK responses to a status-carrying ApiError', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      sseResponse([], { ok: false, status: 401, body: { message: 'Session expired' } }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const promise = aiChatStream([{ role: 'user', content: 'hi' }], { onDelta: vi.fn() });
    await expect(promise).rejects.toBeInstanceOf(ApiError);
    await promise.catch((err: ApiError) => {
      expect(err.status).toBe(401);
      expect(err.message).toBe('Session expired');
    });
  });

  it('ignores malformed JSON frames without killing the stream', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      sseResponse([
        'event: delta\ndata: {broken json\n\nevent: delta\ndata: {"content":"ok"}\n\n',
      ]),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const onDelta = vi.fn();
    const result = await aiChatStream([{ role: 'user', content: 'hi' }], { onDelta });
    expect(onDelta).toHaveBeenCalledWith('ok');
    expect(result.content).toBe('ok');
  });
});
