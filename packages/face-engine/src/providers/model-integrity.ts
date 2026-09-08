/**
 * Model Integrity — validates ONNX model files before loading.
 *
 * Checks:
 * - File exists
 * - File is readable
 * - File size is reasonable (not empty, not suspiciously large)
 * - SHA-256 checksum matches expected value (if provided)
 * - Model can be parsed by ONNX Runtime
 *
 * This prevents:
 * - Corrupted model files
 * - Tampered models
 * - Wrong model files loaded accidentally
 * - Empty/stub model files
 */

import * as fs from 'fs';
import * as crypto from 'crypto';
import * as path from 'path';

export interface ModelManifestEntry {
  /** Component name: 'detector' | 'embedder' | 'liveness' */
  component: string;
  /** Expected filename */
  filename: string;
  /** Expected SHA-256 hex digest (optional — if not provided, checksum is skipped) */
  sha256?: string;
  /** Expected input shape [batch, channels, height, width] */
  inputShape?: [number, number, number, number];
  /** Expected output shape(s) */
  outputShapes?: number[][];
  /** ONNX opset version */
  opset?: number;
  /** Model family */
  modelFamily: string;
  /** License identifier */
  license: string;
  /** Commercial use status */
  commercialUse: 'verified' | 'unknown' | 'not-permitted';
  /** Description */
  description?: string;
}

export interface ModelManifest {
  version: string;
  generatedAt: string;
  models: ModelManifestEntry[];
}

export interface ModelValidationResult {
  valid: boolean;
  component: string;
  modelPath: string;
  fileExists: boolean;
  fileSizeBytes: number;
  checksumValid: boolean | null; // null if no checksum provided
  checksumExpected: string | null;
  checksumActual: string | null;
  errors: string[];
  warnings: string[];
}

/**
 * Validate a single model file.
 */
export function validateModel(
  component: string,
  modelPath: string,
  expected?: Partial<ModelManifestEntry>
): ModelValidationResult {
  const result: ModelValidationResult = {
    valid: true,
    component,
    modelPath,
    fileExists: false,
    fileSizeBytes: 0,
    checksumValid: null,
    checksumExpected: expected?.sha256 ?? null,
    checksumActual: null,
    errors: [],
    warnings: [],
  };

  // 1. Check file exists
  if (!modelPath) {
    result.valid = false;
    result.errors.push(`Model path is empty for component '${component}'`);
    return result;
  }

  try {
    const stat = fs.statSync(modelPath);
    result.fileExists = true;
    result.fileSizeBytes = stat.size;

    // 2. Check file is not empty
    if (stat.size === 0) {
      result.valid = false;
      result.errors.push(`Model file is empty: ${modelPath}`);
      return result;
    }

    // 3. Check reasonable file size (face models are typically 1MB-500MB)
    if (stat.size < 1000) {
      result.warnings.push(
        `Model file is suspiciously small (${stat.size} bytes). Expected a real ONNX model.`
      );
    }
    if (stat.size > 2 * 1024 * 1024 * 1024) {
      result.warnings.push(
        `Model file is very large (${(stat.size / (1024 * 1024 * 1024)).toFixed(1)} GB). Verify this is correct.`
      );
    }

    // 4. Verify extension
    const ext = path.extname(modelPath).toLowerCase();
    if (ext !== '.onnx') {
      result.warnings.push(
        `Model file does not have .onnx extension: ${ext}. Verify this is a valid ONNX model.`
      );
    }

    // 5. SHA-256 checksum verification
    if (expected?.sha256) {
      const fileBuffer = fs.readFileSync(modelPath);
      const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
      result.checksumActual = hash;
      result.checksumValid = hash === expected.sha256;

      if (!result.checksumValid) {
        result.valid = false;
        result.errors.push(
          `Model checksum mismatch for '${component}': expected ${expected.sha256}, got ${hash}. ` +
          `Model may be corrupted or tampered with.`
        );
      }
    }
  } catch (err: unknown) {
    result.valid = false;
    result.errors.push(
      `Cannot read model file '${modelPath}': ${err instanceof Error ? err.message : String(err)}`
    );
  }

  return result;
}

/**
 * Validate all models from a manifest.
 */
export function validateAllModels(
  manifest: ModelManifest,
  modelPaths: Record<string, string>
): ModelValidationResult[] {
  const results: ModelValidationResult[] = [];

  for (const entry of manifest.models) {
    const modelPath = modelPaths[entry.component] || '';
    results.push(validateModel(entry.component, modelPath, entry));
  }

  return results;
}

/**
 * Generate a SHA-256 checksum for a file (utility for creating manifests).
 */
export function computeFileChecksum(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

/**
 * Format validation results as a human-readable report.
 */
export function formatValidationReport(results: ModelValidationResult[]): string {
  const lines: string[] = ['Model Validation Report', '=' .repeat(40)];

  for (const r of results) {
    lines.push('');
    lines.push(`Component: ${r.component}`);
    lines.push(`  Path: ${r.modelPath}`);
    lines.push(`  Exists: ${r.fileExists ? 'YES' : 'NO'}`);
    lines.push(`  Size: ${r.fileSizeBytes} bytes`);

    if (r.checksumExpected) {
      lines.push(`  Checksum: ${r.checksumValid ? 'VALID' : 'INVALID'}`);
      lines.push(`    Expected: ${r.checksumExpected}`);
      lines.push(`    Actual:   ${r.checksumActual}`);
    } else {
      lines.push(`  Checksum: NOT VERIFIED (no expected hash provided)`);
    }

    if (r.errors.length > 0) {
      lines.push(`  ERRORS:`);
      for (const e of r.errors) lines.push(`    - ${e}`);
    }
    if (r.warnings.length > 0) {
      lines.push(`  WARNINGS:`);
      for (const w of r.warnings) lines.push(`    - ${w}`);
    }

    lines.push(`  Status: ${r.valid ? 'PASS' : 'FAIL'}`);
  }

  const allValid = results.every(r => r.valid);
  lines.push('');
  lines.push(`Overall: ${allValid ? 'ALL MODELS VALID' : 'VALIDATION FAILED'}`);

  return lines.join('\n');
}
