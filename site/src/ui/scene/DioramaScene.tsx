import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { cableFraction, SERVICE_GROUPS } from '../../model/serviceGroups.js';
import { defaultCamera } from '../../scene/framing.js';
import { project } from '../../scene/iso.js';
import { LAYOUT } from '../../scene/layout.js';
import type { DioramaHandle, SceneLayout } from '../../scene/pixi/app.js';
import type { FlagLayout } from '../../scene/pixi/overlay.js';
import { FACE_TRANSFORM } from '../../scene/plate.js';
import { flagBox } from '../../scene/plaques.js';
import type { SceneViewProps } from '../SceneView.js';
import { SchematicFallback } from './SchematicFallback.js';
import '../scene.css';

const STATE_WORD = { normal: 'Normal', degraded: 'Degraded', stopped: 'Stopped' } as const;

/**
 * Cards sit evenly along the scene's top edge and each cable drops from its card, so the anchors are
 * the even card positions; the canvas draws the cable from that drop to its entry post (dynamic.ts).
 */
const ANCHORS: Record<string, number> = Object.fromEntries(SERVICE_GROUPS.map((g, i) => [g.id, cableFraction(i)]));

/** Used until the renderer reports its first layout (and in jsdom, which measures nothing): the desktop stage's scene box. */
const NOMINAL = { w: 1068, h: 580 };
const NOMINAL_CAMERA = defaultCamera('site', NOMINAL, false);
/** A flag without a plaque stands on a short pole (overlay.ts). */
const SHORT_POLE = 26;

type Box = { left: number; top: number; width: number; height: number };

/** The button over an area: its plaque and the flag's cloth, or the whole flag when it has no plaque; null when the flag is out of frame. */
function hitBox(l: FlagLayout): Box | null {
  if (!l.inFrame) return null;
  const f = l.rect ? flagBox(l.flagTop, 0) : flagBox(l.foot, l.foot.y - l.flagTop.y);
  const r = l.rect ?? f;
  const left = Math.min(f.x, r.x);
  const top = Math.min(f.y, r.y);
  return { left, top, width: Math.max(f.x + f.w, r.x + r.w) - left, height: Math.max(f.y + f.h, r.y + r.h) - top };
}

/** `b` cut to the stage, so a flag at the stage's edge does not push its button (and focus ring) past it. */
function clip(b: Box | null, view: { w: number; h: number }): Box | null {
  if (!b) return null;
  const left = Math.max(0, b.left);
  const top = Math.max(0, b.top);
  return { left, top, width: Math.min(view.w, b.left + b.width) - left, height: Math.min(view.h, b.top + b.height) - top };
}

/**
 * The scene as the PixiJS diorama. PixiJS loads on mount (a separate chunk), so pages without the
 * scene never fetch it. Over the canvas sits the scene contract's accessible DOM layer, laid out from what
 * the renderer reports after each frame that moved anything: a native button per process area over its
 * plaque and flag, the plate as DOM text engraved in the plane of the board's front-left plinth face (it is
 * the engraving: the canvas does not draw the plate's words) and pinned to the bottom of the stage when that
 * face is out of view, and a marker for each service cable where it drops into the
 * scene. An area out of frame keeps its button, visually hidden, so keyboard and screen reader users can
 * still reach it; focusing it brings the area into view. If the renderer fails to start, or later loses
 * its WebGL context for good, the schematic stands in.
 */
