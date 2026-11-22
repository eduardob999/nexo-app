import { DEFAULT_SETTINGS, type Interval, type Member, type Settings } from './model';
import { atHm, dayStart, JST } from './time';

/**
 * Who is at home, and which meals are eaten there. His request, 2026-11-21: "Kaji should know when we are in home and when we go out too
 * and also know when we eat home and when we eat outside. So there should be a go out, get back button but it also sounds work with our
 * schedules." So the calendars are the default (an event with a place that is not home means out), and a press of Go out or Back home
 * overrides them. Pure: no Firebase, the same answer in the app, the service and the tests.
 */

/**
 * One person's last press, stored in `households/{hid}/away/{uid}` next to the older "I am out until" (which has only `until`).
 * Go out: `{ until: at + outDefaultMin, out: true, at }`. Back home: `{ until: 0, home: true, at }`.
 */
export interface Presence { until: number; out?: boolean; home?: boolean; at?: number }

const HOME = /^home$/i;
export const MEAL_KEYS = ['breakfast', 'lunch', 'dinner'] as const;

/** A calendar event away from home that was running when Back home was pressed ends at that press: he came back early. */
export function afterBackHome(busy: Interval[] = [], p?: Presence): Interval[] {
  if (!p?.home || !p.at) return busy;
  const at = p.at;
  return busy.map((e) => (e.place && !HOME.test(e.place.trim()) && e.start <= at && e.end > at ? { ...e, end: at } : e)).filter((e) => e.end > e.start);
}

/** The times a person is out of home: calendar events with a place other than home, then the Go out press or the older away-until. */
export function outIntervals(busy: Interval[] = [], p?: Presence): Interval[] {
  const list: Interval[] = afterBackHome(busy, p).filter((e) => e.place && !HOME.test(e.place.trim())).map((e) => ({ start: e.start, end: e.end }));
  if (p && p.until && p.until > (p.at ?? 0)) list.push({ start: p.at ?? 0, end: p.until });
  return list;
}

export function isOut(busy: Interval[] | undefined, p: Presence | undefined, t: number): boolean {
  return outIntervals(busy, p).some((e) => e.start <= t && e.end > t);
}

/** What the Today screen says about one person now: home, or out until when, and whether the calendar or a press says so. */
export function presenceNow(busy: Interval[] | undefined, p: Presence | undefined, now: number): { out: boolean; until?: number; by: 'calendar' | 'button' | 'none' } {
  const pressed = p && p.until && p.until > now && (p.at ?? 0) <= now;
  if (pressed) return { out: true, until: p.until, by: 'button' };
  const ev = outIntervals(busy, p ? { ...p, until: 0 } : p).filter((e) => e.start <= now && e.end > now).sort((a, b) => b.end - a.end)[0];
  if (ev) return { out: true, until: ev.end, by: 'calendar' };
  return { out: false, by: p?.home ? 'button' : 'none' };
}

export interface MealAtHome { meal: number; from: number; to: number; home: string[] }

/** The three meals of one local day and who eats each at home: a person is out for a meal when an outing covers its middle. */
export function mealsAtHome(day: number, members: Pick<Member, 'uid'>[], busy: Record<string, Interval[]>, presence: Record<string, Presence> | undefined, s: Pick<Settings, 'meals'>, tz = JST): MealAtHome[] {
  const meals = s.meals && s.meals.length ? s.meals : (DEFAULT_SETTINGS.meals as { from: string; to: string }[]);
  const d = dayStart(day, tz);
  const outs = Object.fromEntries(members.map((m) => [m.uid, outIntervals(busy[m.uid], presence?.[m.uid])]));
  return meals.map((w, meal) => {
    const from = atHm(d, w.from), to = atHm(d, w.to);
    const mid = from + Math.floor((to - from) / 2);
    return { meal, from, to, home: members.filter((m) => !(outs[m.uid] ?? []).some((e) => e.start <= mid && e.end > mid)).map((m) => m.uid) };
  });
}

/** What Go out stores: back after the assumed outing length unless Back home comes first. */
export function goOut(now: number, s: Pick<Settings, 'outDefaultMin'>): Presence {
  return { until: now + (s.outDefaultMin ?? 240) * 60_000, out: true, at: now };
}
export function backHome(now: number): Presence {
  return { until: 0, home: true, at: now };
}
