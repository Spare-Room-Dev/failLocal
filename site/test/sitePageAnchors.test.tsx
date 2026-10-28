import { cleanup, render } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { cableFraction, SERVICE_GROUPS } from '../src/model/serviceGroups.js';
import { appStore, initialAppState } from '../src/model/store.js';
import type { SceneViewProps } from '../src/ui/SceneView.js';

// A stub scene that reports one anchor, so the test sees SitePage place the card from it.
vi.mock('../src/ui/SceneView.js', () => ({
  SceneView: ({ onAnchors }: SceneViewProps) => {
    useEffect(() => onAnchors?.({ 'hosted-erp': 0.9 }), [onAnchors]);
    return <div className="scene" />;
  },
}));

const { SitePage } = await import('../src/ui/pages/SitePage.js');

beforeEach(() => {
  appStore.set(initialAppState());
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {} }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test('SitePage places each card at the anchor its scene reports, evenly spaced until then', () => {
  const { container } = render(<SitePage />);
  const slot = (id: string) =>
    container.querySelector(`[data-service-group="${id}"]`)!.closest<HTMLElement>('.site-card-slot')!.style.getPropertyValue('--cable');
  expect(slot('hosted-erp')).toBe('0.9');
  SERVICE_GROUPS.slice(1).forEach((g, i) => expect(slot(g.id)).toBe(String(cableFraction(i + 1))));
});
