import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'dotenv';
import { vi } from 'vitest';

// Specs in this repo were authored with the jest global API but run under
// vitest (globals: true). Vitest intentionally does not define a jest
// global, so we alias it to vi, whose fn() API is compatible
// (mockResolvedValue, mockImplementation, mockClear, ...).
(globalThis as Record<string, unknown>).jest = vi;

/**
 * Values the test process must agree on with a RUNNING API process.
 *
 * The `test/**` e2e suites talk to a real server (E2E_BASE_URL) and create
 * their own sessions with Prisma, then sign a JWT for them. If the suite signs
 * with a different secret than the server verifies with, or writes the session
 * row to a different database, every provisioned token is rejected with 401
 * and the whole suite fails for a reason that has nothing to do with the code
 * under test.
 *
 * The file is read directly instead of calling `dotenv.config()` on purpose:
 * `config()` would let a developer's ENTIRE local `.env` (FACE_ENGINE_PROVIDER,
 * REDIS_ENABLED, GOOGLE_CLIENT_ID, …) silently override the deterministic
 * defaults below and change unit-test behaviour. Only the two wire-contract
 * values are inherited; everything else stays pinned.
 *
 * Order of precedence: an already-exported env var (CI, shell) > `.env` >
 * the fresh-clone default.
 */
function readLocalEnv(): Record<string, string> {
  const file = path.resolve(__dirname, '.env');
  if (!fs.existsSync(file)) return {};
  try {
    return parse(fs.readFileSync(file));
  } catch {
    return {};
  }
}

const localEnv = readLocalEnv();

// Provide deterministic safe defaults for the test environment.
// This ensures that fresh clones without an .env file can still run tests.
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_URL || localEnv.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/medu_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || localEnv.JWT_SECRET || 'test-jwt-secret-0000000000000000000';
process.env.BIOMETRIC_ENCRYPTION_KEY = process.env.BIOMETRIC_ENCRYPTION_KEY || '00000000000000000000000000000000';
process.env.CAMERA_ENCRYPTION_KEY = process.env.CAMERA_ENCRYPTION_KEY || '00000000000000000000000000000000';
process.env.FACE_ENGINE_PROVIDER = process.env.FACE_ENGINE_PROVIDER || 'mock';
process.env.REDIS_ENABLED = process.env.REDIS_ENABLED || 'false';
process.env.PORT = process.env.PORT || '3001';
