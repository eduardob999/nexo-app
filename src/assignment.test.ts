import { describe, expect, it } from 'vitest';
import { assignmentHeat, pressing, workHours } from './assignment';
import type { Card } from './types';

const card = (o: Partial<Card>): Card => ({ id: 'a', status: 'open', for: 'you', type: 'ASSIGNMENT', ...o } as Card);
const at = (s: string) => new Date(`${s}+09:00`);

describe('assignmentHeat', () => {
  it('guesses the work from the words and lets workHours override', () => {
    expect(workHours(card({ title: 'Write the report' }))).toBe(6);
    expect(workHours(card({ title: 'L21 文型・練習' }))).toBe(2);
    expect(workHours(card({ title: 'Something' }))).toBe(3);
    expect(workHours(card({ title: 'Write the report', workHours: 12 }))).toBe(12);
  });
  it('a long report heats up days before a short exercise does', () => {
    const now = at('2026-11-08T08:00:00'); // 57 h before Tue 17:00
    expect(assignmentHeat(card({ title: 'Write the report', due: '2026-11-10T17:00:00+09:00' }), now)?.level).toBe('watch');
    expect(assignmentHeat(card({ title: 'Homework', due: '2026-11-10T17:00:00+09:00' }), now)?.level).toBe('calm');
  });
  it('goes soon, critical and overdue as the time runs out', () => {
    const c = card({ title: 'Homework', due: '2026-11-09T23:59:00+09:00' });
    expect(assignmentHeat(c, at('2026-11-09T14:00:00'))?.level).toBe('soon');
    expect(assignmentHeat(c, at('2026-11-09T21:30:00'))?.level).toBe('critical');
    expect(assignmentHeat(c, at('2026-11-10T00:30:00'))?.level).toBe('overdue');
  });
  it('says how long is left', () => {
    const c = card({ title: 'Homework', due: '2026-11-09T23:59:00+09:00' });
    expect(assignmentHeat(c, at('2026-11-09T19:59:00'))?.label).toBe('4 h left');
    expect(assignmentHeat(c, at('2026-11-09T23:29:00'))?.label).toBe('30 min left');
  });
  it('ignores a finished card or one with no date', () => {
    expect(assignmentHeat(card({ status: 'done', due: '2026-11-09' }), at('2026-11-09T12:00:00'))).toBeNull();
    expect(assignmentHeat(card({}), at('2026-11-09T12:00:00'))).toBeNull();
  });
  it('pins only the tightest ones, worst first', () => {
    const now = at('2026-11-09T21:00:00');
    const list = pressing([
      card({ id: 'far', title: 'Homework', due: '2026-11-20' }),
      card({ id: 'late', title: 'Homework', due: '2026-11-09T20:00:00+09:00' }),
      card({ id: 'tight', title: 'Homework', due: '2026-11-09T23:59:00+09:00' }),
    ], now);
    expect(list.map((x) => x.card.id)).toEqual(['late', 'tight']);
  });
});
