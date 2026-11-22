import { describe, expect, it } from 'vitest';
import { balance } from './burden';
import { CARLA_UID, SEED as REAL_SEED, migrateTasks } from './catalog';
import { estimateFor } from './adapt';
import { DEFAULT_SETTINGS as S, type Interval, type LogEvent, type Member, type PlannedItem, type SwapRecord } from './model';
import { burdenOf, weightOf } from './burden';
import { applySwaps, bundleSplit, candidateSlots, findCollisions, nexoPick, plan, swapItem, type PlanInput } from './planner';
import { atHm, dayKey, dayStart, DAY, MIN } from './time';

/** The seed with Carla's real uid replaced by the test's B, so her chores can be planned here. */
const SEED = REAL_SEED.map((t) => (t.who ? { ...t, who: t.who.map((u) => (u === CARLA_UID ? 'b' : u)) } : t));
const A: Member = { uid: 'a', name: 'Eduardo', lang: 'es', role: 'owner' };
const B: Member = { uid: 'b', name: 'Carla', lang: 'en', role: 'member' };
const NOW = Date.parse('2026-11-20T12:00:00+09:00');   // a Friday
const day = (n: number) => dayStart(NOW) + n * DAY;
const ev = (n: number, from: string, to: string, extra: Partial<Interval> = {}): Interval => ({ start: atHm(day(n), from), end: atHm(day(n), to), ...extra });

function input(over: Partial<PlanInput> = {}): PlanInput {
  return { now: NOW, horizonDays: 7, tasks: SEED, members: [A, B], estimates: {}, log: [], busy: { a: [], b: [] }, existing: [], settings: S, ...over };
}

describe('planner hard rules', () => {
  it('never overlaps a calendar event, with its buffer, for either person', () => {
    const busy = { a: [ev(0, '17:00', '20:00', { place: 'Yoshida campus' }), ev(1, '10:00', '18:00'), ev(2, '09:00', '22:00')], b: [ev(0, '18:00', '21:00'), ev(3, '17:30', '21:30'), ev(4, '14:00', '23:00')] };
    const out = plan(input({ busy }));
    expect(out.items.length).toBeGreaterThan(20);
    expect(findCollisions(out.items, busy, S.bufferMin)).toEqual([]);
  });
  it('keeps sleep and the lunch hour free and puts every fixed chore inside its window', () => {
    const out = plan(input());
    for (const it of out.items) {
      const t = SEED.find((x) => x.id === it.taskId)!;
      const d = dayStart(it.start);
      expect(overlapsHm(it, d, '12:15', '13:00')).toBe(false);
      expect(it.start >= atHm(d, '07:00')).toBe(true);
      if (t.mode === 'fixed' && t.window) {
        expect(it.start >= atHm(d, t.window.from)).toBe(true);
        expect(it.end <= atHm(d, t.window.to)).toBe(true);
      }
    }
  });
  it('plans nothing for a person who is away, and everything lands on the other', () => {
    const out = plan(input({ awayUntil: { b: day(3) } }));
    expect(out.items.filter((i) => i.uid === 'b' && i.start < day(3)).length).toBe(0);
    expect(out.items.filter((i) => i.uid === 'a' && i.start < day(3)).length).toBeGreaterThan(5);
  });
  it('reports a chore it cannot place instead of forcing a collision', () => {
    const wall = () => Array.from({ length: 8 }, (_, n) => ev(n, '00:00', '23:59'));
    const busy = { a: wall(), b: wall() };
    const out = plan(input({ busy }));
    expect(out.items).toEqual([]);
    expect(out.unplaced.length).toBeGreaterThan(10);
    expect(out.unplaced[0]!.reason).toMatch(/no free time/);
  });
  it('honours who may do a chore and "not today"', () => {
    const tasks = SEED.map((t) => (t.id === 'poceta' ? { ...t, who: ['b'] } : t));
    const out = plan(input({ tasks }));
    expect(out.items.filter((i) => i.taskId === 'poceta').every((i) => i.uid === 'b')).toBe(true);
    const nt = plan(input({ notToday: [{ uid: 'a', taskId: 'aspirar', day: dayKey(day(1)) }, { uid: 'b', taskId: 'aspirar', day: dayKey(day(1)) }] }));
    expect(nt.items.filter((i) => i.taskId === 'aspirar' && dayKey(i.start) === dayKey(day(1))).length).toBe(0);
  });
});

