import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../src/App.js';

afterEach(cleanup);

describe('App', () => {
  it('app renders the fictional badge from the register', () => {
    render(<App register={{ site: { fictional: true } }} />);
    expect(screen.getByText('Fictional model site')).toBeTruthy();
  });

  it('omits the fictional badge when the register says the site is real', () => {
    render(<App register={{ site: { fictional: false } }} />);
    expect(screen.queryByText('Fictional model site')).toBeNull();
  });
});
