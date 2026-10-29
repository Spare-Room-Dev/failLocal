/**
 * Parses `site/public/_headers`, the site's one list of response headers (D-113, D-116). `vite preview`
 * and the e2e suite serve it, and `site/vercel.json` mirrors it for the deployed site. An unindented
 * line names a path pattern, and each indented `Name: value` line under it adds a header for that path.
 * `#` starts a comment.
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

/**
 * The Vercel `source` for a `_headers` path: `*` (any run of characters) becomes `(.*)`, so `/*` is `/(.*)`
 * and `/assets/*` is `/assets/(.*)`, which matches every file under `/assets/`.
 * @param {string} path
 * @returns {string}
 */
export function vercelSource(path) {
  return path.replaceAll('*', '(.*)');
}

/**
 * The ways `vercel` (a parsed `vercel.json`) fails to carry exactly the `_headers` `rules`: its header rules
 * must have the same sources in the same order, no conditions, and for each rule the same headers, key for
 * key and value for value, each once. An empty list means the two match (D-116).
 * @param {Record<string, Record<string, string>>} rules
 * @param {{ headers?: unknown }} vercel
 * @returns {string[]}
 */
export function vercelHeaderProblems(rules, vercel) {
  const list = vercel?.headers;
  if (!Array.isArray(list)) return ['vercel.json has no headers list'];
  const want = Object.keys(rules).map(vercelSource);
  const have = list.map((r) => r?.source);
  if (JSON.stringify(have) !== JSON.stringify(want)) {
    return [`vercel.json header sources are ${JSON.stringify(have)}, but _headers needs ${JSON.stringify(want)}`];
  }
  /** @type {string[]} */
  const problems = [];
  Object.entries(rules).forEach(([path, expected], i) => {
    const rule = list[i];
    const source = rule.source;
    const extraFields = Object.keys(rule).filter((k) => k !== 'source' && k !== 'headers');
    if (extraFields.length) problems.push(`vercel.json ${source} has a condition (${extraFields.join(', ')}), which _headers cannot express`);
    /** @type {Record<string, string>} */
    const sent = {};
    for (const { key, value } of Array.isArray(rule.headers) ? rule.headers : []) {
      if (key in sent) problems.push(`vercel.json ${source} sends ${key} twice`);
      sent[key] = value;
    }
    for (const [key, value] of Object.entries(expected)) {
      if (!(key in sent)) problems.push(`vercel.json ${source} is missing ${key}: ${value} from _headers ${path}`);
      else if (sent[key] !== value) problems.push(`vercel.json ${source} sends ${key}: ${sent[key]}, but _headers ${path} sends ${key}: ${value}`);
    }
    for (const key of Object.keys(sent)) {
      if (!(key in expected)) problems.push(`vercel.json ${source} sends ${key}, which _headers ${path} does not`);
    }
  });
  return problems;
}
