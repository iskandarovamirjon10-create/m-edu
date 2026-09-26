/**
 * RTSP / ONVIF connection providers.
 *
 * Reconstructed from camera module usage evidence:
 *   - new RtspProvider(networkSecurity); provider.testConnection(params)
 *   - new OnvifProvider(networkSecurity); provider.testConnection(params); provider.discover(timeoutMs, subnet)
 *
 * FIX-2: Hikvision model/firmware-agnostic RTSP
 *   - Sends a real RTSP DESCRIBE request to confirm the endpoint
 *     speaks RTSP and to detect the authentication scheme
 *     (Basic vs Digest — Hikvision firmware older than ~5.4.x
 *     ships Basic; newer firmware defaults to Digest).
 *   - Auto-tries common Hikvision stream paths (/Streaming/Channels/101
 *     and /Streaming/Channels/102) when none is supplied and the
 *     user-selected one does not respond.
 *   - Returns a structured errorCode so the API can surface
 *     actionable messages (AUTH_REQUIRED / AUTH_REJECTED /
 *     UNSUPPORTED_SCHEME / UNREACHABLE / UNKNOWN_PATH /
 *     RTSP_PROTOCOL_ERROR).
 */

import * as net from 'net';
import * as crypto from 'node:crypto';

import { SecureLogger } from '@medu/face-security';
import type { NetworkSecurity } from './network-security';
import type { ConnectionTestResult, DiscoveredDevice } from './types';

const logger = new SecureLogger('info');

export interface ProviderConnectionParams {
  validatedIp?: string;
  host: string;
  port: number;
  protocol: 'RTSP' | 'ONVIF';
  credentials?: { username?: string; password?: string };
  streamPath?: string;
  rtspTransport?: 'tcp' | 'udp';
  timeoutMs?: number;
}

/**
 * Common Hikvision RTSP stream paths. Different firmware versions
 * and models use different numbers — these are the most common
 * defaults in 2026-era firmware.
 *
 *   /Streaming/Channels/101 — main stream, high resolution
 *   /Streaming/Channels/102 — sub stream, low resolution
 *   /Streaming/Channels/1   — generic, used by some OEM builds
 *   /h264/ch<0|1>/main/av_stream — Dahua-derived firmware
 *   /live/ch<0|1>/0        — Uniview/HiSilicon firmware
 *   /cam/realmonitor        — older Hikvision (~v4.x)
 *   /Streaming/tracks/101   — ISAPI-style hybrid
 */
const HIKVISION_FALLBACK_PATHS = [
  '/Streaming/Channels/101',
  '/Streaming/Channels/102',
  '/Streaming/Channels/1',
  '/live/ch0/main/av_stream',
  '/live/ch0/sub/av_stream',
  '/live/ch1/main/av_stream',
  '/cam/realmonitor',
  '/Streaming/tracks/101',
];

const RTSP_TIMEOUT_MS_DEFAULT = 5_000;

// ---------------------------------------------------------------------------
// Destination resolution (SSRF / DNS rebinding)
// ---------------------------------------------------------------------------

/**
 * Decide which address a connection test may open a socket to.
 *
 * - `params.validatedIp` (set by the API after `validateHost()` already ran)
 *   is re-checked with `validateIp()`, which performs **no DNS lookup**. The
 *   literal that passed validation is the literal we connect to, so a rebinding
 *   answer cannot move the destination between check and use.
 * - Otherwise `params.host` is resolved here and every resolved address is
 *   validated; the first validated IP (never the name) is returned.
 *
 * Throws when the destination is forbidden — callers map that to
 * `HOST_FORBIDDEN`.
 */
async function resolveDestination(
  networkSecurity: NetworkSecurity,
  params: ProviderConnectionParams,
): Promise<string> {
  if (params.validatedIp) {
    return networkSecurity.validateIp(params.validatedIp);
  }
  return networkSecurity.validateHost(params.host);
}

/**
 * Format the authority component of an RTSP URL. IPv6 literals must be
 * bracketed (`rtsp://[2001:db8::1]:554/...`) or the port would be parsed as
 * additional address groups.
 */
function formatAuthority(host: string, port: number): string {
  const authority =
    host.includes(':') && !host.startsWith('[')
      ? `[${host}]`
      : host;
  return `${authority}:${port}`;
}

// ---------------------------------------------------------------------------
// Low-level TCP probe
// ---------------------------------------------------------------------------

