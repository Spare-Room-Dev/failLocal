import { caveatInputs } from '../../model/guided.js';
import { register } from '../../model/register.js';
import { AssumptionCaveat } from '../AssumptionCaveat.js';
import { DECISION_LOG } from '../decisionLog.js';

const PROJECTION = 's1-projection';

/** What the model does not claim. */
export function LimitsPage() {
  const title = register.scenarios.find((s) => s.id === PROJECTION)?.title;
  if (!title) throw new Error(`register has no scenario ${PROJECTION}`);
  const sources = Object.fromEntries(register.sources.map((s) => [s.id, s.title]));
  return (
    <article className="page">
      <h1>Limitations</h1>
      <ul>
        <li>This is a fictional site with synthetic data.</li>
        <li>Lab timings are not comparable with timings on a real site.</li>
        <li>
          <span className="limits-scenario">{title}.</span>{' '}
          <AssumptionCaveat assumptionsUsed={caveatInputs(register)} sources={sources} />
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