describe('chains and the daily rhythm', () => {
  it('plans hanging after the wash and folding the next day, and prefers the same person for the hanging', () => {
    const out = plan(input());
    const wash = out.items.filter((i) => i.taskId === 'ropa');
    const hang = out.items.filter((i) => i.taskId === 'guindar');
    expect(wash.length).toBeGreaterThanOrEqual(2);
    expect(hang.length).toBeGreaterThanOrEqual(1);
    for (const h of hang) {
      const w = wash.filter((x) => x.end <= h.start).sort((p, q) => q.end - p.end)[0]!;
      expect(h.start - w.end).toBeGreaterThanOrEqual(60 * MIN);
    }
    expect(out.items.filter((i) => i.taskId === 'doblar').every((f) => wash.some((w) => f.start - w.end >= 1440 * MIN))).toBe(true);
  });
  it('plans a bento on the evening before a weekday only', () => {
    const out = plan(input());
    for (const b of out.items.filter((i) => i.taskId === 'bento')) {
      const dow = new Date(dayStart(b.start) + 9 * 60 * MIN + DAY).getUTCDay();
      expect([1, 2, 3, 4, 5]).toContain(dow);
    }
  });
  it('plans the daily meals every day of the horizon', () => {
    const out = plan(input());
    for (const id of ['desayuno', 'cena', 'basura']) expect(new Set(out.items.filter((i) => i.taskId === id).map((i) => dayKey(i.start))).size).toBeGreaterThanOrEqual(6);
  });
  it('does not plan a daily chore again once it is done today', () => {
    const log: LogEvent[] = [{ id: 'x', taskId: 'basura', uid: 'a', kind: 'done', at: NOW - MIN * 30, minutes: 5, planned: true }];
    const out = plan(input({ log }));
    expect(out.items.filter((i) => i.taskId === 'basura' && dayKey(i.start) === dayKey(NOW)).length).toBe(0);
  });
});

describe('stability and minimum change', () => {
  it('never moves a chore that starts inside the freeze window', () => {
    const now = Date.parse('2026-11-20T17:20:00+09:00');
    const first = plan(input({ now }));
    const soon = first.items.find((i) => i.start > now && i.start <= now + 100 * MIN)!;
    expect(soon).toBeDefined();
    const busy = { a: [{ start: soon.start - 10 * MIN, end: soon.end + 10 * MIN }], b: [{ start: soon.start - 10 * MIN, end: soon.end + 10 * MIN }] };
    const again = plan(input({ now, existing: first.items, busy }));
    const kept = again.items.find((i) => i.id === soon.id)!;
    expect([kept.uid, kept.start]).toEqual([soon.uid, soon.start]);
    expect(kept.frozen).toBe(true);
  });
  it('moves only a few chores when one event appears', () => {
    const first = plan(input());
    const later = first.items.filter((i) => i.start > NOW + 3 * DAY);
    const victim = later[Math.floor(later.length / 2)]!;
    const busy = { a: [{ start: victim.start, end: victim.end + 30 * MIN }], b: [] as Interval[] };
    const again = plan(input({ existing: first.items, busy }));
    expect(again.moved.length).toBeLessThanOrEqual(8);
    expect(findCollisions(again.items, busy, S.bufferMin)).toEqual([]);
  });
  it('keeps a pinned chore exactly where a person put it, even far ahead', () => {
    const first = plan(input());
    const far = first.items.find((i) => i.start > NOW + 4 * DAY && i.taskId === 'aspirar') ?? first.items.find((i) => i.start > NOW + 4 * DAY)!;
    const other = far.uid === 'a' ? 'b' : 'a';
    const pinned = { ...far, uid: other, pinned: true };
    const again = plan(input({ existing: first.items.map((i) => (i.id === far.id ? pinned : i)) }));
    const kept = again.items.find((i) => i.id === far.id)!;
    expect([kept.uid, kept.start, kept.pinned]).toEqual([other, far.start, true]);
  });
  it('is deterministic', () => {
    const a = plan(input()), b = plan(input());
    expect(a.items).toEqual(b.items);
  });
});

