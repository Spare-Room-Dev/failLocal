const DECISION_LOG = 'https://github.com/[owner]/faillocal/blob/main/docs/decisions.md';

/** What the model does not claim. */
export function LimitsPage() {
  return (
    <article className="page">
      <h1>Limitations</h1>
      <ul>
        <li>This is a fictional site with synthetic data.</li>
        <li>Lab timings are not comparable with timings on a real site.</li>
        <li>
          The dollar figure for the hosted ERP outage rests on an assumed hold: how long the manual workarounds last
          before they run out.
        </li>
        <li>Lead times model delivery delay, not delivery rate; there is no delivery-rate modelling.</li>
      </ul>
      <p>
        Every modelling choice, and why it was made, is in the <a href={DECISION_LOG} rel="noopener noreferrer">decision log</a>{' '}
        <span className="placeholder">(placeholder until the repo is public)</span>.
      </p>
    </article>
  );
}
