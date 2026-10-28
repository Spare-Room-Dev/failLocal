import { defineConfig, devices } from '@playwright/test';

// E2E_PORT moves the preview off 4173 when that port is taken.
const PORT = Number(process.env.E2E_PORT ?? 4173);

/** End-to-end checks against the built site under `vite preview`, on a laptop, a small laptop, two tablet and a phone viewport. */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  reporter: 'list',
  // Headless Chromium draws WebGL in software through SwiftShader, so the diorama renders under test.
  use: { baseURL: `http://localhost:${PORT}`, launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'laptop-small', use: { ...devices['Desktop Chrome'], viewport: { width: 1150, height: 800 } } },
    { name: 'tablet-landscape', use: { ...devices['Desktop Chrome'], viewport: { width: 1024, height: 768 } } },
    { name: 'tablet-portrait', use: { ...devices['Desktop Chrome'], viewport: { width: 820, height: 1180 }, hasTouch: true } },
    { name: 'phone', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  // The workspace's one Vite (8); engine and site share it.
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    // Always a fresh build, so a stale server never answers for the current code.
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
