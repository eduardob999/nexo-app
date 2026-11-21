import { CUSTOM_ID, customTask } from './quicklog';
import type { Estimate, LogEvent, Member, Settings, TaskType } from './model';

const DAY = 86_400_000;

/** Weight of one doing of a chore, in tama. A fixed chore counts at its planned length; a measured one at what has been learned. */
export function weightOf(task: TaskType, est?: Estimate, minutes?: number): number {
  if (task.weightOverride !== undefined) return task.weightOverride;
  const m = minutes ?? (task.mode === 'fixed' ? task.priorMinutes : est && est.n > 0 ? est.meanMin : task.priorMinutes);
  return (m / 10) * (est?.difficulty ?? 1);
}

/** What it costs the person who does it: weight scaled by how much they mind it (dislike 1 to 5). */
export function burdenOf(weight: number, dislike: number, s: Pick<Settings, 'burdenA' | 'burdenB'>): number {
  return weight * (s.burdenA + s.burdenB * clamp(dislike, 1, 5));
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export interface Share { uid: string; weight: number; burden: number; minutes: number; credit: number }
export interface Balance {
  perUid: Record<string, Share>;
  total: number;
  /** Target share by uid, summing to 1. */
  target: Record<string, number>;
  /** Burden done minus burden owed, in tama. Positive: ahead of the target. */
  diff: Record<string, number>;
  /** 1 means exactly on target, 0 means one person carries everything. */
  evenness: number;
}

function dislikeOf(ev: LogEvent, uid: string, est: Estimate | undefined): number {
  if (ev.uid === uid && ev.dislike) return ev.dislike;
  return est?.dislike[uid] ?? 3;
}

/**
 * Rolling balance over the settings window. `awayDays` shrinks a person's target for days they could not do anything, so
 * time away is not a debt. Credit is the burden saved for the other person by doing a chore they mind more.
 */
export function balance(log: LogEvent[], tasks: TaskType[], estimates: Record<string, Estimate>, members: Member[], now: number,
  s: Settings, awayDays: Record<string, number> = {}): Balance {
  const from = now - s.windowDays * DAY;
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const perUid: Record<string, Share> = Object.fromEntries(members.map((m) => [m.uid, { uid: m.uid, weight: 0, burden: 0, minutes: 0, credit: 0 }]));
  for (const ev of log) {
    if (ev.kind !== 'done' || ev.at < from || ev.at > now) continue;
    const task = byId.get(ev.taskId) ?? (ev.taskId === CUSTOM_ID ? customTask(ev.custom ?? '') : undefined);
    if (!task) continue;
    const est = estimates[ev.taskId];
    const parts = ev.split && ev.split.length ? ev.split : [{ uid: ev.uid, minutes: ev.minutes }];
    const sum = parts.reduce((a, p) => a + p.minutes, 0) || 1;
    const fullWeight = weightOf(task, est, task.mode === 'fixed' ? undefined : ev.minutes);
    for (const p of parts) {
      const row = perUid[p.uid];
      if (!row) continue;
      const w = fullWeight * (p.minutes / sum);
      const own = dislikeOf(ev, p.uid, est);
      row.weight += w;
      row.minutes += p.minutes;
      row.burden += burdenOf(w, own, s);
      for (const other of members) {
        if (other.uid === p.uid) continue;
        const theirs = est?.dislike[other.uid] ?? 3;
        if (theirs > own) row.credit += w * (theirs - own) * s.burdenB;
      }
    }
  }
  const total = Object.values(perUid).reduce((a, r) => a + r.burden, 0);
  const raw = Object.fromEntries(members.map((m) => [m.uid, (s.targets?.[m.uid] ?? m.share ?? 1) * clamp(1 - (awayDays[m.uid] ?? 0) / s.windowDays, 0.05, 1)]));
  const rawSum = Object.values(raw).reduce((a, b) => a + b, 0) || 1;
  const target = Object.fromEntries(members.map((m) => [m.uid, (raw[m.uid] ?? 0) / rawSum]));
  const diff = Object.fromEntries(members.map((m) => [m.uid, (perUid[m.uid]?.burden ?? 0) - total * (target[m.uid] ?? 0)]));
  const off = members.reduce((a, m) => a + Math.abs((total ? (perUid[m.uid]?.burden ?? 0) / total : (target[m.uid] ?? 0)) - (target[m.uid] ?? 0)), 0);
  return { perUid, total, target, diff, evenness: clamp(1 - off / 2, 0, 1) };
}
