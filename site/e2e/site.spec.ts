import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { untaggedNumbers as untaggedIn } from '../test/helpers/untagged.js';

/** Story time runs this many times faster under e2e (controller ruling R9). */
const TIME_SCALE = 40;
const DAY = 24;

/** Opens `hash` with the e2e hook installed and story time sped up. */
async function open(page: Page, hash: string): Promise<void> {
  await page.goto(`/?e2e${hash}`);
  await page.evaluate((scale) => {
    if (!window.__faillocal) throw new Error('the e2e hook is not installed');
    window.__faillocal.timeScale = scale;
  }, TIME_SCALE);
}

const slider = (page: Page) => page.getByRole('slider', { name: 'Timeline' });

/** Scrubs with the keyboard from hour 0 to `day`, a day per Shift+ArrowRight. */
async function scrubToDay(page: Page, day: number): Promise<void> {
  await slider(page).focus();
  await page.keyboard.press('Home');
  for (let i = 0; i < day; i++) await page.keyboard.press('Shift+ArrowRight');
  await expect(slider(page)).toHaveAttribute('aria-valuenow', String(day * DAY));
}

/** The shared `untaggedNumbers` helper (site/test/helpers/untagged.ts), run over the whole page in the browser. */
const untaggedNumbers = (page: Page): Promise<string[]> => page.locator('body').evaluate(untaggedIn);

type Box = { x: number; y: number; width: number; height: number };
const intersects = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** The boxes of the hairline labels showing now. */
const visibleLabels = (page: Page): Promise<Box[]> =>
  page.locator('.timeline-event-name').evaluateAll((els) =>
    els.filter((e) => e.getClientRects().length > 0).map((e) => e.getBoundingClientRect().toJSON() as Box),
  );

test('guided run plays and ends on the comparison', async ({ page }) => {
  await open(page, '#/');
  await page.getByRole('button', { name: 'Show me the site' }).click();
  const guided = page.getByRole('region', { name: 'Guided run' });
  await expect(guided).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play' })).toBeDisabled();

  await expect(guided).toHaveAttribute('data-step', 'comparison', { timeout: 20_000 });
  const totals = guided.locator('.guided-totals');
  await expect(totals.getByText('Revenue at risk, unprepared')).toBeVisible();
  await expect(totals.getByText('Revenue at risk, prepared')).toBeVisible();
  await expect(totals.locator('[data-quantity]')).toHaveCount(3);
  const caveat = guided.locator('.assumption-caveat');
  await expect(caveat).toContainText('This projection rests on two assumed numbers');
  await expect(caveat.locator('[data-quantity]')).toHaveCount(2);
  for (const qty of await caveat.locator('[data-quantity]').all()) await expect(qty).toContainText('assumed');
  await expect(guided.locator('.guided-draft-region .guided-totals')).toBeVisible();
});

test('free play: cut hosted-erp, scrub to day 13, haulage reads Stopped', async ({ page }) => {
  await open(page, '#/site');
  // Free play opens on s1-projection, whose own hosted-erp cut shows as Restore; restore it, then cut it plainly.
  await page.getByRole('button', { name: 'Restore Hosted ERP' }).click();
  // Negative control. With no cuts the run is one quiet day, so cut cloud logins alone to reach day 13:
  // haulage keeps going without the ERP cut.
  await page.locator('[data-service-group="cloud-identity"]').getByRole('button', { name: /^Cut / }).click();
  await scrubToDay(page, 13);
  await expect(page.getByRole('button', { name: /^Haulage: / })).not.toHaveAccessibleName(/^Haulage: Stopped/);
  await expect(page.locator('.state-box')).not.toHaveAttribute('data-state', 'stopped');

  // A cut starts on the current day, so go back to day 0 first.
  await scrubToDay(page, 0);
  await page.getByRole('button', { name: 'Cut Hosted ERP' }).click();
  await expect(page.getByRole('button', { name: 'Restore Hosted ERP' })).toHaveAttribute('aria-pressed', 'true');

  await scrubToDay(page, 13);
  await expect(page.getByRole('button', { name: /^Haulage: Stopped/ })).toBeVisible();
  await expect(page.locator('.state-box')).toHaveAttribute('data-state', 'stopped');
});

test('no untagged numbers on the site view', async ({ page }) => {
  await open(page, '#/site');
  for (const day of [0, 6, 13]) {
    await scrubToDay(page, day);
    expect(await untaggedNumbers(page), `day ${day}`).toEqual([]);
  }
});

