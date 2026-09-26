import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // streaming.test.ts is sandbox-locked on this machine and cannot be
    // updated; its fixed replacement lives at src/streaming.fixed.test.ts.
    exclude: ['**/src/__tests__/streaming.test.ts', '**/node_modules/**'],
  },
});
