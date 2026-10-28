import type { SceneState } from '../model/sceneState.js';
import { SchematicScene } from './scene/SchematicScene.js';

/**
 * The scene contract (v2). Every implementation draws `scene` and nothing else, and renders this
 * accessible DOM layer:
 * - one button per process area, `aria-label="<label>: <State word>"`, `aria-pressed` from
 *   `selected`; click, Enter and Space call `onSelect`;
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
  /** Group id → x of its cable's entry post, as a fraction (0..1) of the scene box's width. */
  onAnchors?(anchors: Record<string, number>): void;
}

/** Chooses the scene implementation. Until the diorama lands, that is always the schematic. */
export function SceneView(p: SceneViewProps) {
  return <SchematicScene {...p} />;
}
