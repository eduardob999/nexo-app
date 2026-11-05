import type { Card } from './types';

/** What the app has learned about his mornings. Stored in Firestore so every device agrees. */
export interface WakePrefs {
  /** Minutes to get ready and travel before something at a physical place. */
  leadTravel: number;
  /** Minutes to get ready before something he does from home or online. */
  leadHome: number;
  /** The wake-up time, in minutes after midnight, when nothing timed is planned. */
  usual: number;
  /** How many mornings he has answered. Later answers move the numbers less. */
  n: number;
}

export const DEFAULT_PREFS: WakePrefs = { leadTravel: 90, leadHome: 45, usual: 7 * 60 + 30, n: 0 };
export type WakeBasis = 'travel' | 'home' | 'usual';
export type WakeFeedback = 'early' | 'right' | 'late';

/** One morning's suggestion, kept so the next day's question can say what it was about. */
export interface WakeRecord { minutes: number; basis: WakeBasis; lead: number; first?: string; feedback?: WakeFeedback }
export interface WakeDoc { prefs?: Partial<WakePrefs>; log?: Record<string, WakeRecord> }

const EARLIEST = 4 * 60;
const LATEST_USUAL = 10 * 60;
const EARLIEST_USUAL = 5 * 60;

export interface WakeSuggestion {
  /** Minutes after midnight. */
  minutes: number;
  basis: WakeBasis;
  /** Minutes allowed for getting ready (and travel), when there is something timed. */
  lead: number;
  /** The first timed thing tomorrow, if there is one. */
  first?: { title: string; at: number; place?: string };
}

export function fullPrefs(p?: Partial<WakePrefs>): WakePrefs {
  return { ...DEFAULT_PREFS, ...(p ?? {}) };
}

export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function hm(s: string | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((s ?? '').trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** When something on this card has to start tomorrow: a trip's leave time if it has one, else the card's own time. */
function startOf(card: Card, tomorrow: string): number | null {
  const due = card.due ?? '';
  if (due.length <= 10 || due.slice(0, 10) !== tomorrow) return null;
  const at = hm(due.slice(11, 16));
  // 00:00 is how a deadline "by the end of the day" is stored, and a report to submit online is not something
  // he has to be awake early for: neither is an event with a start time.
  if (at === null || at === 0 || (card.type ?? '').toUpperCase() === 'ASSIGNMENT') return null;
  const leave = hm(card.plan?.out?.leave);
  return leave !== null && leave <= at ? leave : at;
}

/** True when the card means going somewhere: a trip plan, or a place that is not "Anywhere" or "Online". */
export function needsTravel(card: Card): boolean {
  if (card.plan || card.trip) return true;
  const p = (card.place ?? '').trim();
  return p !== '' && !/^(anywhere|online)/i.test(p);
}

/** The recommended wake-up time for the morning after `now`. */
export function suggestWake(cards: Card[], now: Date, prefs: WakePrefs = DEFAULT_PREFS): WakeSuggestion {
  const t = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const key = ymd(t);
  let first: { title: string; at: number; place?: string; travel: boolean } | undefined;
  for (const c of cards) {
    if (c.status === 'done') continue;
    const at = startOf(c, key);
    if (at === null) continue;
    if (!first || at < first.at) first = { title: c.title ?? c.id, at, travel: needsTravel(c), ...(c.place ? { place: c.place } : {}) };
  }
  if (!first) return { minutes: Math.max(EARLIEST_USUAL, Math.min(LATEST_USUAL, prefs.usual)), basis: 'usual', lead: 0 };
  const lead = first.travel ? prefs.leadTravel : prefs.leadHome;
  const minutes = Math.max(EARLIEST, Math.min(prefs.usual, first.at - lead));
  const shown = { title: first.title, at: first.at, ...(first.place ? { place: first.place } : {}) };
  return { minutes, basis: first.travel ? 'travel' : 'home', lead, first: shown };
}

/** How far one answer moves a number: big at first, small once there is history. */
export function stepFor(n: number): number {
  return n < 6 ? 15 : n < 14 ? 10 : 5;
}

/**
 * Learn from his answer about a morning. "Too early" shortens the time he allows (or moves the usual
 * wake-up later), "too late" lengthens it (or moves it earlier). "About right" changes nothing but counts.
 */
export function applyFeedback(prefs: WakePrefs, basis: WakeBasis, feedback: WakeFeedback): WakePrefs {
  const step = stepFor(prefs.n);
  const dir = feedback === 'early' ? -1 : feedback === 'late' ? 1 : 0;
  const next = { ...prefs, n: prefs.n + 1 };
  if (dir === 0) return next;
  if (basis === 'travel') next.leadTravel = Math.min(180, Math.max(30, prefs.leadTravel + dir * step));
  else if (basis === 'home') next.leadHome = Math.min(120, Math.max(15, prefs.leadHome + dir * step));
  else next.usual = Math.min(LATEST_USUAL, Math.max(EARLIEST_USUAL, prefs.usual - dir * step));
  return next;
}

export function clock(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
