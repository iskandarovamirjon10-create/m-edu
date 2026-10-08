import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  initErrorReporting,
  reportClientError,
  uninstallErrorReporting,
} from '../errorReporter';

describe('errorReporter (production telemetry)', () => {
  let sent: string[];
  const transport = (payload: string) => sent.push(payload);
  const enabled = { enabled: true, endpoint: 'https://sink.example/client-errors', transport };

  beforeEach(() => {
    sent = [];
  });

  afterEach(() => {
    uninstallErrorReporting();
  });

  it('is a no-op when disabled (development / no endpoint)', () => {
    expect(reportClientError(new Error('x'), 'window', { enabled: false })).toBe(false);
    expect(sent).toHaveLength(0);
  });

  it('sends a structured payload with truncated message and stack', () => {
    const error = new Error('m'.repeat(600));
    error.stack = 's'.repeat(5_000);

    const ok = reportClientError(error, 'window', enabled);

    expect(ok).toBe(true);
    expect(sent).toHaveLength(1);
    const report = JSON.parse(sent[0]);
    expect(report.message).toHaveLength(500);
    expect(report.stack).toHaveLength(4000);
    expect(report.source).toBe('window');
    expect(typeof report.route).toBe('string');
  });

  it('never attaches cookies or credentials (anonymous sink contract)', () => {
    // The payload is the only thing the transport receives — no headers,
    // no cookies, no session material.
    reportClientError(new Error('clean payload'), 'window', enabled);
    const report = JSON.parse(sent[0]);
    expect(Object.keys(report).sort()).toEqual(
      ['message', 'route', 'release', 'source', 'stack'].filter((k) =>
        Object.prototype.hasOwnProperty.call(report, k),
      ),
    );
    expect(JSON.stringify(report)).not.toMatch(/access_token|cookie/i);
  });

  it('dedupes repeated crash messages within the window', () => {
    reportClientError(new Error('boom'), 'window', enabled);
    reportClientError(new Error('boom'), 'window', enabled);
    reportClientError(new Error('boom'), 'window', enabled);
    expect(sent).toHaveLength(1);
  });

  it('init installs window + unhandledrejection listeners (idempotent)', () => {
    expect(initErrorReporting(enabled)).toBe(true);
    expect(initErrorReporting(enabled)).toBe(true); // second call: no-op

    window.dispatchEvent(new ErrorEvent('error', { error: new Error('kaboom') }));
    window.dispatchEvent(new Event('unhandledrejection'));

    expect(sent).toHaveLength(2);
    const sources = sent.map((p) => JSON.parse(p).source);
    expect(sources).toContain('window');
    expect(sources).toContain('promise');
  });

  it('init returns false and installs nothing when disabled', () => {
    expect(initErrorReporting({ enabled: false })).toBe(false);
    // No listeners were attached — a direct call must also stay off.
    expect(reportClientError(new Error('ignored'), 'window', { enabled: false })).toBe(false);
    expect(sent).toHaveLength(0);
  });
});
