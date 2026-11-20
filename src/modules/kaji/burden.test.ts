import { describe, expect, it } from 'vitest';
import { SEED } from './catalog';
import { balance, burdenOf, weightOf } from './burden';
import { DEFAULT_SETTINGS as S, type Estimate, type LogEvent, type Member } from './model';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 20, 12);
const A: Member = { uid: 'a', name: 'A', lang: 'en', role: 'owner' };
const B: Member = { uid: 'b', name: 'B', lang: 'es', role: 'member' };
const task = (id: string) => SEED.find((t) => t.id === id)!;
const est = (n: number, mean: number, dislike: Record<string, number>, difficulty = 1): Estimate => ({ n, meanMin: mean, varMin: 0, difficulty, dislike, stableSince: n });
const ev = (id: string, taskId: string, uid: string, minutes: number, daysAgo = 1, extra: Partial<LogEvent> = {}): LogEvent =>
  ({ id, taskId, uid, kind: 'done', at: NOW - daysAgo * DAY, minutes, planned: true, ...extra });

describe('weight and burden', () => {
  it('counts a fixed chore at its planned length and a measured one at what was learned', () => {
    expect(weightOf(task('cena'))).toBeCloseTo(4.5);
    expect(weightOf(task('aspirar'))).toBeCloseTo(2);
    expect(weightOf(task('aspirar'), est(6, 30, {}))).toBeCloseTo(3);
    expect(weightOf(task('aspirar'), est(6, 30, {}, 1.5))).toBeCloseTo(4.5);
  });
  it('makes a chore someone hates cost them up to 1.6 times its weight', () => {
    expect(burdenOf(10, 5, S)).toBeCloseTo(16);
    expect(burdenOf(10, 1, S)).toBeCloseTo(8);
    expect(burdenOf(10, 3, S)).toBeCloseTo(12);
  });
});

describe('balance', () => {
  const tasks = SEED;
  it('is perfectly even when both did the same work and mind it the same', () => {
    const log = [ev('1', 'aspirar', 'a', 20), ev('2', 'aspirar', 'b', 20)];
    const b = balance(log, tasks, {}, [A, B], NOW, S);
    expect(b.evenness).toBeCloseTo(1);
    expect(b.diff.a).toBeCloseTo(0);
  });
  it('shows who is ahead, and counts what someone minds more as more burden', () => {
    const estimates = { poceta: est(5, 10, { a: 5, b: 1 }) };
    const log = [ev('1', 'poceta', 'a', 10), ev('2', 'poceta', 'b', 10)];
    const b = balance(log, tasks, estimates, [A, B], NOW, S);
    expect(b.perUid.a!.burden).toBeGreaterThan(b.perUid.b!.burden);
    expect(b.diff.a).toBeGreaterThan(0);
    expect(b.evenness).toBeLessThan(1);
    expect(b.perUid.b!.credit).toBeGreaterThan(0);   // B did a chore A minds more
  });
  it('ignores events outside the window and skipped ones', () => {
    const log = [ev('1', 'aspirar', 'a', 20, 40), ev('2', 'aspirar', 'b', 20, 1, { kind: 'skipped' })];
    expect(balance(log, tasks, {}, [A, B], NOW, S).total).toBe(0);
  });
  it('splits a shared chore by the minutes each did', () => {
    const log = [ev('1', 'aspirar', 'a', 20, 1, { split: [{ uid: 'a', minutes: 15 }, { uid: 'b', minutes: 5 }] })];
    const b = balance(log, tasks, {}, [A, B], NOW, S);
    expect(b.perUid.a!.weight).toBeCloseTo(1.5);
    expect(b.perUid.b!.weight).toBeCloseTo(0.5);
  });
  it('lowers a target for days away so time away is not a debt', () => {
    const log = [ev('1', 'aspirar', 'a', 20)];
    const b = balance(log, tasks, {}, [A, B], NOW, S, { b: 14 });
    expect(b.target.b).toBeLessThan(0.5);
    expect(Object.values(b.target).reduce((x, y) => x + y, 0)).toBeCloseTo(1);
  });
});
