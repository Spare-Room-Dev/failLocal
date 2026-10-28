import { sampleAt } from '../model/clock.js';
import { register } from '../model/register.js';
import { actions, appStore, useStore } from '../model/store.js';
import { AreaPanel } from './AreaPanel.js';
import { RevenueSection } from './RevenueSection.js';
import './panel.css';

/**
 * The 372 px docked column (DESIGN.md "Docked Detail Panel"): revenue on top, the selected area below.
 * On a phone the revenue moves up into the summary strip under the scene (`revenue={false}` here).
 * Everything is read off `lastGood`, including its variant, so after a failed recompute the panel
 * still describes one run.
 */
export function DetailPanel({ revenue = true }: { revenue?: boolean }) {
  const timeline = useStore(appStore, (s) => s.lastGood);
  const hour = useStore(appStore, (s) => s.clock.hour);
  const selected = useStore(appStore, (s) => s.selected);
  if (!timeline) return null;
  const sample = sampleAt(timeline, hour);

  return (
    <aside className="detail-panel" aria-label="Detail">
      {revenue && <RevenueSection register={register} timeline={timeline} sample={sample} />}
      {selected && (
        <AreaPanel
          register={register}
          timeline={timeline}
          sample={sample}
          variant={timeline.variant}
          processId={selected}
          onClose={() => actions.select(null)}
        />
      )}
    </aside>
  );
}
