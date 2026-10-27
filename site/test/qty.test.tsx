import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Qty } from '../src/ui/Qty.js';
import { untaggedNumbers } from './helpers/untagged.js';

afterEach(cleanup);

describe('Qty', () => {
  it('Qty renders value and tag together', () => {
    const { container } = render(<Qty value={1.4} kind="days" display="computed" />);
    const quantity = container.querySelector('[data-quantity]');
    expect(quantity?.textContent).toBe('1.4 dayscomputed');
    expect(screen.getByLabelText('computed value').textContent).toBe('computed');
  });

  it('overridden adds changed-by-you', () => {
    render(<Qty value={0.6} kind="fraction" display="assumed" overridden />);
    expect(screen.getByText('assumed')).toBeTruthy();
    expect(screen.getByText('changed by you')).toBeTruthy();
  });

  it('has no changed-by-you tag unless overridden', () => {
    render(<Qty value={0.6} kind="fraction" display="assumed" />);
    expect(screen.queryByText('changed by you')).toBeNull();
  });

  it('an assumed tag carries the reasoning as its title', () => {
    render(
      <Qty value={25} kind="mtpa" display="assumed" provenance={{ kind: 'assumed', reasoning: 'A mid-size mine.' }} />,
    );
    expect(screen.getByLabelText('assumed value').getAttribute('title')).toBe('A mid-size mine.');
  });

  it('a sourced tag shows the source title on hover and on focus', () => {
    render(
      <Qty
        value={97.7}
        kind="usdPerT"
        display="sourced"
        provenance={{ kind: 'sourced', source: 'pink-sheet' }}
        sources={{ 'pink-sheet': 'World Bank Pink Sheet' }}
      />,
    );
    const tag = screen.getByLabelText('sourced value');
    const tip = screen.getByRole('tooltip', { hidden: true });
    expect(tip.textContent).toBe('World Bank Pink Sheet');
    expect(tag.getAttribute('aria-describedby')).toBe(tip.id);
    expect(tip.hidden).toBe(true);
    fireEvent.mouseEnter(tag);
    expect(tip.hidden).toBe(false);
    fireEvent.mouseLeave(tag);
    expect(tip.hidden).toBe(true);
    fireEvent.focus(tag);
    expect(tip.hidden).toBe(false);
    fireEvent.blur(tag);
    expect(tip.hidden).toBe(true);
  });

  it('each display kind gets its own tag class', () => {
    const { container } = render(
      <>
        {(['computed', 'assumed', 'sourced', 'measured'] as const).map((d) => (
          <Qty key={d} value={1} kind="hours" display={d} />
        ))}
      </>,
    );
    for (const d of ['computed', 'assumed', 'sourced', 'measured']) {
      expect(container.querySelector(`.qty-tag--${d}`)?.textContent).toBe(d);
    }
  });
});

describe('untaggedNumbers', () => {
  it('untaggedNumbers finds a bare "4 days" but not one inside data-quantity or data-clock', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <p>Stock lasts 4 days</p>
      <p><span data-quantity>5 days<span>assumed</span></span></p>
      <p data-clock><span>Day 3</span></p>
      <p>No digits here</p>
      <svg aria-hidden="true" data-decorative><text>793</text></svg>
      <span aria-hidden="true">7 trucks</span>
      <style>.a { width: 2px; }</style>
      <script>const n = 9;</script>`;
    expect(untaggedNumbers(root)).toEqual(['Stock lasts 4 days', '7 trucks']);
  });

  it('exempts a calendar date inside <time> (R6), but not digits beside it', () => {
    const root = document.createElement('div');
    root.innerHTML = `<p><time datetime="2026-05">May 2026</time>: the ERP goes down.</p><p>Back after 12 days</p>`;
    expect(untaggedNumbers(root)).toEqual(['Back after 12 days']);
  });

  it('exempts message text inside data-message (R7), but not digits beside it', () => {
    const root = document.createElement('div');
    root.innerHTML = `<p data-message role="alert">Price: must be at least 0</p><p>Cut for 3 days</p>`;
    expect(untaggedNumbers(root)).toEqual(['Cut for 3 days']);
  });

  it('finds nothing untagged in a rendered Qty', () => {
    const { container } = render(<Qty value={12400} kind="tonnes" display="computed" overridden />);
    expect(untaggedNumbers(container)).toEqual([]);
  });
});
