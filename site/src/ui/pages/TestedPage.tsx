import { register } from '../../model/register.js';
import { ProvenanceTag } from '../ProvenanceTag.js';

const sourceTitles = Object.fromEntries(register.sources.map((s) => [s.id, s.title]));

/** The interim testing note and each control's capability provenance, from the register. */
export function TestedPage() {
  return (
    <article className="page">
      <h1>How this was tested</h1>
      <p>
        The lab that measures these controls arrives in the next release. Until then every control's capability is
        labelled assumed.
      </p>
      <h2>Controls and how their capability is labelled</h2>
      <ul className="control-list">
        {register.controls.map((c) => (
          <li key={c.id}>
            <span className="control-name">{c.name}</span>
            <ProvenanceTag display={c.capability.provenance.kind} provenance={c.capability.provenance} sources={sourceTitles} />
          </li>
        ))}
      </ul>
    </article>
  );
}
