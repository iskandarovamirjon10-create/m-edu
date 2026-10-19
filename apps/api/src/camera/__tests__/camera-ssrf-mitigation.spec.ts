/**
 * P0-002 — Camera SSRF / DNS-rebinding remediation.
 *
 * The vulnerability is fixed only when ONE destination is used end-to-end:
 *
 *   hostname → DNS → SSRF validation → validated IP → runtime socket → FFmpeg
 *
 * A fix that validates a hostname and later lets FFmpeg resolve that hostname
 * again is NOT a fix: between the two resolutions the attacker flips DNS to an
 * internal address (169.254.169.254, 127.0.0.1, ...).
 *
 * These tests prove every hop of the chain, deterministically and offline:
 *
 *   1. CameraService pins the validated IP at write time; clients can neither
 *      supply nor delete the pin.
 *   2. CameraWorkerManagerService.buildStreamUri() consumes the pin (or
 *      re-validates it) and ALWAYS writes an IP literal into the RTSP URI.
 *   3. The RTSP/ONVIF providers open their socket to that literal.
 *   4. CameraWorkerSession hands the identical URI to FfmpegStreamIngester —
 *      on the first connect AND on reconnect — and FFmpeg's `-i` is that URI.
 *
 * Rebinding is modelled three ways, none of which needs a real DNS server:
 *   - a stub resolver whose answer is switched to a forbidden address AFTER
 *     validation (assert the resolver is never consulted again),
 *   - `localhost` (hosts-file backed, always resolves) used as a name whose
 *     answer is loopback: with strict policy a re-resolution FAILS, so a
 *     successful URI build proves no re-resolution happened,
 *   - an unresolvable `.invalid` hostname at the provider layer: a successful
 *     connection proves the name was never resolved.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import * as net from 'node:net';

import type { EncryptionPort, FaceEngine } from '@medu/core';
import {
  FfmpegStreamIngester,
  NetworkSecurity,
  OnvifProvider,
  RtspProvider,
} from '@medu/camera-engine';

import type { PrismaService } from '../../prisma/prisma.service';
import type { CameraAlertingService } from '../camera-alerting.service';
import type { AttendanceDecisionEngine } from '../attendance-decision.engine';
import { CameraService } from '../camera.service';
import { CameraWorkerManagerService } from '../camera-worker-manager.service';
import { CameraWorkerSession } from '../camera-worker-session';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type MockFn = ReturnType<typeof vi.fn>;

/** Production-like policy: no loopback, no private/link-local/metadata ranges. */
function strictSecurity(): NetworkSecurity {
  return new NetworkSecurity({
    allowPrivateIps: false,
    allowLoopback: false,
  });
}

interface DnsSecurity {
  validateHost: MockFn;
  validateIp: MockFn;
}

/**
 * A NetworkSecurity stand-in whose DNS answers are scripted per test.
 *
 * Behaves like the real class: literals are checked directly, hostnames are
 * resolved and the ANSWER is then checked with the real strict policy — so a
 * scripted `169.254.169.254` answer is rejected exactly like production.
 */
function scriptedResolver(
  answers: Record<string, string>,
): NetworkSecurity {
  const real = strictSecurity();

  const validateHost = vi.fn(
    async (host: string): Promise<string> => {
      const trimmed = host.trim();
      if (net.isIP(trimmed)) {
        return real.validateIp(trimmed);
      }
      const answer = answers[trimmed];
      if (!answer) {
        throw new Error(
          `Unable to resolve camera host: ${trimmed}`,
        );
      }
      return real.validateIp(answer);
    },
  );

  const validateIp = vi.fn((ip: string): string =>
    real.validateIp(ip),
  );

  return {
    validateHost,
    validateIp,
  } as unknown as NetworkSecurity;
}

function resolverOf(
  security: NetworkSecurity,
): DnsSecurity {
  return security as unknown as DnsSecurity;
}

