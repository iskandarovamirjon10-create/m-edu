/**
 * Shared recognition thresholds for the camera pipeline.
 *
 * Both CameraWorkerSession and CameraWorkerManagerService must use the SAME
 * values, and operators must be able to calibrate them per deployment
 * (model, hardware, lighting) without a code change — hence env-driven
 * single source of truth instead of duplicated literals.
 */

/**
 * Read a bounded numeric setting from the environment with a safe fallback.
 * Invalid, missing or out-of-range values fall back rather than failing
 * closed on a typo — a bad knob must never take recognition offline.
 */
export function readBoundedEnv(
  name: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = process.env[name];

  if (!raw) {
    return fallback;
  }

  const value = Number(raw);

  return Number.isFinite(value) &&
    value >= min &&
    value <= max
    ? value
    : fallback;
}

/** Minimum face quality score (0-1) required before a face is matched. */
export const MIN_QUALITY_SCORE = readBoundedEnv(
  'FACE_QUALITY_THRESHOLD',
  0.3,
  0,
  1,
);

/** Minimum top-1 cosine similarity (0-1) for a match. */
export const DEFAULT_SIMILARITY_THRESHOLD = readBoundedEnv(
  'FACE_SIMILARITY_THRESHOLD',
  0.6,
  0,
  1,
);

/** Minimum gap between the top-1 and top-2 candidate (0-1). */
export const DEFAULT_AMBIGUITY_MARGIN = readBoundedEnv(
  'FACE_AMBIGUITY_MARGIN',
  0.05,
  0,
  1,
);
