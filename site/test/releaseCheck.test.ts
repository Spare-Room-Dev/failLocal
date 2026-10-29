// @vitest-environment node
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { PLACEHOLDER_OG_SHA256, RELEASE_BLOCKERS, checkNoBlockers, checkPreviewImageRegenerated, checkPreviewTags, checkVercelConfig } from '../scripts/release-check.mjs';

/** A throwaway `dist/` holding `files` (path → contents). */
function fixtureDist(files: Record<string, string | Buffer>): string {
  const dir = mkdtempSync(join(tmpdir(), 'faillocal-release-'));
  for (const [path, contents] of Object.entries(files)) {
    mkdirSync(join(dir, path, '..'), { recursive: true });
    writeFileSync(join(dir, path), contents);
  }
  return dir;
}

/** index.html's head with the two preview tags set to `url` and `image`. */
function previewHtml(url: string, image: string): string {
  return `<head><meta property="og:url" content="${url}" /><meta property="og:image" content="${image}" /></head>`;
}

test('release-check rejects placeholders and draft markers', () => {
  expect(RELEASE_BLOCKERS).toEqual([
    '[Your name]',
    '[owner]',
    '[Placeholder',
    'placeholder until',
    'draft-marker',
    'draft-banner',
    'Draft copy',
    'awaiting owner review',
  ]);
  for (const blocker of RELEASE_BLOCKERS) {
    const dist = fixtureDist({ 'assets/index.js': `const s = ${JSON.stringify(`before ${blocker} after`)};` });
    const problems = checkNoBlockers(dist);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('dist/assets/index.js');
    expect(problems[0]).toContain(blocker);
  }
  // The Limitations page's decision-log note, as React renders it.
  const limits = fixtureDist({ 'assets/index.js': 'jsx("span",{className:"placeholder",children:"(placeholder until the repo is public)"})' });
  expect(checkNoBlockers(limits)).toEqual(['dist/assets/index.js contains "placeholder until"']);
  // React DOM's own code names the `placeholder` attribute; that alone is not a blocker.
  expect(checkNoBlockers(fixtureDist({ 'assets/react.js': 'const a = ["placeholder","value"];' }))).toEqual([]);
  const html = fixtureDist({ 'index.html': '<p>By [Your name]</p>' });
  expect(checkNoBlockers(html)).toEqual(['dist/index.html contains "[Your name]"']);
  const css = fixtureDist({ 'assets/index.css': '.draft-marker { color: red }', 'assets/index.js': 'const ok = 1;' });
  expect(checkNoBlockers(css)).toEqual([]);
});

test('release-check requires absolute preview URLs', () => {
  expect(checkPreviewTags(previewHtml('https://x.example/', 'https://x.example/og.png'))).toEqual([]);

  const unset = checkPreviewTags(previewHtml('%VITE_SITE_ORIGIN%/', '%VITE_SITE_ORIGIN%/og.png'));
  expect(unset).toContain('dist/index.html og:url is not an absolute https:// URL: %VITE_SITE_ORIGIN%/');
  expect(unset).toContain('dist/index.html og:image is not an absolute https:// URL: %VITE_SITE_ORIGIN%/og.png');
  expect(unset).toContain('dist/index.html still contains %VITE_ (a build variable was not set)');

  expect(checkPreviewTags(previewHtml('http://x.example/', 'https://x.example/og.png'))).toEqual([
    'dist/index.html og:url is not an absolute https:// URL: http://x.example/',
  ]);
  expect(checkPreviewTags(previewHtml('/', '/og.png'))).toHaveLength(2);

  // A trailing slash on VITE_SITE_ORIGIN doubles the slash before the path.
  expect(checkPreviewTags(previewHtml('https://x.example//', 'https://x.example//og.png'))).toEqual([
    'dist/index.html og:url has a doubled slash: https://x.example//',
    'dist/index.html og:image has a doubled slash: https://x.example//og.png',
  ]);

  expect(checkPreviewTags('<head></head>')).toEqual([
    'dist/index.html has no og:url tag',
    'dist/index.html has no og:image tag',
  ]);
});

test('release-check requires vercel.json to carry the _headers rules', () => {
  const headers = '/*\n  X-Content-Type-Options: nosniff\n';
  const vercel = (value: string) =>
    JSON.stringify({ headers: [{ source: '/(.*)', headers: [{ key: 'X-Content-Type-Options', value }] }] });
  const dir = (files: Record<string, string>) => fixtureDist({ '_headers': headers, ...files });
  const check = (d: string) => checkVercelConfig(join(d, 'vercel.json'), join(d, '_headers'));

  expect(check(dir({ 'vercel.json': vercel('nosniff') }))).toEqual([]);
  expect(check(dir({}))).toEqual(['vercel.json is missing, so Vercel would serve the site with no security headers']);
  expect(check(dir({ 'vercel.json': '{ not json' }))[0]).toMatch(/^vercel\.json is not valid JSON: /);
  expect(check(dir({ 'vercel.json': vercel('sniff') }))).toEqual([
    'vercel.json /(.*) sends X-Content-Type-Options: sniff, but _headers /* sends X-Content-Type-Options: nosniff',
  ]);
});

test('release-check requires og.png to be made again after the byline lands', () => {
  // The gate refuses the committed placeholder render by its hash (checked against the real image by
  // `npm run release`); here a fixture image stands in, so regenerating og.png does not break this test.
  expect(PLACEHOLDER_OG_SHA256).toMatch(/^[0-9a-f]{64}$/);
  const image = Buffer.from('the placeholder render');
  const hash = createHash('sha256').update(image).digest('hex');
  expect(checkPreviewImageRegenerated(fixtureDist({ 'og.png': image }), hash)).toEqual([
    'dist/og.png is still the placeholder render showing "[Your name]"; make it again with `npm run og-image -w site` (D-114)',
  ]);
  expect(checkPreviewImageRegenerated(fixtureDist({ 'og.png': Buffer.from('a regenerated image') }), hash)).toEqual([]);
  expect(checkPreviewImageRegenerated(fixtureDist({ 'index.html': '' }), hash)).toEqual(['dist/og.png is missing']);
});
