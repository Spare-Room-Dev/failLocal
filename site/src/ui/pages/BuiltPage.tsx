/** How the site was made and checked, in the owner's words (approved in the Release 2 copy review). */
export function BuiltPage() {
  return (
    <article className="page">
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
        <li>A final reviewer read each release&rsquo;s changes together before it shipped.</li>
        <li>
          A decision log, <code>docs/decisions.md</code>, records each modelling choice, the reasoning behind it and
          where its numbers come from.
        </li>
      </ul>
      <h2>What I learned</h2>
      <ul>
        <li>
          I expected the danger to be someone in the plant controls. In the Scope Systems case the plants were fine;
          what stopped work was losing ordinary business systems like ordering and payroll. And getting them back
          wasn&rsquo;t the end: in the model, backlogs, a purchasing hold and delivery times keep the site short of fuel
          for days after the restore.
        </li>
        <li>
          Claude Code proposed the options and I made the calls, such as holding purchasing after a restore and adding
          delivery times. What I&rsquo;d pass on: make the agent write every decision down with its reasoning, because
          if you can&rsquo;t explain a decision, you don&rsquo;t own it.
        </li>
      </ul>
    </article>
  );
}
