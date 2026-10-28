import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

describe('webglAvailable', () => {
  test('is false where the browser has no WebGL at all (jsdom), without asking for a context', async () => {
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext');
    const { webglAvailable } = await import('../../src/scene/webgl.js');
    expect(webglAvailable()).toBe(false);
    expect(getContext).not.toHaveBeenCalled();
    getContext.mockRestore();
  });

  test('creates one test context, releases it, and caches the answer', async () => {
    const loseContext = vi.fn();
    vi.stubGlobal('WebGLRenderingContext', class {});
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockImplementation(((type: string) => (type === 'webgl2' || type === 'webgl' ? { getExtension: () => ({ loseContext }) } : null)) as never);
    const { webglAvailable } = await import('../../src/scene/webgl.js');
    expect(webglAvailable()).toBe(true);
    expect(webglAvailable()).toBe(true);
    expect(getContext).toHaveBeenCalledTimes(1);
    expect(loseContext).toHaveBeenCalledTimes(1);
    getContext.mockRestore();
  });

  test('is false when the browser refuses a context', async () => {
    vi.stubGlobal('WebGLRenderingContext', class {});
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const { webglAvailable } = await import('../../src/scene/webgl.js');
    expect(webglAvailable()).toBe(false);
    getContext.mockRestore();
  });
});
