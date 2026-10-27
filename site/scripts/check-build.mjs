/**
 * Build guard, run after `vite build`. Fails the build when the output would break the site's
 * Content-Security-Policy (inline script or style in index.html), names a URL outside the
 * allow-list, or ships more gzipped JS than the budget.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { parse } from 'yaml';

/** Gzipped JS budget in bytes (300 KB, decimal, as Vite reports sizes). Plan 2b raises it for PixiJS. */
export const JS_BUDGET_BYTES = 300_000;

/**
 * URLs allowed besides the register's sources. None is ever requested; each is a string
 * that library or page code carries.
 */
export const EXTRA_ALLOWED_URLS = [
  // SVG and XLink namespaces: React DOM and the scene's inline SVG.
  'http://www.w3.org/2000/svg',
  'http://www.w3.org/1999/xlink',
  // XML and MathML namespaces: React DOM's namespace constants.
  'http://www.w3.org/XML/1998/namespace',
  'http://www.w3.org/1998/Math/MathML',
  // React 19's production error-decoder prefix, in thrown error messages.
  'https://react.dev/errors/',
  // Temporary: the Limits page's decision-log link, a placeholder until the repo is public
  // (owner gate 5). Replace this entry with the real URL when the link is filled in.
  'https://github.com/[owner]/faillocal/blob/main/docs/decisions.md',
  // zod 4 JSON Schema dialect identifier, never fetched.
  'https://json-schema.org/draft/2020-12/schema',
  // zod 4 JSON Schema dialect identifier, never fetched.
  'http://json-schema.org/draft-07/schema#',
  // zod 4 JSON Schema dialect identifier, never fetched.
  'http://json-schema.org/draft-04/schema#',
];

/**
 * The one pattern exception: zod 4's IPv6 check builds `http://[${host}]` at runtime; the minifier
 * renames the variable; never a fetchable URL. Every other URL must match the allow-list exactly.
 */
const TEMPLATE_HOST_URL = /^https?:\/\/\[\$\{[A-Za-z_$][\w$]*\}\]$/;

/**
 * Whether `url` is on the allow-list, or is the bare template-literal host artefact above.
 * @param {string} url
 * @param {Set<string>} allowed
 * @returns {boolean}
 */
export function isAllowedUrl(url, allowed) {
  return allowed.has(url) || TEMPLATE_HOST_URL.test(url);
}

const URL_PATTERN = /https?:\/\/[^\s"'`<>\\)]+/g;
const BINARY_EXTENSIONS = new Set(['.woff2', '.woff', '.ttf', '.otf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.ico', '.pdf', '.wasm']);

/**
 * The CSP problems in the built index.html: inline script bodies, inline style blocks, style= attributes.
 * @param {string} html
 * @returns {string[]}
 */
export function checkIndexHtml(html) {
  const problems = [];
  for (const [, body] of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    if (body?.trim()) problems.push('dist/index.html has an inline <script> body');
  }
  for (const [, body] of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    if (body?.trim()) problems.push('dist/index.html has an inline <style> body');
  }
  if (/<[^>]*\sstyle\s*=/i.test(html)) problems.push('dist/index.html has an inline style= attribute');
  return problems;
}

/**
 * The register's `sources[].url` plus the extra allowed URLs.
 * @param {string} registerYaml
 * @returns {Set<string>}
 */
export function allowedUrls(registerYaml) {
  const register = parse(registerYaml);
  /** @type {{ url?: unknown }[]} */
  const sources = Array.isArray(register?.sources) ? register.sources : [];
  const urls = sources.map((s) => s.url).filter((u) => typeof u === 'string');
  return new Set([...urls, ...EXTRA_ALLOWED_URLS]);
}

/**
 * Every file under `dir`, as paths relative to it, sorted.
 * @param {string} dir
 * @returns {string[]}
 */
function listFiles(dir) {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => relative(dir, join(e.parentPath, e.name)).split(sep).join('/'))
    .sort();
}

/**
 * Each http(s) URL in a text file under `distDir` that `isAllowedUrl` rejects.
 * @param {string} distDir
 * @param {Set<string>} allowed
 * @returns {{ file: string, url: string }[]}
 */
export function findDisallowedUrls(distDir, allowed) {
  const found = [];
  for (const file of listFiles(distDir)) {
    if (BINARY_EXTENSIONS.has(extname(file).toLowerCase())) continue;
    for (const [url] of readFileSync(join(distDir, file), 'utf8').matchAll(URL_PATTERN)) {
      if (!isAllowedUrl(url, allowed)) found.push({ file, url });
    }
  }
  return found;
}

/**
 * The summed gzipped size, in bytes, of every .js file under `distDir`.
 * @param {string} distDir
 * @returns {number}
 */
export function gzippedJsBytes(distDir) {
  return listFiles(distDir)
    .filter((f) => f.endsWith('.js'))
    .reduce((total, f) => total + gzipSync(readFileSync(join(distDir, f))).length, 0);
}

/**
 * A problem when the gzipped JS under `distDir` is over `budget` bytes.
 * @param {string} distDir
 * @param {number} [budget]
 * @returns {string[]}
 */
export function checkJsBudget(distDir, budget = JS_BUDGET_BYTES) {
  const js = gzippedJsBytes(distDir);
  return js > budget ? [`gzipped JS is ${js} bytes, over the ${budget} byte budget`] : [];
}

function main() {
  const distDir = fileURLToPath(new URL('../dist/', import.meta.url));
  const registerPath = fileURLToPath(new URL('../../register/pilbara-model-site.yaml', import.meta.url));
  const allowed = allowedUrls(readFileSync(registerPath, 'utf8'));

  const problems = checkIndexHtml(readFileSync(join(distDir, 'index.html'), 'utf8'));
  for (const { file, url } of findDisallowedUrls(distDir, allowed)) problems.push(`dist/${file} names a URL off the allow-list: ${url}`);
  problems.push(...checkJsBudget(distDir));

  const kb = (/** @type {number} */ n) => `${(n / 1000).toFixed(1)} KB`;
  if (problems.length) {
    console.error(`check-build: FAILED\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    process.exit(1);
  }
  console.log(
    `check-build: ok — index.html has no inline script or style; every URL is on the allow-list (${allowed.size} entries); gzipped JS ${kb(gzippedJsBytes(distDir))} of ${kb(JS_BUDGET_BYTES)} (decimal KB, 1 KB = 1,000 bytes)`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
