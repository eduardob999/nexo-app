import { estimateFor } from './adapt';
import { CARLA_UID, migrateTasks, SEED as REAL_SEED } from './catalog';
import { blankListing, SEED_BRIEF, SEED_DOCS, SEED_STEPS } from './housing';
import { DEFAULT_SETTINGS, type Interval, type LogEvent, type Member } from './model';
import { plan } from './planner';
import type { KajiActions, KajiData } from './ui';
import { atHm, dayStart, DAY, MIN } from './time';

/** Invented data for the dev preview and render checks: a Friday evening, three weeks of history, two people. */
export const NOW = Date.parse('2026-11-20T18:05:00+09:00');
const A: Member = { uid: 'a', name: 'Eduardo', lang: 'en', role: 'owner' };
const B: Member = { uid: 'b', name: 'Carla', lang: 'en', role: 'member' };

export function kajiFixture(now = NOW): { data: KajiData; actions: KajiActions } {
  const members = [A, B];
  // Carla's real uid is B here; the kitchen sink as it lives in the app (added there, weekly), so the preview shows it riding on the dinner wash
  const SEED = migrateTasks([...REAL_SEED, { id: 'clean-kitchen-sink-7d1', names: { en: 'Clean kitchen sink', es: 'Clean kitchen sink', ja: 'Clean kitchen sink' }, icon: '🚰', category: 'kitchen' as const,
    freq: { times: 1, perDays: 7 }, mode: 'measured' as const, priorMinutes: 15, active: true }]).map((t) => (t.who ? { ...t, who: t.who.map((u) => (u === CARLA_UID ? 'b' : u)) } : t));
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
  // earlier moves, so the preview shows what Kaji has learned: the rubbish keeps being pushed later, and was twice judged not worth taking out
  for (const d of [9, 6, 3]) log.push({ id: `r${d}`, taskId: 'basura', uid: 'a', kind: 'rescheduled', at: dayStart(now) - d * DAY + 15 * 3_600_000, minutes: 0, planned: true, plannedStart: atHm(dayStart(now) - d * DAY, '15:00'), newStart: atHm(dayStart(now) - d * DAY, '18:30') });
  for (const d of [5, 2]) log.push({ id: `x${d}`, taskId: 'basura', uid: 'b', kind: 'dismissed', at: dayStart(now) - d * DAY + 20 * 3_600_000, minutes: 0, planned: true, plannedStart: atHm(dayStart(now) - d * DAY, '19:00'), reason: 'not_enough' });
  const survey = { a: { cena: 2, platos: 4, 'bano-profundo': 5, poceta: 4 }, b: { cena: 3, platos: 2, 'bano-profundo': 2, poceta: 2 } };
  const estimates = Object.fromEntries(SEED.map((t) => [t.id, estimateFor(t, log, survey, members)]));
  const busy: Record<string, Interval[]> = {
    a: [{ start: atHm(dayStart(now) + DAY, '11:00'), end: atHm(dayStart(now) + DAY, '13:00'), place: '園山大弓場' }, { start: atHm(dayStart(now) + 3 * DAY, '10:00'), end: atHm(dayStart(now) + 3 * DAY, '19:00'), place: 'Uji campus' }],
    b: [{ start: atHm(dayStart(now) + 2 * DAY, '17:00'), end: atHm(dayStart(now) + 2 * DAY, '21:00'), label: 'Class' }],
  };
  // Carla pressed Go out at 17:35, so the Today screen shows both states and dinner is planned for one
  const presence = { b: { until: now + 3 * 3_600_000, out: true, at: now - 30 * MIN } };
  const away = { b: presence.b.until };
  const out = plan({ now, horizonDays: 7, tasks: SEED, members, estimates, log, busy, existing: [], settings: DEFAULT_SETTINGS, presence, awayUntil: away });
  const data: KajiData = {
    hid: 'h', me: 'a', house: { name: 'Casa', members: { a: 'owner', b: 'member' }, createdAt: now - 30 * DAY, names: { a: 'Eduardo', b: 'Carla' } },
    members, tasks: SEED, log, survey, settings: DEFAULT_SETTINGS, away, presence, busy, plan: out.items, unplaced: out.unplaced, swaps: [], estimates, now,
  };
  const noop = async () => {};
  return { data, actions: { logDone: noop, rate: noop, undo: noop, notToday: noop, reschedule: noop, dismiss: noop, move: noop, askSwap: noop, answerSwap: noop, saveTask: noop, saveSettings: noop, saveSurvey: noop, setAway: noop, setPresence: noop, invite: noop, ask: noop } };
}
export { MIN };

/** The housing tracker as it might look in a few weeks: two steps done, one under way, two candidates, a source. Invented. */
export function housingFixture(): import('./housing').HAny[] {
  const steps = SEED_STEPS.map((s) => (s.n <= 2 ? { ...s, status: 'done' as const } : s.n === 3 ? { ...s, status: 'doing' as const, note: 'UR first: no key money or agent fee' } : s));
  const docs = SEED_DOCS.map((d, i) => (i === 0 || i === 1 || i === 5 ? { ...d, done: true } : d));
  return [SEED_BRIEF, ...steps, ...docs,
    { ...blankListing('housing-listing-a', 'a', 1), name: 'Maison Obaku 203', url: 'https://suumo.jp/chintai/jnc_000000000/', area: 'Obaku, Uji', stations: 'Keihan Obaku 6 min, JR Obaku 8 min', rent: '55000', mgmt: '3000', deposit: '1m', keyMoney: '1m', agentFee: '60500', firstMonth: '', guarantor: '29000', insurance: '', keyExchange: '16500', cohab: 'yes' as const, status: 'viewing' as const, viewing: '2027-01-23' },
    { ...blankListing('housing-listing-b', 'b', 2), name: 'UR Momoyama', url: 'https://www.ur-net.go.jp/chintai/', area: 'Fushimi', stations: 'Keihan Momoyama-Minamiguchi 9 min, JR Momoyama 7 min', rent: '61000', mgmt: '2500', deposit: '2m', keyMoney: '0', agentFee: '0', firstMonth: '63500', guarantor: '0', insurance: '15000', keyExchange: '0', cohab: 'ask' as const, status: 'idea' as const },
    { part: 'source' as const, id: 'housing-source-1', url: 'https://www.ur-net.go.jp/chintai/', text: 'UR rental: no key money, no agent fee, no renewal fee, no guarantor needed.', note: 'Why UR is worth a look', at: Date.parse('2026-11-24T10:00:00+09:00'), by: 'b' },
  ];
}
