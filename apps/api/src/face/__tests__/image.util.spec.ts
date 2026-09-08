import {
  BadRequestException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import {
  decodeValidatedImage,
  detectImageFormat,
  MAX_IMAGE_BYTES,
} from '../image.util';

/* ────────────────────────────────────────────────────────────────────── */
/* Fixtures                                                               */
/* ────────────────────────────────────────────────────────────────────── */

function jpegBytes(): Buffer {
  return Buffer.from([
    0xff,
    0xd8,
    0xff,
    0xe0,
    0x00,
    0x10,
    0x4a,
    0x46,
    0x49,
    0x46,
  ]);
}

function pngBytes(): Buffer {
  return Buffer.from([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
    0x00,
    0x00,
  ]);
}

function webpBytes(): Buffer {
  return Buffer.concat([
    Buffer.from('RIFF', 'ascii'),
    Buffer.from([0x24, 0x00, 0x00, 0x00]),
    Buffer.from('WEBP', 'ascii'),
    Buffer.alloc(16),
  ]);
}

/* ────────────────────────────────────────────────────────────────────── */
/* detectImageFormat                                                      */
/* ────────────────────────────────────────────────────────────────────── */

describe('detectImageFormat', () => {
  it('detects JPEG from its magic bytes', () => {
    expect(detectImageFormat(jpegBytes())).toBe('JPEG');
  });

  it('detects PNG from its magic bytes', () => {
    expect(detectImageFormat(pngBytes())).toBe('PNG');
  });

  it('detects WebP from RIFF/WEBP signature', () => {
    expect(detectImageFormat(webpBytes())).toBe('WebP');
  });

  it('returns null for arbitrary text', () => {
    expect(
      detectImageFormat(
        Buffer.from('hello world this is not an image'),
      ),
    ).toBeNull();
  });

  it('returns null for zero-filled data', () => {
    expect(
      detectImageFormat(Buffer.alloc(64)),
    ).toBeNull();
  });

  it('returns null for an empty buffer', () => {
    expect(
      detectImageFormat(Buffer.alloc(0)),
    ).toBeNull();
  });

  it('does not trust a filename or extension', () => {
    // Signature is what matters, not the hypothetical extension.
    const payload = Buffer.from('image.jpg');
    expect(detectImageFormat(payload)).toBeNull();
  });

  it('rejects a truncated JPEG signature', () => {
    expect(
      detectImageFormat(Buffer.from([0xff, 0xd8])),
    ).toBeNull();
  });

  it('rejects a truncated PNG signature', () => {
    expect(
      detectImageFormat(
        Buffer.from([0x89, 0x50, 0x4e]),
      ),
    ).toBeNull();
  });

  it('rejects RIFF data without WEBP marker', () => {
    const fakeRiff = Buffer.concat([
      Buffer.from('RIFF', 'ascii'),
      Buffer.alloc(4),
      Buffer.from('WAVE', 'ascii'),
    ]);

    expect(detectImageFormat(fakeRiff)).toBeNull();
  });
});

/* ────────────────────────────────────────────────────────────────────── */
/* decodeValidatedImage                                                   */
/* ────────────────────────────────────────────────────────────────────── */

describe('decodeValidatedImage', () => {
  it('decodes a valid JPEG payload without modifying bytes', () => {
    const source = jpegBytes();
    const base64 = source.toString('base64');

    const result = decodeValidatedImage(base64);

    expect(result).toEqual(source);
    expect(result.equals(source)).toBe(true);
  });

  it('decodes a valid PNG payload', () => {
    const source = pngBytes();
    const base64 = source.toString('base64');

    const result = decodeValidatedImage(base64);

    expect(result.equals(source)).toBe(true);
  });

  it('decodes a valid WebP payload', () => {
    const source = webpBytes();
    const base64 = source.toString('base64');

    const result = decodeValidatedImage(base64);

    expect(result.equals(source)).toBe(true);
  });

  it('rejects an empty payload', () => {
    expect(() => decodeValidatedImage('')).toThrow(
      BadRequestException,
    );

    expect(() => decodeValidatedImage('   ')).toThrow(
      BadRequestException,
    );
  });

  it('rejects non-image data even when it is valid Base64', () => {
    const base64 = Buffer
      .from('definitely not an image at all')
      .toString('base64');

    expect(() => decodeValidatedImage(base64)).toThrow(
      BadRequestException,
    );
  });

  it('rejects malformed Base64', () => {
    expect(() =>
      decodeValidatedImage('!!!!not-base64!!!!'),
    ).toThrow(BadRequestException);
  });

  it('rejects malformed Base64 padding', () => {
    expect(() =>
      decodeValidatedImage('YWJj===='),
    ).toThrow(BadRequestException);
  });

  it('rejects an invalid Base64 length', () => {
    expect(() =>
      decodeValidatedImage('abc'),
    ).toThrow(BadRequestException);
  });

  it('rejects a Base64 payload containing unsupported whitespace', () => {
    const base64 = jpegBytes()
      .toString('base64')
      .replace(/(.{4})/g, '$1\n');

    /*
     * Keep this expectation only if the production decoder intentionally
     * rejects non-canonical Base64. If whitespace is normalized by design,
     * change this to an acceptance test.
     */
    expect(() =>
      decodeValidatedImage(base64),
    ).toThrow(BadRequestException);
  });

  it('rejects oversized payloads', () => {
    const big = Buffer.alloc(
      MAX_IMAGE_BYTES + 1024 * 1024,
      0x42,
    );

    jpegBytes().copy(big, 0);

    expect(() =>
      decodeValidatedImage(big.toString('base64')),
    ).toThrow(PayloadTooLargeException);
  });

  it('accepts a payload exactly at MAX_IMAGE_BYTES', () => {
    const exact = Buffer.alloc(
      MAX_IMAGE_BYTES,
      0x42,
    );

    jpegBytes().copy(exact, 0);

    expect(() =>
      decodeValidatedImage(exact.toString('base64')),
    ).not.toThrow();
  });

  it('rejects a payload one byte above MAX_IMAGE_BYTES', () => {
    const oversized = Buffer.alloc(
      MAX_IMAGE_BYTES + 1,
      0x42,
    );

    jpegBytes().copy(oversized, 0);

    expect(() =>
      decodeValidatedImage(
        oversized.toString('base64'),
      ),
    ).toThrow(PayloadTooLargeException);
  });

  it('accepts a truncated image payload (structural validation is delegated to the image-processing layer)', () => {
    const truncated = Buffer.from([
      0xff,
      0xd8,
      0xff,
    ]);

    expect(() =>
      decodeValidatedImage(
        truncated.toString('base64'),
      ),
    ).not.toThrow();
  });

  it('accepts arbitrary bytes that start with valid magic bytes (structural validation is delegated to the image-processing layer)', () => {
    const fake = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff]),
      Buffer.from('this is not a real jpeg'),
    ]);

    expect(() =>
      decodeValidatedImage(
        fake.toString('base64'),
      ),
    ).not.toThrow();
  });
});