// @vitest-environment node
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { allowedUrls, checkIndexHtml, findDisallowedUrls, gzippedJsBytes } from '../scripts/check-build.mjs';
import { parseHeaders } from '../scripts/headers.mjs';

const HEADERS_FILE = new URL('../public/_headers', import.meta.url);

const REGISTER = `
sources:
  - id: one
    url: https://example.org/report.pdf?lang=en
  - id: two
    url: https://news.example.com/story/
`;

/** A throwaway `dist/` holding `files` (path → contents). */
function fixtureDist(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'faillocal-dist-'));
  for (const [path, contents] of Object.entries(files)) {
    mkdirSync(join(dir, path, '..'), { recursive: true });
    writeFileSync(join(dir, path), contents);
  }
  return dir;
}

test('headers file carries the exact CSP', () => {
  const headers = parseHeaders(readFileSync(HEADERS_FILE, 'utf8'));
  expect(headers).toEqual({
    '/*': {
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    },
  });
});

describe('check-build', () => {
  test('check-build rejects an inline script', () => {
    const clean = '<script type="module" crossorigin src="/assets/index.js"></script><div id="root"></div>';
    expect(checkIndexHtml(clean)).toEqual([]);
    expect(checkIndexHtml('<script>window.x = 1</script>')).toEqual(['dist/index.html has an inline <script> body']);
    expect(checkIndexHtml('<div style="color: red"></div>')).toEqual(['dist/index.html has an inline style= attribute']);
    expect(checkIndexHtml('<style>body { margin: 0 }</style>')).toEqual(['dist/index.html has an inline <style> body']);
  });

  test('check-build allows register source URLs only', () => {
    const allowed = allowedUrls(REGISTER);
    const dist = fixtureDist({
      'index.html': '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
      'assets/index.js': 'const y = "url: https://example.org/report.pdf?lang=en\\n  - url: https://news.example.com/story/\\n";',
    });
    expect(findDisallowedUrls(dist, allowed)).toEqual([]);

    const leaky = fixtureDist({
      'assets/index.js': 'fetch("https://tracker.example.net/pixel.gif"); const a = "https://example.org/report.pdf";',
      'assets/index.css': '@import url(http://fonts.example.com/face.css);',
      'assets/face.woff2': 'binary https://ignored.example.com/',
    });
    expect(findDisallowedUrls(leaky, allowed)).toEqual([
      { file: 'assets/index.css', url: 'http://fonts.example.com/face.css' },
      { file: 'assets/index.js', url: 'https://tracker.example.net/pixel.gif' },
      { file: 'assets/index.js', url: 'https://example.org/report.pdf' },
    ]);
  });

  test('gzipped JS total counts every script under assets', () => {
    const dist = fixtureDist({ 'assets/a.js': 'a'.repeat(5000), 'assets/b.js': 'b'.repeat(5000), 'assets/c.css': 'c'.repeat(5000) });
    const total = gzippedJsBytes(dist);
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThan(200);
  });
});
