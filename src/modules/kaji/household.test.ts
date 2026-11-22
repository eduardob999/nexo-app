import { describe, expect, it } from 'vitest';
import { balance, weightOf } from './burden';
import { CARLA_UID, DISH_WINDOWS, RACK_WINDOW, SEED as REAL_SEED, migrateTasks } from './catalog';
import { backHome, goOut, isOut, mealsAtHome, presenceNow, type Presence } from './home';
import { karmaFor } from './karma';
import { DEFAULT_SETTINGS as S, type Interval, type LogEvent, type Member, type PlannedItem, type TaskType } from './model';
import { plan, planBreaks, type PlanInput } from './planner';
import { skipsFromLog } from './reschedule';
import { atHm, dayKey, dayStart, DAY, MIN } from './time';

/** The 2026-11-21 requests (cards nmwqfutv81rj, nmwqg4nn1ztp): rack next morning, a wash per meal, home or away, rebalancing, karma. */
const SEED = REAL_SEED.map((t) => (t.who ? { ...t, who: t.who.map((u) => (u === CARLA_UID ? 'b' : u)) } : t));
const A: Member = { uid: 'a', name: 'Eduardo', lang: 'en', role: 'owner' };
const B: Member = { uid: 'b', name: 'Carla', lang: 'en', role: 'member' };
const NOW = Date.parse('2026-11-20T12:00:00+09:00');   // a Friday, after lunch
const day = (n: number) => dayStart(NOW) + n * DAY;
const at = (n: number, hm: string) => atHm(day(n), hm);
const input = (over: Partial<PlanInput> = {}): PlanInput => ({ now: NOW, horizonDays: 7, tasks: SEED, members: [A, B], estimates: {}, log: [], busy: { a: [], b: [] }, existing: [], settings: S, ...over });
const on = (items: PlannedItem[], taskId: string, n: number) => items.filter((i) => i.taskId === taskId && dayKey(i.start) === dayKey(day(n)));
const away = (n: number, from: string, to: string): Interval => ({ start: at(n, from), end: at(n, to), place: 'away' });

describe('1. the dish rack is cleared the morning after the wash', () => {
  it('plans every rack clear inside the morning window, never in the evening, and only the day after a wash', () => {
    const out = plan(input());
    const racks = out.items.filter((i) => i.taskId === 'recoger');
    expect(racks.length).toBeGreaterThanOrEqual(5);
    for (const r of racks) {
      const d = dayStart(r.start);
      expect(r.start).toBeGreaterThanOrEqual(atHm(d, RACK_WINDOW.from));
      expect(r.end).toBeLessThanOrEqual(atHm(d, RACK_WINDOW.to));
      expect(out.items.some((p) => p.taskId === 'platos' && p.start >= d - DAY && p.start < d)).toBe(true);
    }
    expect(on(out.items, 'recoger', 0)).toEqual([]);     // today's morning window is over, and today's washes are cleared tomorrow
    expect(on(out.items, 'recoger', 1)).toHaveLength(1);
  });
  it('clears this morning for a wash logged last night, and not when nothing was washed', () => {
    const early = at(0, '06:30');
    const washed: LogEvent[] = [{ id: 'w', taskId: 'platos', uid: 'a', kind: 'done', at: at(-1, '21:00'), minutes: 12, planned: true }];
    expect(on(plan(input({ now: early, log: washed })).items, 'recoger', 0)).toHaveLength(1);
    expect(on(plan(input({ now: early })).items, 'recoger', 0)).toEqual([]);
  });
  it('brings a stored rack chore made by the old seed up to date, and leaves an edited one alone', () => {
    const old: TaskType = { ...(REAL_SEED.find((t) => t.id === 'recoger') as TaskType), freq: { times: 2, perDays: 1 }, window: undefined, morningAfter: undefined } as unknown as TaskType;
    delete (old as Partial<TaskType>).window; delete (old as Partial<TaskType>).morningAfter;
    const [m] = migrateTasks([old]);
    expect(m!.morningAfter).toBe('platos');
    expect(m!.freq.times).toBe(1);
    expect(m!.window).toEqual(RACK_WINDOW);
    const edited = { ...old, freq: { times: 1, perDays: 2 } };
    expect(migrateTasks([edited])[0]).toBe(edited);
  });
});

