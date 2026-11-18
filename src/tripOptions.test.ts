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

import { chosen, effective, optionId, stepLines } from './tripOptions';
import type { PlanSide, TrainOption } from './types';

const itin = (id: string, start: string, board: string, arrive: string, extra: Partial<TrainOption> = {}): TrainOption => ({
  id, leave: start, start, arrive, txt: 'Keihan', ...extra,
  steps: [
    { kind: 'bike', from: 'Uji campus, lab', to: '黄檗', start, end: board, min: 10, txt: 'Bike from the lab to 黄檗 and park' },
    { kind: 'train', from: '黄檗', to: '中書島', board, alight: '17:07', line: '京阪宇治線', toward: '中書島', platform: '1' },
    { kind: 'change', at: '中書島', wait_min: 4, from_platform: '1', to_platform: null },
    { kind: 'train', from: '中書島', to: '祇園四条', board: '17:11', alight: arrive, line: '京阪本線 特急', toward: '出町柳', platform: null },
  ],
});
const side: PlanSide = { options: [itin('a', '16:38', '16:48', '17:23'), itin('b', '16:49', '16:59', '17:25', { pick: true }), itin('c', '17:01', '17:11', '17:39')] };

describe('choosing a journey', () => {
  it('draws from the planned one until he picks another', () => {
    expect(effective(side)!.option.id).toBe('b');
    expect(chosen({ ...side, selected: 'c' })!.id).toBe('c');
  });
  it('falls back to the planned one when the chosen id is unknown or cleared', () => {
    expect(chosen({ ...side, selected: 'zz' })!.id).toBe('b');
    expect(chosen(side, '')!.id).toBe('b');
  });
  it('every headline time follows the chosen journey', () => {
    const before = effective(side)!;
    const after = effective(side, 'a')!;
    expect([before.start, before.board, before.arrive]).toEqual(['16:49', '16:59', '17:25']);
    expect([after.start, after.board, after.arrive]).toEqual(['16:38', '16:48', '17:23']);
    expect(after.startLabel).toBe('Leave the lab');
  });
  it('flags the chosen row and keeps earlier and later relative to the planned one', () => {
    const rows = optionRows(side.options, 'c');
    expect(rows.map((r) => r.selected)).toEqual([false, false, true]);
    expect(rows.map((r) => r.kind)).toEqual(['early', 'pick', 'later']);
  });
  it('lists every step with a label and shows a platform only when there is one', () => {
    const lines = stepLines(effective(side)!);
    expect(lines.map((l) => `${l.label} ${l.time}`)).toEqual(['Start 16:49', 'Board 16:59', 'Change ', 'Board 17:11', 'Arrive 17:25']);
    expect(lines[1]!.sub).toContain('platform 1');
    expect(lines[2]!.sub).toBe('4 min · platform 1 to ?');
    expect(lines[3]!.sub).not.toContain('platform');
  });
  it('uses leave-arrive as the id when an option has none, and keeps old plans without steps', () => {
    const old: TrainOption = { leave: '08:43', arrive: '09:13', pick: true };
    expect(optionId(old)).toBe('08:43-09:13');
    const h = effective({ options: [old] })!;
    expect(h.steps).toEqual([]);
    expect(h.startLabel).toBe('Start');
    expect(h.start).toBe('08:43');
  });
});
