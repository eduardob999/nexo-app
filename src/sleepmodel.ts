import { suggestWake, ymd, type WakePrefs } from './alarm';
import type { Card } from './types';

/** One night, as stored in users/{uid}/sleep/{night}. */
export interface SleepRec {
  night: string;
  bed: string;
  wake: string | null;
  rating: number | null;
  factors?: Record<string, boolean | number> | undefined;
  note?: string | undefined;
  source?: string | undefined;
}

export const FACTORS = [
  { key: 'caffeine', label: 'Caffeine after 15:00' },
  { key: 'alcohol', label: 'Alcohol' },
  { key: 'screen', label: 'Screen in the last hour' },
  { key: 'exercise', label: 'Exercise' },
  { key: 'stress', label: 'Stress' },
  { key: 'nap', label: 'Nap yesterday' },
  { key: 'wokeNight', label: 'Woke up during the night' },
  { key: 'lateMeal', label: 'Late heavy meal' },
  { key: 'noiseLight', label: 'Noise or light' },
  { key: 'slowToSleep', label: 'Took long to fall asleep' },
] as const;
export type FactorKey = (typeof FACTORS)[number]['key'];

export const PRIOR_HOURS = 7.5;
export const MIN_HOURS = 6;
export const MAX_HOURS = 9.5;
export const WIND_DOWN_MIN = 30;
export const MAX_PAYBACK_MIN = 45;
export const PRIOR_FALL_MIN = 15;
const MAX_DEBT_H = 5;
const DAY = 86_400_000;

// ---------- dates ----------

