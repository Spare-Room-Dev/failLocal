/**
 * Release gate, run after `npm run build` by `npm run release`. Fails while the build still carries
 * placeholder or draft copy, while the link-preview tags are not absolute https:// URLs (the release
 * needs `VITE_SITE_ORIGIN`), or when `dist/_headers` is missing (D-115).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Strings that mark copy the owner has not yet written or approved. None may ship. */
export const RELEASE_BLOCKERS = Object.freeze([
  '[Your name]',
  '[owner]',
  '[Placeholder',
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
 * A problem when `distDir` has no `_headers` file, without which Cloudflare Pages serves the site
 * with no Content-Security-Policy or other security headers.
 * @param {string} distDir
 * @returns {string[]}
 */
export function checkHeadersShipped(distDir) {
  return existsSync(join(distDir, '_headers')) ? [] : ['dist/_headers is missing'];
}

function main() {
  const distDir = fileURLToPath(new URL('../dist/', import.meta.url));
  const problems = [
    ...checkNoBlockers(distDir),
    ...checkPreviewTags(readFileSync(join(distDir, 'index.html'), 'utf8')),
    ...checkHeadersShipped(distDir),
  ];
  if (problems.length) {
    console.error(`release-check: FAILED\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    process.exit(1);
  }
  console.log('release-check: ok — no placeholder or draft copy; link-preview URLs are absolute https://; dist/_headers is present');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
