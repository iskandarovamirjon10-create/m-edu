import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SecureLogger } from '../secure-logger';

describe('SecureLogger — sensitive data redaction (P0 biometric exposure)', () => {
  let consoleLogSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('redacts embedding fields from log context', () => {
    const logger = new SecureLogger('info');
    logger.info('recognition', {
      embedding: [0.1, 0.2, 0.3],
      templateData: 'base64-encoded-face-template',
      studentId: 'student-1',
    });
    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(output.context.embedding).toBe('[REDACTED]');
    expect(output.context.templateData).toBe('[REDACTED]');
    expect(output.context.studentId).toBe('student-1');
  });

  it('redacts tokens, passwords, api keys, secrets', () => {
    const logger = new SecureLogger('info');
    logger.info('auth', {
      accessToken: 'jwt.token.payload',
      password: 'hunter2',
      apiKey: 'fp_abcdef',
      secret: 'shh',
      biometric: 'raw-face-data',
    });
    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(output.context.accessToken).toBe('[REDACTED]');
    expect(output.context.password).toBe('[REDACTED]');
    expect(output.context.apiKey).toBe('[REDACTED]');
    expect(output.context.secret).toBe('[REDACTED]');
    expect(output.context.biometric).toBe('[REDACTED]');
  });

  it('redacts RTSP/HTTP credentials embedded in stream URIs', () => {
    const logger = new SecureLogger('info');
    logger.info('connecting to rtsp://admin:secret@10.0.0.5:554/ch1', {
      streamUri: 'rtsp://admin:secret@10.0.0.5:554/ch1',
    });
    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(output.message).not.toContain('secret');
    expect(output.message).toContain('rtsp://***:***@');
    expect(String(output.context.streamUri)).not.toContain('secret');
    expect(String(output.context.streamUri)).toContain('***:***@');
  });

  it('recursively redacts nested objects', () => {
    const logger = new SecureLogger('info');
    logger.info('nested', {
      user: { token: 'abc', name: 'Ali' },
      meta: [{ apiKeyHash: 'xyz' }],
    });
    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(output.context.user.token).toBe('[REDACTED]');
    expect(output.context.user.name).toBe('Ali');
    expect(output.context.meta[0].apiKeyHash).toBe('[REDACTED]');
  });

  it('respects min level filtering', () => {
    const logger = new SecureLogger('error');
    logger.debug('debug-msg');
    logger.info('info-msg');
    expect(consoleLogSpy).not.toHaveBeenCalled();
    logger.error('error-msg');
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
  });

  it('never logs raw error stack containing sensitive values in context', () => {
    const logger = new SecureLogger('info');
    logger.error('failed', { password: 'secret' }, new Error('boom'));
    const output = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
    expect(output.context.password).toBe('[REDACTED]');
    expect(output.error).toBe('boom');
  });

  it('redacts secrets interpolated into free-form messages (regression: FS-1)', () => {
    const logger = new SecureLogger('info');
    logger.info('auth failed for user admin with password hunter2');
    logger.info('connecting with token=abc123secret');
    logger.info('apikey fp_deadbeefdeadbeef');
    const outputs = consoleLogSpy.mock.calls.map((c) => JSON.parse(c[0]).message as string);
    expect(outputs[0]).not.toMatch(/hunter2/);
    expect(outputs[0]).toContain('[REDACTED]');
    expect(outputs[1]).not.toMatch(/abc123secret/);
    expect(outputs[1]).toContain('[REDACTED]');
    expect(outputs[2]).not.toMatch(/fp_deadbeefdeadbeef/);
    expect(outputs[2]).toContain('[REDACTED]');
  });

  it('redacts Authorization: Bearer tokens in messages (regression: FS-1)', () => {
    const logger = new SecureLogger('info');
    logger.info('Authorization: Bearer eyJhbGciOiJIUzI1NiJ9');
    const msg = JSON.parse(consoleLogSpy.mock.calls[0][0]).message as string;
    expect(msg).not.toContain('eyJhbGciOiJIUzI1NiJ9');
    expect(msg).toContain('[REDACTED]');
  });
});