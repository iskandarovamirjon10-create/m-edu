/**
 * NetworkSecurity — SSRF / network-boundary protection for camera connections.
 *
 * Blocks connections to loopback / link-local / (optionally) private ranges
 * so a compromised tenant cannot probe internal infrastructure.
 *
 * Supported address formats:
 *   - IPv4 (e.g. 192.168.1.10)
 *   - IPv6 (e.g. ::1, fe80::1, ::ffff:192.168.1.1)
 *   - Hostnames (resolved via DNS; every resolved address is validated)
 */

import * as net from 'net';
import * as dns from 'dns/promises';

export interface NetworkSecurityOptions {
  allowPrivateIps: boolean;
  allowLoopback: boolean;
}

const LOOPBACK_RANGES: Array<[string, number]> = [
  ['127.0.0.0', 8],
  ['::1', 128],
  ['0.0.0.0', 8],
  ['255.255.255.255', 32],
];

const PRIVATE_RANGES: Array<[string, number]> = [
  ['10.0.0.0', 8],
  ['172.16.0.0', 12],
  ['192.168.0.0', 16],
  ['169.254.0.0', 16], // link-local
  ['100.64.0.0', 10], // CGNAT
  ['224.0.0.0', 4], // Multicast
  ['fe80::', 10],
  ['fc00::', 7], // ULA
];

interface ParsedIp {
  value: bigint;
  bits: 32 | 128;
}

function ipv4ToBigInt(ip: string): bigint | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let value = 0n;
  for (const p of parts) {
    const n = Number(p);
    if (Number.isNaN(n) || n < 0 || n > 255) return null;
    value = (value << 8n) | BigInt(n);
  }
  return value;
}

/**
 * Expand an IPv6 address into 16 bytes. Handles '::' compression and
 * IPv4-mapped addresses (::ffff:192.168.1.1).
 */
