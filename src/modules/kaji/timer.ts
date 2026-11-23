import type { LogEvent } from './model';

/** One running timer per device. Kept in localStorage so a reload does not lose it. */
export interface Running { taskId: string; itemId?: string | undefined; start: number; pausedAt?: number | undefined }
const KEY = 'kaji.timer';

export function loadTimer(): Running | null {
  try {
    const x = JSON.parse(window.localStorage.getItem(KEY) ?? 'null') as Running | null;
    return x && typeof x.taskId === 'string' && typeof x.start === 'number' ? x : null;
  } catch { return null; }
}
export function saveTimer(r: Running | null): void {
  try { if (r) window.localStorage.setItem(KEY, JSON.stringify(r)); else window.localStorage.removeItem(KEY); } catch { /* private mode */ }
}

/** The instant the clock reads up to: frozen at the pause while paused, otherwise now. */
export const endAt = (r: Running, now: number): number => r.pausedAt ?? now;

/** Freeze the clock. Pausing a paused timer changes nothing. */
export function pauseTimer(r: Running, now: number): Running {
  return r.pausedAt === undefined ? { ...r, pausedAt: now } : r;
}

/** Unfreeze it: the start moves forward by the break, so the elapsed time never counts it. */
export function resumeTimer(r: Running, now: number): Running {
  if (r.pausedAt === undefined) return r;
  const { pausedAt, ...rest } = r;
  return { ...rest, start: r.start + Math.max(0, now - pausedAt) };
}

/** Whole minutes, at least one. */
export function elapsedMin(start: number, now: number): number {
  return Math.max(1, Math.round((now - start) / 60_000));
}

export function clockText(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`;
}

/** When he forgot to stop: the last three times for this chore as one-tap answers, nearest the planned length first, no repeats. */
export function recentAnswers(log: LogEvent[], taskId: string, planned: number): number[] {
  const last = log.filter((e) => e.taskId === taskId && e.kind === 'done' && e.minutes > 0).sort((a, b) => b.at - a.at).slice(0, 3).map((e) => e.minutes);
  return [...new Set([planned, ...last])].slice(0, 4).sort((a, b) => Math.abs(a - planned) - Math.abs(b - planned) || a - b);
}
