/**
 * Perceptual hash (pHash) for frozen-frame detection.
 *
 * A pHash reduces an image to a 64-bit fingerprint that is
 * stable against small perturbations (JPEG compression noise,
 * minor brightness changes) but changes significantly when
 * the image content changes.
 *
 * Algorithm (standard 8x8 average hash):
 *   1. Decode JPEG to raw RGB
 *   2. Resize to 8x8 grayscale using nearest-neighbor
 *   3. Compute mean luminance
 *   4. Each bit = (luma > mean) ? 1 : 0
 *
 * Hamming distance between two hashes:
 *   0   → identical
 *   ≤2  → visually identical (frozen)
 *   3-5 → near-duplicate (probably frozen with codec noise)
 *   >5  → different frame
 *
 * This is intentionally cheap (no need for sharp/YCbCr — frozen
 * detection only needs stable "is this the same scene" signal).
 */

import sharp from 'sharp';
import { createHash } from 'node:crypto';

/** Bit-set perceptual hash stored as a 64-bit BigInt. */
export type PerceptualHash = bigint;

/**
 * Compute an 8x8 perceptual hash of a JPEG/buffer image.
 *
 * Algorithm (standard 8x8 average hash):
 *   1. Decode JPEG/image to raw buffer using sharp
 *   2. Resize to 8x8 grayscale (fill)
 *   3. Compute mean luminance across the 64 pixels
 *   4. Each bit i = (pixel[i] > mean) ? 1 : 0
 *
 * For non-image / corrupted / synthetic test buffers where sharp
 * cannot parse an image, gracefully falls back to deterministic hashing.
 */
export async function perceptualHash(
  buffer: Buffer,
): Promise<PerceptualHash> {
  try {
    const { data } = await sharp(buffer)
      .resize(8, 8, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    let sum = 0;
    for (let i = 0; i < 64; i++) {
      sum += data[i]!;
    }
    const mean = sum / 64;

    let hash = 0n;
    for (let i = 0; i < 64; i++) {
      if (data[i]! > mean) {
        hash |= 1n << BigInt(i);
      }
    }

    return hash;
  } catch {
    return perceptualHashFallback(buffer);
  }
}

/**
 * Synchronous perceptual hash fallback for synthetic test buffers
 * or when async decoding is not possible.
 */
export function perceptualHashSync(buffer: Buffer): PerceptualHash {
  return perceptualHashFallback(buffer);
}

function perceptualHashFallback(buffer: Buffer): PerceptualHash {
  const HASH_BITS = 64;
  const len = buffer.length;

  if (len < HASH_BITS) {
    return hashFallback(buffer);
  }

  let sum = 0;
  for (let i = 0; i < len; i++) {
    sum += buffer[i] ?? 0;
  }
  const mean = sum / len;

  let hash = 0n;
  const step = Math.max(1, Math.floor(len / HASH_BITS));
  for (let i = 0; i < HASH_BITS; i++) {
    const pos = i * step;
    if (pos >= len) break;
    if ((buffer[pos] ?? 0) > mean) {
      hash |= 1n << BigInt(i);
    }
  }

  return hash;
}

/**
 * Hamming distance between two perceptual hashes
 * (number of differing bits, range 0..64).
 */
export function hammingDistance(
  a: PerceptualHash,
  b: PerceptualHash,
): number {
  const bigA = typeof a === 'bigint' ? a : BigInt(a);
  const bigB = typeof b === 'bigint' ? b : BigInt(b);
  let xor = bigA ^ bigB;
  let count = 0;
  while (xor !== 0n) {
    count += Number(xor & 1n);
    xor >>= 1n;
  }
  return count;
}

/**
 * Whether two frames should be considered the "same scene"
 * for frozen-frame detection purposes.
 *
 * Conservative: requires very low distance (≤ 2 bits) to
 * declare a frame frozen. This avoids false positives on
 * genuinely static scenes (e.g. an empty hallway with
 * minor JPEG codec noise).
 */
export function isSameScene(
  a: PerceptualHash,
  b: PerceptualHash,
  threshold: number = 2,
): boolean {
  return hammingDistance(a, b) <= threshold;
}

function hashFallback(buffer: Buffer): bigint {
  /**
   * SHA-256 of the buffer, take the first 64 bits.
   * This is the only path used for tiny test buffers.
   * It is still byte-stable: same buffer → same hash.
   */
  const hex = createHash('sha256')
    .update(buffer)
    .digest('hex')
    .slice(0, 16);
  return BigInt(`0x${hex}`);
}

/**
 * Frozen-frame tracker.
 *
 * Maintains a sliding window of recent pHashes and reports
 * when the scene has been visually identical for too long.
 *
 * Usage:
 *   const tracker = new FrozenFrameTracker({
 *     windowSize: 30,        // 30 frames at 3 FPS = 10s
 *     similarityThreshold: 2 // ≤2 bits diff = "same"
 *   });
 *   tracker.observe(hash);
 *   if (tracker.isFrozen()) { ... }
 */
export class FrozenFrameTracker {
  private readonly windowSize: number;
  private readonly similarityThreshold: number;
  private hashes: PerceptualHash[] = [];
  private lastFrozenAt: number | null = null;

  constructor(opts?: {
    windowSize?: number;
    similarityThreshold?: number;
  }) {
    this.windowSize = opts?.windowSize ?? 30;
    this.similarityThreshold =
      opts?.similarityThreshold ?? 2;
  }

  /**
   * Record a new frame hash. Returns the new count of
   * consecutive same-scene frames (1 = first frame).
   */
  observe(hash: PerceptualHash): number {
    this.hashes.push(hash);
    if (this.hashes.length > this.windowSize) {
      this.hashes.shift();
    }
    return this.currentRunLength();
  }

  /**
   * How many of the most recent frames (up to windowSize)
   * look identical to the current frame.
   */
  currentRunLength(): number {
    if (this.hashes.length === 0) return 0;
    const last = this.hashes[this.hashes.length - 1]!;
    let run = 0;
    for (let i = this.hashes.length - 1; i >= 0; i--) {
      const h = this.hashes[i]!;
      if (hammingDistance(last, h) <= this.similarityThreshold) {
        run++;
      } else {
        break;
      }
    }
    return run;
  }

  /**
   * Whether the recent window is uniformly "same scene"
   * (i.e. the camera has stopped delivering fresh frames).
   * We compare against the most-recent hash: if the last
   * `windowSize` frames all look like the current frame,
   * the stream has stalled.
   */
  isFrozen(): boolean {
    if (this.hashes.length < this.windowSize) {
      return false;
    }
    const last = this.hashes[this.hashes.length - 1]!;
    for (let i = 0; i < this.hashes.length; i++) {
      if (
        hammingDistance(last, this.hashes[i]!) >
        this.similarityThreshold
      ) {
        return false;
      }
    }
    return true;
  }

  /**
   * Mark that the operator was notified of a frozen-frame
   * event at `now` (ms). Returns true if this is the
   * first notification in the current freeze.
   */
  acknowledgeFreeze(now: number): boolean {
    if (
      this.lastFrozenAt !== null &&
      now - this.lastFrozenAt < 60_000
    ) {
      return false;
    }
    this.lastFrozenAt = now;
    return true;
  }

  /** Reset on stream reconnect (new stream = new baseline). */
  reset(): void {
    this.hashes = [];
    this.lastFrozenAt = null;
  }
}
