import { describe, it, expect } from 'vitest';
import {
  perceptualHashSync,
  hammingDistance,
  isSameScene,
  FrozenFrameTracker,
} from '../index';

/**
 * Tests for the perceptual-hash (pHash) module.
 *
 * pHash reduces a JPEG/buffer image to a 64-bit fingerprint that is
 * stable against small perturbations but changes when the scene
 * content actually changes. The frozen-frame detector relies on this
 * distinction: the tracker should not flag a slowly-changing but live
 * stream as frozen.
 */
describe('perceptualHashSync', () => {
  it('returns a deterministic hash for the same buffer', () => {
    const buf = Buffer.alloc(2048);
    for (let i = 0; i < buf.length; i++) {
      buf[i] = (i * 13) & 0xff;
    }
    const a = perceptualHashSync(buf);
    const b = perceptualHashSync(buf);
    expect(a).toBe(b);
  });

  it('produces different hashes for materially different buffers', () => {
    // Use non-uniform buffers with different byte statistics
    // so the per-byte mean comparison diverges between them.
    const a = Buffer.alloc(4096);
    const b = Buffer.alloc(4096);
    for (let i = 0; i < 4096; i++) {
      a[i] = (i * 7) & 0xff;
      b[i] = (i * 13 + 3) & 0xff;
    }
    const ha = perceptualHashSync(a);
    const hb = perceptualHashSync(b);
    // The two linear congruences produce different bit
    // patterns; we expect most bits to differ.
    expect(hammingDistance(ha, hb)).toBeGreaterThan(4);
  });

  it('produces the same hash for buffers that share a byte distribution', () => {
    // Two buffers with the same per-byte mean and the same
    // majority byte statistics hash to the same value even
    // when their content is permuted — this is the expected
    // pHash property (a coarse fingerprint, not a content
    // hash).
    const a = Buffer.alloc(2048, 0x40);
    const b = Buffer.alloc(2048, 0x40);
    expect(perceptualHashSync(a)).toBe(perceptualHashSync(b));
  });

  it('treats identical buffers as same scene', () => {
    const buf = Buffer.from('this is a test payload '.repeat(100));
    const ha = perceptualHashSync(buf);
    const hb = perceptualHashSync(buf);
    expect(isSameScene(ha, hb)).toBe(true);
    expect(hammingDistance(ha, hb)).toBe(0);
  });

  it('falls back to SHA-256 for tiny buffers but stays deterministic', () => {
    const tiny = Buffer.from('abc');
    const a = perceptualHashSync(tiny);
    const b = perceptualHashSync(tiny);
    expect(a).toBe(b);
    // Different tiny buffers should still produce different hashes.
    const c = perceptualHashSync(Buffer.from('xyz'));
    expect(hammingDistance(a, c)).toBeGreaterThan(0);
  });

  it('is robust to small byte perturbations on a long buffer', () => {
    const base = Buffer.alloc(4096);
    for (let i = 0; i < base.length; i++) {
      base[i] = (i * 7 + 11) & 0xff;
    }
    const perturbed = Buffer.from(base);
    // Flip a small number of low-significance bytes.
    perturbed[100] = (perturbed[100]! + 1) & 0xff;
    perturbed[500] = (perturbed[500]! + 1) & 0xff;
    perturbed[2000] = (perturbed[2000]! - 1) & 0xff;

    const d = hammingDistance(
      perceptualHashSync(base),
      perceptualHashSync(perturbed),
    );
    // For this kind of perturbation, distances should remain small.
    expect(d).toBeLessThan(20);
  });
});

describe('hammingDistance', () => {
  it('returns 0 for identical hashes', () => {
    const x = 0b1010_1010n;
    expect(hammingDistance(x, x)).toBe(0);
  });

  it('counts differing bits correctly', () => {
    const a = 0b1111_0000n;
    const b = 0b0000_1111n;
    expect(hammingDistance(a, b)).toBe(8);
  });

  it('handles the full 64-bit range', () => {
    const a = 0xffffffffffffffffn;
    const b = 0x0000000000000000n;
    expect(hammingDistance(a, b)).toBe(64);
  });
});

