/**
 * CredentialVault — encrypts camera credentials at rest using AES-256-GCM.
 *
 * Reconstructed from camera module usage evidence:
 *   - new CredentialVault(encryptionKey)
 *   - vault.encrypt({ username, password }) -> string
 *   - vault.decrypt(encrypted) -> { username, password }
 *   - vault.encryption -> EncryptionPort (shared with workers)
 */

import { AesEncryptionService } from '@medu/face-security';
import type { EncryptionPort } from '@medu/core';

export interface VaultCredentials {
  username?: string;
  password?: string;
}

export class CredentialVault {
  readonly encryption: EncryptionPort;

  constructor(encryptionKey: string) {
    this.encryption = new AesEncryptionService(encryptionKey);
  }

  /** Encrypt credentials into a single storable string. */
  async encrypt(credentials: VaultCredentials): Promise<string> {
    const payload = JSON.stringify({
      username: credentials.username ?? '',
      password: credentials.password ?? '',
    });
    return this.encryption.encrypt(payload);
  }

  /** Decrypt stored credentials. Throws on tampering / wrong key. */
  async decrypt(ciphertext: string): Promise<VaultCredentials> {
    const plaintext = await this.encryption.decrypt(ciphertext);
    const parsed = JSON.parse(plaintext) as VaultCredentials;
    return {
      username: parsed.username || undefined,
      password: parsed.password || undefined,
    };
  }
}
