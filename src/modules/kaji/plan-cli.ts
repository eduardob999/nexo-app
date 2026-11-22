/**
 * The planner as a command, for the service on the loop's computer: it reads one JSON object on stdin and prints the plan.
 * Same code as the app, bundled by `npm run build:plan` into PM's relaunch/kaji-plan.mjs. No network, no Firebase.
 *   in:  { now, tasks, members, log, survey, settings, busy, away, presence, notToday, swaps, existing, check? }
 *   out: { items, unplaced }, or with `check: true` only { breaks }: why the plan on file no longer holds (empty when it does)
 */
import { estimateFor } from './adapt';
import { migrateTasks } from './catalog';
import { DEFAULT_SETTINGS } from './model';
import { plan, planBreaks, type PlanInput } from './planner';
import { dayKey, weekday } from './time';

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c: string) => { raw += c; });
process.stdin.on('end', () => {
  const i = JSON.parse(raw);
  // the stored chores and settings may predate a change: the same migration and defaults the app applies
  i.tasks = migrateTasks(i.tasks);
  i.settings = { ...DEFAULT_SETTINGS, ...(i.settings ?? {}) };
  const estimates = Object.fromEntries(i.tasks.map((t: { id: string }) => [t.id, estimateFor(i.tasks.find((x: { id: string }) => x.id === t.id), i.log, i.survey, i.members)]));
  const today = dayKey(i.now);
  const declines = (i.swaps ?? []).filter((s: { state: string }) => s.state === 'declined').map((s: { toUid: string; taskId: string; start: number }) => ({ uid: s.toUid, taskId: s.taskId, dow: weekday(s.start) }));
  const input: PlanInput = { now: i.now, horizonDays: 7, tasks: i.tasks, members: i.members, estimates, log: i.log, busy: i.busy ?? {}, existing: i.existing ?? [], settings: i.settings,
    awayUntil: i.away ?? {}, presence: i.presence ?? {}, swaps: i.swaps ?? [], notToday: (i.notToday ?? []).filter((n: { day: string }) => n.day >= today), declines };
  if (i.check) { process.stdout.write(JSON.stringify({ breaks: planBreaks(input) })); return; }
  const out = plan(input);
  process.stdout.write(JSON.stringify({ items: out.items, unplaced: out.unplaced }));
});
