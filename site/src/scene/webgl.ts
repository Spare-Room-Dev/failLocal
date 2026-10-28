let cached: boolean | undefined;

/**
 * Whether this browser can draw the diorama: it creates one WebGL test context, releases it at once,
 * and caches the answer. No PixiJS import here, so the check costs nothing where the diorama never loads.
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
    const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}
