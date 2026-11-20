import { describe, expect, it } from 'vitest';
import { SEED } from './catalog';
import { askRates, dataQuestions, drifted, estimateFor, maturity, shouldAsk } from './adapt';
import { DEFAULT_SETTINGS as S, type LogEvent, type Member } from './model';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 20, 12);
const A: Member = { uid: 'a', name: 'A', lang: 'en', role: 'owner' };
const B: Member = { uid: 'b', name: 'B', lang: 'es', role: 'member' };
const asp = SEED.find((t) => t.id === 'aspirar')!;
const series = (mins: number[], startDaysAgo: number, extra: Partial<LogEvent> = {}): LogEvent[] =>
  mins.map((m, i) => ({ id: 'e' + startDaysAgo + i, taskId: 'aspirar', uid: i % 2 ? 'b' : 'a', kind: 'done' as const, at: NOW - (startDaysAgo - i * 3) * DAY, minutes: m, planned: true, ...extra }));

describe('estimates', () => {
  it('starts from the prior and the survey, then follows the data', () => {
    const e0 = estimateFor(asp, [], { a: { aspirar: 2 }, b: { aspirar: 5 } }, [A, B]);
    expect(e0.n).toBe(0);
    expect(e0.meanMin).toBe(20);
    expect(e0.dislike).toEqual({ a: 2, b: 5 });
    const e1 = estimateFor(asp, series([18, 22, 20, 20], 20), {}, [A, B]);
    expect(e1.n).toBe(4);
    expect(e1.meanMin).toBeCloseTo(20);
    expect(e1.varMin).toBeGreaterThan(0);
    expect(e1.dislike.a).toBe(3);
  });
  it('mixes the survey with ratings, the survey counting twice', () => {
    const log = series([20, 20, 20], 12, { dislike: 5 }).map((e) => ({ ...e, uid: 'a' }));
    const e = estimateFor(asp, log, { a: { aspirar: 1 } }, [A, B]);
    expect(e.dislike.a).toBeCloseTo((1 * 2 + 15) / 5);
  });
  it('raises difficulty when effort ratings are high, after three of them', () => {
    expect(estimateFor(asp, series([20, 20], 6, { effort: 5 }), {}, [A, B]).difficulty).toBe(1);
    expect(estimateFor(asp, series([20, 20, 20], 9, { effort: 5 }), {}, [A, B]).difficulty).toBe(1.6);
  });
});

describe('maturity and asking less', () => {
  it('moves from new to settled and asks less and less', () => {
    const early = series([20, 21], 6);
    expect(maturity(estimateFor(asp, early, {}, [A, B]), asp, early, NOW)).toBe('new');
    const steady = series([20, 21, 19, 20, 20, 21, 20], 21);
    const e = estimateFor(asp, steady, {}, [A, B]);
    expect(maturity(e, asp, steady, NOW)).toBe('settled');
    expect(askRates('new', false, asp, S)).toEqual({ timer: 1, rating: 1 });
    expect(askRates('stable', false, asp, S).timer).toBe(0.25);
    expect(askRates('settled', false, asp, S).timer).toBe(S.askFloor);
  });
  it('never asks a fixed chore for a timer', () => {
    const cena = SEED.find((t) => t.id === 'cena')!;
    expect(askRates('new', false, cena, S).timer).toBe(0);
    expect(askRates('new', true, cena, S).timer).toBe(0);
  });
  it('asks again when a chore changes by a quarter', () => {
    const log = series([20, 20, 21, 19, 20, 20, 20, 20], 26).concat(series([30, 31, 29, 30], 9).map((e, i) => ({ ...e, id: 'x' + i, at: NOW - (3 - i) * DAY })));
    expect(drifted(log, 'aspirar')).toBe(true);
    expect(drifted(series([20, 20, 21, 19, 20, 20, 20, 20], 26), 'aspirar')).toBe(false);
    expect(askRates('settled', true, asp, S)).toEqual({ timer: 1, rating: 1 });
  });
  it('shouldAsk is certain at 1, never at 0, random between', () => {
    expect(shouldAsk(1, () => 0.99)).toBe(true);
    expect(shouldAsk(0, () => 0)).toBe(false);
    expect(shouldAsk(0.25, () => 0.1)).toBe(true);
    expect(shouldAsk(0.25, () => 0.5)).toBe(false);
  });
  it('counts the data questions answered in the last week', () => {
    const log = [...series([20, 20], 5, { dislike: 3 }), ...series([20, 20], 30, { dislike: 3 })];
    expect(dataQuestions(log, NOW)).toBe(2);
  });
});