describe('ids', () => {
  const unique = (items: PlannedItem[]) => new Set(items.map((i) => i.id)).size === items.length;
  it('are unique in a fresh plan and after many replans with changing calendars', () => {
    let existing: PlannedItem[] = [];
    for (let step = 0; step < 12; step++) {
      const busy = { a: [ev(step % 6, '17:30', '19:00')], b: [ev((step + 2) % 6, '18:00', '20:30')] };
      const now = NOW + step * 6 * 3_600_000;
      const out = plan(input({ now, busy, existing }));
      expect(unique(out.items)).toBe(true);
      existing = out.items;
    }
  });
  it('are unique when the previous plan carried duplicates from an older version', () => {
    const first = plan(input());
    const dup = first.items.map((i) => (i.taskId === 'cena' ? { ...i, id: 'cena@old' } : i));
    expect(unique(plan(input({ existing: dup })).items)).toBe(true);
  });
});

describe('moving one chore', () => {
  it('offers only free slots, never its own, never on an event, and one per person per hour', () => {
    const busy = { a: [ev(1, '18:00', '21:00')], b: [ev(1, '17:30', '21:30')] };
    const first = plan(input({ busy }));
    const item = first.items.find((i) => i.taskId === 'aspirar')!;
    const slots = candidateSlots(input({ busy, existing: first.items }), item);
    expect(slots.length).toBeGreaterThan(2);
    for (const s of slots) {
      expect(findCollisions([{ ...item, uid: s.uid, start: s.start, end: s.end }], busy, S.bufferMin).filter((c) => c.item.id === item.id && c.event.label === undefined)).toEqual([]);
      expect(first.items.some((o) => o.id !== item.id && o.uid === s.uid && o.start < s.end && s.start < o.end)).toBe(false);
    }
    expect(slots.some((s) => s.uid === item.uid && s.start === item.start)).toBe(false);
    expect(new Set(slots.map((s) => s.uid + Math.floor(s.start / 3_600_000))).size).toBe(slots.length);
  });
  it('respects who may do the chore and an away person', () => {
    const tasks = SEED.map((t) => (t.id === 'poceta' ? { ...t, who: ['b'] } : t));
    const first = plan(input({ tasks }));
    const item = first.items.find((i) => i.taskId === 'poceta')!;
    expect(candidateSlots(input({ tasks, existing: first.items }), item).every((s) => s.uid === 'b')).toBe(true);
    expect(candidateSlots(input({ tasks, existing: first.items, awayUntil: { b: day(9) } }), item)).toEqual([]);
  });
});

