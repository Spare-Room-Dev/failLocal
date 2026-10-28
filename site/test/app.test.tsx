import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../src/App.js';

// A supporting page: the welcome page carries no badge (finish B5).
beforeEach(() => {
  window.location.hash = '#/sources';
});
afterEach(() => {
  cleanup();
  window.location.hash = '#/';
});

describe('App', () => {
  it('app renders the fictional badge from the register', () => {
    render(<App register={{ site: { fictional: true } }} />);
    expect(screen.getByText('Fictional model site')).toBeTruthy();
  });

  it('reads the badge from the real register by default', () => {
    render(<App />);
    expect(screen.getByText('Fictional model site')).toBeTruthy();
  });

  it('omits the fictional badge when the register says the site is real', () => {
    render(<App register={{ site: { fictional: false } }} />);
    expect(screen.queryByText('Fictional model site')).toBeNull();
  });

  it('the welcome page has the brand lockup and no badge; its copy says the site is fictional', () => {
    window.location.hash = '#/';
    const { container } = render(<App />);
    expect(screen.queryByText('Fictional model site')).toBeNull();
    expect(container.querySelector('.welcome-top .brand-word')!.textContent).toBe('FailLocal');
    expect(screen.getByText(/This is a fictional model iron ore site\./)).toBeTruthy();
    expect(screen.getByText('The plants were fine. Purchasing, maintenance and payroll were not.').tagName).toBe('STRONG');
    const primary = screen.getByRole('button', { name: 'Show me the site' });
    expect(primary.querySelector('svg.button-arrow')!.getAttribute('aria-hidden')).toBe('true');
    expect(screen.queryByRole('button', { name: /walkthrough/i })).toBeNull();
  });
});
