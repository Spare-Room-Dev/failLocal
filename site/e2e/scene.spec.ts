import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * The PixiJS diorama in a real browser (Chromium with WebGL through SwiftShader, see
 * playwright.config.ts). Pixels and the camera are read through the `?e2e` hook's `diorama` probe.
 */

type Rgb = [number, number, number];
type Camera = { k: number; ox: number; oy: number };

const hex = (h: string): Rgb => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
const dist = (a: Rgb, b: Rgb) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
/** Distance from `c` to the colour segment `a`–`b` (a noise blend of two tokens lies on it). */
function distToBlend(c: Rgb, a: Rgb, b: Rgb): number {
  let best = Infinity;
  for (let t = 0; t <= 1.0001; t += 0.05) best = Math.min(best, dist(c, a.map((v, i) => v + (b[i]! - v) * t) as Rgb));
  return best;
}

/** DESIGN.md token values (palette.ts reads tokens.css, which Playwright's Node side can't import). */
const OXIDE_LOW = hex('#9a3f24');
const OXIDE_HIGH = hex('#bf6a36');
/** Galvanised `#d9d5cc` and its lit top `#e2dcd1` (DESIGN.md worked check). */
const GALVANISED = [hex('#d9d5cc'), hex('#e2dcd1')];
const PLINTH = hex('#3b3632');
const TOLERANCE = 18;

async function openSite(page: Page): Promise<void> {
  await page.goto('/?e2e#/site');
  await expect(page.locator('.scene--diorama[data-ready="true"]')).toBeVisible({ timeout: 20_000 });
}

/** Every colour the canvas shows on a grid over the scene. */
async function sampleColours(page: Page): Promise<Rgb[]> {
  return page.evaluate(async () => {
    const probe = window.__faillocal?.diorama;
    if (!probe) throw new Error('the diorama probe is not installed');
    return (await probe.sample(6)) as [number, number, number][];
  });
}

type Counts = { created: number; lost: number };

/**
 * Counts every WebGL context the page creates and every one that is lost, listening on each context's own
 * canvas: a leaked context's canvas has left the document, so a listener on window would never hear it.
 */
async function countContexts(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const counts = { created: 0, lost: 0 };
    (window as unknown as { __contexts: typeof counts }).__contexts = counts;
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      const known = (this as unknown as { __gl?: unknown }).__gl;
      const ctx = (original as (...a: unknown[]) => unknown).call(this, type, ...rest);
      if (ctx && /webgl/i.test(type) && known !== ctx) {
        (this as unknown as { __gl?: unknown }).__gl = ctx;
        counts.created++;
        this.addEventListener('webglcontextlost', () => counts.lost++);
      }
      return ctx;
    } as typeof original;
  });
}

const liveContexts = (page: Page) =>
  page.evaluate(() => {
    const c = (window as unknown as { __contexts: Counts }).__contexts;
    return c.created - c.lost;
  });

/** Loses (and with `restore`, then restores) the diorama's WebGL context, as a GPU reset or driver crash would. */
function loseContext(page: Page, restore: boolean): Promise<void> {
  return page.evaluate(async (restore) => {
    const canvas = document.querySelector<HTMLCanvasElement>('.scene--diorama canvas')!;
    const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as WebGLRenderingContext;
    const ext = gl.getExtension('WEBGL_lose_context')!;
    ext.loseContext();
    if (!restore) return;
    await new Promise((r) => setTimeout(r, 300));
    ext.restoreContext();
  }, restore);
}

const NOTE = "Simplified view: this browser can't draw the 3D model.";

const camera = (page: Page) => page.evaluate(() => window.__faillocal!.diorama!.camera()) as Promise<Camera>;
const defaultCamera = (page: Page) => page.evaluate(() => window.__faillocal!.diorama!.defaultCamera()) as Promise<Camera>;

test('canvas renders the board', async ({ page }) => {
  await openSite(page);
  const colours = await sampleColours(page);
  expect(colours.some((c) => distToBlend(c, OXIDE_LOW, OXIDE_HIGH) < TOLERANCE), 'oxide ground').toBe(true);
  expect(colours.some((c) => GALVANISED.some((g) => dist(c, g) < TOLERANCE)), 'galvanised plant').toBe(true);
  expect(colours.some((c) => dist(c, PLINTH) < TOLERANCE), 'plinth').toBe(true);
});

test('no CSP violations with the diorama', async ({ page }) => {
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { __cspViolations: string[] }).__cspViolations = seen;
    document.addEventListener('securitypolicyviolation', (e) => seen.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  const response = await page.goto('/?e2e#/site');
  expect(response!.headers()['content-security-policy']).toContain("script-src 'self'");
  await expect(page.locator('.scene--diorama[data-ready="true"]')).toBeVisible({ timeout: 20_000 });
  const box = (await page.locator('.scene--diorama').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -300);
  await page.getByRole('button', { name: 'Fit' }).click();
  expect(await page.evaluate(() => (window as unknown as { __cspViolations: string[] }).__cspViolations)).toEqual([]);
});

test('no webgl falls back to the schematic', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      if (/webgl/i.test(type)) return null;
      return (original as (...a: unknown[]) => unknown).call(this, type, ...rest);
    } as typeof original;
  });
  await page.goto('/?e2e#/site');
  await expect(page.getByText(NOTE)).toBeVisible();
  await expect(page.getByRole('group', { name: 'Model site schematic' })).toBeVisible();
  await expect(page.locator('[data-cable-group]')).toHaveCount(5);
  await expect(page.locator('.scene-plinth')).toHaveText('FICTIONAL MODEL SITE · PILBARA IRON ORE · SYNTHETIC DATA');
  await expect(page.locator('.scene--diorama')).toHaveCount(0);
});

