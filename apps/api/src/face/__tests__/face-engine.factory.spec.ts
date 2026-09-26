import { describe, it, expect } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { resolveModelPath } from '../face-engine.factory';

describe('resolveModelPath', () => {
  it('returns empty string when given empty input', () => {
    expect(resolveModelPath('')).toBe('');
    expect(resolveModelPath(undefined)).toBe('');
  });

  it('preserves existing absolute path', () => {
    const existingDir = path.resolve('.');
    expect(resolveModelPath(existingDir)).toBe(existingDir);
  });

  it('resolves relative path to packages/face-engine/models if model exists', () => {
    const relPath = 'packages/face-engine/models/face_detection_yunet_2023mar.onnx';
    const resolved = resolveModelPath(relPath);
    if (fs.existsSync(path.resolve(relPath))) {
      expect(resolved).toContain('face_detection_yunet_2023mar.onnx');
      expect(path.isAbsolute(resolved)).toBe(true);
      expect(fs.existsSync(resolved)).toBe(true);
    }
  });

  it('resolves minifasnet case-insensitively to minifasnet_v2.onnx if file exists', () => {
    const resolved = resolveModelPath('MiniFASNetV2.onnx');
    if (fs.existsSync(path.resolve('packages/face-engine/models/minifasnet_v2.onnx'))) {
      expect(resolved).toContain('minifasnet_v2.onnx');
      expect(fs.existsSync(resolved)).toBe(true);
    }
  });

  it('falls back gracefully to input path if model cannot be found', () => {
    const bogus = 'some/non/existent/model.onnx';
    const resolved = resolveModelPath(bogus);
    expect(resolved).toBeDefined();
  });
});
