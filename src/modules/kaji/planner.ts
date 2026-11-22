import { balance, burdenOf, weightOf } from './burden';
import type { Estimate, Interval, LogEvent, Member, PlannedItem, Settings, SwapRecord, TaskType } from './model';
import { afterBackHome, mealsAtHome, outIntervals, type Presence } from './home';
import { applyLearned, dismissedAt, skipsFromLog } from './reschedule';
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
  /** Swap requests. An accepted one holds the chore with the person who took it on every re-plan, whoever wrote the plan; a declined one is remembered through `declines`. */
  swaps?: SwapRecord[];
  /** Minutes added each side of an event that has a place other than home. */
  travelMin?: number;
  /** The last Go out / Back home press per person (home.ts). Back home ends the calendar outing it interrupted; meals follow both. */
  presence?: Record<string, Presence>;
}

export interface Unplaced { taskId: string; ideal: number; reason: string }
export interface PlanOutput { items: PlannedItem[]; unplaced: Unplaced[]; moved: { id: string; fromUid: string; toUid: string; from: number; to: number }[] }

/** `eaters`: for a chore that follows a meal, who ate it at home; they are preferred for it. */
interface Occ { key: string; task: TaskType; window?: { from: string; to: string }; ideal: number; earliest: number; latest: number; minutes: number; parent?: PlannedItem; eaters?: string[] }

const GRID = 15 * MIN;
const HOME = /^home$/i;

/** Bump when the shape or meaning of a stored plan changes: the service re-plans any plan with another version. */
export const PLAN_VERSION = 4;      // 4, 2026-11-22: rack the next morning, washes and cooking only for meals eaten at home

/** The planned item a swap is about: the same id, or, when a re-plan changed the id, the same chore of either person closest in time (within 12 hours). */
export function swapItem(items: PlannedItem[], s: Pick<SwapRecord, 'itemId' | 'taskId' | 'fromUid' | 'toUid' | 'start'>): PlannedItem | undefined {
  const byId = items.find((i) => i.id === s.itemId && i.taskId === s.taskId);
  if (byId) return byId;
  return items.filter((i) => i.taskId === s.taskId && (i.uid === s.fromUid || i.uid === s.toUid) && Math.abs(i.start - s.start) <= 12 * 60 * MIN)
    .sort((a, b) => Math.abs(a.start - s.start) - Math.abs(b.start - s.start))[0];
}

/**
 * Accepted swaps made binding: the chore goes to the person who accepted and is pinned there, so a re-plan (the app's or the service's)
 * keeps it. Applied only while the chore is still with the person who asked and not pinned by someone since, so a later manual move wins.
 */
export function applySwaps(existing: PlannedItem[], swaps: SwapRecord[] | undefined, now: number): PlannedItem[] {
  const accepted = (swaps ?? []).filter((x) => x.state === 'accepted').sort((a, b) => a.at - b.at);
  if (!accepted.length) return existing;
  let out = existing;
  for (const sw of accepted) {
    const it = swapItem(out, sw);
    if (!it || it.end <= now - 5 * MIN) continue;
    if (it.uid === sw.fromUid && !it.pinned) out = out.map((x) => (x.id === it.id ? { ...x, uid: sw.toUid, pinned: true } : x));
  }
  return out;
}

