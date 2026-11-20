import { balance, burdenOf, weightOf } from './burden';
import type { Estimate, Interval, LogEvent, Member, PlannedItem, Settings, TaskType } from './model';
import { atHm, dayKey, dayStart, DAY, hm, JST, MIN, overlaps, weekday } from './time';

/**
 * The live plan. A pure function: the same input always gives the same plan, and nothing here calls the network or the model.
 *
 * HARD rules, never broken: no chore overlaps an event on either calendar (padded by the buffer, and by travel for events away from
 * home), sleep, or the lunch window; one person does one chore at a time; a chore that starts within the freeze window never moves.
 * SOFT rules, traded off by score: balance of burden, the one who minds least, one slot a day, chains kept together, evenings,
 * heavy days, learned declines, and minimum change from the previous plan.
 */
export interface PlanInput {
  now: number;
  horizonDays: number;
  tz?: number;
  tasks: TaskType[];
  members: Member[];
  estimates: Record<string, Estimate>;
  log: LogEvent[];
  /** Calendar events by uid, in epoch milliseconds. Events both attend appear in both lists. */
  busy: Record<string, Interval[]>;
  existing: PlannedItem[];
  settings: Settings;
  /** "I am out until": nothing is planned for that person before this time. */
  awayUntil?: Record<string, number>;
  /** "Not today": a chore that person asked to hand off on that local day (YYYY-MM-DD). */
  notToday?: { uid: string; taskId: string; day: string }[];
  /** Learned declines: that person declined that chore on that weekday before. */
  declines?: { uid: string; taskId: string; dow: number }[];
  /** Minutes added each side of an event that has a place other than home. */
  travelMin?: number;
}

export interface Unplaced { taskId: string; ideal: number; reason: string }
export interface PlanOutput { items: PlannedItem[]; unplaced: Unplaced[]; moved: { id: string; fromUid: string; toUid: string; from: number; to: number }[] }

interface Occ { key: string; task: TaskType; ideal: number; earliest: number; latest: number; minutes: number; parent?: PlannedItem }

const GRID = 15 * MIN;
const HOME = /^home$/i;

