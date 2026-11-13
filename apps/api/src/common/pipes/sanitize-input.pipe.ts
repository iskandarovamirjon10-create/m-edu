import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';

const PASSWORD_FIELDS = new Set([
  'password',
  'newPassword',
  'currentPassword',
  'passwordConfirm',
  'confirmPassword',
  'oldPassword',
]);

// eslint-disable-next-line no-misleading-character-class
const DANGEROUS_UNICODE_REGEX = /[\u0000\u200B\u200C\u200D\uFEFF\u202A-\u202E\u2066-\u2069]/g;

/**
 * Enterprise Input Sanitization Pipe:
 *  - Strips dangerous ASCII null bytes (\0) and invisible Unicode control characters.
 *  - Trims non-password string fields to eliminate accidental whitespace.
 *  - Immunizes against object prototype pollution (__proto__, constructor, prototype).
 *  - Preserves types for primitives, dates, buffers, arrays, and objects.
 */
@Injectable()
export class SanitizeInputPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    if (metadata.type === 'custom') {
      return value;
    }

    return this.sanitizeValue(value, metadata.data);
  }

  private sanitizeValue(val: unknown, keyName?: string): unknown {
    if (typeof val === 'string') {
      // 1. Remove dangerous null bytes and hidden Unicode overrides
      let cleaned = val.replace(DANGEROUS_UNICODE_REGEX, '');

      // 2. Trim string unless it's an explicit password field where whitespace may be significant
      if (!keyName || !PASSWORD_FIELDS.has(keyName)) {
        cleaned = cleaned.trim();
      }

      return cleaned;
    }

    if (Array.isArray(val)) {
      return val.map((item) => this.sanitizeValue(item, keyName));
    }

    if (typeof val === 'object' && !(val instanceof Date) && !(val instanceof RegExp) && !Buffer.isBuffer(val)) {
      const sanitizedObj: Record<string, unknown> = {};

      for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
        // Anti-prototype pollution
        if (k === '__proto__' || k === 'constructor' || k === 'prototype') {
          continue;
        }

        sanitizedObj[k] = this.sanitizeValue(v, k);
      }

      return sanitizedObj;
    }

    return val;
  }
}
