import { useSyncExternalStore } from 'react';

export type Route = 'welcome' | 'site' | 'sources' | 'tested' | 'built' | 'limits';

/** Every page, in footer order, with its hash and its footer label. */
export const ROUTES: { route: Route; hash: string; label: string }[] = [
  { route: 'welcome', hash: '#/', label: 'Welcome' },
  { route: 'site', hash: '#/site', label: 'The site' },
  { route: 'sources', hash: '#/sources', label: 'Sources' },
  { route: 'tested', hash: '#/tested', label: 'How this was tested' },
  { route: 'built', hash: '#/built', label: 'How I built this' },
  { route: 'limits', hash: '#/limits', label: 'Limitations' },
];

/** The page a hash names. An empty, bare or unknown hash is the welcome page. */
export function routeOf(hash: string): Route {
  return ROUTES.find((r) => r.hash === hash)?.route ?? 'welcome';
}

export function hrefOf(route: Route): string {
  return ROUTES.find((r) => r.route === route)!.hash;
}

export function navigate(route: Route): void {
  window.location.hash = hrefOf(route);
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

/** The current page, re-read on every `hashchange`. */
export function useRoute(): Route {
  return useSyncExternalStore(subscribe, () => routeOf(window.location.hash));
}
