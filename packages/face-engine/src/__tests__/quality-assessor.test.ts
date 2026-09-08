import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QualityAssessor } from '../providers/quality-assessor';

// Mock sharp
vi.mock('sharp', () => {
  let lastWidth = 100;
  let lastHeight = 100;

  const chain = () => ({
    metadata: vi.fn().mockResolvedValue({ width: 640, height: 480 }),
    extract: vi.fn().mockImplementation((opts: any) => {
      lastWidth = opts.width || 100;
      lastHeight = opts.height || 100;
      return chain();
    }),
    greyscale: vi.fn().mockReturnThis(),
    raw: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockImplementation((opts?: any) => {
      const w = lastWidth;
      const h = lastHeight;
      const buf = Buffer.alloc(w * h, 128);
      if (opts?.resolveWithObject) {
        return Promise.resolve({ data: buf, info: { width: w, height: h } });
      }
      return Promise.resolve(buf);
    }),
    resize: vi.fn().mockImplementation((w: number, h: number) => {
      lastWidth = w;
      lastHeight = h;
      return chain();
    }),
    removeAlpha: vi.fn().mockReturnThis(),
  });

  return { default: vi.fn(() => chain()) };
});

describe('QualityAssessor', () => {
  let assessor: QualityAssessor;

  beforeEach(() => {
    vi.clearAllMocks();
    assessor = new QualityAssessor();
  });

  describe('assessQuality', () => {
    const dummyImage = Buffer.from('test-image-data');

    it('returns valid QualityMetrics structure', async () => {
      const result = await assessor.assessQuality({
        imageBuffer: dummyImage,
        face: {
          boundingBox: { x: 100, y: 100, width: 200, height: 200 },
          confidence: 0.95,
        },
      });

      expect(result).toHaveProperty('overallScore');
      expect(result).toHaveProperty('sharpness');
      expect(result).toHaveProperty('brightness');
      expect(result).toHaveProperty('faceSizeRatio');
      expect(result).toHaveProperty('pose');
      expect(result).toHaveProperty('passesThreshold');
      expect(typeof result.overallScore).toBe('number');
      expect(typeof result.sharpness).toBe('number');
      expect(typeof result.brightness).toBe('number');
      expect(typeof result.faceSizeRatio).toBe('number');
      expect(result.pose).toHaveProperty('yaw');
      expect(result.pose).toHaveProperty('pitch');
      expect(result.pose).toHaveProperty('roll');
      expect(typeof result.passesThreshold).toBe('boolean');
    });

    it('scores are in valid range [0, 1]', async () => {
      const result = await assessor.assessQuality({
        imageBuffer: dummyImage,
        face: {
          boundingBox: { x: 50, y: 50, width: 300, height: 300 },
          confidence: 0.9,
        },
      });

      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(1);
      expect(result.sharpness).toBeGreaterThanOrEqual(0);
      expect(result.sharpness).toBeLessThanOrEqual(1);
      expect(result.brightness).toBeGreaterThanOrEqual(0);
      expect(result.brightness).toBeLessThanOrEqual(1);
    });

    it('detects face size ratio correctly', async () => {
      // Small face
      const smallFaceResult = await assessor.assessQuality({
        imageBuffer: dummyImage,
        face: {
          boundingBox: { x: 10, y: 10, width: 20, height: 20 },
          confidence: 0.9,
        },
      });

      // Large face
      const largeFaceResult = await assessor.assessQuality({
        imageBuffer: dummyImage,
        face: {
          boundingBox: { x: 0, y: 0, width: 400, height: 400 },
          confidence: 0.9,
        },
      });

      expect(largeFaceResult.faceSizeRatio).toBeGreaterThan(smallFaceResult.faceSizeRatio);
    });

    it('estimates pose from bounding box position', async () => {
      // Center face
      const centerResult = await assessor.assessQuality({
        imageBuffer: dummyImage,
        face: {
          boundingBox: { x: 220, y: 140, width: 200, height: 200 },
          confidence: 0.9,
        },
      });

      // Off-center face
      const offCenterResult = await assessor.assessQuality({
        imageBuffer: dummyImage,
        face: {
          boundingBox: { x: 0, y: 0, width: 200, height: 200 },
          confidence: 0.9,
        },
      });

      // Off-center face should have larger absolute yaw
      expect(Math.abs(offCenterResult.pose.yaw))
        .toBeGreaterThan(Math.abs(centerResult.pose.yaw));
    });

    it('handles custom config', async () => {
      const customAssessor = new QualityAssessor({
        overallThreshold: 0.9,
        minSharpness: 200,
      });

      const result = await customAssessor.assessQuality({
        imageBuffer: dummyImage,
        face: {
          boundingBox: { x: 100, y: 100, width: 200, height: 200 },
          confidence: 0.9,
        },
      });

      // With high threshold, may not pass
      expect(typeof result.passesThreshold).toBe('boolean');
    });
  });
});
