import { vi } from 'vitest';

// Specs in this repo were authored with the jest global API but run under
// vitest (globals: true). Vitest intentionally does not define a jest
// global, so we alias it to i, whose fn() API is compatible
// (mockResolvedValue, mockImplementation, mockClear, ...).
(globalThis as Record<string, unknown>).jest = vi;

// Provide deterministic safe defaults for the test environment.
// This ensures that fresh clones without an .env file can still run tests.
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/medu_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-0000000000000000000';
process.env.BIOMETRIC_ENCRYPTION_KEY = process.env.BIOMETRIC_ENCRYPTION_KEY || '00000000000000000000000000000000';
process.env.CAMERA_ENCRYPTION_KEY = process.env.CAMERA_ENCRYPTION_KEY || '00000000000000000000000000000000';
process.env.FACE_ENGINE_PROVIDER = process.env.FACE_ENGINE_PROVIDER || 'mock';
process.env.REDIS_ENABLED = process.env.REDIS_ENABLED || 'false';
process.env.PORT = process.env.PORT || '3001';
