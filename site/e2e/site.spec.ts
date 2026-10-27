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
  const caveat = guided.locator('.guided-caveat');
  await expect(caveat).toContainText('hold on purchasing');
  await expect(caveat.locator('[data-quantity]')).toContainText('assumed');
});

test('free play: cut hosted-erp, scrub to day 13, haulage reads Stopped', async ({ page }) => {
  await open(page, '#/site');
  // Free play opens on s1-projection, whose own hosted-erp cut shows as Restore; restore it, then cut it plainly.
  await page.getByRole('button', { name: 'Restore Hosted ERP' }).click();
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
  const cards = await page.locator('.service-card').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON() as DOMRect));
  expect(cards).toHaveLength(5);
  for (const [i, c] of cards.entries()) {
    expect(c.x).toBeGreaterThanOrEqual(stage.x);
    expect(c.x + c.width).toBeLessThanOrEqual(stage.x + stage.width);
    expect(c.y).toBeGreaterThanOrEqual(stage.y);
    const next = cards[i + 1];
    if (next) expect(c.x + c.width).toBeLessThanOrEqual(next.x);
  }
  const legend = await box('.legend');
  expect(legend.x + legend.width).toBeLessThanOrEqual(stage.x + stage.width);
  expect(legend.y + legend.height).toBeLessThanOrEqual(stage.y + stage.height);
  expect(legend.x).toBeGreaterThan(stage.x + stage.width / 2);

  await scrubToDay(page, 13);
  await page.screenshot({ path: info.outputPath('desktop-1440x900.png') });
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
  await page.screenshot({ path: info.outputPath('phone-390x844.png'), fullPage: true });
});
