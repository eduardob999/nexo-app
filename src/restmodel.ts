import { ymd } from './alarm';
import { addDays } from './sleepmodel';

/** One day of rest, as stored in users/{uid}/rest/{date}. Written straight to Firestore like sleep, no sync intent. */
export interface RestRec {
  /** The rest day, YYYY-MM-DD. */
  date: string;
  kind: 'full' | 'light';
  /** 1 to 5, asked in the evening of the rest day: how he feels. */
  wellbeing: number | null;
  /** 1 to 5, asked in the evening of the day after: how focus and output were. */
  performance: number | null;
  activities?: Record<string, boolean> | undefined;
  note?: string | undefined;
  source?: string | undefined;
}

export const ACTIVITIES = [
  { key: 'sleptIn', label: 'Slept in' },
  { key: 'outside', label: 'Went outside' },
  { key: 'social', label: 'Saw people' },
  { key: 'hobby', label: 'Hobby or games' },
  { key: 'screens', label: 'Mostly screens' },
  { key: 'chores', label: 'Chores or errands' },
  { key: 'worry', label: 'Could not switch off' },
] as const;

/** A rest day is asked about in the evening, and its aftermath the evening after. */
export const WELLBEING_FROM_HOUR = 18;
export const PERFORMANCE_FROM_HOUR = 17;
/** A question nobody answered is dropped after this many days instead of nagging for ever. */
export const ASK_WINDOW_DAYS = 3;

export interface RestAsk {
  date: string;
  ask: 'wellbeing' | 'performance';
}

/**
 * What to ask him now, if anything. Wellbeing first: a rest day with no wellbeing rating, from 18:00 on that day
 * or any time on a later day. Then performance: the day after a rest day, from 17:00, or any later time.
 * Only the last few days count, so a forgotten day does not come back a month later.
 */
export function restDue(recs: RestRec[], now: Date): RestAsk | null {
  const today = ymd(now);
  const oldest = addDays(today, -ASK_WINDOW_DAYS);
  const recent = recs.filter((r) => r.date >= oldest && r.date <= today).sort((a, b) => b.date.localeCompare(a.date));
  const well = recent.find((r) => r.wellbeing === null && (r.date < today || now.getHours() >= WELLBEING_FROM_HOUR));
  if (well) return { date: well.date, ask: 'wellbeing' };
  const perf = recent.find((r) => {
    if (r.performance !== null) return false;
    const next = addDays(r.date, 1);
    return next < today || (next === today && now.getHours() >= PERFORMANCE_FROM_HOUR);
  });
  return perf ? { date: perf.date, ask: 'performance' } : null;
}

export interface RestStats {
  days: number;
  full: number;
  avgWellbeing: number | null;
  avgPerformance: number | null;
}

const avg = (xs: number[]): number | null => (xs.length === 0 ? null : Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10);

export function restStats(recs: RestRec[]): RestStats {
  return {
    days: recs.length,
    full: recs.filter((r) => r.kind === 'full').length,
    avgWellbeing: avg(recs.flatMap((r) => (r.wellbeing === null ? [] : [r.wellbeing]))),
    avgPerformance: avg(recs.flatMap((r) => (r.performance === null ? [] : [r.performance]))),
  };
}

/** Rest days newest first. */
export function newestFirst(recs: RestRec[]): RestRec[] {
  return [...recs].sort((a, b) => b.date.localeCompare(a.date));
}
