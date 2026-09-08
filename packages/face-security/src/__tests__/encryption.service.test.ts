import { describe, it, expect } from 'vitest';
import { AesEncryptionService } from '../encryption.service';

const KEY = 'test-encryption-key-with-32-chars!!';

describe('AesEncryptionService (AES-256-GCM)', () => {
  const service = new AesEncryptionService(KEY);

  it('encrypts and decrypts round-trip', async () => {
    const plaintext = 'sensitive-biometric-template-data';
    const ciphertext = await service.encrypt(plaintext);
    const decrypted = await service.decrypt(ciphertext);
    expect(decrypted).toBe(plaintext);
  });

  it('produces unique ciphertexts for identical input (random IV)', async () => {
    const a = await service.encrypt('same-data');
    const b = await service.encrypt('same-data');
    expect(a).not.toBe(b);
  });

  it('rejects tampered ciphertext (GCM auth tag)', async () => {
    const ciphertext = await service.encrypt('tamper-me');
    const parts = ciphertext.split(':');
    // Flip one character in the encrypted payload
    const payload = parts[2];
    const tampered = payload[0] === '0' ? '1' + payload.slice(1) : '0' + payload.slice(1);
    const tamperedCiphertext = `${parts[0]}:${parts[1]}:${tampered}`;
    await expect(service.decrypt(tamperedCiphertext)).rejects.toThrow();
  });

  it('rejects tampered auth tag', async () => {
    const ciphertext = await service.encrypt('tamper-tag');
    const parts = ciphertext.split(':');
    const tag = parts[1];
    const tamperedTag = tag[0] === '0' ? '1' + tag.slice(1) : '0' + tag.slice(1);
    const tamperedCiphertext = `${parts[0]}:${tamperedTag}:${parts[2]}`;
    await expect(service.decrypt(tamperedCiphertext)).rejects.toThrow();
  });

  it('rejects malformed ciphertext format', async () => {
    await expect(service.decrypt('not-valid-format')).rejects.toThrow();
  });

  it('rejects ciphertext with wrong IV length', async () => {
    const ciphertext = await service.encrypt('iv-test');
    const parts = ciphertext.split(':');
    await expect(service.decrypt(`${parts[0]}ab:${parts[1]}:${parts[2]}`)).rejects.toThrow();
  });

  it('hash is deterministic and one-way', async () => {
    const h1 = await service.hash('data');
    const h2 = await service.hash('data');
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64); // sha256 hex
    expect(h1).not.toContain('data');
  });

  it('verifyHash validates integrity', async () => {
    const data = 'template-data';
    const hash = await service.hash(data);
    expect(await service.verifyHash(data, hash)).toBe(true);
    expect(await service.verifyHash(data + 'x', hash)).toBe(false);
  });

  it('rejects short encryption keys', () => {
    expect(() => new AesEncryptionService('short')).toThrow();
  });
});
