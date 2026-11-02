import type { Card } from './types';

export type Band = 'assignment' | 'urgent' | 'overdue' | 'today' | 'prep' | 'other';

const DAY = 86_400_000;
/** How far ahead each kind of card is allowed to appear under Preparation. */
const PREP_DAYS = 7;
const PREP_DAYS_TRIP = 14;
const NOTICE_DAYS = 2;

/** A date with no time means any time that day, so it runs to the end of it. */
function parseDue(raw: string): Date {
  return raw.length <= 10 ? new Date(`${raw}T23:59:59`) : new Date(raw);
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** A trip, a bring list or a plan: these need work before the day, so they show earlier. */
function isPlanned(card: Card): boolean {
  return card.type === 'TRIP' || (card.bring?.length ?? 0) > 0 || Boolean(card.plan);
}

/** A class or a holiday needs no work, but the day before it must not come as a surprise. */
function isNotice(card: Card): boolean {
  return card.type === 'INFO' || card.type === 'HOLIDAY';
}

/**
 * Where a card sits on the Today tab.
 *
 * Assignments come first at any distance. Urgent is the old board's rule: marked
 * `high` and either undated or due by the end of today, so a card whose date he
 * has since moved does not keep shouting. Overdue is a date before today, Today
 * is today. Preparation is what falls ahead and needs thought: seven days for a
 * plain task, fourteen for a trip, bring list or plan, two for a class or holiday
 * notice, or whatever the card's own `lead` says. Everything else is `other`: it
 * lives in Upcoming and Search.
 */
export function bandOf(card: Card, now: Date): Band {
  if (card.type === 'ASSIGNMENT') return 'assignment';
  const due = card.due ? parseDue(card.due) : null;
  const valid = due !== null && !Number.isNaN(due.getTime());
  const days = valid ? Math.floor((startOfDay(due) - startOfDay(now)) / DAY) : null;
  if (card.prio === 'high' && !isNotice(card) && (days === null || days <= 0)) return 'urgent';
  if (days === null) return 'other';
  const lead = typeof card.lead === 'number' && card.lead > 0 ? card.lead : null;
  // A notice that has passed asks nothing of him; one that is today is on the banner or the day's list.
  if (isNotice(card) && !isPlanned(card) && lead === null) {
    if (days === 0 && card.type === 'INFO') return 'today';
    return days >= 1 && days <= NOTICE_DAYS ? 'prep' : 'other';
  }
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  const horizon = lead ?? (isPlanned(card) ? PREP_DAYS_TRIP : PREP_DAYS);
  return days <= horizon ? 'prep' : 'other';
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