export function plan(input: PlanInput): PlanOutput {
  const { now, members, estimates, log, settings: s } = input;
  const existingIn = applySwaps(input.existing, input.swaps, now);
  const tz = input.tz ?? JST;
  const travel = (input.travelMin ?? 45) * MIN;
  const buffer = s.bufferMin * MIN;
  const horizonEnd = dayStart(now, tz) + input.horizonDays * DAY;
  // what the household's own moves have taught: windows shifted, gaps stretched. Recomputed from the log every time, never stored.
  const tasks = applyLearned(input.tasks, log, now, s, tz);
  const skips = skipsFromLog(log, now, tz);
  const tById = new Map(tasks.map((t) => [t.id, t]));
  const uids = members.map((m) => m.uid);

  // ---- blocked time per person: calendar events, sleep, lunch, away
  const blocked: Record<string, Interval[]> = {};
  for (const uid of uids) {
    const list: Interval[] = [];
    for (const e of afterBackHome(input.busy[uid], input.presence?.[uid])) {
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
  // karma is work owed, so it counts against what a person has done (karma.ts)
  const load: Record<string, number> = Object.fromEntries(uids.map((u) => [u, (bal.perUid[u]?.burden ?? 0) - (bal.perUid[u]?.karma ?? 0)]));
  const dayLoad: Record<string, number> = {};
  const target = bal.target;
  const dislikeOf = (task: TaskType, uid: string) => estimates[task.id]?.dislike[uid] ?? 3;
  const weight = (task: TaskType) => weightOf(task, estimates[task.id]);
  // "make sure to balance Kaji as required, when required" (his words, 2026-11-21). When the plan on file would leave someone more than
  // `rebalanceTama` past the fair split, that person's chores stop being kept where they were, so the balance term can move them.
  const overloaded = overloadedBy(load, existingIn.filter((e) => e.end > now), tById, weight, dislikeOf, target, s);
  // "I dislike it" hands the chore on for that day instead of cancelling it (karma.ts charges for it)
  const notToday = [...(input.notToday ?? []), ...log.filter((e) => e.kind === 'dismissed' && e.reason === 'dislike' && typeof e.plannedStart === 'number' && e.plannedStart >= dayStart(now, tz))
    .map((e) => ({ uid: e.uid, taskId: e.taskId, day: dayKey(e.plannedStart as number, tz) }))];
  const mealCache = new Map<number, ReturnType<typeof mealsAtHome>>();
  const mealsOn = (d: number) => {
    let m = mealCache.get(d);
    if (!m) { m = mealsAtHome(d, members, input.busy, input.presence, s, tz); mealCache.set(d, m); }
    return m;
  };

  // ---- 1. frozen: already started or starting inside the freeze window, kept exactly
  const frozen = existingIn.filter((e) => e.frozen || e.pinned || (e.start <= now + s.freezeMin * MIN && e.end > now - 5 * MIN));
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
  /** Done, or dismissed as not needed: either way the next one counts from there. */
  const handledAt = (taskId: string) => Math.max(doneAt(taskId), dismissedAt(log, taskId));
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
    if (!task.active || task.freq.adhoc || task.after || task.morningAfter) continue;
    const interval = task.freq.perDays / Math.max(1, task.freq.times);
    if (task.freq.perDays <= 1) {
      const wins = task.windows && task.windows.length === task.freq.times ? task.windows : undefined;
      for (let d = today; d < horizonEnd; d += DAY) {
        if (!activeDay(task, d)) continue;
        const already = doneToday(task.id, d);
        const ideals: number[] = [];
        for (let k = 0; k < task.freq.times; k++) {
          const region = regionFor(wins ? { ...task, window: wins[k] as { from: string; to: string } } : task, d, s, tz);
          ideals.push(region.from + Math.floor(((region.to - region.from) * (wins ? 0.5 : (k + 0.5) / task.freq.times))));
        }
        // a dismissal or a move to another day cancels the occurrence nearest to the time it was planned for
        const cancelled = new Set<number>();
        for (const sk of skips.filter((q) => q.taskId === task.id && q.day === dayKey(d, tz))) {
          let bestK = -1;
          ideals.forEach((id, k) => { if (!cancelled.has(k) && (bestK < 0 || Math.abs(id - sk.at) < Math.abs((ideals[bestK] as number) - sk.at))) bestK = k; });
          if (bestK >= 0) cancelled.add(bestK);
        }
        // a chore that follows a meal is planned only when someone eats that meal at home (Go out / Back home, or the calendars)
        const eatersOf = (k: number): string[] | undefined => {
          if (!task.meals || !task.meals.length) return undefined;
          const meal = task.meals[k] ?? task.meals[0] as number;
          return mealsOn(d)[meal]?.home ?? uids;
        };
        for (let k = already; k < task.freq.times; k++) {
          if (cancelled.has(k)) continue;
          const eaters = eatersOf(k);
          if (eaters && eaters.length === 0) continue;
          const win = wins ? (wins[k] as { from: string; to: string }) : undefined;
          const region = regionFor(win ? { ...task, window: win } : task, d, s, tz);
          if (region.to <= now) continue;
          occs.push({ key: `${task.id}@${dayKey(d, tz)}#${k}`, task, ...(win ? { window: win } : {}), ...(eaters ? { eaters } : {}), ideal: Math.max(ideals[k] as number, now), earliest: d, latest: d + DAY - 1, minutes: minutesOf(task) });
        }
      }
    } else {
      const last = handledAt(task.id);
      let ideal = last ? last + interval * DAY : today;
      let i = 0;
      while (ideal < horizonEnd && i < 40) {
        let day = dayStart(Math.max(ideal, now), tz);
        const pref = task.freq.days;
        if (pref && pref.length) for (let g = 0; g < 7 && !pref.includes(weekday(day, tz)); g++) day += DAY;
        const sk = skips.find((q) => q.taskId === task.id && q.day === dayKey(day, tz));
        if (sk) { ideal = sk.reason === 'no_time' || sk.reason === 'moved' ? day + DAY : day + interval * DAY; i += 1; continue; }
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
    if (parentDone && handledAt(task.id) < parentDone) {
      const ideal = Math.max(parentDone + task.after.delayMin * MIN, now);
      occs.push({ key: `${task.id}@after-${parentDone}`, task, ideal, earliest: ideal, latest: ideal + (task.after.delayMin <= 180 ? 12 * 60 * MIN : 2 * DAY), minutes: minutesOf(task) });
    }
  }
  // the freeze already holds some of them: do not plan a second copy
  // each frozen chore holds one occurrence, the nearest to where it sits (three dishes a day need three, not one)
  const used = new Set<string>();
  const heldBy = (o: Occ) => {
    const f = frozen.filter((x) => x.taskId === o.task.id && !used.has(x.id) && x.start >= o.earliest && x.start <= o.latest).sort((a, b) => Math.abs(a.start - o.ideal) - Math.abs(b.start - o.ideal))[0];
    if (f) used.add(f.id);
    return Boolean(f);
  };

  // ---- 3. order: fixed windows first, then by earliest deadline
  const order = (a: Occ, b: Occ) => (a.task.mode === 'fixed' ? 0 : 1) - (b.task.mode === 'fixed' ? 0 : 1) || a.latest - b.latest || a.ideal - b.ideal || (a.key < b.key ? -1 : 1);
  const unplaced: Unplaced[] = [];
  const retained = new Set<string>();
  const sticky = existingIn.filter((e) => e.start > now && !frozen.includes(e));

  const place = (o: Occ): void => {
    const task = o.task;
    const w = weight(task);
    const region = (day: number) => regionFor(o.window ? { ...task, window: o.window } : task, day, s, tz);
    let best: { uid: string; start: number; score: number } | undefined;
    const prev = sticky.filter((e) => e.taskId === task.id && !retained.has(e.id) && e.start >= o.earliest - DAY / 2 && e.start <= o.latest + DAY / 2).sort((a, b) => Math.abs(a.start - o.ideal) - Math.abs(b.start - o.ideal))[0];
    const parentItem = o.parent;
    for (let day = dayStart(o.earliest, tz); day <= o.latest; day += DAY) {
      const r = region(day);
      const lo = Math.max(r.from, o.earliest, now), hi = Math.min(r.to, o.latest + 1);
      for (let start = Math.ceil(lo / GRID) * GRID; start + o.minutes * MIN <= hi; start += GRID) {
        const end = start + o.minutes * MIN;
        for (const m of members) {
          if (task.who && task.who.length && !task.who.includes(m.uid)) continue;
          if (notToday.some((n) => n.uid === m.uid && n.taskId === task.id && n.day === dayKey(start, tz))) continue;
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
          // the fair split on the day as well as over the window, gently: whoever has carried less today is preferred
          const dk = dayKey(start, tz);
          const dayTotal = uids.reduce((a, u) => a + (dayLoad[u + dk] ?? 0), 0) + bur;
          score += 0.8 * ((dayLoad[m.uid + dk] ?? 0) + bur - (target[m.uid] ?? 0.5) * dayTotal) / 5;
          if (o.eaters && !o.eaters.includes(m.uid)) score += 2;
          if (input.declines?.some((d) => d.uid === m.uid && d.taskId === task.id && d.dow === weekday(start, tz))) score += 3;
          if (parentItem && parentItem.uid === m.uid) score -= 1;
          if (prev && prev.uid === m.uid && !overloaded.has(m.uid)) score -= prev.start === start ? 2.5 : dayKey(prev.start, tz) === dayKey(start, tz) ? 1 : 0;
          if (!best || score < best.score - 1e-9) best = { uid: m.uid, start, score };
        }
      }
    }
    if (!best) {
      unplaced.push({ taskId: task.id, ideal: o.ideal, reason: 'no free time for anyone before ' + dayKey(o.latest, tz) });
      return;
    }
    let id = prev ? prev.id : o.key;
    if (placed.some((x) => x.id === id)) id = `${o.key}~${best.start}`;      // ids are unique, always: the calendar keys its events on them
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
      if (handledAt(task.id) >= p.end) continue;
      children.push({ key: `${task.id}@${dayKey(p.start, tz)}+`, task, ideal, earliest: ideal, latest: ideal + (task.after.delayMin <= 180 ? 12 * 60 * MIN : 2 * DAY), minutes: minutesOf(task), parent: p });
    }
  }
  for (const o of children.sort(order)) if (!heldBy(o) && !placed.some((p) => p.taskId === o.task.id && p.start >= o.earliest && p.start <= o.latest)) place(o);

  // ---- 5. the morning after: the rack is cleared the day after a wash, in its morning window, never the same evening
  const mornings: Occ[] = [];
  for (const task of tasks) {
    if (!task.active || !task.morningAfter) continue;
    const src = task.morningAfter;
    const happened = (d: number) => log.some((e) => e.taskId === src && e.kind === 'done' && e.at >= d - DAY && e.at < d)
      || placed.some((p) => p.taskId === src && p.start >= d - DAY && p.start < d) || existingIn.some((p) => p.taskId === src && p.start >= d - DAY && p.start < d);
    for (let d = today; d < horizonEnd; d += DAY) {
      if (doneToday(task.id, d) || !happened(d)) continue;
      if (skips.some((q) => q.taskId === task.id && q.day === dayKey(d, tz))) continue;
      const region = regionFor(task, d, s, tz);
      if (region.to <= now) continue;
      mornings.push({ key: `${task.id}@${dayKey(d, tz)}#0`, task, ideal: Math.max(region.from, now), earliest: d, latest: d + DAY - 1, minutes: minutesOf(task) });
    }
  }
  for (const o of mornings.sort(order)) if (!heldBy(o)) place(o);

  const items = placed.sort((a, b) => a.start - b.start || (a.id < b.id ? -1 : 1));
  const moved = items.filter((i) => !i.frozen).flatMap((i) => {
    const old = existingIn.find((e) => e.id === i.id);
    return old && (old.uid !== i.uid || old.start !== i.start) ? [{ id: i.id, fromUid: old.uid, toUid: i.uid, from: old.start, to: i.start }] : [];
  });
  return { items, unplaced, moved };
}

/** Who would end up past the fair split by more than the tolerance if the plan on file were carried out as it stands. */
function overloadedBy(load: Record<string, number>, future: PlannedItem[], tById: Map<string, TaskType>, weight: (t: TaskType) => number,
  dislikeOf: (t: TaskType, uid: string) => number, target: Record<string, number>, s: Settings): Set<string> {
  const proj = { ...load };
  for (const e of future) {
    const t = tById.get(e.taskId);
    if (t) proj[e.uid] = (proj[e.uid] ?? 0) + burdenOf(weight(t), dislikeOf(t, e.uid), s);
  }
  const total = Object.values(proj).reduce((a, b) => a + b, 0);
  const tol = s.rebalanceTama ?? 3;
  return new Set(Object.keys(proj).filter((u) => (proj[u] ?? 0) - (target[u] ?? 0) * total > tol));
}

/**
 * Why the plan on file no longer holds, empty when it does: a chore given to someone not allowed to do it, a chore while its person is
 * out or busy, a wash for a meal nobody eats at home any more, or the split off by more than the tolerance. The service re-plans at once
 * when this is not empty, instead of waiting for the plan to age (his words, 2026-11-21: "balance Kaji as required, when required").
 */
export function planBreaks(input: PlanInput): string[] {
  const { now, members, estimates, log, settings: s } = input;
  const tz = input.tz ?? JST;
  const tasks = applyLearned(input.tasks, log, now, s, tz);
  const tById = new Map(tasks.map((t) => [t.id, t]));
  const future = input.existing.filter((e) => e.start > now + s.freezeMin * MIN && !e.pinned);
  const out = new Set<string>();
  for (const e of future) {
    const t = tById.get(e.taskId);
    if (!t) continue;
    if (t.who && t.who.length && !t.who.includes(e.uid)) out.add('who');
    const busy = afterBackHome(input.busy[e.uid], input.presence?.[e.uid]);
    if (busy.some((b) => overlaps(e.start, e.end, b.start - s.bufferMin * MIN, b.end + s.bufferMin * MIN))) out.add('busy');
    const away = input.awayUntil?.[e.uid];
    if ((away && away > e.start) || outIntervals([], input.presence?.[e.uid]).some((b) => overlaps(e.start, e.end, b.start, b.end))) out.add('out');
    if (t.meals && t.meals.length) {
      const wins = t.windows && t.windows.length === t.freq.times ? t.windows : [t.window ?? s.slot];
      const k = Math.max(0, wins.findIndex((w) => e.start >= atHm(dayStart(e.start, tz), w.from) && e.start < atHm(dayStart(e.start, tz), w.to)));
      const meal = t.meals[k] ?? t.meals[0] as number;
      if ((mealsAtHome(e.start, members, input.busy, input.presence, s, tz)[meal]?.home.length ?? 1) === 0) out.add('meal');
    }
  }
  const bal = balance(log, tasks, estimates, members, now, s);
  const load = Object.fromEntries(members.map((m) => [m.uid, (bal.perUid[m.uid]?.burden ?? 0) - (bal.perUid[m.uid]?.karma ?? 0)]));
  const dislikeOf = (t: TaskType, uid: string) => estimates[t.id]?.dislike[uid] ?? 3;
  if (overloadedBy(load, input.existing.filter((e) => e.end > now), tById, (t) => weightOf(t, estimates[t.id]), dislikeOf, bal.target, s).size) out.add('balance');
  return [...out];
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


export interface Slot { uid: string; start: number; end: number }

/**
 * Places where one planned chore could go instead, for a "Move" sheet: free for that person (calendar, buffer, sleep, lunch, other
 * chores), inside the chore's allowed hours, within five days, for either person who may do it. Closest to where it is now first, with
 * at most one slot per person per hour so the list is a real choice and not twenty neighbours.
 */
export function candidateSlots(input: PlanInput, item: PlannedItem, limit = 8): Slot[] {
  const { now, tasks, members, settings: s } = input;
  const tz = input.tz ?? JST;
  const task = tasks.find((t) => t.id === item.taskId);
  if (!task) return [];
  const buffer = s.bufferMin * MIN, travel = (input.travelMin ?? 45) * MIN;
  const len = item.end - item.start;
  const others = input.existing.filter((e) => e.id !== item.id);
  const out: Slot[] = [];
  for (const m of members) {
    if (task.who && task.who.length && !task.who.includes(m.uid)) continue;
    const away = input.awayUntil?.[m.uid] ?? 0;
    const block: Interval[] = (input.busy[m.uid] ?? []).map((e) => ({ start: e.start - buffer - (e.place && !HOME.test(e.place.trim()) ? travel : 0), end: e.end + buffer + (e.place && !HOME.test(e.place.trim()) ? travel : 0) }));
    for (let d = dayStart(now, tz) - DAY; d <= dayStart(now, tz) + 6 * DAY; d += DAY) {
      block.push({ start: atHm(d, s.sleep.from), end: atHm(d + DAY, s.sleep.to) }, { start: atHm(d, s.lunch.from), end: atHm(d, s.lunch.to) });
    }
    for (let day = dayStart(now, tz); day < dayStart(now, tz) + 5 * DAY; day += DAY) {
      const r = regionFor(task, day, s, tz);
      for (let start = Math.ceil(Math.max(r.from, now + 15 * MIN) / GRID) * GRID; start + len <= r.to; start += GRID) {
        const end = start + len;
        if (start === item.start && m.uid === item.uid) continue;
        if (away > start || block.some((b) => overlaps(start, end, b.start, b.end)) || others.some((o) => o.uid === m.uid && overlaps(start, end, o.start, o.end))) continue;
        out.push({ uid: m.uid, start, end });
      }
    }
  }
  out.sort((a, b) => Math.abs(a.start - item.start) - Math.abs(b.start - item.start) || (a.uid < b.uid ? -1 : 1));
  const seen = new Set<string>();
  return out.filter((o) => { const k = o.uid + Math.floor(o.start / (60 * MIN)); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, limit);
}

/**
 * The slot Nexo would choose for a chore that has to move: the closest valid one for either person allowed, found by `candidateSlots`
 * (calendar, buffer, sleep, lunch, other chores, quiet hours all respected). The current person is kept unless another person's slot is
 * more than two hours closer, so "Let Nexo pick" does not hand a chore over without need. Null when nothing is free in the next five days.
 */
export function nexoPick(input: PlanInput, item: PlannedItem): Slot | null {
  const slots = candidateSlots(input, item, 40);
  const best = slots[0];
  if (!best) return null;
  const mine = slots.find((s) => s.uid === item.uid);
  if (mine && Math.abs(mine.start - item.start) <= Math.abs(best.start - item.start) + 2 * 60 * MIN) return mine;
  return best;
}
