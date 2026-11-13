/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import { createLogger } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// Silence noisy ECONNREFUSED terminal logs while backend API is compiling or starting up
const customLogger = createLogger();
const originalError = customLogger.error.bind(customLogger);
const originalWarn = customLogger.warn.bind(customLogger);

customLogger.error = (msg, options) => {
  if (
    typeof msg === 'string' &&
    (msg.includes('http proxy error') ||
      msg.includes('ECONNREFUSED') ||
      msg.includes('socket.io') ||
      msg.includes('/api/'))
  ) {
    return;
  }
  originalError(msg, options);
};

customLogger.warn = (msg, options) => {
  if (
    typeof msg === 'string' &&
    (msg.includes('http proxy error') || msg.includes('ECONNREFUSED'))
  ) {
    return;
  }
  originalWarn(msg, options);
};

export default defineConfig({
  customLogger,
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:3001',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (_err, _req, res) => {
            if (res && 'writeHead' in res && !res.headersSent) {
              (res as any).writeHead(503, {
                'Content-Type': 'application/json',
                'Retry-After': '2',
              });
              (res as any).end(
                JSON.stringify({
                  statusCode: 503,
                  code: 'BACKEND_STARTING',
                  message: 'Backend server is starting up or compiling. Retrying...',
                }),
              );
            }
          });
        },
      },
      // Socket.IO (chat) handshake + websocket upgrade must reach the API in dev
      '/socket.io': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:3001',
        changeOrigin: true,
        ws: true,
        configure: (proxy) => {
          proxy.on('error', (_err, _req, res) => {
            if (res && 'writeHead' in res && !res.headersSent) {
              (res as any).writeHead(503, {
                'Content-Type': 'application/json',
                'Retry-After': '2',
              });
              (res as any).end(
                JSON.stringify({
                  statusCode: 503,
                  code: 'BACKEND_STARTING',
                  message: 'Backend WebSocket server is starting up...',
                }),
              );
            }
          });
        },
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 600,
    cssCodeSplit: true,
    target: 'es2022',
    // PERF-01: production bundles MUST be minified (smaller payload, no readable
    // source in the browser). The old default disabled minification unless
    // VITE_MINIFY=true was passed, and neither the Dockerfile nor docker-compose
    // ever passed it — so every production image shipped unminified JS.
    // Opt OUT explicitly (VITE_MINIFY=false) only for low-memory local debugging:
    // on 8GB Windows machines esbuild parallel chunk minification across 3,350+
    // modules can exceed pagefile limits (errno 1455).
    minify: process.env.VITE_MINIFY === 'false' ? false : 'esbuild',
    modulePreload: {
      polyfill: false,
    },
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes('node_modules/react-dom') ||
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-router')
          ) {
            return 'react-vendor';
          }
          if (id.includes('node_modules/@tanstack/react-query')) {
            return 'query-vendor';
          }
          if (id.includes('node_modules/framer-motion')) {
            return 'motion-vendor';
          }
          if (
            id.includes('node_modules/recharts') ||
            id.includes('node_modules/d3-') ||
            id.includes('node_modules/victory-vendor')
          ) {
            return 'charts-vendor';
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'icons-vendor';
          }
          if (
            id.includes('node_modules/socket.io-client') ||
            id.includes('node_modules/engine.io-client')
          ) {
            return 'socket-vendor';
          }
          if (id.includes('src/i18n/locales/ru')) {
            return 'locale-ru';
          }
          if (id.includes('src/i18n/locales/uz')) {
            return 'locale-uz';
          }
          if (id.includes('src/i18n/locales/en')) {
            return 'locale-en';
          }
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [fileURLToPath(new URL('./src/test-setup.ts', import.meta.url))],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
