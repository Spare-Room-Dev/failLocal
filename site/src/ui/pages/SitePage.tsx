import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { register } from '../../model/register.js';
import { sampleAt } from '../../model/clock.js';
import { sceneState } from '../../model/sceneState.js';
import { SERVICE_GROUPS } from '../../model/serviceGroups.js';
import { actions, appStore, useStore } from '../../model/store.js';
import { AssumptionsEditor } from '../AssumptionsEditor.js';
import { DetailPanel } from '../DetailPanel.js';
import { FreePlay } from '../FreePlay.js';
import { GuidedRun } from '../GuidedRun.js';
import { Legend } from '../Legend.js';
import { SceneView } from '../SceneView.js';
import { ServiceCard } from '../ServiceCard.js';
import { StockMeters } from '../StockMeters.js';
import { Timeline } from '../Timeline.js';
import { TopBar } from '../TopBar.js';
import { useMediaQuery } from '../useMediaQuery.js';
import { usePlayback } from '../usePlayback.js';

function Scene() {
  const run = useStore(appStore, (s) => s.lastGood);
  const hour = useStore(appStore, (s) => s.clock.hour);
  const selected = useStore(appStore, (s) => s.selected);
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  if (!run) return null;
  return <SceneView scene={sceneState(register, sampleAt(run, hour))} selected={selected} onSelect={actions.select} reducedMotion={reducedMotion} />;
}

/**
 * The model site in the DESIGN.md app frame: the top bar, the stage (service cards along its top,
 * the legend bottom-right, the guided caption over it), the timeline strip (day and play, the axis,
 * the stocks) and the detail column docked right, which holds free play, the assumptions editor and
 * `footer` below the area panel. Under 761 px it is one column. The playback loop is mounted here,
 * once.
 */
export function SitePage({ footer }: { footer?: ReactNode }) {
  usePlayback();
  const mode = useStore(appStore, (s) => s.mode);
  // Reached by a link, reload or footer rather than a welcome button: start in free play.
  useEffect(() => {
    if (appStore.get().mode === 'welcome') actions.enterFreePlay();
  }, []);
  return (
    <div className="site-frame">
      <TopBar />
      <div className="site-stage">
        <div className="site-cards">
          {SERVICE_GROUPS.map((g) => (
            <ServiceCard key={g.id} group={g} />
          ))}
        </div>
        <Scene />
        <Legend />
        {mode === 'guided' && <GuidedRun />}
      </div>
      <div className="site-strip">
        <Timeline />
        <StockMeters />
      </div>
      <div className="site-detail">
        <DetailPanel />
        {mode === 'free' && (
          <>
            <FreePlay />
            <AssumptionsEditor />
          </>
        )}
        {footer}
      </div>
    </div>
  );
}
