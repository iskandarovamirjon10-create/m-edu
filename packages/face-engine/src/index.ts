// Production exports (real face recognition)
export * from './types';
export * from './providers';
export * from './lib/alignment';
export * from './lib/pose-estimator';

// Development/testing exports (mocks are secondary)
// Import from '@medu/face-engine/mock' in tests
// or use FACE_ENGINE_PROVIDER=mock in development
