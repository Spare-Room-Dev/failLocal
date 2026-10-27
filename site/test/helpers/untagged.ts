/** Quantities, clock values, calendar dates in `<time>` (R6), and non-text content. */
const EXEMPT = '[data-quantity], [data-clock], time, script, style, [aria-hidden="true"][data-decorative]';

/** Digit-containing text runs under `root` that no `<Qty>` or clock owns: each is an untagged number. */
export function untaggedNumbers(root: HTMLElement): string[] {
  const found: string[] = [];
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent?.trim() ?? '';
    if (!/\d/.test(text)) continue;
    if (node.parentElement?.closest(EXEMPT)) continue;
    found.push(text);
  }
  return found;
}
