/**
 * The planner as a command, for the service on the loop's computer: it reads one JSON object on stdin and prints the plan.
 * Same code as the app, bundled by `npm run build:plan` into PM's relaunch/kaji-plan.mjs. No network, no Firebase.
 *   in:  { now, tasks, members, log, survey, settings, busy, away, notToday, swaps, existing }
 *   out: { items, unplaced }
 */
import { estimateFor } from './adapt';
import { plan } from './planner';
import { dayKey, weekday } from './time';

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c: string) => { raw += c; });
process.stdin.on('end', () => {
  const i = JSON.parse(raw);
  const estimates = Object.fromEntries(i.tasks.map((t: { id: string }) => [t.id, estimateFor(i.tasks.find((x: { id: string }) => x.id === t.id), i.log, i.survey, i.members)]));
  const today = dayKey(i.now);
  const declines = (i.swaps ?? []).filter((s: { state: string }) => s.state === 'declined').map((s: { toUid: string; taskId: string; start: number }) => ({ uid: s.toUid, taskId: s.taskId, dow: weekday(s.start) }));
  const out = plan({ now: i.now, horizonDays: 7, tasks: i.tasks, members: i.members, estimates, log: i.log, busy: i.busy ?? {}, existing: i.existing ?? [], settings: i.settings,
    awayUntil: i.away ?? {}, swaps: i.swaps ?? [], notToday: (i.notToday ?? []).filter((n: { day: string }) => n.day >= today), declines });
  process.stdout.write(JSON.stringify({ items: out.items, unplaced: out.unplaced }));
});
