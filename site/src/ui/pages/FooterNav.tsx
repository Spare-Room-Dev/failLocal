import { ROUTES } from '../../routes.js';
import type { Route } from '../../routes.js';

/** The small footer on every page: a link to each page, the current one marked. */
export function FooterNav({ current }: { current: Route }) {
  return (
    <footer className="page-footer">
      <nav aria-label="Pages">
        <ul>
          {ROUTES.map((r) => (
            <li key={r.route}>
              <a href={r.hash} aria-current={r.route === current ? 'page' : undefined}>
                {r.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </footer>
  );
}
