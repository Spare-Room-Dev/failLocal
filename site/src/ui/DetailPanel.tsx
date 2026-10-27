import type { Sample, Timeline } from '@faillocal/engine';
import { register } from '../model/register.js';
import { actions, appStore, useStore } from '../model/store.js';
import { AreaPanel } from './AreaPanel.js';
import { RevenueSection } from './RevenueSection.js';
import './panel.css';

/** The sample at `hour`, or the last one when the clock sits past a shortened horizon. */
function sampleAt(timeline: Timeline, hour: number): Sample {
  const samples = timeline.samples;
  return samples[Math.min(Math.max(0, Math.floor(hour)), samples.length - 1)]!;
}

/** The 372 px docked column (DESIGN.md "Docked Detail Panel"): revenue on top, the selected area below. */
export function DetailPanel() {
  const timeline = useStore(appStore, (s) => s.lastGood);
  const hour = useStore(appStore, (s) => s.clock.hour);
  const selected = useStore(appStore, (s) => s.selected);
  const variant = useStore(appStore, (s) => s.variant);
  if (!timeline) return null;
  const sample = sampleAt(timeline, hour);

  return (
    <aside className="detail-panel" aria-label="Detail">
      <RevenueSection register={register} timeline={timeline} sample={sample} />
      {selected && (
        <AreaPanel
          register={register}
          timeline={timeline}
          sample={sample}
          variant={variant}
          processId={selected}
          onClose={() => actions.select(null)}
        />
      )}
    </aside>
  );
}