function makePrisma() {
  return {
    camera: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    cameraAttendanceEvent: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    faceTemplate: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
}

function makeCameraRecord(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 'cam-1',
    organizationId: 'org-1',
    name: 'Entrance Camera',
    vendor: 'Generic',
    model: null,
    protocol: 'RTSP',
    host: 'cam.attacker.test',
    port: 554,
    streamPath: '/live',
    rtspTransport: 'tcp',
    location: null,
    credentialConfigured: false,
    encryptedCredentials: null,
    processingFps: 3,
    enabled: true,
    recognitionEnabled: true,
    attendanceEnabled: true,
    status: 'CONFIGURED',
    lastSeenAt: null,
    lastErrorAt: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    reconnectCount: 0,
    metadata: null,
    createdAt: new Date('2026-09-01T10:00:00Z'),
    updatedAt: new Date('2026-09-01T10:00:00Z'),
    ...overrides,
  };
}

function makeService(security: NetworkSecurity) {
  const prisma = makePrisma();
  const service = new CameraService(
    prisma as unknown as PrismaService,
    security,
  );
  return { service, prisma };
}

interface WorkerManagerInternals {
  networkSecurity: NetworkSecurity;
  buildStreamUri(
    camera: unknown,
    credentials: { username?: string; password?: string },
  ): Promise<string>;
  buildWorkerConfig(
    camera: unknown,
    streamUri: string,
  ): WorkerConfig;
}

interface WorkerConfig {
  cameraId: string;
  organizationId: string;
  name: string;
  streamUri: string;
  processingFps: number;
  rtspTransport: 'tcp' | 'udp';
  location: string | null;
  recognitionEnabled: boolean;
  attendanceEnabled: boolean;
  similarityThreshold: number;
}

function makeManager(security: NetworkSecurity) {
  const prisma = makePrisma();
  const manager = new CameraWorkerManagerService(
    prisma as unknown as PrismaService,
    {} as CameraAlertingService,
  );
  internalsOf(manager).networkSecurity = security;
  return manager;
}

function internalsOf(
  manager: CameraWorkerManagerService,
): WorkerManagerInternals {
  return manager as unknown as WorkerManagerInternals;
}

function buildStreamUri(
  manager: CameraWorkerManagerService,
  camera: Record<string, unknown>,
  credentials: { username?: string; password?: string } = {},
): Promise<string> {
  return internalsOf(manager).buildStreamUri(
    camera,
    credentials,
  );
}

function cameraForWorker(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 'cam-1',
    organizationId: 'org-1',
    name: 'Entrance Camera',
    processingFps: 3,
    rtspTransport: 'tcp',
    location: null,
    recognitionEnabled: true,
    attendanceEnabled: true,
    ...overrides,
  };
}

const encryption = {
  encrypt: async (data: unknown) => String(data),
  decrypt: async (payload: string) => payload,
} as unknown as EncryptionPort;

function makeSession(config: WorkerConfig) {
  const prisma = makePrisma();
  return new CameraWorkerSession(
    config,
    {} as FaceEngine,
    {} as AttendanceDecisionEngine,
    prisma as unknown as Pick<PrismaService, 'faceTemplate'>,
    encryption,
  );
}

type SessionInternals = {
  ingester: { streamUri: string } | null;
  handleStreamClose(code: number | null): void;
};

function ingesterUri(session: CameraWorkerSession): string {
  const ingester = (session as unknown as SessionInternals)
    .ingester;
  expect(ingester).not.toBeNull();
  return ingester!.streamUri;
}

/**
 * Prototype-level socket recorder: captures the destination passed to
 * `net.Socket#connect()` (the actual TCP connect) and the exact bytes written
 * (the RTSP request line), then answers with a synthetic RTSP 200 so the probe
 * completes without touching the network.
 */
