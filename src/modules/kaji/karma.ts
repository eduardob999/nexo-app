import type { LogEvent, Settings, TaskType } from './model';

const DAY = 86_400_000;

/**
 * Karma for avoidance. His request, 2026-11-21: "a karma penalization system that balances full avoidance of a task only because someone
 * doesn't like it". A dismissal with the reason "I dislike it" owes `karmaShare` of the chore's weight; each repeat of the same chore by the
 * same person within `karmaRepeatDays` of the previous one doubles it; doing that chore once clears everything that person owed for it.
 *
 * Owed, not done: karma is added to the work a person still has to carry, so the planner hands them more. Adding it to the work they
 * have done would hand them less, the opposite of a penalty.
 */
export interface KarmaRow { taskId: string; skips: number; tama: number }
export interface Karma { total: number; rows: KarmaRow[] }

/** `weight` is the chore's weight in tama (burden.ts weightOf), passed in so this file and burden.ts do not import each other. */
export function karmaFor(log: LogEvent[], tasks: TaskType[], weight: (task: TaskType) => number, uid: string, now: number,
  s: Pick<Settings, 'karmaShare' | 'karmaRepeatDays' | 'karmaMaxDoublings' | 'windowDays'>): Karma {
  const share = s.karmaShare ?? 0.5, repeat = (s.karmaRepeatDays ?? 14) * DAY, cap = s.karmaMaxDoublings ?? 5;
  const from = now - s.windowDays * DAY;
  const rows: KarmaRow[] = [];
  for (const task of tasks) {
    const evs = log.filter((e) => e.uid === uid && e.taskId === task.id && e.at <= now && (e.kind === 'done' || (e.kind === 'dismissed' && e.reason === 'dislike'))).sort((a, b) => a.at - b.at);
    let owed: { at: number; tama: number }[] = [];
    let k = 0;
    for (const e of evs) {
      if (e.kind === 'done') { owed = []; k = 0; continue; }
      const last = owed[owed.length - 1];
      k = last && e.at - last.at <= repeat ? k + 1 : 0;
      owed.push({ at: e.at, tama: share * Math.pow(2, Math.min(k, cap)) * weight(task) });
    }
    const live = owed.filter((o) => o.at >= from);
    if (live.length) rows.push({ taskId: task.id, skips: live.length, tama: live.reduce((a, o) => a + o.tama, 0) });
  }
  return { total: rows.reduce((a, r) => a + r.tama, 0), rows };
}
