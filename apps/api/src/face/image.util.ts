import {
  BadRequestException,
  PayloadTooLargeException,
} from '@nestjs/common';

/**
 * Maximum decoded image size accepted by the face pipeline.
 *
 * 8 MiB is intentionally bounded before the image reaches:
 *
 *   base64 decode → image decoder → face detector → liveness → embedding
 *
 * This is defense-in-depth against memory/resource exhaustion.
 */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/**
 * Maximum Base64 representation of MAX_IMAGE_BYTES.
 *
 * Base64 expands binary data by approximately 4/3.
 * The additional padding margin accounts for Base64 padding.
 */
export const MAX_BASE64_LENGTH =
  Math.ceil((MAX_IMAGE_BYTES / 3) * 4) + 4;

export type SupportedImageFormat =
  | 'JPEG'
  | 'PNG'
  | 'WebP'
  | 'BMP'
  | 'GIF';

interface ImageMagicRule {
  readonly name: SupportedImageFormat;
  readonly match: (buffer: Buffer) => boolean;
}

const MAGIC_BYTES: readonly ImageMagicRule[] = [
  {
    name: 'JPEG',
    match: (buffer) =>
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff,
  },

  {
    name: 'PNG',
    match: (buffer) =>
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a,
  },

  {
    name: 'WebP',
    match: (buffer) =>
      buffer.length >= 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP',
  },

  {
    name: 'BMP',
    match: (buffer) =>
      buffer.length >= 2 &&
      buffer[0] === 0x42 &&
      buffer[1] === 0x4d,
  },

  {
    name: 'GIF',
    match: (buffer) =>
      buffer.length >= 6 &&
      (
        buffer.toString('ascii', 0, 6) === 'GIF87a' ||
        buffer.toString('ascii', 0, 6) === 'GIF89a'
      ),
  },
];

/**
 * Strict Base64 validation using iterative character check.
 *
 * Only standard RFC 4648 Base64 is accepted:
 *   A-Z a-z 0-9 + /
 * with optional terminal padding (= or ==).
 *
 * Whitespace and data-URI prefixes are intentionally rejected.
 *
 * An iterative approach is used instead of regex to avoid stack
 * overflow on large strings (regex engines recurse on long matches).
 */
function isValidBase64(s: string): boolean {
  const len = s.length;
  if (len === 0 || len % 4 !== 0) return false;

  for (let i = 0; i < len; i++) {
    const c = s.charCodeAt(i);
    const isAlphaNum =
      (c >= 65 && c <= 90)   // A-Z
      || (c >= 97 && c <= 122) // a-z
      || (c >= 48 && c <= 57); // 0-9
    const isSpecial = c === 43 || c === 47; // + or /
    const isPad = c === 61; // =

    if (isAlphaNum || isSpecial) continue;

    if (isPad) {
      // '=' padding is only allowed in the last two positions
      if (i < len - 2) return false;
      continue;
    }

    return false;
  }

  return true;
}

/**
 * Returns the detected image format or null.
 *
 * IMPORTANT:
 * This checks only the file signature.
 * It does NOT prove that the image is fully decodable.
 */
export function detectImageFormat(
  buffer: Buffer,
): SupportedImageFormat | null {
  for (const format of MAGIC_BYTES) {
    if (format.match(buffer)) {
      return format.name;
    }
  }

  return null;
}

/**
 * Validates a raw Base64 image and converts it to a Buffer.
 *
 * Validation order is intentionally:
 *
 *   1. input type
 *   2. Base64 string size
 *   3. Base64 syntax
 *   4. Base64 decoding
 *   5. decoded size
 *   6. image magic bytes
 *
 * Actual image decoding/structural validation belongs to the
 * image-processing layer.
 */
export function decodeValidatedImage(
  imageBase64: string,
): Buffer {
  if (typeof imageBase64 !== 'string') {
    throw new BadRequestException(
      'Image data must be a Base64 string',
    );
  }

  // Support standard Data-URI formatted images from browser/canvas captures
  let normalized = imageBase64;
  const dataUriMatch = /^data:image\/[a-zA-Z0-9+.-]+;base64,/i.exec(imageBase64);
  if (dataUriMatch) {
    normalized = imageBase64.slice(dataUriMatch[0].length);
  }

  if (normalized.length === 0) {
    throw new BadRequestException(
      'Image data is empty',
    );
  }

  if (normalized.length > MAX_BASE64_LENGTH) {
    throw new PayloadTooLargeException(
      `Image exceeds maximum allowed size of ` +
        `${Math.floor(MAX_IMAGE_BYTES / 1024 / 1024)}MB`,
    );
  }

  if (!isValidBase64(normalized)) {
    throw new BadRequestException(
      'Image data must be valid Base64',
    );
  }

  let buffer: Buffer;

  try {
    buffer = Buffer.from(
      normalized,
      'base64',
    );
  } catch {
    throw new BadRequestException(
      'Image data could not be decoded',
    );
  }

  if (buffer.length === 0) {
    throw new BadRequestException(
      'Image data is empty',
    );
  }

  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new PayloadTooLargeException(
      `Image exceeds maximum allowed size of ` +
        `${Math.floor(MAX_IMAGE_BYTES / 1024 / 1024)}MB`,
    );
  }

  const format =
    detectImageFormat(buffer);

  if (!format) {
    throw new BadRequestException(
      'Unsupported image format — expected JPEG, PNG, WebP, BMP or GIF',
    );
  }

  return buffer;
}