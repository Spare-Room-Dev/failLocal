import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

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

/**
 * The page-level `untaggedNumbers` (site/test/helpers/untagged.ts), with the same exemptions:
 * digit-bearing text that no `<Qty>`, clock value, date, cited title or message owns.
 */
function untaggedNumbers(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const EXEMPT = '[data-quantity], [data-clock], [data-message], time, cite, script, style, [aria-hidden="true"][data-decorative]';
    const found: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent?.trim() ?? '';
      if (!/\d/.test(text)) continue;
      if (node.parentElement?.closest(EXEMPT)) continue;
      found.push(text);
    }
    return found;
  });
}

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
    const cable = await box(`[data-cable="${c.group}"] [data-cable-group] line`);
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
  // Every event is still listed, with its hour.
  const list = page.getByRole('region', { name: 'Events' }).filter({ visible: true });
  await expect(list.getByRole('listitem')).toHaveCount(await page.locator('.timeline-event').count());
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
