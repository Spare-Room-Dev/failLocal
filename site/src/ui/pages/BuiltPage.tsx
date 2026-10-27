/** Draft copy for the owner to review and rewrite in their own words at the release gate. */
export function BuiltPage() {
  return (
    <article className="page">
      <p className="draft-banner" role="note">
        Draft — awaiting owner review
      </p>
      <h1>How I built this</h1>
      <p>
        I set the goals for FailLocal and the honesty rules it follows, and I approved the design before it was built.
      </p>
      <p>
        Claude Code, Anthropic&rsquo;s coding agent, wrote the code and drafted the copy under that direction. Where it
        had to choose, it asked, or wrote the choice down for me to accept or change.
      </p>
      <p>
        Claude Code proposed every modelling judgement and recorded it in the decision log; I reviewed each one and
        accepted or changed it.
      </p>
      <h2>How it was checked</h2>
      <ul>
        <li>Automated tests on the simulation engine and on this site, including the wording and provenance rules.</li>
        <li>An independent reviewer read every task&rsquo;s changes before it was accepted.</li>
        <li className="placeholder">[Placeholder: whole-branch review — confirm once done]</li>
        <li>
          A decision log, <code>docs/decisions.md</code>, records each modelling choice, the reasoning behind it and
          where its numbers come from.
        </li>
      </ul>
      <h2>What I learned</h2>
      <ul>
        <li className="placeholder">
          [Placeholder for the owner: what building this taught you about how a mine depends on services outside its
          fence.]
        </li>
        <li className="placeholder">
          [Placeholder for the owner: what you learned about directing an AI coding agent and checking its work.]
        </li>
      </ul>
    </article>
  );
}
