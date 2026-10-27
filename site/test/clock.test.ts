import { describe, expect, test } from 'vitest';
import { SPEEDS, advance, scrubTo } from '../src/model/clock.js';
import type { Clock } from '../src/model/clock.js';
import { initialAppState } from '../src/model/store.js';

const playing = (hour: number, hoursPerSecond = 24): Clock => ({ hour, playing: true, hoursPerSecond });

describe('clock', () => {
  test('advance moves by hoursPerSecond × dt', () => {
    expect(advance(playing(10), 0.5, 384)).toEqual(playing(22));
    expect(advance(playing(0, 96), 0.03, 384).hour).toBeCloseTo(2.88);
  });

  test('advance leaves a paused clock alone', () => {
    const paused: Clock = { hour: 5, playing: false, hoursPerSecond: 24 };
    expect(advance(paused, 1, 384)).toBe(paused);
  });

  test('advance stops and pauses at the horizon', () => {
    expect(advance(playing(380), 1, 384)).toEqual({ hour: 384, playing: false, hoursPerSecond: 24 });
    expect(advance(playing(384), 0.01, 384)).toEqual({ hour: 384, playing: false, hoursPerSecond: 24 });
  });

  test('scrub clamps to the horizon', () => {
    expect(scrubTo(-5, 336)).toBe(0);
    expect(scrubTo(346, 336)).toBe(336);
    expect(scrubTo(12.6, 336)).toBe(13);
  });

  test('speeds are hours per second, default 24', () => {
    expect(SPEEDS).toEqual([12, 24, 48, 96]);
    expect(initialAppState().clock.hoursPerSecond).toBe(24);
  });
});
