import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { cableFraction, SERVICE_GROUPS } from '../../model/serviceGroups.js';
import { defaultCamera } from '../../scene/framing.js';
import { project } from '../../scene/iso.js';
import { LAYOUT } from '../../scene/layout.js';
import type { DioramaHandle, SceneLayout } from '../../scene/pixi/app.js';
import type { FlagLayout } from '../../scene/pixi/overlay.js';
import { platePosition } from '../../scene/plate.js';
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
/** Half the side of an area button over a flag with no plaque, in px. */
const HIT = 14;

type Box = { left: number; top: number; width: number; height: number };

/** The button over an area: its plaque and flag, or the flag alone; null when the flag is out of frame. */
function hitBox(l: FlagLayout): Box | null {
  if (!l.inFrame) return null;
  // The flag's cloth flies up to 12 px either side of the top of its pole.
  const flag = { left: l.flagTop.x - HIT, top: l.flagTop.y - 4, width: 2 * HIT, height: 2 * HIT };
  if (!l.rect) return flag;
  const left = Math.min(flag.left, l.rect.x);
  const top = Math.min(flag.top, l.rect.y);
  return { left, top, width: Math.max(flag.left + flag.width, l.rect.x + l.rect.w) - left, height: Math.max(flag.top + 12, l.rect.y + l.rect.h) - top };
}

/**
 * The scene as the PixiJS diorama. PixiJS loads on mount (a separate chunk), so pages without the
 * scene never fetch it. Over the canvas sits the scene contract's accessible DOM layer, laid out from what
 * the renderer reports after each frame that moved anything: a native button per process area over its
 * plaque and flag, the plate as DOM text hung on the board's front plinth face (pinned to the bottom of
 * the stage when that face is out of view), and a marker for each service cable where it drops into the
 * scene. An area out of frame keeps its button, visually hidden, so keyboard and screen reader users can
 * still reach it; focusing it brings the area into view. If the renderer fails to start, or later loses
 * its WebGL context for good, the schematic stands in.
 */
export function DioramaScene({ scene, selected, onSelect, reducedMotion, decorative = false, onAnchors }: SceneViewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const plateRef = useRef<HTMLParagraphElement>(null);
  const handle = useRef<DioramaHandle | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [layout, setLayout] = useState<SceneLayout | null>(null);
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
  // Before the first layout: each button at its area's projected anchor under the nominal camera.
  const boxFor = (id: string): Box | null => {
    const l = layout?.plaques[id];
    if (l) return hitBox(l);
    const { sx, sy } = project(LAYOUT.areas[id]!.anchor, NOMINAL_CAMERA);
    return { left: sx - HIT, top: sy - HIT, width: 2 * HIT, height: 2 * HIT };
  };
  const plate = layout && plateRef.current?.offsetWidth ? platePosition(layout.cam, layout.view, { w: plateRef.current.offsetWidth, h: plateRef.current.offsetHeight }) : null;

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
      <p ref={plateRef} className="scene-plinth" data-placement={plate ? 'face' : 'pinned'} style={plate ? { left: plate.x, top: plate.y } : undefined}>
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