function ipv6ToBytes(ip: string): number[] | null {
  let address = ip.toLowerCase();

  // IPv4-mapped / compatible form: <hextets>:a.b.c.d
  const ipv4Match = address.match(/^(.*:)(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (ipv4Match) {
    const v4 = ipv4Match[2].split('.').map(Number);
    if (v4.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return null;
    const hi = (v4[0] << 8) | v4[1];
    const lo = (v4[2] << 8) | v4[3];
    address = `${ipv4Match[1]}${hi.toString(16)}:${lo.toString(16)}`;
  }

  const groups = address.split('::');
  if (groups.length > 2) return null;

  const parseHextets = (part: string): number[] | null => {
    if (part === '') return [];
    const hextets = part.split(':');
    const bytes: number[] = [];
    for (const h of hextets) {
      if (h.length === 0 || h.length > 4 || !/^[0-9a-f]{1,4}$/.test(h)) return null;
      const v = parseInt(h, 16);
      bytes.push((v >> 8) & 0xff, v & 0xff);
    }
    return bytes;
  };

  if (groups.length === 1) {
    // No compression — must be exactly 8 hextets (16 bytes)
    const bytes = parseHextets(groups[0]);
    if (!bytes || bytes.length !== 16) return null;
    return bytes;
  }

  const leftBytes = parseHextets(groups[0]);
  const rightBytes = parseHextets(groups[1]);
  if (!leftBytes || !rightBytes) return null;
  const missing = 16 - leftBytes.length - rightBytes.length;
  if (missing < 0) return null;
  return [...leftBytes, ...new Array(missing).fill(0), ...rightBytes];
}

function parseIp(ip: string): ParsedIp | null {
  const trimmed = ip.trim();
  if (net.isIPv4(trimmed)) {
    const value = ipv4ToBigInt(trimmed);
    return value === null ? null : { value, bits: 32 };
  }
  if (net.isIPv6(trimmed)) {
    const bytes = ipv6ToBytes(trimmed);
    if (!bytes || bytes.length !== 16) return null;
    // RFC 4291 IPv4-mapped IPv6 (::ffff:a.b.c.d) or IPv4-compatible IPv6 (::a.b.c.d)
    // normalize to IPv4 so the embedded address is subject to the same private/loopback checks.
    const isIpv4Mapped =
      bytes.slice(0, 10).every((b) => b === 0) && bytes[10] === 0xff && bytes[11] === 0xff;
    
    // IPv4-compatible IPv6 addresses are 96 bits of zeros followed by 32 bits of IPv4.
    // Ensure we don't catch `::1` (loopback) or `::` (unspecified) as IPv4-compatible,
    // though `::` would map to `0.0.0.0` which is also loopback/blocked.
    // `::` (unspecified) and `::1` (loopback): unspecified must resolve to a
    // blocked address too (some stacks reach localhost through it) - C9.
    const isUnspecified = bytes.every((b) => b === 0);
    const isIpv4Compatible =
      (isUnspecified ||
        (bytes.slice(0, 12).every((b) => b === 0) &&
          (bytes[12] !== 0 || bytes[13] !== 0 || bytes[14] !== 0 || bytes[15] > 1)));

    if (isIpv4Mapped || isIpv4Compatible || isUnspecified) {
      const v4 = ((bytes[12] << 24) | (bytes[13] << 16) | (bytes[14] << 8) | bytes[15]) >>> 0;
      return { value: BigInt(v4), bits: 32 };
    }
    let value = 0n;
    for (const b of bytes) value = (value << 8n) | BigInt(b);
    return { value, bits: 128 };
  }
  return null;
}

function inRange(ip: ParsedIp, rangeIp: string, prefix: number): boolean {
  const range = parseIp(rangeIp);
  if (range === null) return false;
  // IPv4 and IPv6 ranges never overlap.
  if (ip.bits !== range.bits) return false;
  if (prefix > ip.bits) return false;

  const mask = (1n << BigInt(ip.bits - prefix)) - 1n;
  const maskedIp = ip.value & ~mask;
  const maskedRange = range.value & ~mask;
  return maskedIp === maskedRange;
}

export class NetworkSecurity {
  private readonly allowPrivateIps: boolean;
  private readonly allowLoopback: boolean;

  constructor(options: NetworkSecurityOptions) {
    this.allowPrivateIps = options.allowPrivateIps;
    this.allowLoopback = options.allowLoopback;
  }

  /**
   * Validate an already-resolved IP literal.
   *
   * This method NEVER performs a DNS lookup: it either accepts the literal
   * (after the loopback / private / link-local checks) or throws. It is the
   * entry point for values that were resolved and validated exactly once at
   * write time (e.g. `Camera.metadata.validatedIp`), because resolving a name
   * at connect time would re-open the DNS-rebinding (TOCTOU) window this
   * class exists to close.
   *
   * Returns the normalized literal so the caller can put it straight into a
   * connection string / FFmpeg input URI.
   */
  validateIp(ip: string): string {
    if (!ip || typeof ip !== 'string') {
      throw new Error('Camera IP address is required');
    }
    const trimmed = ip.trim();
    if (!net.isIP(trimmed)) {
      throw new Error(
        `Expected a pre-validated IP address, got host name: ${trimmed}`,
      );
    }
    this.assertAllowedIp(trimmed);
    return trimmed;
  }

  /**
   * Validate a camera host. Throws if the host resolves to a forbidden
   * network range.
   *
   * Returns the first resolved and validated address — never the hostname —
   * so the caller connects to the exact destination that was checked.
   */
  async validateHost(host: string): Promise<string> {
    if (!host || typeof host !== 'string') {
      throw new Error('Camera host is required');
    }
    const trimmed = host.trim();
    if (net.isIP(trimmed)) {
      // Literal — no DNS involved.
      return this.validateIp(trimmed);
    }
    // Hostname — resolve and validate every address
    let addresses: string[] = [];
    try {
      const result = await dns.lookup(trimmed, { all: true });
      addresses = result.map((r) => r.address);
    } catch {
      throw new Error(`Unable to resolve camera host: ${trimmed}`);
    }
    if (addresses.length === 0) {
      throw new Error(`Camera host did not resolve to any address: ${trimmed}`);
    }
    for (const addr of addresses) {
      this.assertAllowedIp(addr);
    }

    // Return the first resolved and validated IP to prevent DNS rebinding TOCTOU
    return addresses[0];
  }

  private assertAllowedIp(ip: string): void {
    const parsed = parseIp(ip);
    if (parsed === null) {
      throw new Error(`Invalid camera IP address: ${ip}`);
    }

    const isLoopback = LOOPBACK_RANGES.some(([r, p]) => inRange(parsed, r, p));
    if (isLoopback && !this.allowLoopback) {
      throw new Error(`Loopback address not allowed: ${ip}`);
    }

    const isPrivate = PRIVATE_RANGES.some(([r, p]) => inRange(parsed, r, p));
    if (isPrivate && !this.allowPrivateIps) {
      throw new Error(`Private network address not allowed: ${ip}`);
    }
  }
}
