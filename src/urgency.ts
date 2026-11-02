import type { Card } from './types';

export type Band = 'assignment' | 'now' | 'today' | 'later';

const DAY = 86_400_000;

/** A date with no time means any time that day, so it runs to the end of it. */
function parseDue(raw: string): Date {
  return raw.length <= 10 ? new Date(`${raw}T23:59:59`) : new Date(raw);
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Where a card sits in the queue. Assignments are always on top, at any
 * distance, because a deadline that is weeks away is still the one that costs
 * him most if it is missed. Everything else is decided by the due date alone.
 */
export function bandOf(card: Card, now: Date): Band {
  if (card.type === 'ASSIGNMENT') return 'assignment';
  if (!card.due) return 'later';
  const due = parseDue(card.due);
  if (Number.isNaN(due.getTime())) return 'later';
  const days = Math.floor((startOfDay(due) - startOfDay(now)) / DAY);
  if (days < 0 || (days === 0 && due.getTime() <= now.getTime())) return 'now';
  return days === 0 ? 'today' : 'later';
}

const ORDER: Record<Band, number> = { assignment: 0, now: 1, today: 2, later: 3 };

/** Queue order: band, then soonest due, then title. Cards with no date go last in their band. */
export function sortQueue(cards: Card[], now: Date): Card[] {
  const key = (c: Card): [number, number, string] => {
    const t = c.due ? parseDue(c.due).getTime() : Number.POSITIVE_INFINITY;
    return [ORDER[bandOf(c, now)], Number.isNaN(t) ? Number.POSITIVE_INFINITY : t, c.title ?? c.id];
  };
  return [...cards].sort((a, b) => {
    const [a0, a1, a2] = key(a);
    const [b0, b1, b2] = key(b);
    return a0 - b0 || (a1 === b1 ? 0 : a1 < b1 ? -1 : 1) || a2.localeCompare(b2);
  });
}

export function dueText(card: Card, now: Date): string {
  if (!card.due) return 'No date';
  const due = parseDue(card.due);
  if (Number.isNaN(due.getTime())) return card.due;
  const days = Math.floor((startOfDay(due) - startOfDay(now)) / DAY);
  const hasTime = card.due.length > 10;
  const time = hasTime ? due.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
  const day =
    days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : days === -1 ? 'Yesterday' :
    due.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
  return time ? `${day} ${time}` : day;
}

function ymd(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Today's date as a date-only string, the default for a card made without one. */
export function todayYmd(now: Date): string {
  return ymd(now);
}

/**
 * "Later" moves a card one day on. A date with a time keeps its time; a card
 * with no date, or one already past, lands on tomorrow so it leaves Now.
 */
export function postpone(due: string | null | undefined, now: Date): string {
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (!due) return ymd(tomorrow);
  const d = parseDue(due);
  if (Number.isNaN(d.getTime()) || startOfDay(d) <= startOfDay(now)) {
    return due.length <= 10 ? ymd(tomorrow) : `${ymd(tomorrow)}${due.slice(10)}`;
  }
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  return due.length <= 10 ? ymd(next) : `${ymd(next)}${due.slice(10)}`;
}