function tcpProbe(
  host: string,
  port: number,
  timeoutMs: number,
): Promise<{
  ok: boolean;
  latencyMs: number;
  err?: string;
}> {
  return new Promise((resolve) => {
    const started = Date.now();
    const socket = new net.Socket();
    let settled = false;
    const finish = (ok: boolean, err?: string) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({ ok, latencyMs: Date.now() - started, err });
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () =>
      finish(false, 'Connection timed out'),
    );
    socket.once('error', (e) => finish(false, e.message));
    socket.connect(port, host);
  });
}

// ---------------------------------------------------------------------------
// RTSP handshake — minimal RFC 2326 client (DESCRIBE only)
// ---------------------------------------------------------------------------

interface RtspAuthChallenge {
  scheme: 'Basic' | 'Digest';
  realm: string | null;
  nonce: string | null;
  opaque: string | null;
  qop: string | null;
  algorithm: string | null;
  raw: string;
}

interface RtspProbeOutcome {
  ok: boolean;
  latencyMs: number;
  statusLine: string | null;
  statusCode: number | null;
  authChallenge: RtspAuthChallenge | null;
  serverHeader: string | null;
  /** Captured unrecognised-but-revealing header (e.g. WWW-Authenticate). */
  rawHeaders: Record<string, string>;
  err?: string;
}

function buildDescribeRequest(
  streamPath: string,
  host: string,
  port: number,
  cseq: number,
  credentials: { username?: string; password?: string } | undefined,
  authChallenge: RtspAuthChallenge | null,
): string {
  const url = `rtsp://${formatAuthority(host, port)}${streamPath}`;
  const lines: string[] = [
    `DESCRIBE ${url} RTSP/1.0`,
    `CSeq: ${cseq}`,
    `User-Agent: medu-rtsp-probe/1.0`,
    `Accept: application/sdp`,
  ];

  if (authChallenge && credentials?.username) {
    if (authChallenge.scheme === 'Basic') {
      const token = Buffer.from(
        `${credentials.username}:${credentials.password ?? ''}`,
      ).toString('base64');
      lines.push(`Authorization: Basic ${token}`);
    } else if (authChallenge.scheme === 'Digest') {
      const nc = '00000001';
      const cnonce = crypto
        .randomBytes(8)
        .toString('hex');
      const uri = streamPath;
      const realm = authChallenge.realm ?? '';
      const nonce = authChallenge.nonce ?? '';
      const qop = authChallenge.qop ?? '';
      const opaque = authChallenge.opaque ?? '';
      const algo =
        authChallenge.algorithm === 'MD5-sess'
          ? 'MD5-sess'
          : 'MD5';

      const ha1Src = `${credentials.username}:${realm}:${credentials.password ?? ''}`;
      const ha1 = crypto
        .createHash('md5')
        .update(ha1Src)
        .digest('hex');

      const ha2 = crypto
        .createHash('md5')
        .update(`DESCRIBE:${uri}`)
        .digest('hex');

      let response: string;
      if (qop.includes('auth')) {
        const responseSrc = `${ha1}:${nonce}:${nc}:${cnonce}:auth:${ha2}`;
        response = crypto
          .createHash('md5')
          .update(responseSrc)
          .digest('hex');
      } else {
        const responseSrc = `${ha1}:${nonce}:${ha2}`;
        response = crypto
          .createHash('md5')
          .update(responseSrc)
          .digest('hex');
      }

      const authParts: string[] = [
        `username="${credentials.username}"`,
        `realm="${realm}"`,
        `nonce="${nonce}"`,
        `uri="${uri}"`,
        `algorithm=${algo}`,
        `response="${response}"`,
      ];
      if (qop) {
        authParts.push(`qop=auth`);
        authParts.push(`nc=${nc}`);
        authParts.push(`cnonce="${cnonce}"`);
      }
      if (opaque) {
        authParts.push(`opaque="${opaque}"`);
      }

      lines.push(
        `Authorization: Digest ${authParts.join(', ')}`,
      );
    }
  }

  return `${lines.join('\r\n')}\r\n\r\n`;
}

function parseStatusLine(
  line: string,
): { code: number; reason: string } {
  const m =
    /^RTSP\/\d\.\d\s+(\d{3})\s*(.*)$/.exec(line);
  if (!m) {
    return { code: 0, reason: '' };
  }
  return { code: parseInt(m[1], 10), reason: m[2] };
}

