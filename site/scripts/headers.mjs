/**
 * Parses a Cloudflare Pages `_headers` file: an unindented line names a path pattern,
 * and each indented `Name: value` line under it adds a header for that path. `#` starts a comment.
 * @param {string} text
 * @returns {Record<string, Record<string, string>>}
 */
export function parseHeaders(text) {
  /** @type {Record<string, Record<string, string>>} */
  const rules = {};
  /** @type {Record<string, string> | undefined} */
  let current;
  for (const line of text.split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      current = rules[line.trim()] = {};
      continue;
    }
    const colon = line.indexOf(':');
    if (!current || colon < 0) throw new Error(`_headers: cannot read "${line.trim()}"`);
    current[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
  }
  return rules;
}
