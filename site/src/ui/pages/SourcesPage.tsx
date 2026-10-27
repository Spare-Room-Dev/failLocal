import { register } from '../../model/register.js';

/** An ISO date as written on the page, e.g. "26 October 2026". */
const longDate = (iso: string): string =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** Every source in the register, with the date it was last read. */
export function SourcesPage() {
  return (
    <article className="page">
      <h1>Sources</h1>
      <p>Every sourced figure on the site names one of these. Each was read on the date shown.</p>
      <ol className="source-list" data-sources>
        {register.sources.map((s) => (
          <li key={s.id}>
            <a href={s.url} rel="noopener noreferrer">
              {s.title}
            </a>
            <span className="source-accessed">
              Accessed <time dateTime={s.accessed}>{longDate(s.accessed)}</time>
            </span>
          </li>
        ))}
      </ol>
    </article>
  );
}