test('no console errors and no requests to other origins', async ({ page, baseURL }) => {
  const errors: string[] = [];
  const foreign: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    if (new URL(r.url()).origin !== new URL(baseURL!).origin && !r.url().startsWith('data:')) foreign.push(r.url());
  });

  await open(page, '#/');
  await page.getByRole('button', { name: 'Explore freely' }).click();
  await expect(slider(page)).toBeVisible();
  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible({ timeout: 10_000 });
  for (const hash of ['#/sources', '#/tested', '#/built', '#/limits', '#/']) {
    await page.goto(`/?e2e${hash}`);
    await expect(page.getByRole('navigation', { name: 'Pages' })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Show me the site' }).click();
  await expect(page.getByRole('region', { name: 'Guided run' })).toBeVisible();

  expect(errors).toEqual([]);
  expect(foreign).toEqual([]);
});

test('desktop frame', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'the desktop frame');
  await open(page, '#/site');
  const box = async (selector: string) => (await page.locator(selector).first().boundingBox())!;

  expect((await box('.top-bar')).height).toBe(60);
  expect((await box('.site-strip')).height).toBe(92);
  const detail = await box('.site-detail');
  expect(detail.width).toBe(372);
  expect(detail.x + detail.width).toBe(1440);
  expect((await box('.timeline-controls')).width).toBe(186);
  expect((await box('.stock-meters')).width).toBe(250);

  const stage = await box('.site-stage');
  const cards = await page.locator('.service-card').evaluateAll((els) =>
    els.map((e) => ({ group: (e as HTMLElement).dataset.serviceGroup!, ...(e.getBoundingClientRect().toJSON() as Box) })),
  );
  expect(cards).toHaveLength(5);
  for (const [i, c] of cards.entries()) {
    expect(c.x).toBeGreaterThanOrEqual(stage.x);
    expect(c.x + c.width).toBeLessThanOrEqual(stage.x + stage.width);
    expect(c.y).toBeGreaterThanOrEqual(stage.y);
    const next = cards[i + 1];
    if (next) expect(c.x + c.width).toBeLessThanOrEqual(next.x);
    // Centred on its own cable, which starts below it and stays visible.
    const cable = await box(`[data-cable-group="${c.group}"]`);
    expect(Math.abs(c.x + c.width / 2 - (cable.x + cable.width / 2))).toBeLessThanOrEqual(2);
    expect(c.y + c.height).toBeLessThanOrEqual(cable.y);
    expect(cable.height).toBeGreaterThan(20);
  }

  // The legend sits in its own band: it never covers the plinth's honesty line.
  const legend = await box('.legend');
  expect(legend.x + legend.width).toBeLessThanOrEqual(stage.x + stage.width);
  expect(legend.y + legend.height).toBeLessThanOrEqual(stage.y + stage.height);
  expect(intersects(legend, await box('.scene-plinth'))).toBe(false);
  await expect(page.getByText(/SYNTHETIC DATA/)).toBeVisible();
  await expect(page.locator('.scene-plinth')).toBeVisible();
  await expect(page.locator('.scene-plinth')).toHaveText('FICTIONAL MODEL SITE · PILBARA IRON ORE · SYNTHETIC DATA');

  // A cut card is taller; it still never crosses the stage top.
  const cuts = page.locator('.service-card').getByRole('button', { name: /^Cut / });
  for (let left = await cuts.count(); left > 0; left--) {
    await cuts.first().click();
    await expect(cuts).toHaveCount(left - 1);
  }
  for (const c of await page.locator('.service-card').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON() as Box)))
    expect(c.y).toBeGreaterThanOrEqual(stage.y);

  await scrubToDay(page, 13);
  await page.screenshot({ path: info.outputPath('desktop-1440x900.png') });
});

