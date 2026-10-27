import { useState } from 'react';

/** `text` as a number, or NaN when it is blank or does not parse. */
export function parseDraft(text: string): number {
  return text.trim() === '' ? NaN : Number(text);
}

/**
 * The text of a number field. It keeps what the visitor types, even when that is blank or not yet a
 * number, and follows `value` when it changes from outside (a reset) to something the text does not
 * already say. The field is never remounted, so it keeps focus while the visitor types.
 */
export function useDraft(value: number): [string, (text: string) => void] {
  const [draft, setDraft] = useState(String(value));
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    if (parseDraft(draft) !== value) setDraft(String(value));
  }
  return [draft, setDraft];
}