describe('fairness over invented months', () => {
  function simulate(weeks: number, dislikeA: Record<string, number>, dislikeB: Record<string, number>) {
    let log: LogEvent[] = [];
    let existing: PlannedItem[] = [];
    const survey = { a: dislikeA, b: dislikeB };
    let t = NOW;
    for (let step = 0; step < weeks * 7; step++) {
      const estimates = Object.fromEntries(SEED.map((k) => [k.id, estimateFor(k, log, survey, [A, B])]));
      const out = plan({ ...input({ now: t, estimates, log, existing }) });
      existing = out.items;
      const dayEnd = dayStart(t) + DAY;
      for (const it of out.items.filter((i) => i.start >= t - DAY && i.end <= dayEnd)) {
        const task = SEED.find((k) => k.id === it.taskId)!;
        log.push({ id: `${it.id}:${it.start}`, taskId: it.taskId, uid: it.uid, kind: 'done', at: it.end, minutes: Math.round((it.end - it.start) / MIN), planned: true, dislike: (it.uid === 'a' ? dislikeA : dislikeB)[task.id] ?? 3 });
      }
      log = log.filter((e, i, arr) => arr.findIndex((x) => x.id === e.id) === i);
      t = dayEnd + 12 * 60 * MIN;
    }
    const estimates = Object.fromEntries(SEED.map((k) => [k.id, estimateFor(k, log, survey, [A, B])]));
    return { log, bal: balance(log, SEED, estimates, [A, B], t, S) };
  }
  it('keeps the burden close to even when both mind the same things', () => {
    const r = simulate(6, {}, {});
    expect(r.bal.total).toBeGreaterThan(50);
    expect(r.bal.evenness).toBeGreaterThan(0.9);
  });
  it('stays even while giving each person more of what they mind less', () => {
    const r = simulate(6, { poceta: 5, 'bano-profundo': 5, platos: 1, cena: 1 }, { poceta: 1, 'bano-profundo': 1, platos: 5, cena: 5 });
    expect(r.bal.evenness).toBeGreaterThan(0.85);
    const count = (uid: string, id: string) => r.log.filter((e) => e.uid === uid && e.taskId === id).length;
    expect(count('b', 'poceta')).toBeGreaterThan(count('a', 'poceta'));
    expect(count('a', 'cena')).toBeGreaterThan(count('b', 'cena'));
  });
});

function overlapsHm(it: PlannedItem, d: number, from: string, to: string): boolean {
  return it.start < atHm(d, to) && atHm(d, from) < it.end;
}

describe('Carla-only chores', () => {
  const burden = (items: PlannedItem[], uid: string, tasks = SEED) =>
    items.filter((i) => i.uid === uid && i.start < NOW + 7 * DAY).reduce((s, i) => {
      const t = tasks.find((x) => x.id === i.taskId)!;
      return s + burdenOf(weightOf(t, undefined), 3, S);
    }, 0);
  const only = ['ropa', 'guindar'];
  it('plans sorting and hanging for her alone', () => {
    const out = plan(input());
    for (const id of only) {
      const mine = out.items.filter((i) => i.taskId === id);
      expect(mine.length).toBeGreaterThan(0);
      expect(mine.every((i) => i.uid === 'b')).toBe(true);
    }
  });
  it('shifts the other chores toward him so the burden still comes out even', () => {
    const open = SEED.map(({ who: _w, ...t }) => t);
    const free = plan(input({ tasks: open }));
    const held = plan(input());
    const others = (items: PlannedItem[], uid: string) => items.filter((i) => i.uid === uid && !only.includes(i.taskId) && i.taskId !== 'doblar' && i.start < NOW + 7 * DAY);
    const w = (items: PlannedItem[]) => items.reduce((s, i) => s + weightOf(SEED.find((x) => x.id === i.taskId)!, undefined), 0);
    // he carries more of everything else than he did when the laundry was shared
    expect(w(others(held.items, 'a'))).toBeGreaterThan(w(others(free.items, 'a')));
    // and the totals still come out close to even (within a fifth of the whole)
    const gap = Math.abs(burden(held.items, 'a') - burden(held.items, 'b'));
    expect(gap / (burden(held.items, 'a') + burden(held.items, 'b'))).toBeLessThan(0.2);
  });
});

