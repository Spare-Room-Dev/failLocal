import { sampleAt } from '../../model/clock.js';
import { register } from '../../model/register.js';
import { sceneState } from '../../model/sceneState.js';
import { actions, appStore, useStore } from '../../model/store.js';
import { hrefOf, navigate } from '../../routes.js';
import { SceneView } from '../SceneView.js';
import { useMediaQuery } from '../useMediaQuery.js';

/**
 * The hero: the model at hour 0 of the current run, cropped on the pit, ROM pad and crusher at k = 1.18, with
 * its ambient motion (a still frame under reduced motion). A picture: hidden from assistive tech and out of the tab order.
 */
function ScenePreview() {
  const run = useStore(appStore, (s) => s.lastGood);
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  if (!run) return null;
  return (
    <div className="welcome-scene" aria-hidden="true" data-decorative inert>
      <SceneView scene={sceneState(register, sampleAt(run, 0))} selected={null} onSelect={() => {}} reducedMotion={reducedMotion} decorative />
    </div>
  );
}

/** The landing page (`.impeccable/mocks/directions/BRIEF.md` "welcome.html copy"). */
export function WelcomePage() {
  const showSite = () => {
    actions.startGuided();
    navigate('site');
  };
  const explore = () => {
    actions.enterFreePlay();
    navigate('site');
  };

  return (
    <div className="welcome">
      <div className="welcome-copy">
        <h1>What stops a mine when the systems outside it go down?</h1>
        <p>
          In <time dateTime="2026-05">May 2026</time>, a ransomware attack on Scope Systems, a Perth company that hosts
          finance and maintenance software for miners, took it offline for about twelve days. The plants were fine.
          Purchasing, maintenance and payroll were not.
        </p>
        <p>
          This is a fictional model iron ore site. Cut the outside services it relies on, watch what stops and what it
          costs, then see what a prepared site does differently.
        </p>
        <div className="welcome-actions">
          <button type="button" className="button button--primary" onClick={showSite}>
            Show me the site
          </button>
          <button type="button" className="button" onClick={explore}>
            Explore freely
          </button>
        </div>
        <p className="small-print">
          Built from public sources: Scope Systems incident updates, the MM-ISAC Mining OT Reference Architecture (
          <time dateTime="2026-08">2026</time>), Rio Tinto&rsquo;s Western Australia operations and the World Bank Pink
          Sheet. <a href={hrefOf('sources')}>Sources →</a>
        </p>
        <p className="small-print byline">
          Built by <span className="placeholder">[Your name]</span>, cyber security graduate, Perth ·{' '}
          <a href={hrefOf('built')}>How I built this →</a>
        </p>
      </div>
      <ScenePreview />
    </div>
  );
}
