import { describe, expect, it } from 'vitest';
import { DISH_WINDOWS, migrateTasks, SEED } from './catalog';
import { DEFAULT_SETTINGS as S, type LogEvent, type PlannedItem } from './model';
import { plan, type PlanInput } from './planner';
import { applyLearned, learnRate, learnShifts, reasonValid, rescheduleOptions, skipsFromLog, windowOffset } from './reschedule';
import { atHm, dayKey, dayStart, DAY, MIN } from './time';

const NOW = Date.parse('2026-11-21T10:00:00+09:00');   // a Saturday
const day = (n: number) => dayStart(NOW) + n * DAY;
const A = { uid: 'a', name: 'A', lang: 'en' as const, role: 'owner' as const };
const B = { uid: 'b', name: 'B', lang: 'en' as const, role: 'member' as const };
const input = (over: Partial<PlanInput> = {}): PlanInput => ({ now: NOW, horizonDays: 7, tasks: SEED, members: [A, B], estimates: {}, log: [], busy: { a: [], b: [] }, existing: [], settings: S, ...over });
let n = 0;
const mv = (taskId: string, plannedHm: string, newHm: string, daysAgo = 3, extra: Partial<LogEvent> = {}): LogEvent => ({
  id: 'm' + n++, taskId, uid: 'a', kind: 'rescheduled', at: NOW - daysAgo * DAY, minutes: 0, planned: true,
  plannedStart: atHm(day(-daysAgo), plannedHm), newStart: atHm(day(-daysAgo), newHm), ...extra,
});
const dis = (taskId: string, reason: NonNullable<LogEvent['reason']>, plannedStart: number, at = NOW): LogEvent => ({ id: 'd' + n++, taskId, uid: 'a', kind: 'dismissed', at, minutes: 0, planned: true, plannedStart, reason });
const item = (taskId: string, start: number, mins = 5): PlannedItem => ({ id: taskId + start, taskId, uid: 'a', start, end: start + mins * MIN });

describe('dismiss reasons', () => {
  it('needs a preset, or other with words', () => {
    expect(reasonValid(null, '')).toBe(false);
    expect(reasonValid(null, 'because')).toBe(false);
    expect(reasonValid('not_needed', '')).toBe(true);
    expect(reasonValid('other', '  ')).toBe(false);
    expect(reasonValid('other', 'guests came')).toBe(true);
  });
});

describe('reschedule options', () => {
  it('offers later today two hours on, this evening and tomorrow, all on the quarter hour', () => {
    const o = rescheduleOptions(item('basura', atHm(day(0), '10:00')), NOW, S);
    expect(o.map((x) => x.id)).toEqual(['later', 'evening', 'tomorrow']);
    expect(o[0]!.start).toBe(atHm(day(0), '12:00'));
    expect(o[1]!.start).toBe(atHm(day(0), '19:00'));
    expect(o[2]!.start).toBe(atHm(day(1), '10:00'));
    for (const x of o) expect(x.start % (15 * MIN)).toBe(0);
  });
  it('drops today choices that would run into the quiet hours, but always keeps tomorrow', () => {
    const late = Date.parse('2026-11-21T21:00:00+09:00');
    const o = rescheduleOptions(item('basura', late), late, S);
    expect(o.map((x) => x.id)).toEqual(['tomorrow']);
  });
});

describe('what the planner may not place again', () => {
  it('a dismissal cancels that day only, a move to the same day cancels nothing, a move to another day cancels the original day', () => {
    const t0 = atHm(day(0), '14:00');
    const log = [dis('basura', 'not_needed', t0), mv('x', '10:00', '11:00', 0, { taskId: 'basura', plannedStart: t0, newStart: t0 + 2 * 3_600_000 }), mv('y', '10:00', '11:00', 0, { taskId: 'poceta', plannedStart: t0, newStart: t0 + DAY })];
    expect(skipsFromLog(log, NOW).map((s) => [s.taskId, s.reason])).toEqual([['basura', 'not_needed'], ['poceta', 'moved']]);
  });
  it('ignores yesterday and earlier', () => {
    expect(skipsFromLog([dis('basura', 'no_time', atHm(day(-1), '14:00'))], NOW)).toEqual([]);
  });
});

