/**
 * Mock implementations for testing and development only.
 *
 * IMPORTANT: Do NOT import from this module in production code.
 * Use only with FACE_ENGINE_PROVIDER=mock environment variable
 * or in test files.
 *
 * Import path: @medu/face-engine/mock
 */

export { MockDetector } from './mock-detector';
export { MockEmbedder } from './mock-embedder';
export { MockLivenessChecker } from './mock-liveness';
export { MockMatcher } from './mock-matcher';
