import type { Variant } from '@faillocal/engine';
import { register } from '../model/register.js';
import { actions, appStore, useStore } from '../model/store.js';
import { ProvenanceTag } from './ProvenanceTag.js';
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

/** The fictional-site badge's glyph: a model block on its plinth, in the scene's 2:1 projection. */
function ModelGlyph() {
  return (
    <svg className="badge-glyph" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M2 6.5 L7 4 L12 6.5 L7 9 Z M2 6.5 V8.5 L7 11 L12 8.5 V6.5 M7 9 V11" fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinejoin="round" />
    </svg>
  );
}

/** The projection badge's glyph: a run that goes solid, then dashed (DESIGN.md: dashes mean "not solid"). */
function ProjectionGlyph() {
  return (
    <svg className="badge-glyph" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M1 10 H5" stroke="currentColor" strokeWidth={1.5} />
      <path d="M5 10 L13 4" stroke="currentColor" strokeWidth={1.6} strokeDasharray="2.4 1.8" />
    </svg>
  );
}

/**
 * The 60 px top bar (DESIGN.md "Top Bar Controls"): brand, scenario title over the public source it is
 * modelled on (tagged sourced), badges and the variant switch.
 */
export function TopBar() {
  // All from the run on screen, so a failed run never leaves the bar describing a different one.
  const kind = useStore(appStore, (s) => s.lastGoodKind);
  const scenarioId = useStore(appStore, (s) => s.lastGood?.scenarioId);
  const projection = useStore(appStore, (s) => s.lastGood?.projection ?? false);
  const variant = useStore(appStore, (s) => s.lastGood?.variant);
  const locked = useStore(appStore, (s) => s.mode === 'guided');
  const scenario = kind === 'free' ? undefined : register.scenarios.find((s) => s.id === scenarioId);
  const title = kind === 'free' ? FREE_PLAY_TITLE : scenario?.title;
  // The scenario's first public source: the register has no shorter "modelled on" line, so its title stands.
  const basis = register.sources.find((s) => s.id === scenario?.basis[0]);

  return (
    <header className="top-bar">
      <div className="brand">
        <BrandMark />
        <span className="brand-word">FailLocal</span>
      </div>
      <div className="top-bar-title">
        <h1 className="top-bar-scenario">{title}</h1>
        {basis && (
          <p className="top-bar-basis">
            <span className="top-bar-basis-text">
              Modelled on <cite>{basis.title}</cite>
            </span>
            <ProvenanceTag provenance={{ kind: 'sourced', source: basis.id }} sources={{ [basis.id]: basis.title }} />
          </p>
        )}
      </div>
      <div className="top-bar-badges">
        {register.site.fictional && (
          <span className="badge">
            <ModelGlyph />
            Fictional model site
          </span>
        )}
        {projection && (
          <span className="badge badge--dashed">
            <ProjectionGlyph />
            Projection
          </span>
        )}
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