describe('2. dishes after each of the three meals', () => {
  it('plans three washes a day when both eat at home, one inside each window', () => {
    const out = plan(input());
    for (const n of [1, 2, 3]) {
      const w = on(out.items, 'platos', n);
      expect(w).toHaveLength(3);
      DISH_WINDOWS.forEach((win) => expect(w.some((i) => i.start >= at(n, win.from) && i.end <= at(n, win.to))).toBe(true));
    }
  });
  it('the old once-a-day wash is migrated to three, each tied to its meal', () => {
    const t = REAL_SEED.find((x) => x.id === 'platos') as TaskType;
    const { windows: _w, meals: _m, ...rest } = t;
    void _w; void _m;
    const old = { ...rest, freq: { times: 1, perDays: 1 }, window: { from: '19:30', to: '22:00' }, priorMinutes: 15 } as TaskType;
    const [m] = migrateTasks([old]);
    expect(m!.freq.times).toBe(3);
    expect(m!.meals).toEqual([0, 1, 2]);
  });
});

describe('3. home or away, and the meals eaten at home', () => {
  it('reads the calendars: an event away from home across a meal means that meal is eaten out', () => {
    const busy = { a: [away(1, '09:00', '18:00')], b: [] };
    const meals = mealsAtHome(day(1), [A, B], busy, {}, S);
    expect(meals.map((m) => m.home)).toEqual([['a', 'b'], ['b'], ['a', 'b']]);
  });
  it('plans no wash for a meal both eat out, and gives the wash of a meal one ate at home to that person when free', () => {
    const busy = { a: [away(1, '11:00', '14:00')], b: [away(1, '11:30', '13:30')] };
    const out = plan(input({ busy }));
    const w = on(out.items, 'platos', 1);
    expect(w).toHaveLength(2);
    expect(w.some((i) => i.start >= at(1, '13:00') && i.start < at(1, '16:00'))).toBe(false);
    const onlyB = plan(input({ busy: { a: [away(2, '11:00', '15:00')], b: [] } }));
    const lunch = on(onlyB.items, 'platos', 2).filter((i) => i.start >= at(2, '13:00') && i.start < at(2, '16:00'));
    expect(lunch.map((i) => i.uid)).toEqual(['b']);
  });
  it('Go out for both over dinner removes dinner, its wash, and nothing else that day', () => {
    const now = at(0, '17:00');
    const presence: Record<string, Presence> = { a: goOut(now, S), b: goOut(now, S) };
    const out = plan(input({ now, presence, awayUntil: { a: presence.a!.until, b: presence.b!.until } }));
    expect(on(out.items, 'cena', 0)).toEqual([]);
    expect(on(out.items, 'platos', 0)).toEqual([]);
    expect(on(out.items, 'platos', 1)).toHaveLength(3);
  });
  it('Back home ends the calendar outing it interrupted: the person is home and the meal is back', () => {
    const busy = { a: [away(0, '15:00', '22:00')], b: [away(0, '16:00', '22:00')] };
    const now = at(0, '17:00');
    expect(presenceNow(busy.a, undefined, now)).toMatchObject({ out: true, by: 'calendar', until: at(0, '22:00') });
    const presence = { a: backHome(now) };
    expect(presenceNow(busy.a, presence.a, now)).toMatchObject({ out: false });
    expect(isOut(busy.a, presence.a, at(0, '19:30'))).toBe(false);
    expect(mealsAtHome(day(0), [A, B], busy, presence, S)[2]!.home).toEqual(['a']);
    const out = plan(input({ now, busy, presence }));
    expect(on(out.items, 'cena', 0).map((i) => i.uid)).toEqual(['a']);
  });
  it('Go out reads as out until the assumed return, and a press for the other person works the same', () => {
    const p = goOut(NOW, S);
    expect(p.until - NOW).toBe((S.outDefaultMin as number) * MIN);
    expect(presenceNow([], p, NOW + 60 * MIN)).toMatchObject({ out: true, by: 'button', until: p.until });
    expect(presenceNow([], p, p.until + MIN).out).toBe(false);
  });
});

