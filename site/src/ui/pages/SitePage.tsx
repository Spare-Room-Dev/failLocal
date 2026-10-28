import { useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { register } from '../../model/register.js';
import { sampleAt } from '../../model/clock.js';
import { sceneState } from '../../model/sceneState.js';
import { cableFraction, SERVICE_GROUPS } from '../../model/serviceGroups.js';
import { actions, appStore, useStore } from '../../model/store.js';
import { AssumptionsEditor } from '../AssumptionsEditor.js';
import { DetailPanel } from '../DetailPanel.js';
import { EventList } from '../EventList.js';
import { FreePlay } from '../FreePlay.js';
import { GuidedRun } from '../GuidedRun.js';
import { Legend } from '../Legend.js';
import { SceneView } from '../SceneView.js';
import { ServiceCard } from '../ServiceCard.js';
import { StockMeters } from '../StockMeters.js';
import { RevenueSection } from '../RevenueSection.js';
import { DayFigure, Timeline } from '../Timeline.js';
import { TopBar } from '../TopBar.js';
import { useMediaQuery } from '../useMediaQuery.js';
import { usePlayback } from '../usePlayback.js';

/** The phone layout's breakpoint (DESIGN.md Layout): one column, in reading order. */
const PHONE = '(max-width: 760px)';

function Scene({ onAnchors }: { onAnchors(anchors: Record<string, number>): void }) {
  const run = useStore(appStore, (s) => s.lastGood);
  const hour = useStore(appStore, (s) => s.clock.hour);
  const selected = useStore(appStore, (s) => s.selected);
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  if (!run) return null;
  return <SceneView scene={sceneState(register, sampleAt(run, hour))} selected={selected} onSelect={actions.select} reducedMotion={reducedMotion} onAnchors={onAnchors} />;
}

/** The phone's summary strip under the scene (finish B4): the day, production deferred and revenue at risk. */
function PhoneSummary() {
  const run = useStore(appStore, (s) => s.lastGood);
  const hour = useStore(appStore, (s) => s.clock.hour);
  if (!run) return null;
  return (
    <div className="site-summary">
      <DayFigure />
      <RevenueSection register={register} timeline={run} sample={sampleAt(run, hour)} />
    </div>
  );
}

/** One service card per group, each over its cable's entry post as the scene reports it (evenly spaced until then). */
function Cards({ anchors }: { anchors: Record<string, number> | null }) {
  return (
    <div className="site-cards">
      {SERVICE_GROUPS.map((g, i) => (
        <div key={g.id} className="site-card-slot" style={{ '--cable': anchors?.[g.id] ?? cableFraction(i) } as CSSProperties}>
          <ServiceCard group={g} />
        </div>
      ))}
    </div>
  );
}

/**
 * The model site in the DESIGN.md app frame: the top bar, the stage (service cards over their
 * cables, the scene, the legend in a band below it, the guided caption over it), the timeline strip
 * (day and play, the axis, the stocks) and the detail column docked right, which holds free play, the
 * assumptions editor, the event list and `footer` below the area panel. Under 761 px it is one column
 * in reading order (finish B4): the cards and scene, a summary strip (day, production deferred, revenue
 * at risk), the timeline, the legend, the events, the stocks, then the area panel and the rest. The
 * playback loop is mounted here, once.
 */
export function SitePage({ footer }: { footer?: ReactNode }) {
  usePlayback();
  const mode = useStore(appStore, (s) => s.mode);
  const phone = useMediaQuery(PHONE);
  // Each card sits over its cable's entry post, as the scene reports it; evenly spaced until then.
  const [anchors, setAnchors] = useState<Record<string, number> | null>(null);
  // Reached by a link, reload or footer rather than a welcome button: start in free play.
  useEffect(() => {
    if (appStore.get().mode === 'welcome') actions.enterFreePlay();
  }, []);
  if (phone)
    return (
      <div className="site-frame site-frame--phone">
        <TopBar />
        <div className="site-stage">
          <Cards anchors={anchors} />
          <Scene onAnchors={setAnchors} />
          {mode === 'guided' && <GuidedRun />}
        </div>
        <PhoneSummary />
        <div className="site-strip">
          <Timeline figure={false} />
        </div>
        <Legend />
        <EventList className="event-list--strip" />
        <StockMeters />
        <div className="site-detail">
          <DetailPanel revenue={false} />
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
  return (
    <div className="site-frame">
      <TopBar />
      <div className="site-stage">
        <Cards anchors={anchors} />
        <Scene onAnchors={setAnchors} />
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
        <EventList className="event-list--detail" />
        {footer}
      </div>
    </div>
  );
}
