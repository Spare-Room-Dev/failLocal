import { useState } from 'react';

/** `text` as a number, or NaN when it is blank or does not parse. */
export function parseDraft(text: string): number {
  return text.trim() === '' ? NaN : Number(text);
}

/**
 * The text of a number field. It keeps what the visitor types, even when that is blank or not yet a
 * number, and follows `value` when it changes from outside to something the text does not already
 * say, unless the text is blank or unparseable: that is the visitor mid-edit (dropping a refused value
 * changes `value` under a blanked field), and refilling it would splice their next keystroke onto the
 * old number. The field is not remounted while the visitor types, so it keeps focus; the editor
 * remounts it only on a reset, which drops any draft text, even one that never parsed.
 */
export function useDraft(value: number): [string, (text: string) => void] {
  const [draft, setDraft] = useState(String(value));
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    const typed = parseDraft(draft);
    if (Number.isFinite(typed) && typed !== value) setDraft(String(value));
  }
  return [draft, setDraft];
}
