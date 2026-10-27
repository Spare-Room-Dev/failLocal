import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

/** End-to-end checks against the built site under `vite preview`, on a laptop and a phone viewport. */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  reporter: 'list',
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'phone', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  // The site's own Vite (8, under site/node_modules), never the engine's hoisted Vite 7.
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    // Always a fresh build, so a stale server never answers for the current code.
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