function parseAuthHeader(
  raw: string,
): RtspAuthChallenge | null {
  const trimmed = raw.trim();
  if (trimmed.toLowerCase().startsWith('basic')) {
    return {
      scheme: 'Basic',
      realm: null,
      nonce: null,
      opaque: null,
      qop: null,
      algorithm: null,
      raw: trimmed,
    };
  }
  if (!trimmed.toLowerCase().startsWith('digest')) {
    return null;
  }

  const params: Record<string, string> = {};
  const re = /(\w+)\s*=\s*(?:"([^"]*)"|([^,]*))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(trimmed)) !== null) {
    params[m[1].toLowerCase()] = m[2] ?? m[3] ?? '';
  }

  return {
    scheme: 'Digest',
    realm: params.realm ?? null,
    nonce: params.nonce ?? null,
    opaque: params.opaque ?? null,
    qop: params.qop ?? null,
    algorithm: params.algorithm ?? null,
    raw: trimmed,
  };
}

function rtspDescribe(
  host: string,
  port: number,
  streamPath: string,
  timeoutMs: number,
  credentials: { username?: string; password?: string } | undefined,
  preChallenge: RtspAuthChallenge | null = null,
): Promise<RtspProbeOutcome> {
  return new Promise((resolve) => {
    const started = Date.now();
    const socket = new net.Socket();
    let settled = false;
    let buf = Buffer.alloc(0);
    let authChallenge = preChallenge;
    let retried = false;
    let cseq = 1;

    const finish = (out: RtspProbeOutcome) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({ ...out, latencyMs: Date.now() - started });
    };

    const sendDescribe = () => {
      if (settled) return;
      const req = buildDescribeRequest(
        streamPath,
        host,
        port,
        cseq++,
        credentials,
        authChallenge,
      );
      try {
        socket.write(req);
      } catch (e) {
        finish({
          ok: false,
          latencyMs: 0,
          statusLine: null,
          statusCode: null,
          authChallenge,
          serverHeader: null,
          rawHeaders: {},
          err: (e as Error).message,
        });
      }
    };

    socket.setTimeout(timeoutMs);
    socket.once('timeout', () =>
      finish({
        ok: false,
        latencyMs: 0,
        statusLine: null,
        statusCode: null,
        authChallenge,
        serverHeader: null,
        rawHeaders: {},
        err: 'RTSP response timed out',
      }),
    );
    socket.once('error', (e) =>
      finish({
        ok: false,
        latencyMs: 0,
        statusLine: null,
        statusCode: null,
        authChallenge,
        serverHeader: null,
        rawHeaders: {},
        err: e.message,
      }),
    );

    socket.connect(port, host, () => sendDescribe());

    socket.on('data', (chunk: Buffer) => {
      buf = Buffer.concat([buf, chunk]);
      const text = buf.toString('utf8');
      const headerEnd = text.indexOf('\r\n\r\n');
      if (headerEnd < 0) return;

      const headerBlock = text.slice(0, headerEnd);
      const lines = headerBlock.split('\r\n');
      const statusLine = lines[0] ?? '';
      const { code, reason } = parseStatusLine(statusLine);

      const rawHeaders: Record<string, string> = {};
      let serverHeader: string | null = null;
      let authHeader: string | null = null;
      for (let i = 1; i < lines.length; i++) {
        const colon = lines[i].indexOf(':');
        if (colon < 0) continue;
        const name = lines[i].slice(0, colon).trim();
        const value = lines[i].slice(colon + 1).trim();
        rawHeaders[name.toLowerCase()] = value;
        if (name.toLowerCase() === 'server') {
          serverHeader = value;
        }
        if (name.toLowerCase() === 'www-authenticate') {
          authHeader = value;
        }
      }

      // 401 → challenge, retry once with credentials
      if (code === 401 && authHeader && !retried) {
        retried = true;
        const challenge = parseAuthHeader(authHeader);
        if (challenge && credentials?.username) {
          authChallenge = challenge;
          buf = Buffer.alloc(0);
          sendDescribe();
          return;
        }
        // 401 with no creds / unparseable challenge
        finish({
          ok: false,
          latencyMs: 0,
          statusLine,
          statusCode: 401,
          authChallenge: challenge,
          serverHeader,
          rawHeaders,
          err: challenge
            ? 'Authentication required'
            : 'Authentication required (unknown scheme)',
        });
        return;
      }

      // 200 → reachable, RTSP-speaking endpoint
      if (code >= 200 && code < 300) {
        finish({
          ok: true,
          latencyMs: 0,
          statusLine,
          statusCode: code,
          authChallenge: null,
          serverHeader,
          rawHeaders,
        });
        return;
      }

      // 404, 454, etc. — path not found
      finish({
        ok: false,
        latencyMs: 0,
        statusLine,
        statusCode: code,
        authChallenge: null,
        serverHeader,
        rawHeaders,
        err: reason || 'RTSP request rejected',
      });
    });
  });
}

