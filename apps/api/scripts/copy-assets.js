// Copy src/assets (fonts etc.) into dist so runtime paths like
// `path.join(__dirname, '..', 'assets', 'fonts', ...)` resolve under
// `dist/certificates` → `dist/assets/fonts`. Nest's `compilerOptions.assets`
// does not reliably copy on every platform, and without the fonts the
// pdfmake-based certificate/report PDF generation ENOENTs in production.
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'src', 'assets');
const dest = path.join(__dirname, '..', 'dist', 'assets');

if (fs.existsSync(src)) {
  fs.cpSync(src, dest, { recursive: true });
  console.log('[copy-assets] src/assets -> dist/assets');
} else {
  console.warn('[copy-assets] src/assets not found — nothing to copy');
}
