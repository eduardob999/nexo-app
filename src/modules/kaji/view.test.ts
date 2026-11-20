import { describe, expect, it } from 'vitest';
import type { LogEvent, PlannedItem } from './model';
import { groupByDay, isDone, memberColor, recentDone, todayFor } from './view';
import { DAY, MIN } from './time';

const NOW = Date.parse('2026-11-20T18:00:00+09:00');
const it_ = (id: string, taskId: string, uid: string, startMin: number): PlannedItem => ({ id, taskId, uid, start: NOW + startMin * MIN, end: NOW + (startMin + 20) * MIN });
const done = (taskId: string, at: number): LogEvent => ({ id: 'l' + at, taskId, uid: 'a', kind: 'done', at, minutes: 10, planned: true });

describe('view helpers', () => {
  it("lists one person's chores for today in time order and hides finished ones", () => {
    const items = [it_('3', 'poceta', 'a', 120), it_('1', 'basura', 'a', 30), it_('2', 'platos', 'b', 60), it_('4', 'cena', 'a', 24 * 60)];
    expect(todayFor(items, 'a', [], NOW).map((i) => i.id)).toEqual(['1', '3']);
    expect(todayFor(items, 'a', [done('basura', NOW - 10 * MIN)], NOW).map((i) => i.id)).toEqual(['3']);
  });
  it('does not count an old log entry as finishing a later chore', () => {
    expect(isDone(it_('1', 'basura', 'a', 30), [done('basura', NOW - DAY)], NOW)).toBe(false);
  });
  it('groups by local day', () => {
    const g = groupByDay([it_('1', 'x', 'a', 30), it_('2', 'x', 'a', 24 * 60 + 30), it_('3', 'x', 'b', 45)]);
    expect(g.map((x) => [x.day, x.items.length])).toEqual([['2026-11-20', 2], ['2026-11-21', 1]]);
  });
  it('lists what she finished in the last two days, newest first, and whether it was rated', () => {
    const log = [{ ...done('a', NOW - 3 * 3600_000), id: 'e1' }, { ...done('b', NOW - MIN), id: 'e2', effort: 3 }, { ...done('c', NOW - 3 * DAY), id: 'e3' }, { ...done('d', NOW - 5 * 3600_000), id: 'e4', note: 'tired' }, { ...done('e', NOW - 2 * 3600_000), id: 'e5', uid: 'b' }];
    const got = recentDone(log, 'a', NOW);
    expect(got.map((g) => g.event.id)).toEqual(['e2', 'e1', 'e4']);
    expect(got.map((g) => g.rated)).toEqual([true, false, true]);
  });
  it('gives each member a different colour', () => {
    expect(memberColor(0)).not.toBe(memberColor(1));
  });
});
