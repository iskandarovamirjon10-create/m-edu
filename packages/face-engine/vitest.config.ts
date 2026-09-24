import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 60000,
    hookTimeout: 60000,
    teardownTimeout: 60000,
    pool: 'forks', // Use process instead of worker_threads to prevent ONNX runtime thread starvation
  },
});
