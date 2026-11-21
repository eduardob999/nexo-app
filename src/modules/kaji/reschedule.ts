import type { LogEvent, PlannedItem, Reason, Settings, TaskType } from './model';
import { atHm, dayKey, dayStart, DAY, hm, JST, MIN } from './time';

/**
 * Rescheduling and dismissing a planned chore, and what the household's own moves teach the planner. All pure: the same log always gives
 * the same answer, so the app, the service and the tests agree, and nothing is stored twice (the learned shift is recomputed from the
 * append-only log each time, never written into the chore, so it cannot compound).
 */

const GRID = 15 * MIN;
export const NEEDS_REASON: Reason[] = ['not_needed', 'no_time', 'not_enough', 'other'];

/** A dismissal must say why: a preset, or `other` with some words. */
export function reasonValid(reason: Reason | null, text: string): boolean {
  if (!reason) return false;
  return reason !== 'other' || text.trim().length > 0;
}

export interface RescheduleOption { id: 'later' | 'evening' | 'tomorrow'; start: number }

const roundUp = (ms: number) => Math.ceil(ms / GRID) * GRID;

/** The one-tap choices: later today (two hours on), this evening, and tomorrow at the same time. Choices that would run into the quiet hours are left out. */
export function rescheduleOptions(item: PlannedItem, now: number, s: Pick<Settings, 'quiet'>, tz = JST): RescheduleOption[] {
  const len = item.end - item.start;
  const today = dayStart(now, tz);
  const quietEnd = atHm(today, s.quiet.from);
  const fits = (start: number) => start + len <= quietEnd;
  const out: RescheduleOption[] = [];
  const later = roundUp(Math.max(now, item.start) + 2 * 3_600_000);
  if (fits(later)) out.push({ id: 'later', start: later });
  const evening = atHm(today, '19:00');
  if (evening > now + 30 * MIN && fits(evening) && (!out[0] || Math.abs(evening - out[0].start) >= 45 * MIN)) out.push({ id: 'evening', start: evening });
  const clock = item.start - dayStart(item.start, tz);
  const tomorrow = today + DAY + Math.max(clock, hm('07:30') * MIN);
  out.push({ id: 'tomorrow', start: tomorrow });
  return out;
}

/** What the planner must not place again: one occurrence of a chore on a local day. */
export interface Skip { taskId: string; day: string; at: number; reason: Reason | 'moved' }

/** Dismissed chores, and chores moved to another day, from today on. A same-day move is held by its pinned item instead. */
export function skipsFromLog(log: LogEvent[], now: number, tz = JST): Skip[] {
  const out: Skip[] = [];
  const from = dayStart(now, tz);
  for (const e of log) {
    if (typeof e.plannedStart !== 'number' || e.plannedStart < from) continue;
    if (e.kind === 'dismissed') out.push({ taskId: e.taskId, day: dayKey(e.plannedStart, tz), at: e.plannedStart, reason: e.reason ?? 'other' });
    else if (e.kind === 'rescheduled' && typeof e.newStart === 'number' && dayKey(e.newStart, tz) !== dayKey(e.plannedStart, tz)) out.push({ taskId: e.taskId, day: dayKey(e.plannedStart, tz), at: e.plannedStart, reason: 'moved' });
  }
  return out;
}

/** When a chore was last settled without being done: dismissed because it was not needed (not merely not today), so the next one counts from there. */
export function dismissedAt(log: LogEvent[], taskId: string): number {
  return log.filter((e) => e.taskId === taskId && e.kind === 'dismissed' && e.reason !== 'no_time' && typeof e.plannedStart === 'number')
    .reduce((m, e) => Math.max(m, e.plannedStart as number), 0);
}

// ---- learning

export interface LearnedShift {
  taskId: string;
  kind: 'window' | 'freq';
  /** window: minutes the window moved (negative is earlier). freq: how many times longer the gap between occurrences became. */
  value: number;
  /** The samples behind it. */
  n: number;
}

const WINDOW_DAYS = 60, FREQ_DAYS = 28;
const MAX_SHIFT = 180, MAX_STRETCH = 2;
/** The share of the observed move that is applied: large for the first agreeing samples, shrinking as they pile up, never under 10 percent, and no single step over 45 minutes. */
export const learnRate = (k: number): number => Math.max(0.1, 0.35 / Math.sqrt(Math.max(1, k)));

