import type { SceneViewProps } from '../SceneView.js';
import { SchematicScene } from './SchematicScene.js';

/** The D-106 note shown with the schematic where the diorama can't run. */
export const FALLBACK_NOTE = "Simplified view: this browser can't draw the 3D model.";

/** The schematic standing in for the diorama, with a note saying why (D-106). The decorative scene carries no note. */
export function SchematicFallback(p: SceneViewProps) {
  return (
    <>
      {!p.decorative && (
        <p className="scene-note" data-message>
          {FALLBACK_NOTE}
        </p>
      )}
      <SchematicScene {...p} />
    </>
  );
}
