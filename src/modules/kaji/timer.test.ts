import { describe, expect, it } from 'vitest';
import { clockText, elapsedMin, endAt, pauseTimer, recentAnswers, resumeTimer } from './timer';
import type { LogEvent } from './model';

const ev = (m: number, at: number): LogEvent => ({ id: String(at), taskId: 't', uid: 'a', kind: 'done', at, minutes: m, planned: true });

describe('timer', () => {
  it('rounds to whole minutes, at least one', () => {
    expect(elapsedMin(0, 20_000)).toBe(1);
    expect(elapsedMin(0, 14 * 60_000 + 40_000)).toBe(15);
  });
  it('shows m:ss and h:mm:ss', () => {
    expect(clockText(65_000)).toBe('1:05');
    expect(clockText(3_725_000)).toBe('1:02:05');
    expect(clockText(-5)).toBe('0:00');
  });
  it('offers the planned length and the last distinct durations, nearest first', () => {
    expect(recentAnswers([ev(20, 1), ev(25, 2), ev(20, 3), ev(10, 4)], 't', 20)).toEqual([20, 25, 10]);
    expect(recentAnswers([], 't', 15)).toEqual([15]);
  });
  it('a pause freezes the clock and the break is not counted after resuming', () => {
    const r = { taskId: 't', start: 1_000 };
    const p = pauseTimer(r, 61_000);
    expect(endAt(p, 999_999)).toBe(61_000);
    expect(pauseTimer(p, 90_000)).toBe(p);
    const back = resumeTimer(p, 361_000);
    expect(back.pausedAt).toBeUndefined();
    expect(endAt(back, 361_000) - back.start).toBe(60_000);
    expect(resumeTimer(r, 5)).toBe(r);
  });
});