export function DioramaScene({ scene, selected, onSelect, reducedMotion, decorative = false, onAnchors }: SceneViewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const handle = useRef<DioramaHandle | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [layout, setLayout] = useState<SceneLayout | null>(null);
  const shown = useRef<Record<string, Box>>({});
  const focusedArea = () => {
    const el = document.activeElement;
    return el instanceof HTMLElement && hostRef.current?.contains(el) ? (el.dataset.area ?? null) : null;
  };

  // The camera moved (a wheel, drag or pinch) while an area button had focus, and took its area out of frame: bring it back.
  useLayoutEffect(() => {
    const id = focusedArea();
    if (id && layout?.plaques[id]?.inFrame === false) handle.current?.reveal(id);
  }, [layout]);
  const latest = useRef({ scene, reducedMotion, selected });
  latest.current = { scene, reducedMotion, selected };

  useEffect(() => onAnchors?.(ANCHORS), [onAnchors]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    const onLayout = (l: SceneLayout) => {
      if (!cancelled) setLayout(l);
    };
    // The renderer lost its context for good: release it and let the schematic stand in.
    const onFail = () => {
      if (cancelled) return;
      handle.current?.destroy();
      handle.current = null;
      setFailed(true);
    };
    import('../../scene/pixi/app.js')
      .then(({ createDiorama }) => createDiorama(host, onLayout, { interactive: !decorative, framing: decorative ? 'hero' : 'site', onFail }))
      .then(
        (h) => {
          // Unmounted while the renderer was starting: release its context at once.
          if (cancelled) return h.destroy();
          try {
            h.setState(latest.current.scene, latest.current.reducedMotion, latest.current.selected);
          } catch {
            // The world failed to build: release the context and show the schematic instead.
            h.destroy();
            setFailed(true);
            return;
          }
          handle.current = h;
          setReady(true);
        },
        () => {
          if (!cancelled) setFailed(true);
        },
      );
    return () => {
      cancelled = true;
      handle.current?.destroy();
      handle.current = null;
      setReady(false);
      setLayout(null);
    };
  }, [decorative]);

  useEffect(() => handle.current?.setState(scene, reducedMotion, selected), [scene, reducedMotion, selected]);

  if (failed) return <SchematicFallback scene={scene} selected={selected} onSelect={onSelect} reducedMotion={reducedMotion} decorative={decorative} onAnchors={onAnchors} />;

  const onKeyDown = (id: string) => (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    // The handler selects; stop the native button's own click from selecting twice.
    e.preventDefault();
    onSelect(id);
  };
  // Before the first layout: each button over its flag under the nominal camera.
  const placeBox = (id: string): Box | null => {
    const l = layout?.plaques[id];
    if (l && layout) return clip(hitBox(l), layout.view);
    const { sx, sy } = project(LAYOUT.areas[id]!.anchor, NOMINAL_CAMERA);
    return hitBox({ foot: { x: sx, y: sy }, flagTop: { x: sx, y: sy - SHORT_POLE }, rect: null, inFrame: true, side: 1 });
  };
  // A focused button whose area has just left the frame keeps its last place (and its focus ring) until the
  // camera brings the area back (the effect below), so focus never lands on something invisible.
  const boxFor = (id: string): Box | null => {
    const box = placeBox(id);
    if (box) shown.current[id] = box;
    else if (focusedArea() === id) return shown.current[id] ?? null;
    return box;
  };
  const plate = layout?.plate.w ? layout.plate : null;

  return (
    <div
      ref={hostRef}
      className="scene scene--diorama"
      data-ready={ready}
      data-reduced-motion={reducedMotion}
      {...(decorative ? { 'aria-hidden': true } : { role: 'group', 'aria-label': 'Model site', tabIndex: 0 })}
    >
      {!decorative &&
        Object.keys(LAYOUT.areas).map((id) => {
          const p = scene.processes[id];
          if (!p) throw new Error(`scene has no process ${id}`);
          const box = boxFor(id);
          return (
            <button
              key={id}
              type="button"
              className={box ? `scene-hit${layout?.plaques[id]?.rect ? ' scene-hit--plaque' : ''}` : 'scene-hit scene-hit--away'}
              data-area={id}
              style={box ?? undefined}
              onFocus={box ? undefined : () => handle.current?.reveal(id)}
              aria-pressed={selected === id}
              aria-label={`${p.label}: ${STATE_WORD[p.state]}${p.note ? `. ${p.note}` : ''}`}
              onClick={() => onSelect(id)}
              onKeyDown={onKeyDown(id)}
              onKeyUp={(e) => e.key === ' ' && e.preventDefault()}
            />
          );
        })}
      {SERVICE_GROUPS.map((g) => {
        const state = scene.cables[g.id];
        if (!state) throw new Error(`scene has no cable for ${g.id}`);
        return <span key={g.id} className="scene-cable-drop" data-cable-group={g.id} data-cable-state={state} style={{ left: `${ANCHORS[g.id]! * 100}%` }} aria-hidden="true" />;
      })}
      <p
        className="scene-plinth"
        data-placement={plate?.onFace ? 'face' : 'pinned'}
        style={plate ? { left: plate.x, top: plate.y, right: 'auto', bottom: 'auto', ...(plate.onFace && { fontSize: plate.font, transform: FACE_TRANSFORM }) } : undefined}
      >
        {scene.plate.text}
      </p>
      {!decorative && (
        <button type="button" className="scene-fit" onClick={() => handle.current?.fit()}>
          Fit
        </button>
      )}
    </div>
  );
}