/** Minutes of clock difference between two instants, ignoring which day each is on (moving to "tomorrow, same time" is not a shift). */
function clockDelta(from: number, to: number, tz: number): number {
  const a = ((from + tz * MIN) % DAY + DAY) % DAY, b = ((to + tz * MIN) % DAY + DAY) % DAY;
  return Math.round((((b - a) / MIN + 720) % 1440 + 1440) % 1440 - 720);
}

/** Evidence for moving a chore's window: every reschedule that moved the clock time, and every "no time" dismissal (read as "later", +60). */
function windowEvidence(log: LogEvent[], taskId: string, now: number, tz: number): number[] {
  const out: number[] = [];
  for (const e of [...log].sort((a, b) => a.at - b.at)) {
    if (e.taskId !== taskId || e.at < now - WINDOW_DAYS * DAY || typeof e.plannedStart !== 'number') continue;
    if (e.kind === 'rescheduled' && typeof e.newStart === 'number') {
      const d = clockDelta(e.plannedStart, e.newStart, tz);
      if (Math.abs(d) >= 20 && Math.abs(d) <= 240) out.push(d);
    } else if (e.kind === 'dismissed' && e.reason === 'no_time') out.push(60);
  }
  return out;
}

/** How far the window has moved, by folding the evidence in order: the first sample alone changes nothing, each later one that agrees with the one before moves it by a falling share. */
export function windowOffset(evidence: number[]): { offset: number; n: number } {
  let off = 0, k = 0, last = 0;
  for (const d of evidence) {
    const sign = Math.sign(d);
    if (sign === last && sign !== 0) { k += 1; off += Math.max(-45, Math.min(45, learnRate(k) * d)); }
    last = sign;
  }
  const q = Math.round(off / 15) * 15;
  return { offset: Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, q)), n: evidence.length };
}

/** Dismissals because it was not needed or there was not enough: they say the chore comes round too often. */
function freqStretch(log: LogEvent[], task: TaskType, now: number): { stretch: number; n: number } {
  const recent = log.filter((e) => e.taskId === task.id && e.at >= now - FREQ_DAYS * DAY);
  const d = recent.filter((e) => e.kind === 'dismissed' && (e.reason === 'not_needed' || e.reason === 'not_enough')).length;
  if (d < 2) return { stretch: 1, n: d };
  const done = recent.filter((e) => e.kind === 'done').length;
  const ratio = d / (d + done + 2);
  return { stretch: 1 + Math.min(MAX_STRETCH - 1, 2 * ratio * learnRate(d - 1)), n: d };
}

const shiftWindow = (w: { from: string; to: string }, off: number): { from: string; to: string } => {
  const len = hm(w.to) - hm(w.from);
  const from = Math.max(6 * 60, Math.min(23 * 60 - len, hm(w.from) + off));
  const f = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  return { from: f(from), to: f(from + len) };
};

/** Every shift the log currently implies, for the planner and for the change history on More. */
export function learnShifts(tasks: TaskType[], log: LogEvent[], now: number, tz = JST): LearnedShift[] {
  const out: LearnedShift[] = [];
  for (const task of tasks) {
    if (!task.active || task.freq.adhoc) continue;
    const w = windowOffset(windowEvidence(log, task.id, now, tz));
    if (w.offset !== 0) out.push({ taskId: task.id, kind: 'window', value: w.offset, n: w.n });
    const f = freqStretch(log, task, now);
    if (f.stretch > 1.05 && task.freq.times === 1 && !task.freq.weekdaysOnly) out.push({ taskId: task.id, kind: 'freq', value: Math.round(f.stretch * 100) / 100, n: f.n });
  }
  return out;
}

/** The chores as the planner should see them: windows moved and gaps stretched by what the log has taught. The stored chores are never touched. */
export function applyLearned(tasks: TaskType[], log: LogEvent[], now: number, s: Pick<Settings, 'slot'>, tz = JST): TaskType[] {
  const shifts = learnShifts(tasks, log, now, tz);
  if (!shifts.length) return tasks;
  return tasks.map((task) => {
    let x = task;
    for (const sh of shifts.filter((q) => q.taskId === task.id)) {
      if (sh.kind === 'window') {
        if (x.windows && x.windows.length === x.freq.times) x = { ...x, windows: x.windows.map((w) => shiftWindow(w, sh.value)) };
        else x = { ...x, window: shiftWindow(x.window ?? s.slot, sh.value) };
      } else x = { ...x, freq: { ...x.freq, perDays: x.freq.perDays * sh.value } };
    }
    return x;
  });
}
