import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { cableFraction, SERVICE_GROUPS } from '../../model/serviceGroups.js';
import { fitCamera, project } from '../../scene/iso.js';
import type { Camera } from '../../scene/iso.js';
import { BOARD, LAYOUT } from '../../scene/layout.js';
import type { DioramaHandle } from '../../scene/pixi/app.js';
import type { SceneViewProps } from '../SceneView.js';
import { SchematicFallback } from './SchematicFallback.js';
import '../scene.css';

const STATE_WORD = { normal: 'Normal', degraded: 'Degraded', stopped: 'Stopped' } as const;

/**
 * Cards sit evenly along the scene's top edge and each cable drops from its card, so the anchors are
 * the even card positions; the canvas draws the cable from that drop to its entry post (dynamic.ts).
 */
const ANCHORS: Record<string, number> = Object.fromEntries(SERVICE_GROUPS.map((g, i) => [g.id, cableFraction(i)]));

/** Used until the host has been measured (and in jsdom, which measures nothing): the desktop stage's scene box. */
const NOMINAL = { w: 928, h: 580 };
/** Half the area buttons' hit target, in px. */
const HIT = 14;

type Frame = { cam: Camera; w: number; h: number };

/**
 * The scene as the PixiJS diorama. PixiJS loads on mount (a separate chunk), so pages without the
 * scene never fetch it. Over the canvas sits the scene contract's accessible DOM layer: a native
 * button per process area at its projected anchor, the plate as DOM text, and a marker for each
 * service cable where it drops into the scene. If the renderer fails to start, or later loses its WebGL context for good, the schematic stands in.
 */
export function DioramaScene({ scene, selected, onSelect, reducedMotion, decorative = false, onAnchors }: SceneViewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const handle = useRef<DioramaHandle | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [frame, setFrame] = useState<Frame>(() => ({ cam: fitCamera(BOARD, NOMINAL, LAYOUT.defaultFocus), ...NOMINAL }));
  const latest = useRef({ scene, reducedMotion, selected });
  latest.current = { scene, reducedMotion, selected };

  useEffect(() => onAnchors?.(ANCHORS), [onAnchors]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    const onCamera = (cam: Camera) => setFrame({ cam, w: host.clientWidth || NOMINAL.w, h: host.clientHeight || NOMINAL.h });
    // The renderer lost its context for good: release it and let the schematic stand in.
    const onFail = () => {
      if (cancelled) return;
      handle.current?.destroy();
      handle.current = null;
      setFailed(true);
    };
    import('../../scene/pixi/app.js')
      .then(({ createDiorama }) => createDiorama(host, onCamera, { interactive: !decorative, onFail }))
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
  // Positions are clamped into the scene box, so a button for an area out of frame waits at the edge.
  const place = (p: { x: number; y: number; z: number }): CSSProperties => {
    const s = project(p, frame.cam);
    return {
      left: Math.min(frame.w - 2 * HIT, Math.max(0, s.sx - HIT)),
      top: Math.min(frame.h - 2 * HIT, Math.max(0, s.sy - HIT)),
    };
  };

  return (
    <div
      ref={hostRef}
      className="scene scene--diorama"
      data-ready={ready}
      data-reduced-motion={reducedMotion}
      {...(decorative ? { 'aria-hidden': true } : { role: 'group', 'aria-label': 'Model site', tabIndex: 0 })}
    >
      {!decorative &&
        Object.entries(LAYOUT.areas).map(([id, area]) => {
          const p = scene.processes[id];
          if (!p) throw new Error(`scene has no process ${id}`);
          return (
            <button
              key={id}
              type="button"
              className="scene-hit"
              data-area={id}
              style={place(area.anchor)}
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
      <p className="scene-plinth">{scene.plate.text}</p>
      {!decorative && (
        <button type="button" className="scene-fit" onClick={() => handle.current?.fit()}>
          Fit
        </button>
      )}
    </div>
  );
}
