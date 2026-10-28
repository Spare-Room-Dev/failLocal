import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { parseHeaders } from './scripts/headers.mjs';

/** The deployed `_headers` for every path, so `vite preview` (and the e2e suite) runs under the real CSP. */
const deployedHeaders = parseHeaders(readFileSync(new URL('public/_headers', import.meta.url), 'utf8'))['/*'];

export default defineConfig({
  plugins: [react()],
  preview: { headers: deployedHeaders },
  // Playwright owns e2e/.
  test: { environment: 'jsdom', exclude: ['e2e/**', 'node_modules/**'], css: { include: [/tokens\.css/] } },
});