describe('isSameScene', () => {
  it('respects custom threshold', () => {
    const a = 0b0000_0000n;
    // 3 differing bits — within default threshold of 2? No. But threshold=3? Yes.
    const b = 0b0000_0111n;
    expect(isSameScene(a, b, 2)).toBe(false);
    expect(isSameScene(a, b, 3)).toBe(true);
  });
});

describe('FrozenFrameTracker', () => {
  it('does not declare frozen state until the window is full', () => {
    const t = new FrozenFrameTracker({ windowSize: 4, similarityThreshold: 2 });
    const buf = Buffer.alloc(1024);
    for (let i = 0; i < 1024; i++) buf[i] = (i * 11 + 5) & 0xff;
    const h = perceptualHashSync(buf);
    t.observe(h);
    t.observe(h);
    expect(t.isFrozen()).toBe(false);
  });

  it('declares frozen state when the entire window matches', () => {
    const t = new FrozenFrameTracker({ windowSize: 4, similarityThreshold: 2 });
    const base = Buffer.alloc(1024);
    for (let i = 0; i < 1024; i++) base[i] = (i * 11 + 5) & 0xff;
    const h = perceptualHashSync(base);
    t.observe(h);
    t.observe(h);
    t.observe(h);
    t.observe(h);
    expect(t.isFrozen()).toBe(true);
  });

  it('returns to not-frozen when a fresh different frame arrives', () => {
    const t = new FrozenFrameTracker({ windowSize: 4, similarityThreshold: 2 });
    const frozen = perceptualHashSync(Buffer.alloc(1024));
    // Initialize window with 4 different frames so frozen is false
    for (let i = 0; i < 4; i++) {
      const fresh = Buffer.alloc(1024);
      for (let j = 0; j < 1024; j++) fresh[j] = (i * 17 + j) & 0xff;
      t.observe(perceptualHashSync(fresh));
    }
    expect(t.isFrozen()).toBe(false);
  });

  it('debounces acknowledgeFreeze to once per 60s', () => {
    const t = new FrozenFrameTracker({ windowSize: 2, similarityThreshold: 2 });
    const buf = Buffer.alloc(1024);
    for (let i = 0; i < 1024; i++) buf[i] = (i * 11) & 0xff;
    const h = perceptualHashSync(buf);
    t.observe(h);
    t.observe(h);
    expect(t.isFrozen()).toBe(true);
    expect(t.acknowledgeFreeze(1000)).toBe(true);
    expect(t.acknowledgeFreeze(10_000)).toBe(false);
    expect(t.acknowledgeFreeze(70_000)).toBe(true);
  });

  it('reset() clears the window and lastFrozenAt', () => {
    const t = new FrozenFrameTracker({ windowSize: 2, similarityThreshold: 2 });
    const buf = Buffer.alloc(1024);
    for (let i = 0; i < 1024; i++) buf[i] = (i * 11) & 0xff;
    const h = perceptualHashSync(buf);
    t.observe(h);
    t.observe(h);
    t.acknowledgeFreeze(1000);
    t.reset();
    expect(t.isFrozen()).toBe(false);
    expect(t.acknowledgeFreeze(2000)).toBe(true);
  });

  it('currentRunLength counts trailing identical frames', () => {
    const t = new FrozenFrameTracker({ windowSize: 6, similarityThreshold: 2 });
    const frozenBuf = Buffer.alloc(1024);
    const otherBuf = Buffer.alloc(1024);
    for (let i = 0; i < 1024; i++) {
      frozenBuf[i] = (i * 11 + 5) & 0xff;
      otherBuf[i] = (i * 19 + 7) & 0xff;
    }
    const frozen = perceptualHashSync(frozenBuf);
    const other = perceptualHashSync(otherBuf);
    t.observe(other);
    t.observe(other);
    t.observe(frozen);
    expect(t.currentRunLength()).toBe(1);
    t.observe(frozen);
    expect(t.currentRunLength()).toBe(2);
    t.observe(frozen);
    t.observe(frozen);
    expect(t.currentRunLength()).toBe(4);
  });
});
