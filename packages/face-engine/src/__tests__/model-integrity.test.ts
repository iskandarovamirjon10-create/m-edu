import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { validateModel, computeFileChecksum, formatValidationReport } from '../providers/model-integrity';

// Mock fs
vi.mock('fs');

describe('Model Integrity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateModel', () => {
    it('rejects empty model path', () => {
      const result = validateModel('detector', '', {});
      expect(result.valid).toBe(false);
      expect(result.fileExists).toBe(false);
      expect(result.errors[0]).toContain('empty');
    });

    it('rejects nonexistent file', () => {
      (fs.statSync as any).mockImplementation(() => {
        throw new Error('ENOENT');
      });

      const result = validateModel('detector', '/nonexistent/model.onnx', {});
      expect(result.valid).toBe(false);
      expect(result.fileExists).toBe(false);
      expect(result.errors[0]).toContain('Cannot read');
    });

    it('accepts valid file with no checksum', () => {
      (fs.statSync as any).mockReturnValue({ size: 5_000_000 });

      const result = validateModel('detector', '/valid/model.onnx', {});
      expect(result.valid).toBe(true);
      expect(result.fileExists).toBe(true);
      expect(result.fileSizeBytes).toBe(5_000_000);
      expect(result.checksumValid).toBeNull();
      expect(result.errors).toHaveLength(0);
    });

    it('warns about suspiciously small file', () => {
      (fs.statSync as any).mockReturnValue({ size: 100 });

      const result = validateModel('detector', '/tiny/model.onnx', {});
      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('small');
    });

    it('validates correct SHA-256 checksum', () => {
      const content = Buffer.from('test model content');
      const expectedHash = crypto.createHash('sha256').update(content).digest('hex');

      (fs.statSync as any).mockReturnValue({ size: content.length });
      (fs.readFileSync as any).mockReturnValue(content);

      const result = validateModel('embedder', '/valid/model.onnx', {
        sha256: expectedHash,
      });

      expect(result.valid).toBe(true);
      expect(result.checksumValid).toBe(true);
      expect(result.checksumActual).toBe(expectedHash);
    });

    it('rejects incorrect SHA-256 checksum', () => {
      const content = Buffer.from('tampered model content');

      (fs.statSync as any).mockReturnValue({ size: content.length });
      (fs.readFileSync as any).mockReturnValue(content);

      const result = validateModel('embedder', '/tampered/model.onnx', {
        sha256: '0000000000000000000000000000000000000000000000000000000000000000',
      });

      expect(result.valid).toBe(false);
      expect(result.checksumValid).toBe(false);
      expect(result.errors[0]).toContain('checksum mismatch');
    });

    it('warns about non-.onnx extension', () => {
      (fs.statSync as any).mockReturnValue({ size: 5_000_000 });

      const result = validateModel('detector', '/model.bin', {});
      expect(result.warnings.some(w => w.includes('.onnx'))).toBe(true);
    });

    it('rejects empty file', () => {
      (fs.statSync as any).mockReturnValue({ size: 0 });

      const result = validateModel('detector', '/empty/model.onnx', {});
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('empty');
    });
  });

  describe('computeFileChecksum', () => {
    it('computes SHA-256 correctly', () => {
      const content = Buffer.from('hello world');
      const expected = crypto.createHash('sha256').update(content).digest('hex');

      (fs.readFileSync as any).mockReturnValue(content);

      const result = computeFileChecksum('/test/file');
      expect(result).toBe(expected);
    });
  });

  describe('formatValidationReport', () => {
    it('formats a passing report', () => {
      const results = [
        {
          valid: true,
          component: 'detector',
          modelPath: '/models/detector.onnx',
          fileExists: true,
          fileSizeBytes: 5_000_000,
          checksumValid: true,
          checksumExpected: 'abc123',
          checksumActual: 'abc123',
          errors: [],
          warnings: [],
        },
      ];

      const report = formatValidationReport(results);
      expect(report).toContain('detector');
      expect(report).toContain('PASS');
      expect(report).toContain('ALL MODELS VALID');
    });

    it('formats a failing report', () => {
      const results = [
        {
          valid: false,
          component: 'embedder',
          modelPath: '/models/embedder.onnx',
          fileExists: false,
          fileSizeBytes: 0,
          checksumValid: false,
          checksumExpected: 'abc123',
          checksumActual: null,
          errors: ['Model file not found'],
          warnings: [],
        },
      ];

      const report = formatValidationReport(results);
      expect(report).toContain('embedder');
      expect(report).toContain('FAIL');
      expect(report).toContain('VALIDATION FAILED');
    });
  });
});
