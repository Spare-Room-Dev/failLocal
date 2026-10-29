/**
 * Renders the link-preview image, `site/public/og.png`: a 1200 × 630 still of the welcome page (headline,
 * the model on its plinth and the "FICTIONAL MODEL SITE" plate), the site's own render (D-114).
 *
 * Usage: `node scripts/og-image.mjs <baseUrl>` (or `npm run og-image -w site -- <baseUrl>`), against a built
 * site under `vite preview`. From the repo root:
 *   1. npm run build -w site
 *   2. (cd site && npx vite preview --port 4183 --strictPort)    # in another shell; never port 4173
 *   3. npm run og-image -w site -- http://localhost:4183
 *   4. stop the preview, then commit site/public/og.png
 */
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const baseUrl = process.argv[2]?.replace(/\/$/, '');
if (!baseUrl) {
  console.error('usage: node scripts/og-image.mjs <baseUrl>, e.g. http://localhost:4183');
  process.exit(1);
}
const out = fileURLToPath(new URL('../public/og.png', import.meta.url));

// Headless Chromium draws WebGL in software through SwiftShader, as in playwright.config.ts.
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  await page.goto(`${baseUrl}/#/`);
  await page.locator('.welcome-scene .scene--diorama[data-ready="true"]').waitFor({ timeout: 30_000 });
  await page.locator('.welcome-scene .scene-plinth').waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: out });
  console.log(`og-image: wrote ${out}`);
} finally {
  await browser.close();
}
