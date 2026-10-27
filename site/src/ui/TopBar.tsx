import type { Variant } from '@faillocal/engine';
import { register } from '../model/register.js';
import { actions, appStore, useStore } from '../model/store.js';
import './chrome.css';

const VARIANTS: { id: Variant; label: string }[] = [
  { id: 'unprepared', label: 'Unprepared' },
  { id: 'prepared', label: 'Prepared' },
];

/** The free-play run's title; every register scenario uses its own `title`. */
const FREE_PLAY_TITLE = 'Your scenario';

/** A pit in section: four bench lines narrowing upward, cut at the top right by a short red stroke. */
function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 28 24" aria-hidden="true">
      <path d="M2 21 H26 M5 16 H23 M8 11 H20 M11 6 H17" stroke="var(--ink)" strokeWidth={2} fill="none" />
      <path d="M19 2 L25 9" stroke="var(--stop-red)" strokeWidth={2.2} />
    </svg>
  );
}

/** The 60 px top bar (DESIGN.md "Top Bar Controls"): brand, scenario title, badges and the variant switch. */
export function TopBar() {
  // All from the run on screen, so a failed run never leaves the bar describing a different one.
  const kind = useStore(appStore, (s) => s.lastGoodKind);
  const scenarioId = useStore(appStore, (s) => s.lastGood?.scenarioId);
  const projection = useStore(appStore, (s) => s.lastGood?.projection ?? false);
  const variant = useStore(appStore, (s) => s.lastGood?.variant);
  const locked = useStore(appStore, (s) => s.mode === 'guided');
  const title = kind === 'free' ? FREE_PLAY_TITLE : register.scenarios.find((s) => s.id === scenarioId)?.title;

  return (
    <header className="top-bar">
      <div className="brand">
        <BrandMark />
        <span className="brand-word">FailLocal</span>
      </div>
      <h1 className="top-bar-title">{title}</h1>
      <div className="top-bar-badges">
        {register.site.fictional && <span className="badge">Fictional model site</span>}
        {projection && <span className="badge badge--dashed">Projection</span>}
      </div>
      <div className="segmented" role="group" aria-label="Site readiness">
        {VARIANTS.map((v) => (
          <button key={v.id} type="button" aria-pressed={variant === v.id} disabled={locked} onClick={() => actions.setVariant(v.id)}>
            {v.label}
          </button>
        ))}
      </div>
    </header>
  );
}
