import { clamp } from './burden';
import type { Estimate, LogEvent, Member, Settings, TaskType } from './model';

const DAY = 86_400_000;
export const SURVEY_WEIGHT = 2;

/** Running numbers for one chore from the log and each person's baseline survey answer (1 to 5). Welford for the variance. */
export function estimateFor(task: TaskType, log: LogEvent[], survey: Record<string, Record<string, number>>, members: Member[]): Estimate {
  const done = log.filter((e) => e.taskId === task.id && e.kind === 'done').sort((a, b) => a.at - b.at);
  let n = 0, mean = 0, m2 = 0;
  for (const e of done) {
    if (!(e.minutes > 0)) continue;
    n += 1;
    const d = e.minutes - mean;
    mean += d / n;
    m2 += d * (e.minutes - mean);
  }
  const efforts = done.map((e) => e.effort).filter((x): x is number => typeof x === 'number');
  const difficulty = efforts.length >= 3 ? clamp(efforts.reduce((a, b) => a + b, 0) / efforts.length / 3, 0.6, 1.6) : 1;
  const dislike: Record<string, number> = {};
  for (const m of members) {
    const rated = done.filter((e) => e.uid === m.uid && typeof e.dislike === 'number').map((e) => e.dislike as number);
    const s = survey[m.uid]?.[task.id];
    const wS = typeof s === 'number' ? SURVEY_WEIGHT : 0;
    const total = wS + rated.length;
    dislike[m.uid] = total ? ((typeof s === 'number' ? s * wS : 0) + rated.reduce((a, b) => a + b, 0)) / total : 3;
  }
  return { n, meanMin: n ? mean : task.priorMinutes, varMin: n > 1 ? m2 / (n - 1) : 0, difficulty, dislike, stableSince: stableRun(done.map((e) => e.minutes), mean) };
}

/** How many of the latest samples sit within 20 percent of the mean, counted back until one does not. */
export function stableRun(minutes: number[], mean: number): number {
  let run = 0;
  for (let i = minutes.length - 1; i >= 0; i--) {
    const m = minutes[i] as number;
    if (mean > 0 && Math.abs(m - mean) / mean <= 0.2) run += 1; else break;
  }
  return run;
}

export function cv(est: Estimate): number {
  return est.meanMin > 0 && est.n > 1 ? Math.sqrt(est.varMin) / est.meanMin : 1;
}

export type Maturity = 'new' | 'learning' | 'stable' | 'settled';

/** new: fewer than three samples. learning: not yet steady. stable: five samples under 15 percent spread. settled: stable for three weeks. */
export function maturity(est: Estimate, task: TaskType, log: LogEvent[], now: number): Maturity {
  if (task.mode === 'fixed') return est.n < 3 ? 'learning' : 'stable';
  if (est.n < 3) return 'new';
  if (est.n < 5 || cv(est) > 0.15 || est.stableSince < 5) return 'learning';
  const recent = log.filter((e) => e.taskId === task.id && e.kind === 'done').sort((a, b) => a.at - b.at);
  const fifth = recent[recent.length - est.stableSince];
  return fifth && now - fifth.at >= 21 * DAY ? 'settled' : 'stable';
}

/** The last four samples against the ones before them: a change of 25 percent or more means a new routine, so ask again. */
export function drifted(log: LogEvent[], taskId: string): boolean {
  const xs = log.filter((e) => e.taskId === taskId && e.kind === 'done' && e.minutes > 0).sort((a, b) => a.at - b.at).map((e) => e.minutes);
  if (xs.length < 8) return false;
  const last = xs.slice(-4), before = xs.slice(0, -4);
  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  return Math.abs(avg(last) - avg(before)) / avg(before) >= 0.25;
}

export interface AskRates { timer: number; rating: number }

/** Probability of offering the timer and of asking for the three ratings. Falls as the chore settles. */
export function askRates(mat: Maturity, isDrifted: boolean, task: TaskType, s: Pick<Settings, 'askFloor'>): AskRates {
  if (isDrifted) return { timer: task.mode === 'fixed' ? 0 : 1, rating: 1 };
  const timer = task.mode === 'fixed' ? 0 : mat === 'new' || mat === 'learning' ? 1 : mat === 'stable' ? 0.25 : s.askFloor;
  const rating = mat === 'new' || mat === 'learning' ? 1 : mat === 'stable' ? 0.25 : s.askFloor;
  return { timer, rating };
}

export function shouldAsk(p: number, rand: () => number = Math.random): boolean {
  return p >= 1 || (p > 0 && rand() < p);
}

/** How many times in the last seven days a person was asked to time or rate: the number the app shows falling. */
export function dataQuestions(log: LogEvent[], now: number): number {
  return log.filter((e) => e.at >= now - 7 * DAY && e.at <= now && e.kind === 'done' &&
    (typeof e.effort === 'number' || typeof e.dislike === 'number' || typeof e.enjoyment === 'number' || e.start !== undefined)).length;
}