test('hairline labels never overlap', async ({ page }) => {
  await open(page, '#/site');
  for (const day of [0, 3, 12, 16]) {
    await scrubToDay(page, day);
    const labels = await visibleLabels(page);
    expect(labels.length, `day ${day}`).toBeLessThanOrEqual(1);
  }
  // Hovering a hairline shows its label alone; focusing one does the same.
  // Events at one hour share a spot; force the hover onto whichever hairline is on top.
  await page.locator('.timeline-event').nth(2).hover({ force: true });
  const hovered = await visibleLabels(page);
  expect(hovered).toHaveLength(1);
  await page.mouse.move(0, 0);
  await page.locator('.timeline-event').nth(4).focus();
  const focused = await visibleLabels(page);
  for (const [i, a] of focused.entries()) for (const b of focused.slice(i + 1)) expect(intersects(a, b)).toBe(false);
  // Focus on one hairline (by keyboard, so it is focus-visible) and the pointer on another: one label, the hovered one's.
  await page.locator('.timeline-event').nth(3).focus();
  await page.keyboard.press('Tab');
  await expect(page.locator('.timeline-event').nth(4)).toBeFocused();
  // Haulage's hairline stands alone, so the pointer lands on it and nothing else. Its top pixel: on
  // the tablet strip the axis track covers the rest of it.
  const haulage = page.getByRole('button', { name: 'Haulage stopped' });
  await haulage.hover({ position: { x: 5, y: 1 } });
  expect(await page.evaluate(() => [...document.querySelectorAll('.timeline-event:hover')].map((e) => e.getAttribute('aria-label')))).toEqual(['Haulage stopped']);
  const shown = await page.locator('.timeline-event-name').evaluateAll((els) => els.filter((e) => e.getClientRects().length > 0).map((e) => e.textContent));
  expect(shown).toEqual(['Haulage']);
  await page.mouse.move(0, 0);
  // Every event is still listed, with its hour.
  const list = page.getByRole('region', { name: 'Events' }).filter({ visible: true });
  await expect(list.getByRole('listitem')).toHaveCount(await page.locator('.timeline-event').count());
});

test('provenance tags: the sourced tooltip is hoverable and Escape closes it; the assumed reasoning toggles by keyboard and by tap', async ({ page }, info) => {
  await open(page, '#/site');
  const revenue = page.locator('.revenue-working').filter({ visible: true });
  const sourced = revenue.getByRole('button', { name: 'sourced value' }).first();
  await sourced.hover();
  const sourcedTip = page.locator(`#${await sourced.getAttribute('aria-describedby')}`);
  await expect(sourcedTip).toBeVisible();
  // Across the gap and onto the tooltip itself: it stays.
  const tip = (await sourcedTip.boundingBox())!;
  const tag = (await sourced.boundingBox())!;
  await page.mouse.move(tag.x + tag.width / 2, (tag.y + tip.y + tip.height) / 2, { steps: 4 });
  await page.mouse.move(tip.x + tip.width / 2, tip.y + tip.height / 2, { steps: 4 });
  await expect(sourcedTip).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sourcedTip).toBeHidden();
  await page.mouse.move(0, 0);

  const assumed = revenue.getByRole('button', { name: 'assumed value' }).first();
  const assumedTip = page.locator(`#${await assumed.getAttribute('aria-describedby')}`);
  await assumed.focus();
  await expect(assumedTip).toBeVisible();
  expect((await assumedTip.textContent())!.length).toBeGreaterThan(0);
  await page.keyboard.press('Escape');
  await expect(assumedTip).toBeHidden();
  await assumed.blur();
  if (info.project.use.hasTouch) {
    // A tap emulates hover and focus, so it must toggle on its own: open, then closed.
    await assumed.tap();
    await expect(assumedTip).toBeVisible();
    await expect(assumed).toHaveAttribute('aria-expanded', 'true');
    await assumed.tap();
    await expect(assumedTip).toBeHidden();
    await expect(assumed).toHaveAttribute('aria-expanded', 'false');
  } else {
    // Focused (so showing), the first press closes it and the next opens it.
    await assumed.focus();
    await expect(assumedTip).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(assumedTip).toBeHidden();
    await page.keyboard.press('Enter');
    await expect(assumedTip).toBeVisible();
    await expect(assumed).toHaveAttribute('aria-expanded', 'true');
  }
  await page.keyboard.press('Escape');
  await page.mouse.move(0, 0);

  // Every popover in the working opens inside the window, however near the edge its tag sits.
  const width = page.viewportSize()!.width;
  for (const t of await revenue.getByRole('button', { name: /^(assumed|sourced) value$/ }).all()) {
    await t.blur();
    await t.focus();
    const popover = page.locator(`#${await t.getAttribute('aria-describedby')}`);
    await expect(popover).toBeVisible();
    const box = (await popover.boundingBox())!;
    expect(box.x, 'popover left').toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, 'popover right').toBeLessThanOrEqual(width);
    await page.keyboard.press('Escape');
  }
});

