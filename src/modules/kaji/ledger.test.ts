import { describe, expect, it } from 'vitest';
import { balances, monthTotals, parseYen, settleUp, yen, type LedgerEntry } from './ledger';

const M = [{ uid: 'a' }, { uid: 'b' }];
const e = (id: string, paidBy: string, amount: number, extra: Partial<LedgerEntry> = {}): LedgerEntry => ({ id, at: Date.parse('2026-11-10T12:00:00+09:00'), by: paidBy, paidBy, amount, text: id, kind: 'expense', ...extra });

describe('ledger balances', () => {
  it('splits an expense equally by default', () => {
    const n = balances([e('x', 'a', 3000)], M);
    expect(n.a).toBeCloseTo(1500);
    expect(n.b).toBeCloseTo(-1500);
  });
  it('sums to zero and follows who paid', () => {
    const n = balances([e('x', 'a', 3000), e('y', 'b', 1000), e('z', 'b', 700)], M);
    expect(n.a! + n.b!).toBeCloseTo(0);
    expect(n.a).toBeCloseTo(650);                        // a paid 3000 and owes 1850 of 3700 in total; b paid 1700 and owes 1850: a is owed 650
  });
  it('lets one person pay for the other alone', () => {
    const n = balances([e('x', 'b', 2000, { split: { a: 1 } })], M);     // she paid, it was all his
    expect(n.b).toBeCloseTo(2000);
    expect(n.a).toBeCloseTo(-2000);
  });
  it('treats a settlement as paying back', () => {
    const n = balances([e('x', 'a', 3000), e('s', 'b', 1500, { kind: 'settle', split: { a: 1 } })], M);
    expect(n.a).toBeCloseTo(0);
    expect(n.b).toBeCloseTo(0);
    expect(settleUp(n)).toBeNull();
  });
  it('ignores zero, negative and unknown-payer entries', () => {
    expect(balances([e('x', 'a', 0), e('y', 'a', -5), e('z', 'ghost', 100)], M)).toEqual({ a: 0, b: 0 });
  });
  it('suggests who pays whom, to the whole yen', () => {
    expect(settleUp(balances([e('x', 'a', 3001)], M))).toEqual({ from: 'b', to: 'a', amount: 1501 });
    expect(settleUp({ a: 0.3, b: -0.3 })).toBeNull();
  });
});

describe('totals and parsing', () => {
  it('totals a month and leaves settlements out', () => {
    const t = monthTotals([e('x', 'a', 3000), e('y', 'b', 1000), e('s', 'a', 500, { kind: 'settle' }), e('old', 'a', 99, { at: Date.parse('2026-10-31T12:00:00+09:00') })], '2026-11');
    expect(t).toEqual({ total: 4000, byPayer: { a: 3000, b: 1000 } });
  });
  it('reads amounts the way people type them', () => {
    expect(['1,200', '¥1200', '1200円', '1 200', '１２００'].map(parseYen)).toEqual([1200, 1200, 1200, 1200, 1200]);
    expect(['', '0', 'abc', '12.5', '-5'].map(parseYen)).toEqual([0, 0, 0, 0, 0]);
    expect(yen(12345.4)).toBe('¥12,345');
  });
});
