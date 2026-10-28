import { Container, RenderTexture, Sprite } from 'pixi.js';
import type { Renderer } from 'pixi.js';
import type { Camera } from '../iso.js';

/**
 * A group of the world that changes only with the camera or the engine state, drawn once into a
 * view-sized texture and shown as a sprite until something invalidates it. While the scene animates,
 * each frame then costs one textured quad for the group instead of re-rasterising its geometry and
 * re-running its blur filters. The texture is the stage's size at the renderer's resolution, so it is
 * as sharp as drawing live at any zoom.
 */
export class Snapshot {
  readonly sprite: Sprite;
  private readonly root = new Container();
  private readonly world = new Container();
  private readonly texture: RenderTexture;
  private valid = false;

  constructor(content: Container, label: string) {
    this.world.addChild(content);
    this.root.addChild(this.world);
    this.texture = RenderTexture.create({ width: 1, height: 1, antialias: true });
    this.sprite = new Sprite({ texture: this.texture, label });
  }

  /** The stage's size in CSS pixels and the renderer's resolution. */
  resize(w: number, h: number, resolution: number): void {
    this.texture.resize(w, h, resolution);
    this.valid = false;
  }

  invalidate(): void {
    this.valid = false;
  }

  /** Redraws the texture under camera `cam` if it was invalidated. */
  update(renderer: Renderer, cam: Camera): void {
    if (this.valid) return;
    this.world.position.set(cam.ox, cam.oy);
    this.world.scale.set(cam.k);
    renderer.render({ container: this.root, target: this.texture, clear: true, clearColor: [0, 0, 0, 0] });
    this.valid = true;
  }

  destroy(): void {
    this.sprite.destroy();
    this.root.destroy({ children: true });
    this.texture.destroy(true);
  }
}
