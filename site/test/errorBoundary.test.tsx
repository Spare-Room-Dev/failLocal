import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { App } from '../src/App.js';
import { SiteErrorBoundary } from '../src/ui/SiteErrorBoundary.js';

// The site view, made to throw while it renders.
vi.mock('../src/ui/pages/SitePage.js', () => ({
  SitePage: () => {
    throw new Error('site view broke');
  },
}));

function Throws(): never {
  throw new Error('boom');
}

beforeEach(() => {
  // React logs every caught render error; keep the output clean.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.location.hash = '#/';
});

describe('SiteErrorBoundary', () => {
  test('a throwing child shows the fallback with a link to the welcome page', () => {
    render(
      <SiteErrorBoundary>
        <Throws />
      </SiteErrorBoundary>,
    );
    expect(screen.getByRole('alert').textContent).toContain('Something went wrong showing the model site');
    expect(screen.getByRole('link', { name: /welcome/i }).getAttribute('href')).toBe('#/');
  });

  test('renders its children when nothing throws', () => {
    render(
      <SiteErrorBoundary>
        <p>fine</p>
      </SiteErrorBoundary>,
    );
    expect(screen.getByText('fine')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('the app wraps the site view in it', () => {
    window.location.hash = '#/site';
    render(<App />);
    expect(screen.getByText(/Something went wrong showing the model site/)).toBeTruthy();
  });
});