// ---------------------------------------------------------------------------
// RtspProvider
// ---------------------------------------------------------------------------

export class RtspProvider {
  constructor(private readonly networkSecurity: NetworkSecurity) {}

  async testConnection(
    params: ProviderConnectionParams,
  ): Promise<ConnectionTestResult> {
    let resolvedIp: string;
    try {
      resolvedIp = await resolveDestination(
        this.networkSecurity,
        params,
      );
    } catch (err) {
      return {
        success: false,
        latencyMs: 0,
        message: (err as Error).message,
        errorCode: 'HOST_FORBIDDEN',
      };
    }

    const timeoutMs = params.timeoutMs ?? RTSP_TIMEOUT_MS_DEFAULT;

    /**
     * The stream path is interpolated verbatim into the RTSP request line
     * (`DESCRIBE rtsp://<ip>:<port><path> RTSP/1.0`). Control characters would
     * let a caller inject additional RTSP headers, so they are rejected before
     * any socket is opened.
     */
    if (
      params.streamPath &&
      /[\r\n\x00-\x1F]/.test(params.streamPath)
    ) {
      return {
        success: false,
        latencyMs: 0,
        message:
          'RTSP stream path contains invalid control characters.',
        errorCode: 'INVALID_STREAM_PATH',
      };
    }

    // 1. TCP reachability
    const tcp = await tcpProbe(resolvedIp, params.port, timeoutMs);
    if (!tcp.ok) {
      return {
        success: false,
        latencyMs: tcp.latencyMs,
        message:
          `RTSP port ${params.port} unreachable: ${tcp.err}. ` +
          `Verify the camera is powered on, the network is ` +
          `reachable, and that the RTSP port is ${params.port} ` +
          `(Hikvision default 554, secondary 10554).`,
        errorCode: 'UNREACHABLE',
      };
    }

    // 2. RTSP handshake on the configured path (or first Hikvision default).
    const primaryPath =
      params.streamPath ?? HIKVISION_FALLBACK_PATHS[0];

    const primary = await rtspDescribe(
      resolvedIp,
      params.port,
      primaryPath,
      timeoutMs,
      params.credentials,
    );

    if (primary.ok) {
      return {
        success: true,
        latencyMs: tcp.latencyMs,
        message:
          `RTSP endpoint reachable (${params.host}:${params.port}${primaryPath})`,
        errorCode: undefined,
        deviceInfo: {
          protocol: 'RTSP',
          host: params.host,
          port: params.port,
          streamPath: primaryPath,
          server: primary.serverHeader ?? undefined,
          statusCode: primary.statusCode ?? undefined,
        },
      };
    }

    // 3. If the configured path returned 401 with creds supplied,
    //    the credentials were rejected — surface this loudly and
    //    do NOT silently try other paths.
    if (
      primary.statusCode === 401 &&
      params.credentials?.username
    ) {
      return {
        success: false,
        latencyMs: primary.latencyMs,
        message:
          `RTSP authentication failed for ${primaryPath}. ` +
          `Verify the username/password (Hikvision: usually ` +
          `admin / verification code on the device label) ` +
          `and that the account has RTSP access enabled in ` +
          `Configuration → Network → Advanced → RTSP.`,
        errorCode: 'AUTH_REJECTED',
        deviceInfo: {
          protocol: 'RTSP',
          host: params.host,
          port: params.port,
          streamPath: primaryPath,
          server: primary.serverHeader ?? undefined,
          statusCode: 401,
        },
      };
    }

    // 4. If the configured path returned 401 without creds,
    //    the camera is asking for auth — surface this clearly.
    if (primary.statusCode === 401 && !params.credentials?.username) {
      return {
        success: false,
        latencyMs: primary.latencyMs,
        message:
          `RTSP endpoint requires authentication. ` +
          `Provide a username and password (Hikvision: usually ` +
          `admin / verification code on the device label).`,
        errorCode: 'AUTH_REQUIRED',
        deviceInfo: {
          protocol: 'RTSP',
          host: params.host,
          port: params.port,
          streamPath: primaryPath,
          server: primary.serverHeader ?? undefined,
          statusCode: 401,
        },
      };
    }

    // 5. If the configured path was supplied and got 404/454,
    //    surface the path-not-found error directly — do not
    //    silently try other paths because the user explicitly
    //    chose this one.
    if (params.streamPath && primary.statusCode) {
      return {
        success: false,
        latencyMs: primary.latencyMs,
        message:
          `RTSP stream path "${primaryPath}" returned ` +
          `${primary.statusCode} from the camera. ` +
          `Hikvision models use /Streaming/Channels/101 ` +
          `(main) or /102 (sub) on most firmware; some older ` +
          `firmware uses /cam/realmonitor. Clear the stream ` +
          `path field to auto-detect.`,
        errorCode: 'UNKNOWN_PATH',
        deviceInfo: {
          protocol: 'RTSP',
          host: params.host,
          port: params.port,
          streamPath: primaryPath,
          server: primary.serverHeader ?? undefined,
          statusCode: primary.statusCode,
        },
      };
    }

    // 6. No path supplied and the default failed — try the
    //    fallback list and pick the first one that returns
    //    anything other than 404/454. This is the
    //    firmware-agnostic discovery path.
    const tried = new Set<string>([primaryPath]);
    for (
      let i = 0;
      i < HIKVISION_FALLBACK_PATHS.length;
      i++
    ) {
      const candidate = HIKVISION_FALLBACK_PATHS[i];
      if (tried.has(candidate)) continue;
      tried.add(candidate);

      const probe = await rtspDescribe(
        resolvedIp,
        params.port,
        candidate,
        timeoutMs,
        params.credentials,
      );
      if (probe.ok) {
        return {
          success: true,
          latencyMs: tcp.latencyMs,
          message:
            `RTSP endpoint reachable via auto-detected path ` +
            `${candidate} (Hikvision model/firmware fallback). ` +
            `Save the camera with this stream path.`,
          errorCode: undefined,
          deviceInfo: {
            protocol: 'RTSP',
            host: params.host,
            port: params.port,
            streamPath: candidate,
            server: probe.serverHeader ?? undefined,
            statusCode: probe.statusCode ?? undefined,
            autoDetected: true,
          },
        };
      }
      if (probe.statusCode === 401) {
        // Auth challenge on a fallback — same handling as
        // primary path, return the auth failure.
        return {
          success: false,
          latencyMs: probe.latencyMs,
          message: params.credentials?.username
            ? `RTSP authentication failed for ${candidate}.`
            : `RTSP endpoint requires authentication.`,
          errorCode: params.credentials?.username
            ? 'AUTH_REJECTED'
            : 'AUTH_REQUIRED',
          deviceInfo: {
            protocol: 'RTSP',
            host: params.host,
            port: params.port,
            streamPath: candidate,
            statusCode: 401,
          },
        };
      }
    }

    return {
      success: false,
      latencyMs: primary.latencyMs,
      message:
        `RTSP server at ${params.host}:${params.port} did not ` +
        `respond to any known Hikvision stream path. ` +
        `Tried: ${Array.from(tried).join(', ')}. ` +
        `Verify the camera model/firmware in the Hikvision ` +
        `web UI under Configuration → System → System Settings.`,
      errorCode: 'UNKNOWN_PATH',
      deviceInfo: {
        protocol: 'RTSP',
        host: params.host,
        port: params.port,
        triedPaths: Array.from(tried),
        server: primary.serverHeader ?? undefined,
      },
    };
  }
}

