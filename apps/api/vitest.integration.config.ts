import { defineConfig } from 'vitest/config';
import path from 'path';
import type { Plugin } from 'vite';

/**
 * SWC Vite plugin — compiles ALL TypeScript with decorator metadata support.
 * NestJS relies on `emitDecoratorMetadata` for DI; esbuild strips it.
 * With `esbuild: false`, this plugin is the sole TS transformer.
 */
function swcPlugin(): Plugin {
  return {
    name: 'vitest-swc-transform',
    enforce: 'pre',
    async transform(code, id) {
      if (!id.endsWith('.ts') || id.endsWith('.d.ts') || id.includes('node_modules')) return null;
      const { transform } = await import('@swc/core');
      const result = await transform(code, {
        filename: id,
        jsc: {
          parser: { syntax: 'typescript', decorators: true },
          target: 'es2022',
          transform: {
            legacyDecorator: true,
            decoratorMetadata: true,
          },
        },
        module: { type: 'es6' },
        isModule: true,
      });
      return { code: result.code, map: result.map };
    },
  };
}

/**
 * Dedicated Vitest configuration for API integration tests.
 *
 * Targets real PostgreSQL database integration tests:
 *  - src/**\/*.integration.spec.ts
 *
 * Requires DATABASE_URL to be set to a live PostgreSQL database (e.g. medu_test).
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.integration.spec.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    setupFiles: [path.resolve(__dirname, 'vitest.setup.ts')],
    testTimeout: 60000,
    hookTimeout: 120000,
  },
  esbuild: false,
  plugins: [swcPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
