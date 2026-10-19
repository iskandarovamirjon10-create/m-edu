/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
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
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:3001',
        changeOrigin: true,
        // Enable sending cookies/credentials for cross-origin OAuth callback
        cookieDomainRewrite: 'localhost',
      },
      // Socket.IO (chat) handshake + websocket upgrade must reach the API in dev
      '/socket.io': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:3001',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 600,
    cssCodeSplit: true,
    target: 'es2022',
    minify: 'esbuild',
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
