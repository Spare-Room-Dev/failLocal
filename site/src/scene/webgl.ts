let cached: boolean | undefined;

/**
 * Whether this browser can draw the diorama: it creates one WebGL test context with a stencil buffer
 * (the pit's masks need one, and PixiJS's own WebGL check asks for it too), releases it at once, and
 * caches the answer. No PixiJS import here, so the check costs nothing where the diorama never loads.
 */
export function webglAvailable(): boolean {
  if (cached !== undefined) return cached;
  cached = probe();
  return cached;
}

function probe(): boolean {
  if (typeof document === 'undefined' || typeof WebGLRenderingContext === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const options = { stencil: true };
    const gl = (canvas.getContext('webgl2', options) ?? canvas.getContext('webgl', options)) as WebGLRenderingContext | null;
    if (!gl) return false;
    const stencil = !!gl.getContextAttributes()?.stencil;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return stencil;
  } catch {
    return false;
  }
}