test('phone layout', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'the phone layout');
  await open(page, '#/site');
  const noSideScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

  expect(await noSideScroll()).toBe(true);
  await expect(page.getByText(/Best on a laptop/)).toBeVisible();
  await expect(page.getByRole('region', { name: 'Assumptions' })).toHaveCount(0);

  const card = page.locator('[data-service-group="cloud-identity"]');
  await card.getByRole('button', { name: /^Cut / }).click();
  await expect(card.getByRole('button', { name: /^Restore / })).toHaveAttribute('aria-pressed', 'true');
  await expect(card).toHaveAttribute('data-cut', 'true');
  expect(await noSideScroll()).toBe(true);
  // Nothing outside the card scroller reaches past the viewport's right edge.
  const overflowing = await page.evaluate(() =>
    [...document.body.querySelectorAll('*')]
      .filter((e) => !e.closest('.site-cards') && e.getBoundingClientRect().right > window.innerWidth + 0.5)
      .map((e) => `${e.tagName.toLowerCase()}.${e.getAttribute('class') ?? ''}`),
  );
  expect(overflowing).toEqual([]);
  await page.screenshot({ path: info.outputPath('phone-390x844.png'), fullPage: true });
});

test('tablet layout', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('tablet'), 'the tablet layouts');
  await open(page, '#/site');
  const box = async (selector: string) => (await page.locator(selector).first().boundingBox())!;
  const viewport = page.viewportSize()!;

  expect((await box('.timeline-axis')).width).toBeGreaterThan(200);
  for (const name of ['Unprepared', 'Prepared']) await expect(page.getByRole('button', { name, exact: true })).toBeInViewport({ ratio: 1 });

  // Cut every service still up, so every card is in its cut state.
  const cuts = page.locator('.service-card').getByRole('button', { name: /^Cut / });
  for (let left = await cuts.count(); left > 0; left--) {
    await cuts.first().click();
    await expect(cuts).toHaveCount(left - 1);
  }
  const stage = await box('.site-stage');
  const cards = await page.locator('.service-card').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON() as Box));
  expect(cards).toHaveLength(5);
  for (const c of cards) {
    expect(c.y).toBeGreaterThanOrEqual(stage.y);
    expect(c.x).toBeGreaterThanOrEqual(stage.x);
    expect(c.x + c.width).toBeLessThanOrEqual(stage.x + stage.width);
  }
  await page.screenshot({ path: info.outputPath(`tablet-${viewport.width}x${viewport.height}-all-cut.png`) });

  // Nothing outside the card scroller reaches past the viewport's right edge.
  const overflowing = await page.evaluate(() =>
    [...document.body.querySelectorAll('*')]
      .filter((e) => !e.closest('.site-cards') && e.getBoundingClientRect().right > window.innerWidth + 0.5)
      .map((e) => `${e.tagName.toLowerCase()}.${e.getAttribute('class') ?? ''}`),
  );
  expect(overflowing).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await scrubToDay(page, 13);
  await page.screenshot({ path: info.outputPath(`tablet-${viewport.width}x${viewport.height}.png`) });
});

test('1150 px keeps a usable timeline', async ({ page }, info) => {
  test.skip(info.project.name !== 'laptop-small', 'the small laptop');
  await open(page, '#/site');
  expect((await page.locator('.timeline-axis').first().boundingBox())!.width).toBeGreaterThan(200);
  for (const name of ['Unprepared', 'Prepared']) await expect(page.getByRole('button', { name, exact: true })).toBeInViewport({ ratio: 1 });
  await page.screenshot({ path: info.outputPath('laptop-1150x800.png') });
});

test('the site runs under the deployed CSP', async ({ page }) => {
  // Listen before any page script runs, so violations during module evaluation and first paint count too.
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { __cspViolations: string[] }).__cspViolations = seen;
    document.addEventListener('securitypolicyviolation', (e) => seen.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  const violations = () => page.evaluate(() => (window as unknown as { __cspViolations: string[] }).__cspViolations);

  const response = await page.goto('/?e2e#/');
  // `vite preview` serves public/_headers; without the header, no violations would prove nothing.
  expect(response!.headers()['content-security-policy']).toContain("script-src 'self'");
  await expect(page.getByRole('button', { name: 'Show me the site' })).toBeVisible();
  expect(await violations()).toEqual([]);

  await open(page, '#/site');
  const card = page.locator('[data-service-group="cloud-identity"]');
  await card.getByRole('button', { name: /^Cut / }).click();
  await expect(card).toHaveAttribute('data-cut', 'true');
  await scrubToDay(page, 6);
  expect(await violations()).toEqual([]);
});

