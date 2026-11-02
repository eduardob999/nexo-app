import type { Card } from './types';

export type Band = 'assignment' | 'urgent' | 'overdue' | 'today' | 'prep' | 'other';

const DAY = 86_400_000;
const PREP_DAYS = 7;

/** A date with no time means any time that day, so it runs to the end of it. */
function parseDue(raw: string): Date {
  return raw.length <= 10 ? new Date(`${raw}T23:59:59`) : new Date(raw);
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Needs thinking about before the day: a trip, anything with a bring list or a plan, or a plain task. Classes, notices and holidays do not. */
function needsPrep(card: Card): boolean {
  if (card.type === 'TRIP') return true;
  if ((card.bring?.length ?? 0) > 0 || card.plan) return true;
  return card.type !== 'INFO' && card.type !== 'HOLIDAY';
}

/**
 * Where a card sits on the Today tab.
 *
 * Assignments come first at any distance. Urgent is the old board's rule: marked
 * `high` and either undated or due by the end of today, so a card whose date he
 * has since moved does not keep shouting. Overdue is a date before today, Today
 * is today. Preparation is what falls in the next seven days and needs thought
 * ahead of time. Everything else is `other`: it lives in Upcoming and Search.
 */
export function bandOf(card: Card, now: Date): Band {
  if (card.type === 'HOLIDAY') return 'other';
  if (card.type === 'ASSIGNMENT') return 'assignment';
  const due = card.due ? parseDue(card.due) : null;
  const valid = due !== null && !Number.isNaN(due.getTime());
  const days = valid ? Math.floor((startOfDay(due) - startOfDay(now)) / DAY) : null;
  if (card.prio === 'high' && (days === null || days <= 0)) return 'urgent';
  if (days === null) return 'other';
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  if (days <= PREP_DAYS && needsPrep(card)) return 'prep';
  return 'other';
}

const ORDER: Record<Band, number> = { assignment: 0, urgent: 1, overdue: 2, today: 3, prep: 4, other: 5 };

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