export function plan(input: PlanInput): PlanOutput {
  const { now, tasks, members, estimates, log, settings: s } = input;
  const tz = input.tz ?? JST;
  const travel = (input.travelMin ?? 45) * MIN;
  const buffer = s.bufferMin * MIN;
  const horizonEnd = dayStart(now, tz) + input.horizonDays * DAY;
  const tById = new Map(tasks.map((t) => [t.id, t]));
  const uids = members.map((m) => m.uid);

  // ---- blocked time per person: calendar events, sleep, lunch, away
  const blocked: Record<string, Interval[]> = {};
  for (const uid of uids) {
    const list: Interval[] = [];
    for (const e of input.busy[uid] ?? []) {
      const pad = buffer + (e.place && !HOME.test(e.place.trim()) ? travel : 0);
      list.push({ start: e.start - pad, end: e.end + pad });
    }
    for (let d = dayStart(now, tz) - DAY; d <= horizonEnd; d += DAY) {
      list.push({ start: atHm(d, s.sleep.from), end: atHm(d + DAY, s.sleep.to) });
      list.push({ start: atHm(d, s.lunch.from), end: atHm(d, s.lunch.to) });
    }
    const away = input.awayUntil?.[uid];
    if (away && away > now) list.push({ start: now - DAY, end: away });
    blocked[uid] = list;
  }

  const placed: PlannedItem[] = [];
  const free = (uid: string, start: number, end: number): boolean =>
    !(blocked[uid] ?? []).some((b) => overlaps(start, end, b.start, b.end)) && !placed.some((p) => p.uid === uid && overlaps(start, end, p.start, p.end));

  // ---- load so far: burden already done in the window, plus what is planned in this run
  const bal = balance(log, tasks, estimates, members, now, s);
  const load: Record<string, number> = Object.fromEntries(uids.map((u) => [u, bal.perUid[u]?.burden ?? 0]));
  const dayLoad: Record<string, number> = {};
  const target = bal.target;
  const dislikeOf = (task: TaskType, uid: string) => estimates[task.id]?.dislike[uid] ?? 3;
  const weight = (task: TaskType) => weightOf(task, estimates[task.id]);

  // ---- 1. frozen: already started or starting inside the freeze window, kept exactly
  const frozen = input.existing.filter((e) => e.frozen || e.pinned || (e.start <= now + s.freezeMin * MIN && e.end > now - 5 * MIN));
  for (const f of frozen) {
    placed.push({ ...f, frozen: true });
    const t = tById.get(f.taskId);
    if (t) {
      const b = burdenOf(weight(t), dislikeOf(t, f.uid), s);
      load[f.uid] = (load[f.uid] ?? 0) + b;
      const k = f.uid + dayKey(f.start, tz);
      dayLoad[k] = (dayLoad[k] ?? 0) + b;
    }
  }

  // ---- 2. demand: the occurrences the horizon needs
  const doneAt = (taskId: string) => log.filter((e) => e.taskId === taskId && e.kind === 'done').reduce((m, e) => Math.max(m, e.at), 0);
  const doneToday = (taskId: string, day: number) => log.filter((e) => e.taskId === taskId && e.kind === 'done' && e.at >= day && e.at < day + DAY).length;
  const minutesOf = (task: TaskType) => Math.max(5, Math.ceil((task.mode === 'fixed' ? task.priorMinutes : (estimates[task.id]?.n ? estimates[task.id]!.meanMin : task.priorMinutes)) / 5) * 5);
  const activeDay = (task: TaskType, day: number): boolean => {
    if (!task.freq.weekdaysOnly) return true;
    const eveningBefore = task.window && hm(task.window.from) >= 18 * 60;
    const dow = weekday(eveningBefore ? day + DAY : day, tz);
    return dow >= 1 && dow <= 5;
  };
  const occs: Occ[] = [];
  const today = dayStart(now, tz);
  for (const task of tasks) {
    if (!task.active || task.freq.adhoc || task.after) continue;
    const interval = task.freq.perDays / Math.max(1, task.freq.times);
    if (task.freq.perDays <= 1) {
      for (let d = today; d < horizonEnd; d += DAY) {
        if (!activeDay(task, d)) continue;
        const already = doneToday(task.id, d);
        for (let k = already; k < task.freq.times; k++) {
          const region = regionFor(task, d, s, tz);
          const span = region.to - region.from;
          const ideal = region.from + Math.floor((span * (k + 0.5)) / task.freq.times);
          if (region.to <= now) continue;
          occs.push({ key: `${task.id}@${dayKey(d, tz)}#${k}`, task, ideal: Math.max(ideal, now), earliest: d, latest: d + DAY - 1, minutes: minutesOf(task) });
        }
      }
    } else {
      const last = doneAt(task.id);
      let ideal = last ? last + interval * DAY : today;
      let i = 0;
      while (ideal < horizonEnd && i < 40) {
        let day = dayStart(Math.max(ideal, now), tz);
        const pref = task.freq.days;
        if (pref && pref.length) for (let g = 0; g < 7 && !pref.includes(weekday(day, tz)); g++) day += DAY;
        const tol = Math.max(0.5, interval * 0.25) * DAY;
        occs.push({ key: `${task.id}@${dayKey(day, tz)}#0`, task, ideal: Math.max(atHm(day, regionFor(task, day, s, tz).fromHm), now), earliest: Math.max(day - tol, today), latest: Math.min(day + tol, horizonEnd - 1), minutes: minutesOf(task) });
        ideal = day + interval * DAY;
        i += 1;
      }
    }
  }
  // chores waiting after a parent that was done but whose follow-up was not
  for (const task of tasks) {
    if (!task.active || !task.after) continue;
    const parentDone = doneAt(task.after.taskId);
    if (parentDone && doneAt(task.id) < parentDone) {
      const ideal = Math.max(parentDone + task.after.delayMin * MIN, now);
      occs.push({ key: `${task.id}@after-${parentDone}`, task, ideal, earliest: ideal, latest: ideal + (task.after.delayMin <= 180 ? 12 * 60 * MIN : 2 * DAY), minutes: minutesOf(task) });
    }
  }
  // the freeze already holds some of them: do not plan a second copy
  const heldBy = (o: Occ) => frozen.some((f) => f.taskId === o.task.id && f.start >= o.earliest && f.start <= o.latest);

  // ---- 3. order: fixed windows first, then by earliest deadline
  const order = (a: Occ, b: Occ) => (a.task.mode === 'fixed' ? 0 : 1) - (b.task.mode === 'fixed' ? 0 : 1) || a.latest - b.latest || a.ideal - b.ideal || (a.key < b.key ? -1 : 1);
  const unplaced: Unplaced[] = [];
  const retained = new Set<string>();
  const sticky = input.existing.filter((e) => e.start > now && !frozen.includes(e));

  const place = (o: Occ): void => {
    const task = o.task;
    const w = weight(task);
    const region = (day: number) => regionFor(task, day, s, tz);
    let best: { uid: string; start: number; score: number } | undefined;
    const prev = sticky.filter((e) => e.taskId === task.id && !retained.has(e.id)).sort((a, b) => Math.abs(a.start - o.ideal) - Math.abs(b.start - o.ideal))[0];
    const parentItem = o.parent;
    for (let day = dayStart(o.earliest, tz); day <= o.latest; day += DAY) {
      const r = region(day);
      const lo = Math.max(r.from, o.earliest, now), hi = Math.min(r.to, o.latest + 1);
      for (let start = Math.ceil(lo / GRID) * GRID; start + o.minutes * MIN <= hi; start += GRID) {
        const end = start + o.minutes * MIN;
        for (const m of members) {
          if (task.who && task.who.length && !task.who.includes(m.uid)) continue;
          if (input.notToday?.some((n) => n.uid === m.uid && n.taskId === task.id && n.day === dayKey(start, tz))) continue;
          if (!free(m.uid, start, end)) continue;
          const mine = placed.filter((p) => p.uid === m.uid && dayKey(p.start, tz) === dayKey(start, tz));
          let score = Math.abs(dayStart(start, tz) - dayStart(o.ideal, tz)) / DAY * 3 + Math.abs(start - o.ideal) / DAY * 0.5;
          const dis = dislikeOf(task, m.uid);
          const bur = burdenOf(w, dis, s);
          const total = Object.values(load).reduce((a, b) => a + b, 0) + bur;
          const excess = ((load[m.uid] ?? 0) + bur - (target[m.uid] ?? 0.5) * total) / 5;
          score += 4 * excess + 2 * (s.burdenA + s.burdenB * dis);
          if (mine.length) {
            const near = mine.some((p) => Math.abs(p.start - end) <= 90 * MIN || Math.abs(start - p.end) <= 90 * MIN);
            score += near ? -1.5 : 0.8;
            if (mine.length >= 3) score += 1.5;
          }
          if (task.mode === 'measured' && start % DAY >= 0 && new Date(start + tz * MIN).getUTCHours() >= 21) score += 1;
          if ((dayLoad[m.uid + dayKey(start, tz)] ?? 0) + bur > 12) score += 3;
          if (input.declines?.some((d) => d.uid === m.uid && d.taskId === task.id && d.dow === weekday(start, tz))) score += 3;
          if (parentItem && parentItem.uid === m.uid) score -= 1;
          if (prev && prev.uid === m.uid) score -= prev.start === start ? 2.5 : dayKey(prev.start, tz) === dayKey(start, tz) ? 1 : 0;
          if (!best || score < best.score - 1e-9) best = { uid: m.uid, start, score };
        }
      }
    }
    if (!best) {
      unplaced.push({ taskId: task.id, ideal: o.ideal, reason: 'no free time for anyone before ' + dayKey(o.latest, tz) });
      return;
    }
    const id = prev && prev.uid === best.uid && prev.start === best.start ? prev.id : prev ? prev.id : o.key;
    if (prev) retained.add(prev.id);
    const item: PlannedItem = { id, taskId: task.id, uid: best.uid, start: best.start, end: best.start + o.minutes * MIN };
    placed.push(item);
    const b = burdenOf(w, dislikeOf(task, best.uid), s);
    load[best.uid] = (load[best.uid] ?? 0) + b;
    const k = best.uid + dayKey(best.start, tz);
    dayLoad[k] = (dayLoad[k] ?? 0) + b;
  };

  for (const o of occs.sort(order)) if (!heldBy(o)) place(o);

  // ---- 4. children of planned parents
  const children: Occ[] = [];
  for (const task of tasks) {
    if (!task.active || !task.after) continue;
    for (const p of placed.filter((x) => x.taskId === task.after!.taskId && x.end > now - DAY)) {
      const ideal = Math.max(p.end + task.after.delayMin * MIN, now);
      if (ideal >= horizonEnd) continue;
      if (doneAt(task.id) >= p.end) continue;
      children.push({ key: `${task.id}@${dayKey(p.start, tz)}+`, task, ideal, earliest: ideal, latest: ideal + (task.after.delayMin <= 180 ? 12 * 60 * MIN : 2 * DAY), minutes: minutesOf(task), parent: p });
    }
  }
  for (const o of children.sort(order)) if (!heldBy(o) && !placed.some((p) => p.taskId === o.task.id && p.start >= o.earliest && p.start <= o.latest)) place(o);

  const items = placed.sort((a, b) => a.start - b.start || (a.id < b.id ? -1 : 1));
  const moved = items.filter((i) => !i.frozen).flatMap((i) => {
    const old = input.existing.find((e) => e.id === i.id);
    return old && (old.uid !== i.uid || old.start !== i.start) ? [{ id: i.id, fromUid: old.uid, toUid: i.uid, from: old.start, to: i.start }] : [];
  });
  return { items, unplaced, moved };
}

