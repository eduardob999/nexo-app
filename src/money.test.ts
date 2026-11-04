import { describe, expect, it } from 'vitest';
import { allocMonth, earlierMonths, jstMonth, marketCounts, moneyItems, needsSeed, receiptMonths, summarise, topBars, yen } from './money';
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

describe('market and receipts', () => {
  it('counts logged purchases and when the last was', () => {
    const now = Date.parse('2026-11-04T12:00:00Z');
    const c = marketCounts([{ itemId: 'a', name: 'Rice', ts: '2026-11-04T09:00:00Z' }, { itemId: 'a', name: 'Rice', ts: '2026-11-01T09:00:00Z' }], now);
    expect(c.get('a')).toEqual({ n: 2, last: '3 h ago' });
  });
  it('charts named items and sets lump-sum trips aside, skipping tax', () => {
    const r = (id: string, amount: number, vendor: string) => ({ id, amount, cat: 'food', vendor, ts: '2026-10-01T00:00:00Z' });
    const d = moneyItems([r('1', 299, 'Shop (milk cocoa)'), r('2', 299, 'Shop (milk cocoa)'), r('3', 9000, 'Supermarket (total only)'), r('4', 30, 'Shop (tax)'), r('5', 100, 'Shop')]);
    expect(d.rows).toEqual([{ name: 'milk cocoa', n: 2, sum: 598 }]);
    expect(d.lump).toEqual({ n: 2, sum: 9100 });
    expect(topBars(d.rows, 'sum')[0]).toEqual({ name: 'milk cocoa', value: 598, pct: 100 });
  });
  it('groups receipts by month with category totals', () => {
    const r = (id: string, amount: number, cat: string, ts: string) => ({ id, amount, cat, vendor: '', ts });
    const m = receiptMonths([r('1', 100, 'food', '2026-10-05T00:00:00Z'), r('2', 300, 'supplies', '2026-10-06T00:00:00Z'), r('3', 50, 'food', '2026-09-30T00:00:00Z')]);
    expect(m.map((x) => x.month)).toEqual(['2026-10', '2026-09']);
    expect(m[0]).toMatchObject({ total: 400, cats: [{ cat: 'supplies', sum: 300 }, { cat: 'food', sum: 100 }] });
  });
});