// --- The diorama's DOM layer at each width (task 7) ---------------------------------------------------

type Rect = { x: number; y: number; w: number; h: number };
type PlaqueInfo = { rect: Rect | null; inFrame: boolean };
const GROUPS = ['hosted-erp', 'cloud-identity', 'iroc-link', 'corporate-network', 'vendor-access'];

/** The site with a still diorama (reduced motion: these checks are about layout, not motion). */
async function openStill(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, '#/site');
  await expect(page.locator('.scene--diorama[data-ready="true"]')).toBeVisible({ timeout: 20_000 });
}

test('cards sit on their cables, and every post and plaque is in frame without collisions', async ({ page }, info) => {
  test.skip(info.project.name === 'phone', 'phones hide the cables and crop the scene');
  await openStill(page);
  const scene = (await page.locator('.scene--diorama').boundingBox())!;

  // Each card is centred on its reported anchor (where its cable enters the scene) and covers at most 8 px of it.
  for (const [i, id] of GROUPS.entries()) {
    const card = (await page.locator(`.service-card[data-service-group="${id}"]`).boundingBox())!;
    const cable = (await page.locator(`[data-cable-group="${id}"]`).boundingBox())!;
    const anchor = cable.x + cable.width / 2;
    expect(Math.abs(anchor - (scene.x + ((i + 1) / 6) * scene.width)), `${id} anchor`).toBeLessThanOrEqual(1);
    expect(Math.abs(card.x + card.width / 2 - anchor), `${id} centring`).toBeLessThanOrEqual(2);
    expect(card.y + card.height - cable.y, `${id} covers its cable`).toBeLessThanOrEqual(8);
  }
  // Every card stays inside the stage, and every name on it reads in full.
  const stage = (await page.locator('.site-stage').boundingBox())!;
  for (const id of GROUPS) {
    const card = (await page.locator(`.service-card[data-service-group="${id}"]`).boundingBox())!;
    expect(card.x, `${id} left edge`).toBeGreaterThanOrEqual(stage.x);
    expect(card.x + card.width, `${id} right edge`).toBeLessThanOrEqual(stage.x + stage.width);
  }
  const truncated = await page
    .locator('.service-card-name, .service-row-name')
    .evaluateAll((els) => els.filter((e) => e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1).map((e) => e.textContent));
  expect(truncated).toEqual([]);

  // Every entry post is drawn inside the stage, so every cable visibly reaches it.
  for (const id of GROUPS) {
    const post = await page.evaluate((g) => window.__faillocal!.diorama!.entryPost(g), id);
    expect(post.x, id).toBeGreaterThan(0);
    expect(post.x, id).toBeLessThan(scene.width);
    expect(post.y, id).toBeGreaterThan(0);
    expect(post.y, id).toBeLessThan(scene.height);
  }
  // The first view shows the model on its plinth: the plate is engraved on the front-left face, not pinned.
  await expect(page.locator('.scene-plinth')).toHaveAttribute('data-placement', 'face');
  await expect(page.locator('.scene-plinth')).toBeVisible();

  for (const day of [0, 13]) {
    await scrubToDay(page, day);
    // The plaques are laid out on the next drawn frame: wait until two reads agree.
    const read = () => page.evaluate(() => JSON.stringify(window.__faillocal!.diorama!.plaques()));
    await expect.poll(async () => {
      const a = await read();
      await page.waitForTimeout(150);
      return a === (await read());
    }).toBe(true);
    // At the start of the run and at day 13 (wider plaques): every flag in frame has its plaque, whole inside the stage, and no two plaques overlap.
    const plaques = (await page.evaluate(() => window.__faillocal!.diorama!.plaques())) as Record<string, PlaqueInfo>;
    const shown = Object.entries(plaques).filter(([, p]) => p.inFrame);
    expect(shown.length).toBeGreaterThanOrEqual(8);
    for (const [id, p] of shown) {
      expect(p.rect, `${id} on day ${day}`).not.toBeNull();
      const r = p.rect!;
      expect(r.x >= 0 && r.y >= 0 && r.x + r.w <= scene.width && r.y + r.h <= scene.height, `${id} clipped`).toBe(true);
    }
    const rects = shown.map(([id, p]) => [id, p.rect!] as const);
    for (const [i, [a, ra]] of rects.entries())
      for (const [b, rb] of rects.slice(i + 1))
        expect(intersects({ x: ra.x, y: ra.y, width: ra.w, height: ra.h }, { x: rb.x, y: rb.y, width: rb.w, height: rb.h }), `${a} and ${b}`).toBe(false);

    // Each area's button covers its plaque (once React has laid the DOM layer out from the same frame).
    const uncovered = () =>
      page.evaluate((list) => {
        const host = document.querySelector('.scene--diorama')!.getBoundingClientRect();
        return list.flatMap(([id, r]) => {
          const b = document.querySelector(`.scene-hit[data-area="${id}"]`)!.getBoundingClientRect();
          const x = b.left - host.left;
          const y = b.top - host.top;
          const covers = x <= r.x + 1 && y <= r.y + 1 && x + b.width >= r.x + r.w - 1 && y + b.height >= r.y + r.h - 1;
          return covers ? [] : [id];
        });
      }, rects as unknown as [string, Rect][]);
    await expect.poll(uncovered).toEqual([]);
    // No plaque covers the honesty plate or the Fit button.
    await expect.poll(() => plaquesOver(page, ['.scene-plinth', '.scene-fit'])).toEqual([]);
  }
  await page.screenshot({ path: info.outputPath(`plaques-${page.viewportSize()!.width}.png`) });
});