describe('swaps', () => {
  const sw = (over: Partial<SwapRecord> = {}): SwapRecord => ({ id: 's1', itemId: 'x', taskId: 'aspirar', fromUid: 'a', toUid: 'b', state: 'accepted', at: NOW, start: 0, ...over });
  const base = () => plan(input());
  it('moves an accepted swap to the other person, pinned', () => {
    const first = base();
    const item = first.items.find((i) => i.taskId === 'aspirar' && i.uid === 'a') ?? first.items.find((i) => i.taskId === 'cena' && i.uid === 'a')!;
    const out = plan(input({ existing: first.items, swaps: [sw({ itemId: item.id, taskId: item.taskId, start: item.start })] }));
    const kept = out.items.find((i) => i.id === item.id)!;
    expect([kept.uid, kept.start, kept.pinned]).toEqual(['b', item.start, true]);
  });
  it('still holds after a re-plan changed the item id (the old code pinned by id and did nothing)', () => {
    const first = base();
    const item = first.items.find((i) => i.taskId === 'aspirar' && i.start > NOW + 2 * DAY && i.uid === 'a') ?? first.items.find((i) => i.taskId === 'cena' && i.start > NOW + 2 * DAY && i.uid === 'a')!;
    const renamed = first.items.map((i) => (i.id === item.id ? { ...i, id: 'renamed-by-replan' } : i));
    const swap = sw({ itemId: item.id, taskId: item.taskId, start: item.start });
    const out = plan(input({ existing: renamed, swaps: [swap] }));
    const kept = out.items.find((i) => i.taskId === item.taskId && Math.abs(i.start - item.start) < 12 * 3_600_000 && i.uid === 'b' && i.pinned);
    expect(kept).toBeDefined();
    expect(swapItem(renamed, swap)?.id).toBe('renamed-by-replan');
    // and again on the next re-plan, with no swap data needed once it is pinned
    expect(plan(input({ existing: out.items, swaps: [swap] })).items.some((i) => i.id === kept!.id && i.uid === 'b')).toBe(true);
  });
  it('is applied even if the person who accepted never wrote the plan (state only in the swap)', () => {
    const existing = [{ id: 'q', taskId: 'aspirar', uid: 'a', start: NOW + 3 * DAY, end: NOW + 3 * DAY + 20 * MIN }];
    expect(applySwaps(existing, [sw({ itemId: 'q', start: existing[0]!.start })], NOW)[0]).toMatchObject({ uid: 'b', pinned: true });
  });
  it('ignores open and declined swaps, and a swap whose chore was since moved by hand', () => {
    const existing: PlannedItem[] = [{ id: 'q', taskId: 'aspirar', uid: 'a', start: NOW + 3 * DAY, end: NOW + 3 * DAY + 20 * MIN }];
    for (const state of ['open', 'declined'] as const) expect(applySwaps(existing, [sw({ itemId: 'q', state })], NOW)).toBe(existing);
    const pinned = [{ ...existing[0]!, pinned: true }];
    expect(applySwaps(pinned, [sw({ itemId: 'q' })], NOW)).toBe(pinned);
  });
  it('does not match a swap to another chore', () => {
    const existing: PlannedItem[] = [{ id: 'q', taskId: 'cena', uid: 'a', start: NOW + DAY, end: NOW + DAY + 20 * MIN }];
    expect(swapItem(existing, sw({ itemId: 'nope', taskId: 'aspirar', start: NOW + DAY }))).toBeUndefined();
  });
});

describe('Nexo picks a slot', () => {
  it('returns the nearest free slot for someone allowed, never a blocked one', () => {
    const busy = { a: [ev(1, '17:30', '21:30')], b: [] as Interval[] };
    const first = plan(input({ busy }));
    const item = first.items.find((i) => i.taskId === 'aspirar')!;
    const pick = nexoPick(input({ busy, existing: first.items }), item)!;
    expect(pick).not.toBeNull();
    expect(candidateSlots(input({ busy, existing: first.items }), item, 40).some((s) => s.uid === pick.uid && s.start === pick.start)).toBe(true);
    expect(findCollisions([{ ...item, uid: pick.uid, start: pick.start, end: pick.end }], busy, S.bufferMin).filter((c) => c.event.label === undefined)).toEqual([]);
  });
  it('is null when nothing is free', () => {
    const wall = () => Array.from({ length: 8 }, (_, n) => ev(n, '00:00', '23:59'));
    const first = plan(input());
    const item = first.items.find((i) => i.taskId === 'aspirar')!;
    expect(nexoPick(input({ busy: { a: wall(), b: wall() }, existing: first.items }), item)).toBeNull();
  });
});

