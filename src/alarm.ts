import type { Card } from './types';

/** The usual wake-up time. A late first plan never pushes the alarm later than this. */
export const USUAL_WAKE = 7 * 60 + 30;
export const DEFAULT_LEAD = 90;
const EARLIEST = 4 * 60;

export interface WakeSuggestion {
  /** Minutes after midnight. */
  minutes: number;
  /** The first timed thing tomorrow, if there is one. */
  first?: { title: string; at: number; place?: string };
}

function ymd(d: Date): string {
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
  if (at === null) return null;
  const leave = hm(card.plan?.out?.leave);
  return leave !== null && leave <= at ? leave : at;
}

/** The recommended alarm for the morning after `now`: the first timed card, minus time to get ready and travel, never later than the usual wake time. */
export function suggestWake(cards: Card[], now: Date, lead = DEFAULT_LEAD): WakeSuggestion {
  const t = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const key = ymd(t);
  let first: WakeSuggestion['first'];
  for (const c of cards) {
    if (c.status === 'done') continue;
    const at = startOf(c, key);
    if (at === null) continue;
    if (!first || at < first.at) first = { title: c.title ?? c.id, at, ...(c.place ? { place: c.place } : {}) };
  }
  const want = first ? first.at - lead : USUAL_WAKE;
  const minutes = Math.max(EARLIEST, Math.min(USUAL_WAKE, want));
  return first ? { minutes, first } : { minutes };
}

export function clock(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** An Android link that opens the Clock app on a new alarm with this time and label filled in. */
export function alarmLink(minutes: number, label = 'Wake up'): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `intent:#Intent;action=android.intent.action.SET_ALARM;i.android.intent.extra.alarm.HOUR=${Math.floor(m / 60)};i.android.intent.extra.alarm.MINUTES=${m % 60};S.android.intent.extra.alarm.MESSAGE=${encodeURIComponent(label)};B.android.intent.extra.alarm.SKIP_UI=false;end`;
}