/**
 * Plaques (from the probe) that overlap any of the scene's DOM elements matching `selectors`, as "plaque/selector".
 * An element set in the plinth face's plane (the engraved plate) is tested as the slanted strip it is drawn as,
 * not as the box round its slant.
 */
function plaquesOver(page: Page, selectors: string[]): Promise<string[]> {
  return page.evaluate((sels) => {
    type P = { x: number; y: number };
    const host = document.querySelector('.scene--diorama')!.getBoundingClientRect();
    const plaques = window.__faillocal!.diorama!.plaques();
    // The element's four corners as drawn, in stage pixels.
    const quad = (el: HTMLElement): P[] => {
      const css = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (css.transform === 'none') return [{ x: r.left, y: r.top }, { x: r.right, y: r.top }, { x: r.right, y: r.bottom }, { x: r.left, y: r.bottom }].map((p) => ({ x: p.x - host.left, y: p.y - host.top }));
      const m = new DOMMatrix(css.transform);
      const [ox, oy] = css.transformOrigin.split(' ').map(parseFloat) as [number, number];
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      return [[0, 0], [w, 0], [w, h], [0, h]].map(([x, y]) => {
        const t = m.transformPoint(new DOMPoint(x! - ox, y! - oy));
        return { x: el.offsetLeft + ox + t.x, y: el.offsetTop + oy + t.y };
      });
    };
    // Separating axis test between a convex quad and an axis-aligned box.
    const overlaps = (q: P[], b: { x: number; y: number; w: number; h: number }) => {
      const box = [{ x: b.x, y: b.y }, { x: b.x + b.w, y: b.y }, { x: b.x + b.w, y: b.y + b.h }, { x: b.x, y: b.y + b.h }];
      const axes = [{ x: 1, y: 0 }, { x: 0, y: 1 }, ...q.map((p, i) => { const n = q[(i + 1) % q.length]!; return { x: p.y - n.y, y: n.x - p.x }; })];
      return axes.every((a) => {
        const span = (pts: P[]) => { const d = pts.map((p) => p.x * a.x + p.y * a.y); return [Math.min(...d), Math.max(...d)] as const; };
        const [a0, a1] = span(q);
        const [b0, b1] = span(box);
        return a0 < b1 && b0 < a1;
      });
    };
    return sels.flatMap((sel) => {
      const q = quad(document.querySelector<HTMLElement>(sel)!);
      return Object.entries(plaques).flatMap(([id, p]) => (p.rect && overlaps(q, p.rect) ? [`${id}/${sel}`] : []));
    });
  }, selectors);
}

