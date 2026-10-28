/**
 * Digit-bearing text under `root` that no `<Qty>` or clock owns: each is an untagged number. It scans
 * text, the `aria-label` and `title` attributes (what assistive technology and tooltips say), and the
 * value of a read-only field. Exempt: quantities, clock values, calendar dates in `<time>` (R6), cited
 * titles in `<cite>`, validation and issue messages (R7), a provenance tag's own popover (the
 * reasoning or source title it carries, `[data-provenance]`) and non-text content.
 *
 * Self-contained, with no imports or module constants, so the e2e suite can run this same function
 * in the browser (`locator.evaluate`).
 */
export function untaggedNumbers(root: HTMLElement): string[] {
  const exempt = '[data-quantity], [data-clock], [data-message], [data-provenance], time, cite, script, style, [aria-hidden="true"][data-decorative]';
  const found: string[] = [];
  const doc = root.ownerDocument;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent?.trim() ?? '';
    if (!/\d/.test(text)) continue;
    if (node.parentElement?.closest(exempt)) continue;
    found.push(text);
  }
  const labelled = '[aria-label], [title], input[readonly]';
  for (const el of [...(root.matches(labelled) ? [root] : []), ...root.querySelectorAll(labelled)]) {
    // A read-only input's value is on screen but in no text node. (A textarea's text is its own text node, scanned above.)
    const value = el.tagName === 'INPUT' && (el as HTMLInputElement).readOnly ? (el as HTMLInputElement).value : '';
    const said = [el.getAttribute('aria-label'), el.getAttribute('title'), value].filter((t): t is string => !!t && /\d/.test(t));
    // Digits first: most labels have none, and `closest` is the slow part.
    if (said.length === 0 || el.closest(exempt)) continue;
    found.push(...said.map((t) => t.trim()));
  }
  return found;
}
