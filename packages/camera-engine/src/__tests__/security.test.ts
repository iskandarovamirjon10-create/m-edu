import { describe, it, expect } from 'vitest';
import { CredentialVault, NetworkSecurity } from '../index';

const KEY = 'camera-test-encryption-key-32chars!!';

describe('CredentialVault', () => {
  const vault = new CredentialVault(KEY);

  it('encrypts and decrypts credentials round-trip', async () => {
    const encrypted = await vault.encrypt({ username: 'admin', password: 'pass123' });
    const decrypted = await vault.decrypt(encrypted);
    expect(decrypted.username).toBe('admin');
    expect(decrypted.password).toBe('pass123');
  });

  it('tampered ciphertext cannot be decrypted', async () => {
    const encrypted = await vault.encrypt({ username: 'u', password: 'p' });
    const parts = encrypted.split(':');
    const payload = parts[2];
    const tampered = payload[0] === '0' ? '1' + payload.slice(1) : '0' + payload.slice(1);
    await expect(vault.decrypt(`${parts[0]}:${parts[1]}:${tampered}`)).rejects.toThrow();
  });

  it('exposes encryption port with working encrypt/decrypt', async () => {
    const cipher = await vault.encryption.encrypt('hello');
    expect(await vault.encryption.decrypt(cipher)).toBe('hello');
  });
});

describe('NetworkSecurity — SSRF protection', () => {
  it('allows private IPs when allowPrivateIps is true', async () => {
    const sec = new NetworkSecurity({ allowPrivateIps: true, allowLoopback: true });
    await expect(sec.validateHost('192.168.1.10')).resolves.toBeUndefined();
  });

  it('blocks private IPs when allowPrivateIps is false', async () => {
    const sec = new NetworkSecurity({ allowPrivateIps: false, allowLoopback: true });
    await expect(sec.validateHost('192.168.1.10')).rejects.toThrow();
    await expect(sec.validateHost('10.0.0.5')).rejects.toThrow();
    await expect(sec.validateHost('172.16.0.5')).rejects.toThrow();
  });

  it('blocks loopback when allowLoopback is false', async () => {
    const sec = new NetworkSecurity({ allowPrivateIps: true, allowLoopback: false });
    await expect(sec.validateHost('127.0.0.1')).rejects.toThrow();
    await expect(sec.validateHost('localhost')).rejects.toThrow();
  });

  it('allows loopback when allowLoopback is true', async () => {
    const sec = new NetworkSecurity({ allowPrivateIps: true, allowLoopback: true });
    await expect(sec.validateHost('127.0.0.1')).resolves.toBeUndefined();
  });

  it('rejects empty / invalid hosts', async () => {
    const sec = new NetworkSecurity({ allowPrivateIps: true, allowLoopback: true });
    await expect(sec.validateHost('')).rejects.toThrow();
  });
});

describe('NetworkSecurity — CIDR matching regression', () => {
  it('does NOT treat a private IPv4 as loopback (allowLoopback=false)', async () => {
    // Regression: the old mask computation (128-prefix on 32-bit IPv4 values)
    // classified EVERY IPv4 as loopback, rejecting all real camera hosts.
    const sec = new NetworkSecurity({ allowPrivateIps: true, allowLoopback: false });
    await expect(sec.validateHost('192.168.1.10')).resolves.toBeUndefined();
    await expect(sec.validateHost('10.0.0.5')).resolves.toBeUndefined();
    await expect(sec.validateHost('172.20.0.9')).resolves.toBeUndefined();
  });

  it('still blocks loopback IPv4 when allowLoopback=false', async () => {
    const sec = new NetworkSecurity({ allowPrivateIps: true, allowLoopback: false });
    await expect(sec.validateHost('127.0.0.1')).rejects.toThrow(/Loopback/);
    await expect(sec.validateHost('127.8.8.8')).rejects.toThrow(/Loopback/);
  });

  it('allows public IPs when both loopback and private are forbidden', async () => {
    const sec = new NetworkSecurity({ allowPrivateIps: false, allowLoopback: false });
    await expect(sec.validateHost('8.8.8.8')).resolves.toBeUndefined();
    await expect(sec.validateHost('203.0.113.10')).resolves.toBeUndefined();
  });

  it('blocks link-local / cloud metadata IP when private is forbidden', async () => {
    const sec = new NetworkSecurity({ allowPrivateIps: false, allowLoopback: true });
    // 169.254.169.254 is the AWS/GCP/Azure metadata endpoint
    await expect(sec.validateHost('169.254.169.254')).rejects.toThrow(/Private/);
  });

  it('blocks IPv6 loopback ::1 when allowLoopback=false', async () => {
    const sec = new NetworkSecurity({ allowPrivateIps: true, allowLoopback: false });
    await expect(sec.validateHost('::1')).rejects.toThrow(/Loopback|not allowed/);
  });

  it('allows IPv6 loopback ::1 when allowLoopback=true', async () => {
    const sec = new NetworkSecurity({ allowPrivateIps: true, allowLoopback: true });
    await expect(sec.validateHost('::1')).resolves.toBeUndefined();
  });

  it('blocks IPv6 ULA fc00::/7 when private is forbidden', async () => {
    const sec = new NetworkSecurity({ allowPrivateIps: false, allowLoopback: true });
    await expect(sec.validateHost('fd12:3456:789a::1')).rejects.toThrow(/Private/);
  });

  it('handles IPv4-mapped IPv6 addresses', async () => {
    const sec = new NetworkSecurity({ allowPrivateIps: false, allowLoopback: true });
    await expect(sec.validateHost('::ffff:10.0.0.5')).rejects.toThrow(/Private/);
  });
});