describe('4. the plan rebalances when it breaks', () => {
  it('a plan on file that gives everything to one person is moved toward the fair split, not kept', () => {
    const fresh = plan(input()).items;
    const lopsided = fresh.map((i) => ({ ...i, uid: SEED.find((t) => t.id === i.taskId)?.who?.length ? i.uid : 'a' }));
    expect(planBreaks(input({ existing: lopsided }))).toContain('balance');
    const out = plan(input({ existing: lopsided }));
    const share = (items: PlannedItem[], u: string) => items.filter((i) => i.uid === u && i.start > NOW + S.freezeMin * MIN).length;
    expect(share(out.items, 'b')).toBeGreaterThan(share(lopsided, 'b') + 10);
    // and all the way: the overloaded person's chores are not held where they were, so the split is the one a fresh plan makes
    expect(['a', 'b'].map((u) => share(out.items, u))).toEqual(['a', 'b'].map((u) => share(fresh, u)));
    expect(planBreaks(input({ existing: out.items }))).toEqual([]);
  });
  it('a fresh plan holds, and each way of breaking it is named', () => {
    const items = plan(input()).items;
    expect(planBreaks(input({ existing: items }))).toEqual([]);
    const later = items.filter((i) => i.start > NOW + S.freezeMin * MIN);
    const mopA = later.find((i) => i.uid === 'a' && i.taskId !== 'platos')!;
    // a Carla-only chore handed to him
    const ropa = later.find((i) => i.taskId === 'ropa')!;
    expect(planBreaks(input({ existing: items.map((i) => (i.id === ropa.id ? { ...i, uid: 'a' } : i)) }))).toContain('who');
    // he goes out over one of his chores
    const p = { a: { until: mopA.end + MIN, out: true, at: mopA.start - MIN } };
    expect(planBreaks(input({ existing: items, presence: p, awayUntil: { a: p.a.until } }))).toContain('out');
    // both eat lunch out tomorrow after the plan was made
    const busy = { a: [away(1, '11:00', '14:00')], b: [away(1, '11:00', '14:00')] };
    expect(planBreaks(input({ existing: items, busy }))).toEqual(expect.arrayContaining(['meal']));
  });
});

describe('5. karma for skipping a chore only because it is disliked', () => {
  const task = SEED.find((t) => t.id === 'bano-profundo') as TaskType;
  const w = weightOf(task, undefined);
  const skip = (d: number, uid = 'a'): LogEvent => ({ id: `s${d}${uid}`, taskId: task.id, uid, kind: 'dismissed', at: at(d, '18:00'), minutes: 0, planned: true, plannedStart: at(d, '17:30'), reason: 'dislike' });
  const done = (d: number, uid = 'a'): LogEvent => ({ id: `d${d}${uid}`, taskId: task.id, uid, kind: 'done', at: at(d, '18:00'), minutes: 45, planned: true });
  const k = (log: LogEvent[], uid = 'a') => karmaFor(log, SEED, (t) => weightOf(t, undefined), uid, NOW, S).total;

  it('owes half the weight for one skip, and doubles for each repeat within 14 days', () => {
    expect(k([skip(-20)])).toBeCloseTo(0.5 * w);
    expect(k([skip(-20), skip(-10)])).toBeCloseTo(0.5 * w + 1 * w);
    expect(k([skip(-20), skip(-10), skip(-3)])).toBeCloseTo(0.5 * w + 1 * w + 2 * w);
  });
  it('starts again at half after a gap longer than 14 days, and is cleared by doing the chore once', () => {
    expect(k([skip(-27), skip(-5)])).toBeCloseTo(0.5 * w + 0.5 * w);
    expect(k([skip(-20), skip(-10), done(-5)])).toBe(0);
    expect(k([skip(-20), done(-15), skip(-3)])).toBeCloseTo(0.5 * w);
    expect(k([skip(-10)], 'b')).toBe(0);
  });
  it('other dismissal reasons cost nothing', () => {
    expect(k([{ ...skip(-3), reason: 'no_time' }, { ...skip(-2), reason: 'not_needed' }])).toBe(0);
  });
  it('is counted as work owed in the balance, so the person who skipped is behind, not ahead', () => {
    const log = [done(-6, 'a'), done(-6, 'b'), skip(-2, 'a')];
    const bal = balance(log, SEED, {}, [A, B], NOW, S);
    expect(bal.perUid.a!.karma).toBeCloseTo(0.5 * w);
    expect(bal.diff.a!).toBeLessThan(bal.diff.b!);
  });
  it('a dislike skip hands that day to the other person instead of cancelling it, and the skipper is given more work after', () => {
    const tomorrow = plan(input()).items.find((i) => i.taskId === 'poceta' && i.start > NOW + DAY)!;
    const sk: LogEvent = { id: 'x', taskId: 'poceta', uid: tomorrow.uid, kind: 'dismissed', at: NOW, minutes: 0, planned: true, plannedStart: tomorrow.start, reason: 'dislike' };
    expect(skipsFromLog([sk], NOW)).toEqual([]);
    const after = on(plan(input({ log: [sk] })).items, 'poceta', Math.round((dayStart(tomorrow.start) - day(0)) / DAY));
    expect(after.map((i) => i.uid)).toEqual([tomorrow.uid === 'a' ? 'b' : 'a']);
    const heavy = Array.from({ length: 4 }, (_, n) => skip(-12 + 3 * n, 'a'));
    const count = (log: LogEvent[]) => plan(input({ log })).items.filter((i) => i.uid === 'a').length;
    expect(count(heavy)).toBeGreaterThan(count([]));
  });
});