describe('dishes three times a day', () => {
  it('plans one wash in each of the three windows, every day', () => {
    const out = plan(input({ now: Date.parse('2026-11-21T06:00:00+09:00') }));
    const d1 = out.items.filter((i) => i.taskId === 'platos' && dayKey(i.start) === dayKey(day(1)));
    expect(d1).toHaveLength(3);
    const wins = DISH_WINDOWS.map((w) => [atHm(day(1), w.from), atHm(day(1), w.to)]);
    d1.sort((a, b) => a.start - b.start).forEach((i, k) => { expect(i.start >= wins[k]![0]!).toBe(true); expect(i.end <= wins[k]![1]!).toBe(true); });
  });
  it('plans only the windows still ahead once one has been done', () => {
    const done: LogEvent = { id: 'z', taskId: 'platos', uid: 'a', kind: 'done', at: Date.parse('2026-11-21T09:00:00+09:00'), minutes: 8, planned: true };
    const out = plan(input({ log: [done] }));
    expect(out.items.filter((i) => i.taskId === 'platos' && dayKey(i.start) === dayKey(day(0)))).toHaveLength(2);
  });
  it('a pinned one holds one window, not all three', () => {
    const pinned: PlannedItem = { id: 'p', taskId: 'platos', uid: 'a', start: atHm(day(1), '20:00'), end: atHm(day(1), '20:10'), pinned: true };
    const out = plan(input({ existing: [pinned] }));
    expect(out.items.filter((i) => i.taskId === 'platos' && dayKey(i.start) === dayKey(day(1)))).toHaveLength(3);
  });
  it('a dismissed wash is not placed again that day, and the others stay', () => {
    const lunch = atHm(day(0), '13:30');
    const out = plan(input({ log: [dis('platos', 'not_enough', lunch)] }));
    const today = out.items.filter((i) => i.taskId === 'platos' && dayKey(i.start) === dayKey(day(0)));
    expect(today.some((i) => i.start >= atHm(day(0), '13:00') && i.start < atHm(day(0), '16:00'))).toBe(false);
    expect(today).toHaveLength(2);       // it is 10:00: the morning and the dinner washes remain
    expect(today.some((i) => i.start >= atHm(day(0), '19:30'))).toBe(true);
  });
  it('a chore moved to tomorrow is not placed again today', () => {
    const t0 = atHm(day(0), '19:00');
    const log = [mv('x', '19:00', '19:00', 0, { taskId: 'basura', plannedStart: t0, newStart: t0 + DAY })];
    const out = plan(input({ log, existing: [{ id: 'b', taskId: 'basura', uid: 'a', start: t0 + DAY, end: t0 + DAY + 5 * MIN, pinned: true }] }));
    const b = out.items.filter((i) => i.taskId === 'basura');
    expect(b.filter((i) => dayKey(i.start) === dayKey(day(0)))).toHaveLength(0);
    expect(b.filter((i) => dayKey(i.start) === dayKey(day(1)))).toHaveLength(1);       // the pinned one stands in for tomorrow's own
  });
});

describe('stored dishes', () => {
  it('moves the old seed to three a day and leaves an edited chore alone', () => {
    const old = { ...SEED.find((x) => x.id === 'platos')!, freq: { times: 1, perDays: 1 }, window: { from: '19:30', to: '22:00' }, priorMinutes: 15 };
    delete (old as { windows?: unknown }).windows;
    const [m] = migrateTasks([old]);
    expect(m!.freq).toEqual({ times: 3, perDays: 1 });
    expect(m!.windows).toEqual(DISH_WINDOWS);
    expect(m!.window).toBeUndefined();
    const edited = { ...old, window: { from: '20:00', to: '22:00' } };
    expect(migrateTasks([edited])[0]).toBe(edited);
    expect(migrateTasks(SEED).every((x, i) => x === SEED[i])).toBe(true);
  });
});