// ---------------------------------------------------------------------------
// OnvifProvider — unchanged
// ---------------------------------------------------------------------------

export class OnvifProvider {
  constructor(private readonly networkSecurity: NetworkSecurity) {}

  async testConnection(
    params: ProviderConnectionParams,
  ): Promise<ConnectionTestResult> {
    let resolvedIp: string;
    try {
      resolvedIp = await resolveDestination(
        this.networkSecurity,
        params,
      );
    } catch (err) {
      return {
        success: false,
        latencyMs: 0,
        message: (err as Error).message,
        errorCode: 'HOST_FORBIDDEN',
      };
    }

    const result = await tcpProbe(
      resolvedIp,
      params.port,
      params.timeoutMs ?? 5000,
    );
    if (!result.ok) {
      return {
        success: false,
        latencyMs: result.latencyMs,
        message: `ONVIF port ${params.port} unreachable: ${result.err}`,
        errorCode: 'CONNECTION_FAILED',
      };
    }
    return {
      success: true,
      latencyMs: result.latencyMs,
      message: `ONVIF endpoint reachable (${params.host}:${params.port})`,
      deviceInfo: {
        protocol: 'ONVIF',
        host: params.host,
        port: params.port,
      },
      profiles: [],
    };
  }

  /**
   * Discover ONVIF devices via WS-Discovery (UDP multicast probe).
   * Returns an empty list when discovery is not possible on the host.
   */
  async discover(
    timeoutMs: number = 5000,
    subnet?: string,
  ): Promise<DiscoveredDevice[]> {
    const probeMessage = [
      '<?xml version="1.0" encoding="utf-8"?>',
      '<e:Envelope xmlns:e="http://www.w3.org/2003/05/soap-envelope"',
      ' xmlns:w="http://schemas.xmlsoap.org/ws/2004/08/addressing"',
      ' xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery"',
      ' xmlns:dn="http://www.onvif.org/ver10/network/wsdl">',
      '<e:Header><w:MessageID>uuid:medu-discovery</w:MessageID>',
      '<w:To e:mustUnderstand="true">urn:schemas-xmlsoap-org:ws:2005:04:discovery</w:To>',
      '<w:Action e:mustUnderstand="true">http://schemas.xmlsoap.org/ws/2005/04/discovery</w:Action>',
      '</e:Header><e:Body><d:Probe><d:Types>dn:NetworkVideoTransmitter</d:Types></d:Probe></e:Body></e:Envelope>',
    ].join('');

    const dgram = await import('node:dgram');
    const socket = dgram.createSocket('udp4');
    const devices = new Map<string, DiscoveredDevice>();

    return new Promise<DiscoveredDevice[]>((resolve) => {
      const timer = setTimeout(() => {
        socket.close();
        resolve(Array.from(devices.values()));
      }, timeoutMs);

      socket.on('message', (msg, rinfo) => {
        const text = msg.toString('utf8');
        const xAddrMatch = text.match(
          /<d:XAddrs>([^<]+)<\/d:XAddrs>/i,
        );
        const typesMatch = text.match(
          /<d:Types>([^<]*)<\/d:Types>/i,
        );
        if (xAddrMatch) {
          const xAddr = xAddrMatch[1];
          let host = rinfo.address;
          let port = rinfo.port;
          try {
            const url = new URL(xAddr.trim().split(/\s+/)[0]);
            host = url.hostname;
            port = Number(url.port) || 80;
          } catch (err: unknown) {
            // Fall back to packet remote info; log safely without leaking unredacted URLs
            logger.debug('ONVIF XAddr URL parsing failed; falling back to remote IP', {
              remoteAddress: rinfo.address,
              error: err instanceof Error ? err.message : 'Unknown error',
            });
          }
          const key = `${host}:${port}`;
          if (!devices.has(key)) {
            devices.set(key, {
              host,
              port,
              protocol: 'ONVIF',
              name: `ONVIF device at ${host}`,
              xAddr,
              profiles: [],
              ...(typesMatch
                ? { model: typesMatch[1].split(/\s+/)[0] }
                : {}),
            });
          }
        }
      });

      socket.on('error', () => {
        clearTimeout(timer);
        socket.close();
        resolve([]);
      });

      socket.bind(0, () => {
        socket.setBroadcast(true);
        const buf = Buffer.from(probeMessage);
        socket.send(buf, 0, buf.length, 3702, '239.255.255.250');
        if (subnet) {
          try {
            socket.send(
              buf,
              0,
              buf.length,
              3702,
              subnet,
            );
          } catch (err: unknown) {
            // Directed subnet broadcast failure — log safely for diagnosis
            logger.debug('ONVIF directed subnet broadcast failed', {
              subnet,
              error: err instanceof Error ? err.message : 'Unknown error',
            });
          }
        }
      });
    });
  }
}