export function parseKey(k: string): Date {
  const [y, m, d] = k.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

export function addDays(key: string, n: number): string {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return ymd(d);
}

/** The night a bedtime belongs to: the local date of the bedtime when it is from 12:00 on, else the day before. */
export function nightKey(bed: Date): string {
  const d = new Date(bed.getFullYear(), bed.getMonth(), bed.getDate());
  if (bed.getHours() < 12) d.setDate(d.getDate() - 1);
  return ymd(d);
}

/** ISO with the local offset, the shape the records already use (+09:00). */
export function isoLocal(d: Date): string {
  const p = (n: number, w = 2) => String(Math.abs(n)).padStart(w, '0');
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}${sign}${p(Math.floor(Math.abs(off) / 60))}:${p(Math.abs(off) % 60)}`;
}

export function minuteOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "7 h 40" for 7.67. */
export function fmtHours(h: number): string {
  const total = Math.round(h * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return mm === 0 ? `${hh} h` : `${hh} h ${String(mm).padStart(2, '0')}`;
}

/** The date a bedtime on `night` falls on, given a clock time: from 12:00 on it is that day, earlier it is after midnight. */
export function bedDate(night: string, hour: number, minute: number): Date {
  const d = parseKey(hour >= 12 ? night : addDays(night, 1));
  d.setHours(hour, minute, 0, 0);
  return d;
}

/** Wake is always on the morning after the night. */
export function wakeDate(night: string, hour: number, minute: number): Date {
  const d = parseKey(addDays(night, 1));
  d.setHours(hour, minute, 0, 0);
  return d;
}

/** Waking on a Saturday or Sunday morning makes the night before a weekend night. */
export function isWeekendNight(night: string): boolean {
  const dow = parseKey(addDays(night, 1)).getDay();
  return dow === 0 || dow === 6;
}

// ---------- records ----------

export function durationHours(r: SleepRec): number | null {
  if (!r.wake) return null;
  const h = (new Date(r.wake).getTime() - new Date(r.bed).getTime()) / 3_600_000;
  // A forgotten press leaves a bedtime and a wake a day apart, or a wake before the bed: neither is a night.
  return Number.isFinite(h) && h >= 2 && h <= 16 ? h : null;
}

function ageDays(night: string, now: Date): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((today.getTime() - parseKey(night).getTime()) / DAY));
}

/** Recent nights count more: a half-life of three weeks. */
function weight(night: string, now: Date): number {
  return 0.5 ** (ageDays(night, now) / 21);
}

interface Evidence { night: string; value: number; w: number; weekend: boolean }

/**
 * What each night says about how long he needs. A night rated 4 or 5 says "this length is enough".
 * A short night rated 1 or 2 says "more than this"; it counts as 1.5 hours longer than it was, and never less than 8 h.
 */
export function evidence(recs: SleepRec[], now: Date): Evidence[] {
  const out: Evidence[] = [];
  for (const r of recs) {
    const dur = durationHours(r);
    if (dur === null || r.rating === null || r.rating === undefined) continue;
    let value: number | null = null;
    if (r.rating >= 4) value = dur;
    else if (r.rating <= 2 && dur < PRIOR_HOURS) value = Math.min(MAX_HOURS, Math.max(dur + 1.5, PRIOR_HOURS + 0.5));
    if (value === null) continue;
    out.push({ night: r.night, value, w: weight(r.night, now), weekend: isWeekendNight(r.night) });
  }
  return out;
}

const wmean = (xs: Evidence[]) => xs.reduce((a, x) => a + x.w * x.value, 0) / xs.reduce((a, x) => a + x.w, 0);
const PRIOR_WEIGHT = 2;

export interface Need { hours: number; n: number }

/** Hours of sleep he needs. `weekend` says which kind of night is being planned, when that matters. */
export function neededHours(recs: SleepRec[], now: Date, weekend?: boolean): Need {
  const ev = evidence(recs, now);
  const sumW = ev.reduce((a, x) => a + x.w, 0);
  let hours = (PRIOR_HOURS * PRIOR_WEIGHT + ev.reduce((a, x) => a + x.w * x.value, 0)) / (PRIOR_WEIGHT + sumW);
  if (weekend !== undefined) {
    const same = ev.filter((x) => x.weekend === weekend);
    const other = ev.filter((x) => x.weekend !== weekend);
    if (same.length >= 3 && other.length >= 3) {
      const offset = (wmean(same) - wmean(ev)) * 0.5;
      hours += Math.max(-1, Math.min(1, offset));
    }
  }
  hours = Math.max(MIN_HOURS, Math.min(MAX_HOURS, hours));
  return { hours: Math.round(hours * 12) / 12, n: ev.length };
}

/** Shortfall against the need over the last 7 nights. A long night does not erase a short one beyond what it made up. */
export function sleepDebt(recs: SleepRec[], now: Date, need: number): number {
  let debt = 0;
  for (const r of recs) {
    const dur = durationHours(r);
    if (dur === null) continue;
    const age = ageDays(r.night, now);
    if (age > 7) continue;
    debt += Math.max(-1, Math.min(3, need - dur));
  }
  return Math.max(0, Math.min(MAX_DEBT_H, debt));
}

/** A quarter of the debt, in 5 minute steps, never more than 45 minutes of extra sleep in one night. */
export function paybackMinutes(debtHours: number): number {
  return Math.min(MAX_PAYBACK_MIN, Math.round((debtHours * 60) / 4 / 5) * 5);
}

/** Minutes to fall asleep: 15 until he says it took long on some nights, up to 45. */
export function fallAsleepMinutes(recs: SleepRec[]): number {
  const rated = [...recs].filter((r) => r.rating !== null && r.rating !== undefined).sort((a, b) => b.night.localeCompare(a.night)).slice(0, 14);
  if (rated.length < 3) return PRIOR_FALL_MIN;
  const slow = rated.filter((r) => r.factors?.['slowToSleep'] === true).length;
  return PRIOR_FALL_MIN + Math.round(((slow / rated.length) * 30) / 5) * 5;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2;
}

/** The wake-up time he actually keeps, in minutes after midnight, or null when there are fewer than 3 recorded mornings. */
export function learnedUsualWake(recs: SleepRec[], weekend: boolean): number | null {
  const withWake = [...recs].filter((r) => r.wake).sort((a, b) => b.night.localeCompare(a.night)).slice(0, 14)
    .map((r) => ({ weekend: isWeekendNight(r.night), m: minuteOfDay(new Date(r.wake as string)) }))
    .filter((x) => x.m >= 3 * 60 && x.m <= 12 * 60);
  if (withWake.length < 3) return null;
  const same = withWake.filter((x) => x.weekend === weekend);
  const pool = same.length >= 3 ? same : withWake;
  return Math.round(median(pool.map((x) => x.m)) / 5) * 5;
}

// ---------- the plan ----------

export type Confidence = 'low' | 'medium' | 'high';

export interface SleepPlan {
  forNight: string;
  wakeAt: Date;
  bedAt: Date;
  windDownAt: Date;
  needHours: number;
  debtHours: number;
  paybackMin: number;
  fallMin: number;
  confidence: Confidence;
  evidenceN: number;
  weekend: boolean;
  basis: 'travel' | 'home' | 'usual';
  first?: { title: string; at: number; place?: string };
  reason: string;
}

export interface PlanInput { recs: SleepRec[]; cards: Card[]; now: Date; prefs: WakePrefs }

export function planSleep({ recs, cards, now, prefs }: PlanInput): SleepPlan {
  const forNight = now.getHours() >= 12 ? ymd(now) : addDays(ymd(now), -1);
  const wakeDay = parseKey(addDays(forNight, 1));
  const weekend = isWeekendNight(forNight);
  const need = neededHours(recs, now, weekend);
  const debt = sleepDebt(recs, now, need.hours);
  const payback = paybackMinutes(debt);
  const fall = fallAsleepMinutes(recs);

  const usual = learnedUsualWake(recs, weekend);
  const effective: WakePrefs = usual === null ? prefs : { ...prefs, usual };
  // suggestWake looks at the morning after the day of the date it is given, so ask it from the evening of `forNight`.
  const ref = parseKey(forNight);
  ref.setHours(12);
  const s = suggestWake(cards, ref, effective);
  const wakeMin = Math.floor(s.minutes / 5) * 5;
  const wakeAt = new Date(wakeDay.getFullYear(), wakeDay.getMonth(), wakeDay.getDate(), 0, wakeMin);
  const bedAt = new Date(wakeAt.getTime() - (Math.round(need.hours * 60) + payback + fall) * 60_000);
  bedAt.setMinutes(Math.floor(bedAt.getMinutes() / 5) * 5, 0, 0);
  const windDownAt = new Date(bedAt.getTime() - WIND_DOWN_MIN * 60_000);

  const confidence: Confidence = need.n < 3 ? 'low' : need.n < 8 ? 'medium' : 'high';
  let reason = need.n >= 3
    ? `Based on ${need.n} nights, you feel best at about ${fmtHours(need.hours)}.`
    : `Starting from ${fmtHours(need.hours)} until a few more nights are rated.`;
  if (payback > 0) reason += ` Adding ${payback} min to catch up.`;

  return {
    forNight, wakeAt, bedAt, windDownAt,
    needHours: need.hours, debtHours: Math.round(debt * 10) / 10, paybackMin: payback, fallMin: fall,
    confidence, evidenceN: need.n, weekend, basis: s.basis, ...(s.first ? { first: s.first } : {}), reason,
  };
}

/** The shape written to meta/sleepPlan for the sync to read: clock strings, with the night saying which dates they fall on. */
export function planDoc(p: SleepPlan): { forNight: string; bedtime: string; windDown: string; wake: string; needHours: number; reason: string } {
  return { forNight: p.forNight, bedtime: hhmm(p.bedAt), windDown: hhmm(p.windDownAt), wake: hhmm(p.wakeAt), needHours: p.needHours, reason: p.reason };
}

// ---------- the card's state ----------

export type SleepPhase =
  | { kind: 'asleep'; rec: SleepRec }
  | { kind: 'rate'; rec: SleepRec }
  | { kind: 'evening' }
  | { kind: 'none' };

/**
 * What the card should offer. A record with a bedtime and no wake is "asleep" until the morning, then "I'm up".
 * A record with a wake and no rating asks for the rating for 18 hours. Otherwise the evening shows the plan.
 */
export function phaseOf(recs: SleepRec[], now: Date): SleepPhase {
  const latest = [...recs].sort((a, b) => b.bed.localeCompare(a.bed))[0];
  if (latest && !latest.wake) {
    const since = now.getTime() - new Date(latest.bed).getTime();
    if (since >= 0 && since < 24 * 3_600_000) return { kind: 'asleep', rec: latest };
  }
  if (latest?.wake && (latest.rating === null || latest.rating === undefined)) {
    const since = now.getTime() - new Date(latest.wake).getTime();
    if (since >= 0 && since < 18 * 3_600_000) return { kind: 'rate', rec: latest };
  }
  if (now.getHours() >= 18) return { kind: 'evening' };
  return { kind: 'none' };
}

/** Whether the open record should show "I'm up" rather than "Good night": from 04:00, or more than 3 hours after the bedtime. */
export function isMorning(rec: SleepRec, now: Date): boolean {
  const since = now.getTime() - new Date(rec.bed).getTime();
  return now.getHours() >= 4 && now.getHours() < 18 && since > 2 * 3_600_000;
}

// ---------- insights ----------

/** Position on the chart axis, 20:00 at 0 and 12:00 the next day at 1. */
export function axisPos(d: Date): number {
  const m = (minuteOfDay(d) - 20 * 60 + 1440) % 1440;
  return Math.max(0, Math.min(1, m / (16 * 60)));
}

export interface Bar { night: string; rec?: SleepRec; start?: number; end?: number }

/** The last `count` nights ending with `lastNight`, oldest first, with gaps kept so a missed night shows as empty. */
export function bars(recs: SleepRec[], lastNight: string, count = 14): Bar[] {
  const byNight = new Map(recs.map((r) => [r.night, r]));
  const out: Bar[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const night = addDays(lastNight, -i);
    const rec = byNight.get(night);
    if (rec && rec.wake && durationHours(rec) !== null) out.push({ night, rec, start: axisPos(new Date(rec.bed)), end: axisPos(new Date(rec.wake)) });
    else out.push(rec ? { night, rec } : { night });
  }
  return out;
}

export interface FactorEffect {
  key: string;
  label: string;
  nWith: number;
  nWithout: number;
  diff: number | null;
  verdict: 'helps' | 'hurts' | 'none' | 'unknown';
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs: number[]) => { const m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))); };

/** How the rating differs on nights with a factor against nights without it. Needs 3 nights in each group. */
export function factorEffects(recs: SleepRec[]): FactorEffect[] {
  const rated = recs.filter((r) => r.rating !== null && r.rating !== undefined && r.factors);
  return FACTORS.map((f) => {
    const w = rated.filter((r) => r.factors?.[f.key] === true).map((r) => r.rating as number);
    const wo = rated.filter((r) => r.factors?.[f.key] !== true).map((r) => r.rating as number);
    if (w.length < 3 || wo.length < 3) return { key: f.key, label: f.label, nWith: w.length, nWithout: wo.length, diff: null, verdict: 'unknown' as const };
    const diff = Math.round((mean(w) - mean(wo)) * 10) / 10;
    return { key: f.key, label: f.label, nWith: w.length, nWithout: wo.length, diff, verdict: diff <= -0.4 ? 'hurts' as const : diff >= 0.4 ? 'helps' as const : 'none' as const };
  });
}

export interface SleepStats {
  nights: number;
  avgHours: number | null;
  avgBed: string | null;
  avgWake: string | null;
  bedSpreadMin: number | null;
  consistency: 'steady' | 'uneven' | 'irregular' | null;
  avgRating: number | null;
  bestHours: number | null;
}

function fromAxis(m: number): string {
  const t = ((m + 720) % 1440 + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.round(t % 60)).padStart(2, '0')}`;
}