describe('closing chores', () => {
  // His words, 2026-11-22: "Clean the kitchen sink and take down the trash should be done in sequence at the very end once everything
  // else is done." The live sink chore was added in the app, weekly and measured, and is found by name.
  const sink = { id: 'clean-kitchen-sink-7d1', names: { en: 'Clean kitchen sink', es: 'Clean kitchen sink', ja: 'Clean kitchen sink' }, icon: '🚰', category: 'kitchen' as const,
    freq: { times: 1, perDays: 7 }, mode: 'measured' as const, priorMinutes: 15, active: true };
  it('the migration marks the sink 1 and the rubbish 2', () => {
    const m = migrateTasks([sink, (({ closing: _c, ...t }) => t)(REAL_SEED.find((t) => t.id === 'basura')!), REAL_SEED.find((t) => t.id === 'platos')!]);
    expect(m.map((t) => t.closing)).toEqual([1, 2, undefined]);
  });
  it('plans the sink and then the rubbish, back to back, after every other chore of the day', () => {
    // with the bundle onto the dinner wash switched off (bundle: null), the sink keeps its own closing slot
    const tasks = migrateTasks([...SEED, { ...sink, bundle: null }]);
    const busy = { a: [ev(1, '17:00', '20:00')], b: [ev(2, '18:00', '21:00')] };
    const out = plan(input({ tasks, busy }));
    expect(findCollisions(out.items, busy, S.bufferMin)).toEqual([]);
    const sinks = out.items.filter((i) => i.taskId === sink.id);
    expect(sinks.length).toBeGreaterThanOrEqual(1);
    for (const sk of sinks) {
      const trash = out.items.find((i) => i.taskId === 'basura' && dayKey(i.start) === dayKey(sk.start))!;
      expect(trash).toBeDefined();
      expect(trash.start).toBe(sk.end);
    }
    for (const trash of out.items.filter((i) => i.taskId === 'basura')) {
      const rest = out.items.filter((i) => dayKey(i.start) === dayKey(trash.start) && i.taskId !== 'basura' && i.taskId !== sink.id);
      const sk = sinks.find((i) => dayKey(i.start) === dayKey(trash.start));
      for (const r of rest) expect(r.end).toBeLessThanOrEqual(sk ? sk.start : trash.start);
    }
  });
});

