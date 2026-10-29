// @vitest-environment node
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { gzipSync } from 'node:zlib';
import {
  JS_BUDGET_BYTES,
  YAML_PARSER_SIGNATURE,
  allowedUrls,
  checkIndexHtml,
  checkJsBudget,
  checkNoYamlParser,
  findDisallowedUrls,
  gzippedJsBytes,
  isAllowedUrl,
} from '../scripts/check-build.mjs';
import { parseHeaders, vercelHeaderProblems } from '../scripts/headers.mjs';

const HEADERS_FILE = new URL('../public/_headers', import.meta.url);
const VERCEL_JSON = new URL('../vercel.json', import.meta.url);
const INDEX_HTML = new URL('../index.html', import.meta.url);
const OG_PNG = new URL('../public/og.png', import.meta.url);

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

test('headers file carries the exact security headers', () => {
  const headers = parseHeaders(readFileSync(HEADERS_FILE, 'utf8'));
  expect(headers).toEqual({
    '/*': {
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Resource-Policy': 'same-origin',
    },
    '/assets/*': { 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
});

test('vercel.json carries exactly the _headers rules', () => {
  const rules = parseHeaders(readFileSync(HEADERS_FILE, 'utf8'));
  const vercel = JSON.parse(readFileSync(VERCEL_JSON, 'utf8'));
  expect(vercelHeaderProblems(rules, vercel)).toEqual([]);
  // Every rule, header for header, in Vercel's own shape: `*` in a `_headers` path is `(.*)` in a source.
  expect(vercel.headers).toEqual(
    Object.entries(rules).map(([path, headers]) => ({
      source: path.replaceAll('*', '(.*)'),
      headers: Object.entries(headers).map(([key, value]) => ({ key, value })),
    })),
  );
});

describe('vercelHeaderProblems', () => {
  const rules = { '/*': { A: '1', B: '2' }, '/assets/*': { C: '3' } };
  const rule = (source: string, headers: Record<string, string>) => ({
    source,
    headers: Object.entries(headers).map(([key, value]) => ({ key, value })),
  });
  const matching = { headers: [rule('/(.*)', { A: '1', B: '2' }), rule('/assets/(.*)', { C: '3' })] };

  test('a matching config has no problems', () => {
    expect(vercelHeaderProblems(rules, matching)).toEqual([]);
  });

  test('a changed, missing or extra header is a problem', () => {
    expect(vercelHeaderProblems(rules, { headers: [rule('/(.*)', { A: '9', B: '2' }), matching.headers[1]] })).toEqual([
      'vercel.json /(.*) sends A: 9, but _headers /* sends A: 1',
    ]);
    expect(vercelHeaderProblems(rules, { headers: [rule('/(.*)', { A: '1' }), matching.headers[1]] })).toEqual([
      'vercel.json /(.*) is missing B: 2 from _headers /*',
    ]);
    expect(vercelHeaderProblems(rules, { headers: [rule('/(.*)', { A: '1', B: '2', D: '4' }), matching.headers[1]] })).toEqual([
      'vercel.json /(.*) sends D, which _headers /* does not',
    ]);
  });

  test('a missing, extra or reordered rule is a problem', () => {
    expect(vercelHeaderProblems(rules, { headers: [matching.headers[0]] })).toEqual([
      'vercel.json header sources are ["/(.*)"], but _headers needs ["/(.*)","/assets/(.*)"]',
    ]);
    expect(vercelHeaderProblems(rules, { headers: [matching.headers[1], matching.headers[0]] })).toEqual([
      'vercel.json header sources are ["/assets/(.*)","/(.*)"], but _headers needs ["/(.*)","/assets/(.*)"]',
    ]);
    expect(vercelHeaderProblems(rules, {})).toEqual(['vercel.json has no headers list']);
  });

  test('a duplicate key or a condition on a rule is a problem', () => {
    const dup = { source: '/(.*)', headers: [{ key: 'A', value: '1' }, { key: 'A', value: '1' }, { key: 'B', value: '2' }] };
    expect(vercelHeaderProblems(rules, { headers: [dup, matching.headers[1]] })).toEqual(['vercel.json /(.*) sends A twice']);
    const conditional = { ...matching.headers[0], has: [{ type: 'query', key: 'x' }] };
    expect(vercelHeaderProblems(rules, { headers: [conditional, matching.headers[1]] })).toEqual([
      'vercel.json /(.*) has a condition (has), which _headers cannot express',
    ]);
  });
});

describe('index.html', () => {
  test('index.html carries the link-preview tags', () => {
    const html = readFileSync(INDEX_HTML, 'utf8');
    const meta = (attr: 'name' | 'property', key: string) =>
      html.match(new RegExp(`<meta ${attr}="${key}" content="([^"]*)"`))?.[1];
    expect(meta('name', 'description')).toBeTruthy();
    expect(meta('property', 'og:type')).toBe('website');
    expect(meta('property', 'og:title')).toBeTruthy();
    expect(meta('property', 'og:description')).toBeTruthy();
    expect(meta('property', 'og:url')).toBe('%VITE_SITE_ORIGIN%/');
    expect(meta('property', 'og:image')).toBe('%VITE_SITE_ORIGIN%/og.png');
    expect(meta('property', 'og:image:width')).toBe('1200');
    expect(meta('property', 'og:image:height')).toBe('630');
    expect(meta('property', 'og:image:alt')).toBeTruthy();
    expect(meta('name', 'twitter:card')).toBe('summary_large_image');
    expect(html).toMatch(/<link rel="icon" href="\/favicon\.svg" type="image\/svg\+xml"\s*\/?>/);
    expect(meta('name', 'theme-color')).toBeTruthy();
  });

  test('og.png is 1200 × 630 and under 400 KB', () => {
    const png = readFileSync(OG_PNG);
    expect(png.subarray(1, 4).toString('ascii')).toBe('PNG');
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
    expect(png.length).toBeLessThan(400_000);
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

  test('the site origin\'s preview URLs are allowed only when an origin is given', () => {
    const withOrigin = allowedUrls(REGISTER, 'https://x.example');
    expect(withOrigin.has('https://x.example/og.png')).toBe(true);
    expect(withOrigin.has('https://x.example/')).toBe(true);
    const without = allowedUrls(REGISTER);
    expect(without.has('https://x.example/og.png')).toBe(false);
    expect([...without].some((u) => u.startsWith('https://x.example'))).toBe(false);
  });

  test('zod 4 JSON Schema dialect URIs are allowed exactly, near misses are not', () => {
    const allowed = allowedUrls(REGISTER);
    for (const url of [
      'https://json-schema.org/draft/2020-12/schema',
      'http://json-schema.org/draft-07/schema#',
      'http://json-schema.org/draft-04/schema#',
    ]) {
      expect(isAllowedUrl(url, allowed)).toBe(true);
    }
    expect(isAllowedUrl('https://json-schema.org/draft/2020-12/schema/../x', allowed)).toBe(false);
  });

  test('only a bare template-literal host like http://[${e}] is allowed as a pattern', () => {
    const allowed = allowedUrls(REGISTER);
    expect(isAllowedUrl('http://[${e}]', allowed)).toBe(true);
    expect(isAllowedUrl('http://[${abc}]', allowed)).toBe(true);
    for (const url of ['http://[::1]', 'http://[${e}]/x', 'https://evil.example/[${e}]']) {
      expect(isAllowedUrl(url, allowed)).toBe(false);
    }
    const dist = fixtureDist({
      'assets/index.js': 'const a = `http://[${e}]`; const b = "http://[::1]"; const c = `http://[${e}]/x`;',
    });
    expect(findDisallowedUrls(dist, allowed)).toEqual([
      { file: 'assets/index.js', url: 'http://[::1]' },
      { file: 'assets/index.js', url: 'http://[${e}]/x' },
    ]);
  });

  test('gzipped JS total counts every .js file in dist and nothing else', () => {
    const files = { 'top.js': 'let t = 1;\n'.repeat(300), 'assets/a.js': 'a'.repeat(5000), 'assets/deep/b.js': 'const b = [1, 2, 3];'.repeat(80) };
    const dist = fixtureDist({ ...files, 'assets/c.css': 'body { margin: 0 }'.repeat(400), 'index.html': '<p>x</p>'.repeat(300) });
    const expected = Object.values(files).reduce((sum, text) => sum + gzipSync(text).length, 0);
    expect(gzippedJsBytes(dist)).toBe(expected);
  });

  test('check-build fails a build over the gzipped JS budget', () => {
    const dist = fixtureDist({ 'assets/index.js': 'x'.repeat(5000) });
    const size = gzippedJsBytes(dist);
    expect(checkJsBudget(dist, size)).toEqual([]);
    expect(checkJsBudget(dist, size - 1)).toEqual([`gzipped JS is ${size} bytes, over the ${size - 1} byte budget`]);
    expect(JS_BUDGET_BYTES).toBe(450_000); // D-104
  });

  // The signature is the string literal 'YAMLParseError', which the yaml package passes to its error
  // base class as the error's name, so no minifier can rename it.
  test('site bundle has no yaml parser', () => {
    expect(YAML_PARSER_SIGNATURE).toBe('YAMLParseError');
    const clean = fixtureDist({ 'assets/index.js': 'const r = JSON.parse("{}");', 'index.html': '<p>YAMLParseError</p>' });
    expect(checkNoYamlParser(clean)).toEqual([]);
    const leaky = fixtureDist({
      'assets/index.js': 'class n extends t{constructor(e,r,i){super("YAMLParseError",e,r,i)}}',
      'assets/vendor.js': 'const ok = 1;',
    });
    expect(checkNoYamlParser(leaky)).toEqual(['dist/assets/index.js bundles the yaml parser (contains "YAMLParseError")']);
  });
});
