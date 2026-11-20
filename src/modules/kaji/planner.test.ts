import { describe, expect, it } from 'vitest';
import { balance } from './burden';
import { SEED } from './catalog';
import { estimateFor } from './adapt';
import { DEFAULT_SETTINGS as S, type Interval, type LogEvent, type Member, type PlannedItem } from './model';
import { candidateSlots, findCollisions, plan, type PlanInput } from './planner';
import { atHm, dayKey, dayStart, DAY, MIN } from './time';

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
