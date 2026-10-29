// @vitest-environment node
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { RELEASE_BLOCKERS, checkHeadersShipped, checkNoBlockers, checkPreviewTags } from '../scripts/release-check.mjs';

/** A throwaway `dist/` holding `files` (path → contents). */
function fixtureDist(files: Record<string, string>): string {
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
  expect(RELEASE_BLOCKERS).toEqual(['[Your name]', '[owner]', '[Placeholder', 'draft-marker', 'draft-banner', 'Draft copy', 'awaiting owner review']);
  for (const blocker of RELEASE_BLOCKERS) {
    const dist = fixtureDist({ 'assets/index.js': `const s = ${JSON.stringify(`before ${blocker} after`)};` });
    const problems = checkNoBlockers(dist);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('dist/assets/index.js');
    expect(problems[0]).toContain(blocker);
  }
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

test('release-check requires the headers file', () => {
  expect(checkHeadersShipped(fixtureDist({ '_headers': '/*\n  X-Content-Type-Options: nosniff\n', 'index.html': '' }))).toEqual([]);
  expect(checkHeadersShipped(fixtureDist({ 'index.html': '' }))).toEqual(['dist/_headers is missing']);
});