function recordSockets() {
  const connections: Array<{ port: number; host: string }> = [];
  const requests: string[] = [];

  const socketProto = net.Socket.prototype as unknown as Record<
    string,
    (...args: unknown[]) => unknown
  >;

  const originalConnect = socketProto.connect;
  const originalWrite = socketProto.write;

  socketProto.connect = function (
    this: net.Socket,
    ...args: unknown[]
  ): unknown {
    const hasNumericPort = typeof args[0] === 'number';
    const port = Number(hasNumericPort ? args[0] : args[1]);
    const host = String(hasNumericPort ? args[1] : args[0]);
    const callback = hasNumericPort ? args[2] : args[1];

    connections.push({ port, host });

    queueMicrotask(() => {
      if (typeof callback === 'function') {
        (callback as () => void).call(this);
      }
      this.emit('connect');
    });

    return this;
  };

  socketProto.write = function (
    this: net.Socket,
    ...args: unknown[]
  ): boolean {
    requests.push(String(args[0]));
    queueMicrotask(() => {
      this.emit(
        'data',
        Buffer.from(
          'RTSP/1.0 200 OK\r\nCSeq: 1\r\nServer: mock-camera\r\n\r\n',
        ),
      );
    });
    return true;
  };

  return {
    connections,
    requests,
    restore() {
      socketProto.connect = originalConnect;
      socketProto.write = originalWrite;
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// 1. Write path — the validated IP is captured, and only the server can pin it
// ---------------------------------------------------------------------------

describe('CameraService — validated destination pin', () => {
  it('stores the validated IP for the host and ignores a client-supplied pin', async () => {
    const security = scriptedResolver({
      'cam.attacker.test': '203.0.113.10',
    });
    const { service, prisma } = makeService(security);

    let persisted: unknown;
    prisma.camera.create.mockImplementation(
      async (args: { data: Record<string, unknown> }) => {
        persisted = args.data.metadata;
        return makeCameraRecord(args.data);
      },
    );

    await service.createCamera('org-1', {
      name: 'Entrance Camera',
      host: 'cam.attacker.test',
      // Attacker-controlled metadata: must never win over the validated IP.
      metadata: {
        site: 'A',
        validatedIp: '169.254.169.254',
        validatedHost: 'evil.test',
      },
    });

    expect(resolverOf(security).validateHost).toHaveBeenCalledWith(
      'cam.attacker.test',
    );
    expect(persisted).toEqual({
      site: 'A',
      validatedIp: '203.0.113.10',
      validatedHost: 'cam.attacker.test',
    });
  });

  it('keeps the pin when only unrelated metadata is updated', async () => {
    const security = scriptedResolver({});
    const { service, prisma } = makeService(security);

    prisma.camera.findFirst.mockResolvedValue(
      makeCameraRecord({
        metadata: {
          site: 'A',
          validatedIp: '203.0.113.10',
          validatedHost: 'cam.attacker.test',
        },
      }),
    );
    prisma.camera.update.mockResolvedValue(
      makeCameraRecord(),
    );

    await service.updateCamera('org-1', 'cam-1', {
      metadata: {
        validatedIp: '169.254.169.254',
        validatedHost: 'evil.test',
        extra: 1,
      },
    });

    const update = prisma.camera.update.mock.calls[0][0] as {
      data: { metadata: Record<string, unknown> };
    };

    expect(update.data.metadata).toEqual({
      site: 'A',
      extra: 1,
      validatedIp: '203.0.113.10',
      validatedHost: 'cam.attacker.test',
    });
  });

  it('re-pins to the freshly validated IP when the host changes', async () => {
    const security = scriptedResolver({
      'new-cam.example.test': '198.51.100.20',
    });
    const { service, prisma } = makeService(security);

    prisma.camera.findFirst.mockResolvedValue(
      makeCameraRecord({
        metadata: {
          validatedIp: '203.0.113.10',
          validatedHost: 'old-cam.example.test',
        },
      }),
    );
    prisma.camera.update.mockResolvedValue(
      makeCameraRecord(),
    );

    await service.updateCamera('org-1', 'cam-1', {
      host: 'new-cam.example.test',
    });

    const update = prisma.camera.update.mock.calls[0][0] as {
      data: {
        host: string;
        metadata: Record<string, unknown>;
      };
    };

    expect(update.data.host).toBe('new-cam.example.test');
    expect(update.data.metadata).toEqual({
      validatedIp: '198.51.100.20',
      validatedHost: 'new-cam.example.test',
    });
  });

  it('rejects a forbidden host before anything is written', async () => {
    const security = strictSecurity();
    const { service, prisma } = makeService(security);

    await expect(
      service.createCamera('org-1', {
        name: 'Metadata camera',
        host: '169.254.169.254',
      }),
    ).rejects.toThrow(/(Private network address|Private link-local)/);

    expect(prisma.camera.create).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 2. Stream URI — always an IP literal, never a re-resolved hostname
// ---------------------------------------------------------------------------

describe('CameraWorkerManagerService.buildStreamUri — DNS rebinding', () => {
  it('uses the pinned IP and never consults DNS again after rebinding', async () => {
    const security = scriptedResolver({
      'cam.attacker.test': '203.0.113.10',
    });
    const { service, prisma } = makeService(security);

    let pinned: Record<string, unknown> | null = null;
    prisma.camera.create.mockImplementation(
      async (args: { data: Record<string, unknown> }) => {
        pinned = args.data.metadata as Record<
          string,
          unknown
        >;
        return makeCameraRecord(args.data);
      },
    );

    await service.createCamera('org-1', {
      name: 'Entrance Camera',
      host: 'cam.attacker.test',
    });
    expect(pinned).not.toBeNull();

    // --- DNS rebinding: the attacker now points the name at the cloud
    // metadata service. A re-resolution would be rejected (or, worse, used).
    const resolver = resolverOf(security);
    resolver.validateHost.mockReset();
    resolver.validateHost.mockRejectedValue(
      new Error(
        'Private network address not allowed: 169.254.169.254',
      ),
    );

    const manager = makeManager(security);
    const uri = await buildStreamUri(manager, {
      host: 'cam.attacker.test',
      port: 554,
      protocol: 'RTSP',
      streamPath: '/live',
      metadata: pinned,
    });

    // The destination is the IP that passed validation before the flip...
    expect(uri).toBe('rtsp://203.0.113.10:554/live');
    expect(uri).not.toContain('cam.attacker.test');
    // ...and the (now hostile) resolver was never asked again.
    expect(resolver.validateHost).not.toHaveBeenCalled();
  });

  it('fail-closed with the real resolver: a re-resolved loopback answer is rejected, the pin is not', async () => {
    const security = strictSecurity();
    const manager = makeManager(security);

    // `localhost` always resolves (hosts file) to ::1/127.0.0.1 — the offline
    // stand-in for "DNS now points at an internal address". Under strict
    // policy that answer is forbidden, so ANY code path that re-resolves the
    // host makes this test fail.
    const pinnedUri = await buildStreamUri(manager, {
      host: 'localhost',
      port: 554,
      protocol: 'RTSP',
      streamPath: '/live',
      metadata: {
        validatedIp: '203.0.113.10',
        validatedHost: 'localhost',
      },
    });
    expect(pinnedUri).toBe('rtsp://203.0.113.10:554/live');

    // No pin → the host must be resolved and validated → loopback → rejected.
    await expect(
      buildStreamUri(manager, {
        host: 'localhost',
        port: 554,
        protocol: 'RTSP',
        streamPath: '/live',
        metadata: null,
      }),
    ).rejects.toThrow(/Loopback address not allowed/);
  });

  it('ignores a pin recorded for a different host', async () => {
    const security = strictSecurity();
    const manager = makeManager(security);

    const uri = await buildStreamUri(manager, {
      host: '203.0.113.99',
      port: 554,
      protocol: 'RTSP',
      streamPath: '/live',
      metadata: {
        validatedIp: '203.0.113.10',
        validatedHost: 'other-camera.example.test',
      },
    });

    // The pin does not belong to this host: fall back to validating the host.
    expect(uri).toBe('rtsp://203.0.113.99:554/live');
  });

  it('never redirects to a tampered pin (cloud metadata service)', async () => {
    const security = strictSecurity();
    const manager = makeManager(security);

    // Tampered row: attacker overwrote metadata.validatedIp directly in the DB.
    const uri = await buildStreamUri(manager, {
      host: '203.0.113.50',
      port: 554,
      protocol: 'RTSP',
      streamPath: '/live',
      metadata: {
        validatedIp: '169.254.169.254',
        validatedHost: '203.0.113.50',
      },
    });

    expect(uri).toBe('rtsp://203.0.113.50:554/live');
    expect(uri).not.toContain('169.254.169.254');
  });

  it('fails closed when neither the pin nor the host is acceptable', async () => {
    const security = strictSecurity();
    const manager = makeManager(security);

    await expect(
      buildStreamUri(manager, {
        host: 'localhost',
        port: 554,
        protocol: 'RTSP',
        streamPath: '/live',
        metadata: { validatedIp: '169.254.169.254' },
      }),
    ).rejects.toThrow(/Private network address|Loopback address/);
  });

  it('brackets IPv6 literals and keeps forbidden IPv6 ranges out', async () => {
    const security = strictSecurity();
    const manager = makeManager(security);

    const uri = await buildStreamUri(manager, {
      host: 'my-ipv6-cam.local',
      port: 554,
      protocol: 'RTSP',
      streamPath: '/stream',
      metadata: {
        validatedIp: '2001:db8::1',
        validatedHost: 'my-ipv6-cam.local',
      },
    });
    expect(uri).toBe('rtsp://[2001:db8::1]:554/stream');

    // A pin that no longer passes policy (IPv6 unique-local) must never be
    // the destination: resolution falls back to validating the host itself,
    // so the URI carries the host's allowed address instead of the pin.
    const uiaPinUri = await buildStreamUri(manager, {
      host: '203.0.113.44',
      port: 554,
      protocol: 'RTSP',
      streamPath: '/stream',
      metadata: {
        validatedIp: 'fd12:3456:789a::1',
        validatedHost: '203.0.113.44',
      },
    });
    expect(uiaPinUri).toBe('rtsp://203.0.113.44:554/stream');
    expect(uiaPinUri).not.toContain('fd12');
  });

  it('keeps RTSP URL construction safe (credentials encoded, path normalized, CRLF rejected)', async () => {
    const security = strictSecurity();
    const manager = makeManager(security);
    const pin = {
      validatedIp: '203.0.113.10',
      validatedHost: '203.0.113.10',
    };

    const withCreds = await buildStreamUri(
      manager,
      {
        host: '203.0.113.10',
        port: 554,
        protocol: 'RTSP',
        streamPath: 'Streaming/Channels/101',
        metadata: pin,
      },
      { username: 'admin', password: 'p@ss:word' },
    );
    expect(withCreds).toBe(
      'rtsp://admin:p%40ss%3Aword@203.0.113.10:554/Streaming/Channels/101',
    );

    await expect(
      buildStreamUri(manager, {
        host: '203.0.113.10',
        port: 554,
        protocol: 'RTSP',
        streamPath: '/live\r\nX-Injected: 1',
        metadata: pin,
      }),
    ).rejects.toThrow(/control.*characters/);

    await expect(
      buildStreamUri(manager, {
        host: '203.0.113.10',
        port: 99999,
        protocol: 'RTSP',
        streamPath: '/live',
        metadata: pin,
      }),
    ).rejects.toThrow(/Invalid camera port/);
  });
});

// ---------------------------------------------------------------------------
// 3. FFmpeg — the validated destination is the literal passed to `-i`
// ---------------------------------------------------------------------------

describe('FFmpeg destination verification', () => {
  it('carries the validated IP from the camera record into the FFmpeg -i argument', async () => {
    const security = strictSecurity();
    const manager = makeManager(security);

    const uri = await buildStreamUri(manager, {
      host: 'cam.attacker.test',
      port: 554,
      protocol: 'RTSP',
      streamPath: '/live',
      metadata: {
        validatedIp: '198.51.100.7',
        validatedHost: 'cam.attacker.test',
      },
    });
    expect(uri).toBe('rtsp://198.51.100.7:554/live');

    const config = internalsOf(manager).buildWorkerConfig(
      cameraForWorker(),
      uri,
    );
    expect(config.streamUri).toBe(uri);

    const start = vi
      .spyOn(FfmpegStreamIngester.prototype, 'start')
      .mockResolvedValue(undefined);
    const session = makeSession(config);

    await session.start();

    const connectedUri = ingesterUri(session);
    expect(connectedUri).toBe(uri);

    const args = FfmpegStreamIngester.buildArgs(
      connectedUri,
      3,
      'tcp',
    );
    const inputIndex = args.indexOf('-i');
    expect(inputIndex).toBeGreaterThan(-1);
    expect(args[inputIndex + 1]).toBe(uri);
    // The hostname must not appear anywhere in the FFmpeg command line.
    expect(args.join(' ')).not.toContain('cam.attacker.test');

    await session.stop();
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('reconnect uses the same validated destination (no re-resolution)', async () => {
    vi.useFakeTimers();

    const security = strictSecurity();
    const manager = makeManager(security);

    const uri = await buildStreamUri(manager, {
      host: 'cam.attacker.test',
      port: 554,
      protocol: 'RTSP',
      streamPath: '/live',
      metadata: {
        validatedIp: '198.51.100.7',
        validatedHost: 'cam.attacker.test',
      },
    });

    vi.spyOn(
      FfmpegStreamIngester.prototype,
      'start',
    ).mockResolvedValue(undefined);

    const config = internalsOf(manager).buildWorkerConfig(
      cameraForWorker(),
      uri,
    );
    const session = makeSession(config);
    await session.start();

    const firstIngester = (
      session as unknown as SessionInternals
    ).ingester;
    expect(ingesterUri(session)).toBe(uri);

    // Stream dies → the worker schedules a reconnect (5s backoff).
    (session as unknown as SessionInternals).handleStreamClose(
      null,
    );
    await vi.advanceTimersByTimeAsync(15_000);

    const secondIngester = (
      session as unknown as SessionInternals
    ).ingester;
    expect(secondIngester).not.toBe(firstIngester);
    expect(ingesterUri(session)).toBe(uri);
    expect(ingesterUri(session)).not.toContain(
      'cam.attacker.test',
    );

    await session.stop();
  });
});

// ---------------------------------------------------------------------------
// 4. Connection layer — RTSP / ONVIF sockets open to the validated IP
// ---------------------------------------------------------------------------

describe('Provider connection layer', () => {
  it('RTSP connects to the validated IP and sends that IP in the request line', async () => {
    const sockets = recordSockets();
    try {
      const security = strictSecurity();
      const provider = new RtspProvider(security);

      const result = await provider.testConnection({
        // Unresolvable on purpose: if the provider resolved this name the
        // whole test would fail with HOST_FORBIDDEN instead of connecting.
        host: 'rebind-camera.invalid',
        validatedIp: '198.51.100.7',
        port: 554,
        protocol: 'RTSP',
        streamPath: '/live',
        timeoutMs: 100,
      });

      expect(result.success).toBe(true);
      expect(result.errorCode).toBeUndefined();

      expect(sockets.connections.length).toBeGreaterThan(0);
      for (const conn of sockets.connections) {
        expect(conn.host).toBe('198.51.100.7');
        expect(conn.host).not.toBe('rebind-camera.invalid');
      }

      const describe = sockets.requests[0];
      expect(describe).toMatch(
        /^DESCRIBE rtsp:\/\/198\.51\.100\.7:554\/live RTSP\/1\.0\r\n/,
      );
      expect(describe).not.toContain('rebind-camera.invalid');
    } finally {
      sockets.restore();
    }
  });

  it('ONVIF connects to the validated IP', async () => {
    const sockets = recordSockets();
    try {
      const provider = new OnvifProvider(strictSecurity());

      const result = await provider.testConnection({
        host: 'rebind-camera.invalid',
        validatedIp: '198.51.100.7',
        port: 80,
        protocol: 'ONVIF',
        timeoutMs: 100,
      });

      expect(result.success).toBe(true);
      expect(sockets.connections).toEqual([
        { port: 80, host: '198.51.100.7' },
      ]);
    } finally {
      sockets.restore();
    }
  });

  it('validates the host itself when no validated IP is supplied', async () => {
    const sockets = recordSockets();
    try {
      const provider = new RtspProvider(strictSecurity());

      // No pin → the hostname must be resolved and validated first.
      const unresolved = await provider.testConnection({
        host: 'rebind-camera.invalid',
        port: 554,
        protocol: 'RTSP',
        timeoutMs: 100,
      });

      expect(unresolved.success).toBe(false);
      expect(unresolved.errorCode).toBe('HOST_FORBIDDEN');
      expect(unresolved.message).toMatch(
        /Unable to resolve camera host/,
      );
      expect(sockets.connections).toHaveLength(0);

      // A forbidden literal is rejected outright, still without a socket.
      const forbidden = await provider.testConnection({
        host: '169.254.169.254',
        port: 554,
        protocol: 'RTSP',
        timeoutMs: 100,
      });
      expect(forbidden.success).toBe(false);
      expect(forbidden.errorCode).toBe('HOST_FORBIDDEN');
      expect(forbidden.message).toMatch(
        /(Private network address|Private link-local)/,
      );
      expect(sockets.connections).toHaveLength(0);
    } finally {
      sockets.restore();
    }
  });

  it('rejects a stream path containing RTSP header injection before opening a socket', async () => {
    const sockets = recordSockets();
    try {
      const provider = new RtspProvider(strictSecurity());

      const result = await provider.testConnection({
        host: 'rebind-camera.invalid',
        validatedIp: '198.51.100.7',
        port: 554,
        protocol: 'RTSP',
        streamPath: '/live\r\nAuthorization: Basic YWJj',
        timeoutMs: 100,
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_STREAM_PATH');
      expect(sockets.connections).toHaveLength(0);
      expect(sockets.requests).toHaveLength(0);
    } finally {
      sockets.restore();
    }
  });

  it('brackets IPv6 literals in the RTSP request line', async () => {
    const sockets = recordSockets();
    try {
      const provider = new RtspProvider(strictSecurity());

      const result = await provider.testConnection({
        host: '2001:db8::1',
        port: 554,
        protocol: 'RTSP',
        streamPath: '/live',
        timeoutMs: 100,
      });

      expect(result.success).toBe(true);
      expect(sockets.requests[0]).toMatch(
        /^DESCRIBE rtsp:\/\/\[2001:db8::1\]:554\/live RTSP\/1\.0\r\n/,
      );
    } finally {
      sockets.restore();
    }
  });
});

// ---------------------------------------------------------------------------
// 5. IPv4 / IPv6 policy for the pre-validated destination
// ---------------------------------------------------------------------------

describe('NetworkSecurity.validateIp — no DNS, full range policy', () => {
  const security = strictSecurity();

  it('rejects a host name instead of resolving it', () => {
    // The whole point: validateIp() must never turn a name into an address.
    expect(() =>
      security.validateIp('camera.attacker.test'),
    ).toThrow(/got host name/);
    expect(() => security.validateIp('')).toThrow(
      /required/,
    );
  });

  it.each([
    ['127.0.0.1', /Loopback/],
    ['127.8.8.8', /Loopback/],
    ['0.0.0.0', /Loopback/],
    ['10.0.0.5', /Private/],
    ['172.16.0.5', /Private/],
    ['172.31.255.255', /Private/],
    ['192.168.1.1', /Private/],
    ['169.254.169.254', /Private/],
    ['100.64.0.1', /Private/],
    ['224.0.0.1', /Private/],
    ['::1', /Loopback/],
    ['fe80::1', /Private/],
    ['fd12:3456:789a::1', /Private/],
    ['fc00::1', /Private/],
    ['::ffff:169.254.169.254', /Private/],
  ])('rejects %s', (ip, pattern) => {
    expect(() => security.validateIp(ip)).toThrow(pattern);
  });

  it.each([
    ['203.0.113.10'],
    ['198.51.100.7'],
    ['8.8.8.8'],
    ['2001:db8::1'],
  ])('accepts %s and returns it unchanged', (ip) => {
    expect(security.validateIp(ip)).toBe(ip);
  });

  it('resolves a host name to a validated IP (never returns the name)', async () => {
    // Loopback is permitted here only so the hosts-file answer for
    // `localhost` can be observed; the assertion is about the shape of the
    // return value: an address, never the host name.
    const security = new NetworkSecurity({
      allowPrivateIps: false,
      allowLoopback: true,
    });

    const ip = await security.validateHost('localhost');
    expect(net.isIP(ip)).toBeTruthy();
    expect(ip).not.toBe('localhost');
  });
});
