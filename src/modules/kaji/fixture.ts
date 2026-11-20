import { estimateFor } from './adapt';
import { SEED } from './catalog';
import { DEFAULT_SETTINGS, type Interval, type LogEvent, type Member } from './model';
import { plan } from './planner';
import type { KajiActions, KajiData } from './ui';
import { atHm, dayStart, DAY, MIN } from './time';

/** Invented data for the dev preview and render checks: a Friday evening, three weeks of history, two people. */
export const NOW = Date.parse('2026-11-20T18:05:00+09:00');
const A: Member = { uid: 'a', name: 'Eduardo', lang: 'es', role: 'owner' };
const B: Member = { uid: 'b', name: 'Carla', lang: 'en', role: 'member' };

export function kajiFixture(now = NOW): { data: KajiData; actions: KajiActions } {
  const members = [A, B];
  const log: LogEvent[] = [];
  let n = 0;
  const add = (taskId: string, uid: string, at: number, minutes: number, extra: Partial<LogEvent> = {}) => log.push({ id: `f${n++}`, taskId, uid, kind: 'done', at, minutes, planned: true, ...extra });
  for (let d = 21; d >= 1; d--) {
    const day = dayStart(now) - d * DAY;
    add('cena', d % 2 ? 'a' : 'b', atHm(day, '19:10'), 45);
    add('platos', d % 3 ? 'b' : 'a', atHm(day, '20:20'), 12 + (d % 4), { dislike: d % 3 ? 4 : 2, effort: 2 });
    add('basura', d % 2 ? 'b' : 'a', atHm(day, '19:50'), 5);
    if (d % 4 === 0) add('aspirar', d % 8 ? 'a' : 'b', atHm(day, '18:30'), 20 + (d % 3), { dislike: 3, effort: 3 });
    if (d % 7 === 2) add('bano-profundo', 'a', atHm(day, '17:40'), 50, { dislike: 5, effort: 4 });
    if (d % 3 === 1) add('poceta', 'b', atHm(day, '18:00'), 9, { dislike: 2, effort: 2 });
    if (d % 4 === 1) add('ropa', d % 8 === 1 ? 'a' : 'b', atHm(day, '18:10'), 15, { dislike: 2 });
  }
  const survey = { a: { cena: 2, platos: 4, 'bano-profundo': 5, poceta: 4 }, b: { cena: 3, platos: 2, 'bano-profundo': 2, poceta: 2 } };
  const estimates = Object.fromEntries(SEED.map((t) => [t.id, estimateFor(t, log, survey, members)]));
  const busy: Record<string, Interval[]> = {
    a: [{ start: atHm(dayStart(now) + DAY, '11:00'), end: atHm(dayStart(now) + DAY, '13:00'), place: '園山大弓場' }, { start: atHm(dayStart(now) + 3 * DAY, '10:00'), end: atHm(dayStart(now) + 3 * DAY, '19:00'), place: 'Uji campus' }],
    b: [{ start: atHm(dayStart(now) + 2 * DAY, '17:00'), end: atHm(dayStart(now) + 2 * DAY, '21:00'), label: 'Class' }],
  };
  const out = plan({ now, horizonDays: 7, tasks: SEED, members, estimates, log, busy, existing: [], settings: DEFAULT_SETTINGS });
  const data: KajiData = {
    hid: 'h', me: 'a', house: { name: 'Casa', members: { a: 'owner', b: 'member' }, createdAt: now - 30 * DAY, names: { a: 'Eduardo', b: 'Carla' } },
    members, tasks: SEED, log, survey, settings: DEFAULT_SETTINGS, away: {}, busy, plan: out.items, unplaced: out.unplaced, swaps: [], estimates, now,
  };
  const noop = async () => {};
  return { data, actions: { logDone: noop, undo: noop, notToday: noop, move: noop, askSwap: noop, answerSwap: noop, saveTask: noop, saveSettings: noop, saveSurvey: noop, setAway: noop, invite: noop } };
}
export { MIN };
