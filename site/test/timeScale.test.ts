import { afterEach, describe, expect, test } from 'vitest';
import { appStore, initialAppState } from '../src/model/store.js';
import { installE2eHook, timeScale } from '../src/model/timeScale.js';

afterEach(() => {
  if (window.__faillocal) window.__faillocal.timeScale = 1;
  delete window.__faillocal;
  appStore.set(initialAppState());
});

const at = (search: string) => ({ location: { search } }) as unknown as Window;

describe('e2e speed hook (R9)', () => {
  test('installs only in a dev build or under ?e2e', () => {
    const plain = at('');
    expect(installE2eHook(plain, false)).toBe(false);
    expect(plain.__faillocal).toBeUndefined();
    const e2e = at('?e2e');
    expect(installE2eHook(e2e, false)).toBe(true);
    expect(e2e.__faillocal?.timeScale).toBe(1);
    expect(installE2eHook(at('?x=e2e'), false)).toBe(false);
    expect(installE2eHook(at('?noe2e'), false)).toBe(false);
    expect(installE2eHook(at('?a=1&e2e'), false)).toBe(true);
    expect(installE2eHook(at(''), true)).toBe(true);
  });

  test('timeScale defaults to 1 and follows the hook; setSpeed sets the playback speed', () => {
    expect(timeScale()).toBe(1);
    installE2eHook(window, true);
    window.__faillocal!.timeScale = 40;
    expect(timeScale()).toBe(40);
    window.__faillocal!.setSpeed(96);
    expect(appStore.get().clock.hoursPerSecond).toBe(96);
  });
});
