import { describe, expect, it } from 'vitest';
import { clockText, elapsedMin, recentAnswers } from './timer';
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
});
