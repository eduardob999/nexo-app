import { describe, expect, it } from 'vitest';
import { optionRows } from './tripOptions';

const o = (leave: string, extra = {}) => ({ leave, arrive: '18:00', txt: 'Keihan', ...extra });

describe('train options on a ticket', () => {
  it('marks the ones before the planned train earlier and the ones after later', () => {
    const rows = optionRows([o('16:31'), o('16:43'), o('16:56', { pick: true }), o('17:07'), o('17:18')]);
    expect(rows.map((r) => r.kind)).toEqual(['early', 'early', 'pick', 'later', 'later']);
  });
  it('shows nothing when the card has none', () => {
    expect(optionRows(undefined)).toEqual([]);
    expect(optionRows([])).toEqual([]);
  });
  it('treats every row as plain when none is planned, and skips rows without times', () => {
    const rows = optionRows([o('16:31'), { leave: '', arrive: '' }, o('16:43')]);
    expect(rows.map((r) => r.kind)).toEqual(['plain', 'plain']);
  });
  it('keeps the late flag', () => {
    expect(optionRows([o('17:18', { pick: true }), o('17:32', { late: true })])[1]!.late).toBe(true);
  });
});
