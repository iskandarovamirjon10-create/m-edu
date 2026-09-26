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
 * Single authoritative Vitest configuration for the API.
 *
 * - `vitest.setup.ts` installs the `jest` alias on globalThis.
 * - Unit specs live in `src/**`, end-to-end HTTP specs in `test/**`.
 * - E2E specs boot Nest and talk to a real PostgreSQL, so their timeouts are
 *   much longer than a unit test's.
 *
 * SWC is used as the TypeScript transformer because NestJS relies on
 * `emitDecoratorMetadata` for dependency injection, which esbuild strips.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'],
    exclude: ['**/*.integration.spec.ts', '**/node_modules/**', '**/dist/**'],
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