test('scene mount and unmount does not leak contexts', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one viewport is enough for the lifecycle');
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  // Every destroyed diorama loses its context on purpose, so after the cycles exactly as many contexts may
  // be alive as after the first mount: the live diorama's, and PixiJS's one page-wide test context (shader precision).
  await countContexts(page);

  const alive = () => liveContexts(page);
  await openSite(page);
  const baseline = await alive();
  expect(baseline).toBeLessThanOrEqual(2);
  for (let i = 0; i < 20; i++) {
    await page.evaluate(() => (location.hash = '#/sources'));
    await expect(page.locator('.scene--diorama')).toHaveCount(0);
    await page.evaluate(() => (location.hash = '#/site'));
    await expect(page.locator('.scene--diorama[data-ready="true"]')).toBeVisible({ timeout: 20_000 });
  }
  // A quick out-and-back that unmounts before the renderer finishes starting.
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => (location.hash = '#/sources'));
    await page.evaluate(() => (location.hash = '#/site'));
  }
  await expect(page.locator('.scene--diorama[data-ready="true"]')).toBeVisible({ timeout: 20_000 });

  const contexts = await page.evaluate(() => (window as unknown as { __contexts: Counts }).__contexts);
  expect(contexts.created).toBeGreaterThanOrEqual(26);
  // Losses are reported asynchronously; wait for the last destroyed one to land.
  await expect.poll(alive).toBe(baseline);
  expect(await page.locator('canvas').count()).toBe(1);
  expect(errors).toEqual([]);
  const colours = await sampleColours(page);
  expect(colours.some((c) => distToBlend(c, OXIDE_LOW, OXIDE_HIGH) < TOLERANCE)).toBe(true);
});

test('camera zoom and fit', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'wheel zoom on the laptop frame');
  await openSite(page);
  const start = await camera(page);
  const fit = await defaultCamera(page);
  expect(start.k).toBeCloseTo(fit.k, 3);

  const box = (await page.locator('.scene--diorama').boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.5);
  for (let i = 0; i < 30; i++) await page.mouse.wheel(0, -400);
  await expect.poll(async () => (await camera(page)).k).toBeGreaterThan(start.k * 2);
  const zoomed = await camera(page);
  expect(zoomed.k).toBeLessThanOrEqual(2.4);

  await page.locator('.scene--diorama').focus();
  await page.keyboard.press('0');
  const back = await camera(page);
  expect(back.k).toBeCloseTo(fit.k, 3);
  expect(back.ox).toBeCloseTo(fit.ox, 0);
  expect(back.oy).toBeCloseTo(fit.oy, 0);

  await page.keyboard.press('+');
  expect((await camera(page)).k).toBeGreaterThan(fit.k);
  await page.getByRole('button', { name: 'Fit' }).click();
  expect((await camera(page)).k).toBeCloseTo(fit.k, 3);

  // Drag pans; the camera stays on the board however far the drag goes.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 4000, box.y + box.height / 2 + 4000, { steps: 8 });
  await page.mouse.up();
  const panned = await camera(page);
  expect(panned.ox).not.toBeCloseTo(fit.ox, 0);
  const centre = await page.evaluate(() => window.__faillocal!.diorama!.groundAtCentre());
  expect(centre.x).toBeGreaterThanOrEqual(0);
  expect(centre.x).toBeLessThanOrEqual(1600);
  expect(centre.y).toBeGreaterThanOrEqual(0);
  expect(centre.y).toBeLessThanOrEqual(1000);
});

test('a lost context that comes back draws the board again', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one viewport is enough for context loss');
  await openSite(page);
  await loseContext(page, true);
  const frames = await page.evaluate(() => window.__faillocal!.diorama!.frames());
  // The ticker redraws on its own after the restore, without anything else changing.
  await expect.poll(() => page.evaluate(() => window.__faillocal!.diorama!.frames())).toBeGreaterThan(frames);
  await expect(page.locator('.scene--diorama[data-ready="true"]')).toBeVisible();
  await expect(page.getByText(NOTE)).toHaveCount(0);
  const colours = await sampleColours(page);
  expect(colours.some((c) => distToBlend(c, OXIDE_LOW, OXIDE_HIGH) < TOLERANCE)).toBe(true);
});

test('a lost context that never comes back falls back to the schematic', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one viewport is enough for context loss');
  await openSite(page);
  await loseContext(page, false);
  await expect(page.getByText(NOTE)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('group', { name: 'Model site schematic' })).toBeVisible();
  await expect(page.locator('.scene--diorama')).toHaveCount(0);
  await expect(page.locator('canvas')).toHaveCount(0);
});

test('a failure after the renderer starts releases it and falls back', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one viewport is enough for the start-up path');
  await countContexts(page);
  // Fail the first step after Application.init: the font load before the plate is set.
  await page.addInitScript(() => {
    document.fonts.load = () => {
      throw new Error('font loading failed');
    };
  });
  await page.goto('/?e2e#/site');
  await expect(page.getByText(NOTE)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('group', { name: 'Model site schematic' })).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);
  // The started renderer's context was released; at most PixiJS's page-wide test context remains.
  await expect.poll(() => liveContexts(page)).toBeLessThanOrEqual(1);
});
