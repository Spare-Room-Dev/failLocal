/**
 * Release gate, run after `npm run build` by `npm run release`. Fails while the build still carries a
 * marked placeholder or draft marker, while the link-preview tags are not absolute https:// URLs (the
 * release needs `VITE_SITE_ORIGIN`), while `dist/og.png` is still the placeholder render (D-115), or when
 * `site/vercel.json` is missing or does not carry exactly the rules in `site/public/_headers` (D-116).
 * Unmarked draft labels are approved through the owner's copy checklist, not here.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseHeaders, vercelHeaderProblems } from './headers.mjs';

/** Strings that mark copy the owner has not yet written or approved. None may ship. */
export const RELEASE_BLOCKERS = Object.freeze([
  '[Your name]',
  '[owner]',
  '[Placeholder',
  // The Limitations page's "(placeholder until the repo is public)". Not a bare "placeholder", which
  // React DOM's own code carries as an attribute name.
  'placeholder until',
  'draft-marker',
  'draft-banner',
  'Draft copy',
  'awaiting owner review',
]);

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
 * A problem for each release blocker in each .js or .html file under `distDir`. Stylesheets are not
 * scanned: a class name such as `.draft-marker` left in CSS shows nothing on its own.
 * @param {string} distDir
 * @returns {string[]}
 */
export function checkNoBlockers(distDir) {
  const problems = [];
  for (const file of listFiles(distDir).filter((f) => f.endsWith('.js') || f.endsWith('.html'))) {
    const text = readFileSync(join(distDir, file), 'utf8');
    for (const blocker of RELEASE_BLOCKERS) {
      if (text.includes(blocker)) problems.push(`dist/${file} contains "${blocker}"`);
    }
  }
  return problems;
}

/**
 * The `content` of the `<meta property="…">` tag in `html`, or undefined when there is none.
 * @param {string} html
 * @param {string} property
 * @returns {string | undefined}
 */
function metaProperty(html, property) {
  return html.match(new RegExp(`<meta\\s+property="${property}"\\s+content="([^"]*)"`))?.[1];
}

/**
 * The problems with the built index.html's link-preview tags: `og:url` and `og:image` must be absolute
 * https:// URLs without a doubled slash (which a trailing slash on `VITE_SITE_ORIGIN` produces), and no
 * `%VITE_` placeholder may remain anywhere in the page.
 * @param {string} html
 * @returns {string[]}
 */
export function checkPreviewTags(html) {
  const problems = [];
  for (const property of ['og:url', 'og:image']) {
    const value = metaProperty(html, property);
    if (value === undefined) {
      problems.push(`dist/index.html has no ${property} tag`);
    } else if (!/^https:\/\/[^/\s]+\//.test(value)) {
      problems.push(`dist/index.html ${property} is not an absolute https:// URL: ${value}`);
    } else if (value.slice('https://'.length).includes('//')) {
      problems.push(`dist/index.html ${property} has a doubled slash: ${value}`);
    }
  }
  if (html.includes('%VITE_')) problems.push('dist/index.html still contains %VITE_ (a build variable was not set)');
  return problems;
}

/**
 * The problems with the Vercel config at `vercelPath`: it must exist, parse, and carry exactly the rules
 * in the `_headers` file at `headersPath`. Without it, Vercel serves the site with no Content-Security-Policy
 * or other security headers (D-116).
 * @param {string} vercelPath
 * @param {string} headersPath
 * @returns {string[]}
 */
export function checkVercelConfig(vercelPath, headersPath) {
  if (!existsSync(vercelPath)) return ['vercel.json is missing, so Vercel would serve the site with no security headers'];
  let vercel;
  try {
    vercel = JSON.parse(readFileSync(vercelPath, 'utf8'));
  } catch (e) {
    return [`vercel.json is not valid JSON: ${e instanceof Error ? e.message : e}`];
  }
  return vercelHeaderProblems(parseHeaders(readFileSync(headersPath, 'utf8')), vercel);
}

/**
 * The sha256 of the committed `site/public/og.png`, which is the placeholder render: it shows the byline
 * as "[Your name]". Making the image again after the byline lands (D-114) changes the hash and clears
 * this check.
 */
export const PLACEHOLDER_OG_SHA256 = '7a6720cf9132a95bbdb80ad91b289c15d9c232ce3d7bfaaa4462de531412cbbf';

/**
 * A problem when `distDir/og.png` is missing or is still the placeholder render (its sha256 equals
 * `placeholderSha256`). The gate cannot read the byline in a picture, so it compares bytes instead.
 * @param {string} distDir
 * @param {string} [placeholderSha256]
 * @returns {string[]}
 */
export function checkPreviewImageRegenerated(distDir, placeholderSha256 = PLACEHOLDER_OG_SHA256) {
  const path = join(distDir, 'og.png');
  if (!existsSync(path)) return ['dist/og.png is missing'];
  const hash = createHash('sha256').update(readFileSync(path)).digest('hex');
  return hash === placeholderSha256
    ? ['dist/og.png is still the placeholder render showing "[Your name]"; make it again with `npm run og-image -w site` (D-114)']
    : [];
}

const VERCEL_JSON = new URL('../vercel.json', import.meta.url);
const HEADERS_FILE = new URL('../public/_headers', import.meta.url);

function main() {
  const distDir = fileURLToPath(new URL('../dist/', import.meta.url));
  const problems = [
    ...checkNoBlockers(distDir),
    ...checkPreviewTags(readFileSync(join(distDir, 'index.html'), 'utf8')),
    ...checkPreviewImageRegenerated(distDir),
    ...checkVercelConfig(fileURLToPath(VERCEL_JSON), fileURLToPath(HEADERS_FILE)),
  ];
  if (problems.length) {
    console.error(`release-check: FAILED\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    process.exit(1);
  }
  console.log(
    'release-check: ok — no marked placeholder or draft marker; link-preview URLs are absolute https://; og.png is regenerated; vercel.json carries the _headers rules',
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
