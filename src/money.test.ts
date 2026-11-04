import { describe, expect, it } from 'vitest';
import { allocMonth, earlierMonths, jstMonth, needsSeed, summarise, yen } from './money';
import type { Alloc } from './types';

const a = (id: string, amount: number, done: boolean, extra: Partial<Alloc> = {}): Alloc => ({ id, label: id, amount, done, ...extra });

describe('money helpers', () => {
  it('puts a line with no month in the month of its timestamp, in Japan', () => {
    expect(allocMonth(a('x', 1, false, { ts: '2026-09-30T20:00:00Z' }))).toBe('2026-10');   // 05:00 on 1 Oct in Tokyo
    expect(allocMonth(a('y', 1, false, { month: '2026-11', ts: '2026-09-01T00:00:00Z' }))).toBe('2026-11');
    expect(jstMonth(new Date('2026-10-31T16:00:00Z'))).toBe('2026-11');
  });
  it('sums a month and what is left', () => {
    const s = summarise([a('1', 100, true, { month: '2026-11' }), a('2', 250, false, { month: '2026-11' }), a('3', 999, false, { month: '2026-10' })], '2026-11');
    expect(s).toMatchObject({ total: 350, left: 250, doneCount: 1 });
    expect(s.lines).toHaveLength(2);
  });
  it('asks for a seed only when the month is empty and an earlier one is not', () => {
    const old = [a('1', 1, true, { month: '2026-10' })];
    expect(needsSeed(old, '2026-11')).toBe(true);
    expect(needsSeed([...old, a('2', 1, false, { month: '2026-11' })], '2026-11')).toBe(false);
    expect(needsSeed([], '2026-11')).toBe(false);
  });
  it('lists earlier months newest first and formats yen', () => {
    expect(earlierMonths([a('1', 1, true, { month: '2026-09' }), a('2', 1, true, { month: '2026-10' }), a('3', 1, true, { month: '2026-11' })], '2026-11').map((m) => m.month)).toEqual(['2026-10', '2026-09']);
    expect(yen(35000)).toBe('¥35,000');
  });
});
