import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Qty } from '../src/ui/Qty.js';
import { untaggedNumbers } from './helpers/untagged.js';

afterEach(cleanup);

describe('Qty', () => {
  it('Qty renders value and tag together', () => {
    const { container } = render(<Qty value={1.4} kind="days" computed />);
    const quantity = container.querySelector('[data-quantity]');
    expect(quantity?.textContent).toBe('1.4 dayscomputed');
    expect(screen.getByLabelText('computed value').textContent).toBe('computed');
  });

  it('an overridden value shows only changed-by-you, never its register kind', () => {
    render(
      <Qty value={120} kind="usdPerT" provenance={{ kind: 'sourced', source: 'pink-sheet' }} overridden original={97.7} sources={{ 'pink-sheet': 'World Bank Pink Sheet' }} />,
    );
    expect(screen.getByText('changed by you')).toBeTruthy();
    expect(screen.queryByText('sourced')).toBeNull();
    expect(screen.queryByLabelText('sourced value')).toBeNull();
  });

  it("changed-by-you's tooltip names the register value, its kind and its source", () => {
    render(
      <Qty value={120} kind="usdPerT" provenance={{ kind: 'sourced', source: 'pink-sheet' }} overridden original={97.7} sources={{ 'pink-sheet': 'World Bank Pink Sheet' }} />,
    );
    const tag = screen.getByText('changed by you');
    const tip = screen.getByRole('tooltip', { hidden: true });
    expect(tip.textContent).toBe('Register value: US$97.7/t (sourced, World Bank Pink Sheet)');
    expect(tag.getAttribute('aria-describedby')).toBe(tip.id);
    expect(tip.hidden).toBe(true);
    fireEvent.focus(tag);
    expect(tip.hidden).toBe(false);
    fireEvent.blur(tag);
    expect(tip.hidden).toBe(true);
  });

  it("an overridden assumed value's tooltip names its kind alone", () => {
    render(<Qty value={0.6} kind="fraction" provenance={{ kind: 'assumed', reasoning: 'r' }} overridden original={0.5} />);
    expect(screen.getByRole('tooltip', { hidden: true }).textContent).toBe('Register value: 50% (assumed)');
  });

  it('has no changed-by-you tag unless overridden', () => {
    render(<Qty value={0.6} kind="fraction" provenance={{ kind: 'assumed', reasoning: 'r' }} />);
    expect(screen.queryByText('changed by you')).toBeNull();
    expect(screen.getByText('assumed')).toBeTruthy();
  });

  it('a sourced value whose source has no title shows the source id', () => {
    render(<Qty value={97.7} kind="usdPerT" provenance={{ kind: 'sourced', source: 'pink-sheet' }} sources={{}} />);
    expect(screen.getByRole('tooltip', { hidden: true }).textContent).toBe('pink-sheet');
    render(<Qty value={120} kind="usdPerT" provenance={{ kind: 'sourced', source: 'pink-sheet' }} overridden original={97.7} />);
    expect(screen.getAllByRole('tooltip', { hidden: true })[1]!.textContent).toBe('Register value: US$97.7/t (sourced, pink-sheet)');
  });

  it('an assumed tag is a button whose popover gives the reasoning: click toggles it, Escape closes it', () => {
    render(<Qty value={25} kind="mtpa" provenance={{ kind: 'assumed', reasoning: 'A mid-size mine.' }} />);
    const tag = screen.getByRole('button', { name: 'assumed value' });
    const tip = screen.getByRole('tooltip', { hidden: true });
    expect(tip.textContent).toBe('A mid-size mine.');
    expect(tag.getAttribute('title')).toBeNull();
    expect(tag.getAttribute('aria-describedby')).toBe(tip.id);
    expect(tag.getAttribute('aria-expanded')).toBe('false');
    expect(tip.hidden).toBe(true);
    // A tap or a click opens it and a second one closes it, so touch reaches the reasoning.
    fireEvent.click(tag);
    expect(tip.hidden).toBe(false);
    expect(tag.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(tag);
    expect(tip.hidden).toBe(true);
    // Keyboard: focus opens it, Escape dismisses it while focus stays.
    fireEvent.focus(tag);
    expect(tip.hidden).toBe(false);
    fireEvent.keyDown(tag, { key: 'Escape' });
    expect(tip.hidden).toBe(true);
    fireEvent.blur(tag);
    fireEvent.focus(tag);
    expect(tip.hidden).toBe(false);
  });

  it('the first press on a focused tag closes its popover, and the next opens it', () => {
    render(<Qty value={25} kind="mtpa" provenance={{ kind: 'assumed', reasoning: 'A mid-size mine (D-088).' }} />);
    const tag = screen.getByRole('button', { name: 'assumed value' });
    const tip = screen.getByRole('tooltip', { hidden: true });
    fireEvent.focus(tag);
    expect(tag.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(tag);
    expect(tip.hidden).toBe(true);
    expect(tag.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(tag);
    expect(tip.hidden).toBe(false);
    // With the pointer over it too, the first click closes it.
    fireEvent.pointerEnter(tag, { pointerType: 'mouse' });
    fireEvent.click(tag);
    expect(tip.hidden).toBe(true);
  });

  it('a tap opens the popover and a second tap closes it', () => {
    render(<Qty value={25} kind="mtpa" provenance={{ kind: 'assumed', reasoning: 'A mid-size mine (D-088).' }} />);
    const tag = screen.getByRole('button', { name: 'assumed value' });
    const tip = screen.getByRole('tooltip', { hidden: true });
    // A tap emulates hover and focus before its click.
    const tap = () => {
      fireEvent.pointerDown(tag, { pointerType: 'touch' });
      fireEvent.pointerEnter(tag, { pointerType: 'mouse' });
      fireEvent.focus(tag);
      fireEvent.click(tag);
    };
    tap();
    expect(tip.hidden).toBe(false);
    tap();
    expect(tip.hidden).toBe(true);
  });

  it('only one popover is open at a time', () => {
    render(
      <>
        <Qty value={25} kind="mtpa" provenance={{ kind: 'assumed', reasoning: 'A (D-001).' }} />
        <Qty value={97.7} kind="usdPerT" provenance={{ kind: 'sourced', source: 's' }} sources={{ s: 'S' }} />
      </>,
    );
    const [a, b] = screen.getAllByRole('button');
    const [tipA, tipB] = screen.getAllByRole('tooltip', { hidden: true });
    fireEvent.click(a!);
    expect(tipA!.hidden).toBe(false);
    fireEvent.pointerEnter(b!, { pointerType: 'mouse' });
    expect(tipB!.hidden).toBe(false);
    expect(tipA!.hidden).toBe(true);
  });

  it('in a popover, the reasoning is marked as such and a source title is a citation', () => {
    render(
      <>
        <Qty value={25} kind="mtpa" provenance={{ kind: 'assumed', reasoning: 'One 12-hour shift (D-045).' }} />
        <Qty value={97.7} kind="usdPerT" provenance={{ kind: 'sourced', source: 's' }} sources={{ s: 'Pink Sheet, October 2026' }} />
      </>,
    );
    const [tipA, tipB] = screen.getAllByRole('tooltip', { hidden: true });
    expect(tipA!.querySelector('[data-reasoning]')?.textContent).toBe('One 12-hour shift (D-045).');
    expect(tipB!.querySelector('cite')?.textContent).toBe('Pink Sheet, October 2026');
  });

  it('a sourced tag is hoverable: moving from the tag onto its tooltip keeps it open; Escape anywhere closes it', () => {
    render(<Qty value={97.7} kind="usdPerT" provenance={{ kind: 'sourced', source: 'pink-sheet' }} sources={{ 'pink-sheet': 'World Bank Pink Sheet' }} />);
    const tag = screen.getByRole('button', { name: 'sourced value' });
    const tip = screen.getByRole('tooltip', { hidden: true });
    fireEvent.pointerEnter(tag, { pointerType: 'mouse' });
    expect(tip.hidden).toBe(false);
    fireEvent.pointerOut(tag, { pointerType: 'mouse', relatedTarget: tip });
    fireEvent.pointerOver(tip, { pointerType: 'mouse', relatedTarget: tag });
    expect(tip.hidden).toBe(false);
    // Dismissable without moving the pointer (WCAG 1.4.13): Escape works wherever focus is.
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(tip.hidden).toBe(true);
    fireEvent.pointerLeave(tip, { pointerType: 'mouse' });
    fireEvent.pointerEnter(tag, { pointerType: 'mouse' });
    expect(tip.hidden).toBe(false);
  });

  it('computed and measured tags are plain text, not buttons', () => {
    render(
      <>
        <Qty value={1} kind="hours" computed />
        <Qty value={1} kind="hours" provenance={{ kind: 'measured', runId: 'r1', date: '2026-01-01', evidence: 'e' }} />
      </>,
    );
    expect(screen.queryAllByRole('button')).toEqual([]);
  });

  it('each display kind gets its own tag class', () => {
    const { container } = render(
      <>
        <Qty value={1} kind="hours" computed />
        <Qty value={1} kind="hours" provenance={{ kind: 'assumed', reasoning: 'r' }} />
        <Qty value={1} kind="hours" provenance={{ kind: 'sourced', source: 's' }} sources={{ s: 'S' }} />
        <Qty value={1} kind="hours" provenance={{ kind: 'measured', runId: 'r1', date: '2026-01-01', evidence: 'e' }} />
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

  it('exempts a cited title inside <cite>, but not digits beside it', () => {
    const root = document.createElement('div');
    root.innerHTML = `<p><cite>Waterfall Security, 2025 OT Cyber Threat Report</cite></p><p>Read 3 times</p>`;
    expect(untaggedNumbers(root)).toEqual(['Read 3 times']);
  });

  it('also scans aria-label, title and aria-valuetext, and the value of a read-only field', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <button aria-label="Cut for 3 days">Cut</button>
      <span title="Holds 24 hours">holds</span>
      <input readonly value="12 t" />
      <input value="40" />
      <textarea readonly>7 trucks</textarea>
      <span data-quantity><span aria-label="5 days assumed" title="2 sources">5 days</span></span>
      <p data-clock aria-label="Day 3 of 16">Day 3</p>
      <span><button>assumed</button><span role="tooltip"><span data-reasoning>Held for 24 h (D-007)</span><span> since 2 am</span></span></span>
      <div role="slider" aria-valuetext="Day 4, hour 2"></div>
      <div data-clock><div role="slider" aria-valuetext="Day 5, hour 0"></div></div>
      <button aria-label="Pause">x</button>`;
    // Only the cited reasoning itself is exempt (R-u); text beside it in a popover is still scanned.
    expect(untaggedNumbers(root)).toEqual(['7 trucks', 'since 2 am', 'Cut for 3 days', 'Holds 24 hours', '12 t', 'Day 4, hour 2']);
  });

  it('exempts message text inside data-message (R7), but not digits beside it', () => {
    const root = document.createElement('div');
    root.innerHTML = `<p data-message role="alert">Price: must be at least 0</p><p>Cut for 3 days</p>`;
    expect(untaggedNumbers(root)).toEqual(['Cut for 3 days']);
  });

  it('finds nothing untagged in a rendered Qty', () => {
    const { container } = render(
      <Qty value={12400} kind="tonnes" provenance={{ kind: 'assumed', reasoning: 'r' }} overridden original={10000} />,
    );
    expect(untaggedNumbers(container)).toEqual([]);
  });
});
