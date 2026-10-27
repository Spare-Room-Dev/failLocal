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

function Scene() {
  const run = useStore(appStore, (s) => s.lastGood);
  const hour = useStore(appStore, (s) => s.clock.hour);
  const selected = useStore(appStore, (s) => s.selected);
  if (!run) return null;
  return <SceneView scene={sceneState(register, sampleAt(run, hour))} selected={selected} onSelect={actions.select} reducedMotion={false} />;
}

/**
 * The model site, stacked plainly; Task 11 lays out the desktop frame. `Timeline` mounts the
 * playback loop, so nothing else here does.
 */
export function SitePage() {
  const mode = useStore(appStore, (s) => s.mode);
  return (
    <div className="site-page">
      <TopBar />
      <div className="site-cards">
        {SERVICE_GROUPS.map((g) => (
          <ServiceCard key={g.id} group={g} />
        ))}
      </div>
      <Scene />
      <Legend />
      <DetailPanel />
      <Timeline />
      <StockMeters />
      {mode === 'guided' && <GuidedRun />}
      {mode === 'free' && (
        <>
          <FreePlay />
          <AssumptionsEditor />
        </>
      )}
    </div>
  );
}