describe('bundled chores', () => {
  // His words, 2026-11-22 23:06: "The kitchen cleaning should be included in the night time dish washing by default."
  const sink = { id: 'clean-kitchen-sink-7d1', names: { en: 'Clean kitchen sink', es: 'Clean kitchen sink', ja: 'Clean kitchen sink' }, icon: '🚰', category: 'kitchen' as const,
    freq: { times: 1, perDays: 7 }, mode: 'measured' as const, priorMinutes: 15, active: true };
  const tasks = () => migrateTasks([...SEED, sink]);
  const dinnerWash = (items: PlannedItem[], d: string) => items.find((i) => i.taskId === 'platos' && dayKey(i.start) === d && i.start >= atHm(dayStart(i.start), '19:30'));

  it('the migration bundles the live sink onto the after-dinner wash, and leaves a switched-off or edited one alone', () => {
    const [m] = migrateTasks([sink]);
    expect(m!.bundle).toEqual({ taskId: 'platos', meal: 2 });
    expect(m!.closing).toBe(1);
    expect(migrateTasks([{ ...sink, bundle: null }])[0]!.bundle).toBeNull();
    expect(migrateTasks([{ ...sink, closing: 3 }])[0]!.bundle).toBeUndefined();
    expect(migrateTasks([REAL_SEED.find((t) => t.id === 'basura')!])[0]!.bundle).toBeUndefined();
  });

  it('plans no separate sink: the dinner wash carries it, one person, with both lengths added', () => {
    const out = plan(input({ tasks: tasks() }));
    expect(out.items.filter((i) => i.taskId === sink.id)).toEqual([]);
    const hosts = out.items.filter((i) => i.with?.some((w) => w.taskId === sink.id));
    expect(hosts.length).toBe(1);                         // weekly: once in the week
    const h = hosts[0]!;
    expect(h.taskId).toBe('platos');
    expect(dinnerWash(out.items, dayKey(h.start))).toBe(h);
    expect(h.with).toEqual([{ taskId: sink.id, minutes: 15 }]);
    expect(h.end - h.start).toBe((10 + 15) * MIN);
    // the rubbish is still the last chore of that day
    const trash = out.items.find((i) => i.taskId === 'basura' && dayKey(i.start) === dayKey(h.start))!;
    for (const r of out.items.filter((i) => dayKey(i.start) === dayKey(h.start) && i !== trash)) expect(r.end).toBeLessThanOrEqual(trash.start);
  });

  it('falls back to its own closing slot when nobody eats dinner at home that day', () => {
    const first = plan(input({ tasks: tasks() }));
    const d = dayKey(first.items.find((i) => i.with)!.start);
    const n = Math.round((Date.parse(d + 'T00:00:00+09:00') - dayStart(NOW)) / DAY);
    const out = plan(input({ tasks: tasks(), busy: { a: [ev(n, '18:00', '21:30', { place: 'Gion' })], b: [ev(n, '18:00', '21:30', { place: 'Gion' })] } }));
    expect(dinnerWash(out.items, d)).toBeUndefined();
    const own = out.items.filter((i) => i.taskId === sink.id);
    expect(own.length).toBe(1);
    expect(dayKey(own[0]!.start)).toBe(d);
    expect(out.items.some((i) => i.with)).toBe(false);
    const trash = out.items.find((i) => i.taskId === 'basura' && dayKey(i.start) === d)!;
    expect(trash.start).toBe(own[0]!.end);
  });

  it('switched off, the sink is planned on its own again', () => {
    const out = plan(input({ tasks: migrateTasks([...SEED, { ...sink, bundle: null }]) }));
    expect(out.items.some((i) => i.with)).toBe(false);
    expect(out.items.filter((i) => i.taskId === sink.id).length).toBe(1);
  });

  it('a frozen dinner wash planned before the bundle existed keeps its shape and the sink is planned on its own', () => {
    const first = plan(input({ tasks: tasks() }));
    const h = first.items.find((i) => i.with)!;
    const { with: _w, ...bare } = h;
    void _w;
    const old = { ...bare, end: bare.start + 10 * MIN };
    // an hour before it, inside the freeze window, with the day's earlier washes behind
    const out = plan(input({ now: h.start - 60 * MIN, tasks: tasks(), existing: [old] }));
    expect(out.items.find((i) => i.id === old.id)!.with).toBeUndefined();
    expect(out.items.filter((i) => i.taskId === sink.id && dayKey(i.start) === dayKey(h.start)).length).toBe(1);
  });

  it('a frozen dinner wash that carries the sink keeps it, and the sink is not planned a second time', () => {
    const t = tasks();
    const out = plan(input({ tasks: t }));
    const h = out.items.find((i) => i.with)!;
    const again = plan(input({ now: h.start - 60 * MIN, tasks: t, existing: [h] }));
    expect(again.items.filter((i) => i.taskId === sink.id)).toEqual([]);
    expect(again.items.find((i) => i.id === h.id)!.with).toEqual(h.with);
  });
});

describe('bundleSplit', () => {
  it('splits the logged minutes of a wash that carried the sink by planned share', () => {
    const item: PlannedItem = { id: 'x', taskId: 'platos', uid: 'a', start: 0, end: 25 * MIN, with: [{ taskId: 'sink', minutes: 15 }] };
    expect(bundleSplit(item, 50)).toEqual({ main: 20, with: [{ taskId: 'sink', minutes: 30 }] });
    expect(bundleSplit({ ...item, with: [] }, 12)).toEqual({ main: 12, with: [] });
    expect(bundleSplit(null, 12)).toEqual({ main: 12, with: [] });
  });
});
