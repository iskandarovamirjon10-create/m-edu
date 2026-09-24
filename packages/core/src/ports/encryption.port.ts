/**
 * Encryption port — abstraction for biometric data encryption at rest.
 *
 * Implementations must use proper cryptographic algorithms (AES-256-GCM recommended).
 * Keys must come from environment/configuration, never hardcoded.
 */

export interface EncryptionPort {
  /**
   * Encrypt plaintext data.
   * Returns ciphertext that can be stored safely.
   */
  encrypt(plaintext: string): Promise<string>;

  /**
   * Decrypt ciphertext back to plaintext.
   */
  decrypt(ciphertext: string): Promise<string>;

  /**
   * Generate a SHA-256 hash of the data (for integrity verification).
   * This is a one-way hash — not reversible.
   */
  hash(data: string): Promise<string>;

  /**
   * Verify that data matches a previously computed hash.
   */
  verifyHash(data: string, expectedHash: string): Promise<boolean>;
}
