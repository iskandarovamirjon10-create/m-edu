/**
 * Encryption Service — AES-256-GCM encryption for biometric template data.
 *
 * Uses environment-configured keys. Never hardcodes keys.
 * In production, consider using a KMS (AWS KMS, HashiCorp Vault) for key management.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'crypto';
import type { EncryptionPort } from '@medu/core';

export class AesEncryptionService implements EncryptionPort {
  private readonly key: Buffer;
  private readonly algorithm = 'aes-256-gcm';

  constructor(encryptionKey: string) {
    if (!encryptionKey || encryptionKey.length < 32) {
      throw new Error('Encryption key must be at least 32 characters');
    }
    // Derive a 32-byte key from the provided string
    this.key = createHash('sha256').update(encryptionKey).digest();
  }

  async encrypt(plaintext: string): Promise<string> {
    const iv = randomBytes(16);
    const cipher = createCipheriv(this.algorithm, this.key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:encryptedData (all hex-encoded)
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  async decrypt(ciphertext: string): Promise<string> {
    const parts = ciphertext.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid ciphertext format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const decipher = createDecipheriv(this.algorithm, this.key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  async hash(data: string): Promise<string> {
    return createHash('sha256').update(data).digest('hex');
  }

  async verifyHash(data: string, expectedHash: string): Promise<boolean> {
    const actualHash = await this.hash(data);

    // Constant-time comparison: a plain `===` short-circuits on the first
    // differing byte and leaks the position of the mismatch through timing,
    // which allows a stored hash to be recovered byte-by-byte. Both operands
    // are fixed-length hex SHA-256 digests, so equal-length buffers are the
    // only valid input; a length mismatch is a definite non-match.
    const actual = Buffer.from(actualHash, 'hex');
    const expected = Buffer.from(expectedHash, 'hex');
    if (actual.length !== expected.length || actual.length === 0) {
      return false;
    }
    return timingSafeEqual(actual, expected);
  }
}