describe('learning from moves', () => {
  it('learns nothing from one move, and moves the window by a share of the next agreeing ones', () => {
    expect(windowOffset([90]).offset).toBe(0);
    const two = windowOffset([90, 90]).offset;
    expect(two).toBeGreaterThan(0);
    expect(two).toBeLessThan(90);
    expect(windowOffset([90, 90, -90, 60, 60]).offset).not.toBe(windowOffset([90, 90]).offset);
  });
  it('steps shrink as samples grow, within a cap', () => {
    expect(learnRate(1)).toBeGreaterThan(learnRate(4));
    expect(learnRate(1000)).toBeGreaterThanOrEqual(0.1);
    expect(windowOffset(Array(200).fill(120)).offset).toBeLessThanOrEqual(180);
  });
  it('ignores a move to the same clock time on another day and tiny moves', () => {
    const log = [mv('basura', '19:00', '19:10'), mv('basura', '19:00', '19:10', 4), mv('basura', '19:00', '19:00', 5, { newStart: atHm(day(-4), '19:00') + DAY })];
    expect(learnShifts(SEED, log, NOW)).toEqual([]);
  });
  it('shifts the window of a chore moved later again and again, and reports it for the history', () => {
    const log = [mv('basura', '15:00', '17:00', 6), mv('basura', '15:00', '17:00', 4), mv('basura', '15:00', '17:00', 2)];
    const s = learnShifts(SEED, log, NOW);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ taskId: 'basura', kind: 'window', n: 3 });
    expect(s[0]!.value).toBeGreaterThan(0);
    expect(s[0]!.value % 15).toBe(0);
    const eff = applyLearned(SEED, log, NOW, S).find((x) => x.id === 'basura')!;
    expect(eff.window!.from > '08:00').toBe(true);
    expect(SEED.find((x) => x.id === 'basura')!.window!.from).toBe('08:00');       // the stored chore is untouched
  });
  it('shifts every window of a chore that has one per occurrence', () => {
    const log = [mv('platos', '19:30', '21:00', 6), mv('platos', '19:30', '21:00', 3)];
    const eff = applyLearned(SEED, log, NOW, S).find((x) => x.id === 'platos')!;
    expect(eff.windows).toHaveLength(3);
    expect(eff.windows![0]!.from > '08:00').toBe(true);
    expect(eff.windows![2]!.from > '19:30').toBe(true);
  });
  it('forgets moves older than sixty days', () => {
    expect(learnShifts(SEED, [mv('basura', '15:00', '17:00', 70), mv('basura', '15:00', '17:00', 65)], NOW)).toEqual([]);
  });
  it('treats repeated "no time" dismissals as a push later', () => {
    const log = [dis('basura', 'no_time', atHm(day(-4), '10:00'), NOW - 4 * DAY), dis('basura', 'no_time', atHm(day(-2), '10:00'), NOW - 2 * DAY)];
    expect(learnShifts(SEED, log, NOW)[0]).toMatchObject({ kind: 'window' });
  });
  it('stretches the gap of a chore dismissed as not needed, cautiously and not on one sample', () => {
    const one = [dis('basura', 'not_enough', atHm(day(-1), '19:00'), NOW - DAY)];
    expect(learnShifts(SEED, one, NOW).some((s) => s.kind === 'freq')).toBe(false);
    const many = [1, 2, 3, 4].map((d) => dis('basura', 'not_enough', atHm(day(-d), '19:00'), NOW - d * DAY));
    const f = learnShifts(SEED, many, NOW).find((s) => s.kind === 'freq')!;
    expect(f.value).toBeGreaterThan(1.05);
    expect(f.value).toBeLessThanOrEqual(2);
    expect(applyLearned(SEED, many, NOW, S).find((x) => x.id === 'basura')!.freq.perDays).toBeCloseTo(f.value);
  });
  it('does not stretch a chore that is still being done', () => {
    const done: LogEvent[] = Array.from({ length: 25 }, (_, i) => ({ id: 'q' + i, taskId: 'basura', uid: 'a', kind: 'done', at: NOW - (i + 1) * 0.9 * DAY, minutes: 5, planned: true }));
    const some = [dis('basura', 'not_needed', atHm(day(-1), '19:00'), NOW - DAY), dis('basura', 'not_needed', atHm(day(-3), '19:00'), NOW - 3 * DAY)];
    const f = learnShifts(SEED, [...done, ...some], NOW).find((s) => s.kind === 'freq');
    expect(f === undefined || f.value < 1.15).toBe(true);
  });
});