export function sleepStats(recs: SleepRec[], lastNight: string, days = 14): SleepStats {
  const since = addDays(lastNight, -(days - 1));
  const win = recs.filter((r) => r.night >= since && r.night <= lastNight);
  const done = win.filter((r) => durationHours(r) !== null);
  const beds = win.map((r) => (minuteOfDay(new Date(r.bed)) - 720 + 1440) % 1440);
  const wakes = done.map((r) => minuteOfDay(new Date(r.wake as string)));
  const ratings = win.filter((r) => r.rating !== null && r.rating !== undefined).map((r) => r.rating as number);
  const good = done.filter((r) => (r.rating ?? 0) >= 4).map((r) => durationHours(r) as number);
  const spread = beds.length >= 3 ? sd(beds) : null;
  return {
    nights: win.length,
    avgHours: done.length ? mean(done.map((r) => durationHours(r) as number)) : null,
    avgBed: beds.length ? fromAxis(mean(beds)) : null,
    avgWake: wakes.length ? `${String(Math.floor(mean(wakes) / 60)).padStart(2, '0')}:${String(Math.round(mean(wakes) % 60)).padStart(2, '0')}` : null,
    bedSpreadMin: spread === null ? null : Math.round(spread),
    consistency: spread === null ? null : spread < 30 ? 'steady' : spread < 60 ? 'uneven' : 'irregular',
    avgRating: ratings.length ? mean(ratings) : null,
    bestHours: good.length >= 2 ? mean(good) : null,
  };
}