/** The allowed part of a day for a chore, in epoch milliseconds, plus the window start as minutes for ideals. */
export function regionFor(task: TaskType, day: number, s: Settings, tz = JST): { from: number; to: number; fromHm: string } {
  const dow = weekday(day, tz);
  const weekend = dow === 0 || dow === 6;
  const w = task.window ?? { from: weekend ? '09:00' : s.slot.from, to: s.slot.to };
  const quietFrom = hm(s.quiet.from);
  const fixed = task.mode === 'fixed';
  const to = fixed ? hm(w.to) : Math.min(hm(w.to), quietFrom);
  return { from: atHm(day, w.from), to: atHm(day, `${String(Math.floor(to / 60)).padStart(2, '0')}:${String(to % 60).padStart(2, '0')}`), fromHm: w.from };
}

/** Every pair (chore, calendar event) that overlaps once the buffer is added. Empty means the hard rule holds. */
export function findCollisions(items: PlannedItem[], busy: Record<string, Interval[]>, bufferMin: number): { item: PlannedItem; event: Interval }[] {
  const out: { item: PlannedItem; event: Interval }[] = [];
  for (const it of items) for (const e of busy[it.uid] ?? []) if (overlaps(it.start, it.end, e.start - bufferMin * MIN, e.end + bufferMin * MIN)) out.push({ item: it, event: e });
  for (const a of items) for (const b of items) if (a.id < b.id && a.uid === b.uid && overlaps(a.start, a.end, b.start, b.end)) out.push({ item: a, event: { start: b.start, end: b.end, label: b.id } });
  return out;
}
