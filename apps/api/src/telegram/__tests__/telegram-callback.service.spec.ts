import { describe, it, expect, beforeEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { TelegramCallbackService } from '../telegram-callback.service';

const CHAT = '9001';
const OTHER_CHAT = '5555';

function makeService(env: Record<string, string | undefined> = { JWT_SECRET: 'jwt-secret' }) {
  const config = { get: (key: string) => env[key] } as unknown as ConfigService;
  return new TelegramCallbackService(config);
}

describe('TelegramCallbackService', () => {
  let service: TelegramCallbackService;

  beforeEach(() => {
    service = makeService();
  });

  it('round-trips a payload for the same chat', () => {
    const encoded = service.encode('cs', '2', CHAT);
    expect(service.decode(encoded, CHAT)).toEqual({ code: 'cs', arg: '2' });
  });

  it('round-trips a payload with no argument', () => {
    const encoded = service.encode('mm', null, CHAT);
    expect(service.decode(encoded, CHAT)).toEqual({ code: 'mm', arg: null });
  });

  it('keeps pagination arguments intact (contains a colon)', () => {
    const encoded = service.encode('pg', 'students:12', CHAT);
    expect(service.decode(encoded, CHAT)).toEqual({ code: 'pg', arg: 'students:12' });
  });

  it('stays inside Telegram 64-byte callback_data limit', () => {
    expect(service.encode('pg', 'students:20', CHAT).length).toBeLessThanOrEqual(64);
    expect(service.encode('cs', '5', CHAT).length).toBeLessThanOrEqual(64);
  });

  it('rejects a payload replayed from a different chat (cross-user replay)', () => {
    const captured = service.encode('ul', null, CHAT);
    expect(service.decode(captured, OTHER_CHAT)).toBeNull();
  });

  it('rejects a tampered action code', () => {
    const encoded = service.encode('cs', '1', CHAT);
    const parts = encoded.split('~');
    parts[0] = 'ul'; // escalate a harmless navigation into a disconnect
    expect(service.decode(parts.join('~'), CHAT)).toBeNull();
  });

  it('rejects a tampered argument (resource substitution)', () => {
    const encoded = service.encode('cs', '0', CHAT);
    const parts = encoded.split('~');
    parts[1] = Buffer.from('3', 'utf8').toString('base64url');
    expect(service.decode(parts.join('~'), CHAT)).toBeNull();
  });

  it('rejects a tampered expiry', () => {
    const encoded = service.encode('mm', null, CHAT);
    const parts = encoded.split('~');
    parts[2] = (Number.parseInt(parts[2], 36) + 100000).toString(36);
    expect(service.decode(parts.join('~'), CHAT)).toBeNull();
  });

  it('rejects an expired payload', () => {
    const encoded = service.encode('ul', null, CHAT, -1);
    expect(service.decode(encoded, CHAT)).toBeNull();
  });

  it('rejects malformed payloads', () => {
    expect(service.decode('garbage', CHAT)).toBeNull();
    expect(service.decode('a~b~c', CHAT)).toBeNull();
    expect(service.decode('', CHAT)).toBeNull();
  });

  it('rejects a payload signed with a different secret', () => {
    const other = makeService({ JWT_SECRET: 'a-different-secret' });
    const encoded = other.encode('mm', null, CHAT);
    expect(service.decode(encoded, CHAT)).toBeNull();
  });

  it('gives sensitive actions a shorter lifetime than navigation', () => {
    expect(service.ttlFor('ul')).toBeLessThan(service.ttlFor('mm'));
    expect(service.ttlFor('lg')).toBeLessThan(service.ttlFor('pg'));
  });

  it('prefers the dedicated callback secret over JWT_SECRET', () => {
    const dedicated = makeService({ TELEGRAM_CALLBACK_SECRET: 'callback-secret', JWT_SECRET: 'jwt' });
    const wrong = makeService({ JWT_SECRET: 'jwt' });
    const encoded = dedicated.encode('mm', null, CHAT);
    expect(dedicated.decode(encoded, CHAT)).toEqual({ code: 'mm', arg: null });
    // A payload signed with the fallback secret must not verify.
    expect(wrong.decode(encoded, CHAT)).toBeNull();
  });

  it('fails closed when no signing secret is available', () => {
    const unconfigured = makeService({});
    expect(unconfigured.isConfigured()).toBe(false);
    expect(() => unconfigured.encode('mm', null, CHAT)).toThrow();
    expect(unconfigured.decode('mm~~1~sig', CHAT)).toBeNull();
  });
});