test('zoomed out, the plate is engraved on the plinth face and no plaque covers it', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one viewport is enough for the zoomed-out plate');
  await openStill(page);
  await page.locator('.scene--diorama').focus();
  for (let i = 0; i < 8; i++) await page.keyboard.press('-');
  const plate = page.locator('.scene-plinth');
  await expect(plate).toHaveAttribute('data-placement', 'face');
  await expect(plate).toContainText('SYNTHETIC DATA');
  const scene = (await page.locator('.scene--diorama').boundingBox())!;
  const b = (await plate.boundingBox())!;
  expect(b.x).toBeGreaterThanOrEqual(scene.x);
  expect(b.y + b.height).toBeLessThanOrEqual(scene.y + scene.height);
  await expect.poll(() => plaquesOver(page, ['.scene-plinth', '.scene-fit'])).toEqual([]);
});

test('a focused area button never goes out of sight when the camera moves', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'wheel zoom on the laptop frame');
  test.setTimeout(45_000);
  await openStill(page);
  const remote = page.getByRole('button', { name: /^Remote operations from Perth: / });
  await remote.focus();
  // Zoom in about the far left of the scene, which carries the area (at the right) out of frame.
  const scene = (await page.locator('.scene--diorama').boundingBox())!;
  await page.mouse.move(scene.x + 40, scene.y + scene.height / 2);
  for (let i = 0; i < 4; i++) await page.mouse.wheel(0, -300);
  await expect(remote).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.__faillocal!.diorama!.plaques()['remote-operations']!.inFrame)).toBe(true);
  await expect(remote).not.toHaveClass(/scene-hit--away/);
  await expect.poll(async () => {
    const b = (await remote.boundingBox())!;
    return b.width > 20 && b.x >= scene.x && b.x + b.width <= scene.x + scene.width + 0.5;
  }).toBe(true);
});

test('the honesty plate stays visible at maximum zoom', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one viewport is enough for the zoom');
  await openStill(page);
  await page.locator('.scene--diorama').focus();
  for (let i = 0; i < 12; i++) await page.keyboard.press('+');
  expect((await page.evaluate(() => window.__faillocal!.diorama!.camera())).k).toBeCloseTo(2.4, 6);
  const plate = page.locator('.scene-plinth');
  await expect(plate).toBeVisible();
  await expect(plate).toContainText('SYNTHETIC DATA');
  const scene = (await page.locator('.scene--diorama').boundingBox())!;
  const b = (await plate.boundingBox())!;
  expect(b.x).toBeGreaterThanOrEqual(scene.x);
  expect(b.y).toBeGreaterThanOrEqual(scene.y);
  expect(b.x + b.width).toBeLessThanOrEqual(scene.x + scene.width);
  expect(b.y + b.height).toBeLessThanOrEqual(scene.y + scene.height);
});

test('phone: the scene crops to the working area, hides the cables, and a tap selects an area', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'the phone scene');
  await openStill(page);
  for (const id of GROUPS) await expect(page.locator(`[data-cable-group="${id}"]`)).toBeHidden();
  const centre = await page.evaluate(() => window.__faillocal!.diorama!.groundAtCentre());
  // The working area's centre (layout.ts): between the pit and the crusher.
  expect(centre.x).toBeCloseTo(800, 0);
  expect(centre.y).toBeCloseTo(525, 0);
  const crushing = page.getByRole('button', { name: /^Crushing and conveying: / });
  await expect(crushing).toHaveAttribute('aria-pressed', 'false');
  await crushing.tap();
  await expect(crushing).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { name: 'Crushing and conveying' })).toBeVisible();
});

test('welcome hero: the k = 1.18 crop, moving, and still under reduced motion', async ({ page }, info) => {
  test.skip(!['desktop', 'phone'].includes(info.project.name), 'the welcome page on a laptop and a phone');
  await open(page, '#/');
  await expect(page.locator('.welcome-scene .scene--diorama[data-ready="true"]')).toBeVisible({ timeout: 20_000 });
  expect((await page.evaluate(() => window.__faillocal!.diorama!.camera())).k).toBe(1.18);
  await expect(page.locator('.welcome-scene button, .welcome-scene [tabindex]')).toHaveCount(0);
  const frames = () => page.evaluate(() => window.__faillocal!.diorama!.frames());
  const before = await frames();
  await expect.poll(frames).toBeGreaterThan(before + 3);
  await page.screenshot({ path: info.outputPath(`welcome-${page.viewportSize()!.width}.png`) });

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(async () => {
    const a = await frames();
    await page.waitForTimeout(300);
    return (await frames()) - a;
  }).toBe(0);
});
