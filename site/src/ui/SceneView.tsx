import type { SceneState } from '../model/sceneState.js';
import { webglAvailable } from '../scene/webgl.js';
import { DioramaScene } from './scene/DioramaScene.js';
import { SchematicFallback } from './scene/SchematicFallback.js';

/**
 * The scene contract (v2). Every implementation draws `scene` and nothing else, and renders this
 * accessible DOM layer:
 * - one element with button semantics per process area (native `<button>` in HTML layers),
 *   `aria-label="<label>: <State word>"`, `aria-pressed` from `selected`; click, Enter and Space call `onSelect`;
 * - one `.scene-plinth` element holding `scene.plate.text` as DOM text;
 * - one marker per service group with `data-cable-group="<id>"` and `data-cable-state`;
 * - `onAnchors` after layout and whenever the anchors change.
 * `decorative` (the welcome hero) renders no buttons and hides the scene from assistive tech.
 */
export interface SceneViewProps {
  scene: SceneState;
  selected: string | null;
  onSelect(processId: string): void;
  reducedMotion: boolean;
  decorative?: boolean;
  /** Group id → x where its cable enters the top of the scene, under its card, as a fraction (0..1) of the scene box's width (ruling R-n). */
  onAnchors?(anchors: Record<string, number>): void;
}

/** Chooses the scene implementation: the PixiJS diorama where WebGL runs, otherwise the schematic with the D-106 note. */
export function SceneView(p: SceneViewProps) {
  return webglAvailable() ? <DioramaScene {...p} /> : <SchematicFallback {...p} />;
}
