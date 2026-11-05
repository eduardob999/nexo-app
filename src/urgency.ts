import { isHis } from './nexo';
import type { Card } from './types';

export type Band = 'incoming' | 'assignment' | 'qa' | 'urgent' | 'overdue' | 'today' | 'prep' | 'other';

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
 * is today, and so is an undated card that asks something of him. Preparation is what falls ahead and needs thought: seven days for a
 * plain task, fourteen for a trip, bring list or plan, two for a class or holiday
 * notice, or whatever the card's own `lead` says. Everything else is `other`: it
 * lives in Upcoming and Search.
 */
export function bandOf(card: Card, now: Date): Band {
  if (isIncoming(card, now)) return 'incoming';
  if (card.type === 'ASSIGNMENT') return 'assignment';
  if (isQA(card)) return 'qa';
  const due = card.due ? parseDue(card.due) : null;
  const valid = due !== null && !Number.isNaN(due.getTime());
  const days = valid ? Math.floor((startOfDay(due) - startOfDay(now)) / DAY) : null;
  if (card.prio === 'high' && !isNotice(card) && (days === null || days <= 0)) return 'urgent';
  // No date on something that asks him to act is a gap in the data, not a reason to hide it: it shows
  // under Today, labelled "No date", until someone dates it.
  if (days === null) return isNotice(card) ? 'other' : 'today';
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

const ORDER: Record<Band, number> = { incoming: 0, assignment: 1, qa: 2, urgent: 3, overdue: 4, today: 5, prep: 6, other: 7 };

/** A question Nexo put to him, or an answer he asked for: both are highly relevant, so they are pinned on Today at any date. */
export function isQA(card: Card): boolean {
  if (card.status === 'done') return false;
  const t = (card.type ?? '').toUpperCase();
  return t === 'QUESTION' || t === 'ANSWER' || (!t && !!card.ask);
}

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

/** The end of an hour window as HH:MM, from a bare HH:MM or an ISO time. Anything else is no window. */
export function windowEnd(raw: string | null | undefined): string {
  const e = String(raw ?? '');
  const hm = e.length > 5 ? e.slice(11, 16) : e;
  return /^\d\d:\d\d$/.test(hm) ? hm : '';
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
  const end = time ? windowEnd(card.dueEnd) : '';
  return time ? `${day} ${time}${end ? `\u2013${end}` : ''}` : day;
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

/**
 * Which cards the Today tab lists. His own cards in every group, and the cards that have gone to
 * Nexo's lane only while they are Urgent or due Today, so replying to something that cannot wait
 * does not make it vanish from the day.
 */
export function onTodayBoard(card: Card, now: Date): boolean {
  if (card.for === 'you' || isHis(card) || isQA(card)) return true;
  const band = bandOf(card, now);
  return card.for === 'nexo' && (band === 'urgent' || band === 'today' || band === 'incoming');
}

const INCOMING_BEFORE_MIN = 15;
const INCOMING_AFTER_MIN = 10;
const EASY_TYPES = ['CLASS', 'MEETING', 'CALL'];
const EASY_WORDS = /\b(zoom|teams|meet|online|webinar|class|lecture|seminar|call)\b|授業|講義|ミーティング|オンライン|面談|ゼミ/i;
const LINK_HOSTS = /(?:zoom\.us|meet\.google\.com|teams\.microsoft\.com|teams\.live\.com)/i;
const LINK_URL = /https?:\/\/(?:[\w-]+\.)*(?:zoom\.us|meet\.google\.com|teams\.microsoft\.com|teams\.live\.com)[^\s)\]>"'<]*/i;

/** The start of a card with a real clock time, or null for no due, a date only, or midnight. */
function startTime(card: Card): Date | null {
  const m = /T(\d\d):(\d\d)/.exec(card.due ?? '');
  if (!m || (m[1] === '00' && m[2] === '00')) return null;
  const d = new Date(card.due as string);
  return Number.isNaN(d.getTime()) ? null : d;
}

function linkTexts(card: Card): string[] {
  return [card.title, card.place, card.ask, card.last?.text].filter((t): t is string => Boolean(t));
}

/** The first https meeting link on the card (place, question or latest entry), or null. */
export function meetingLink(card: Card): string | null {
  for (const t of [card.place, card.ask, card.last?.text, card.title]) {
    const m = t ? LINK_URL.exec(t) : null;
    if (m) return m[0];
  }
  return null;
}

/** Whether missing this one would be easy: an online class or call. His own flag wins either way. */
export function isEasyToMiss(card: Card): boolean {
  if (card.incoming === false) return false;
  if (card.incoming === true) return true;
  if (!startTime(card)) return false;
  if (EASY_TYPES.includes((card.type ?? '').toUpperCase())) return true;
  if (EASY_WORDS.test([card.title, card.place, card.ask].filter(Boolean).join(' '))) return true;
  return linkTexts(card).some((t) => LINK_HOSTS.test(t));
}

/** Whole minutes until the card starts (negative once started), or null without a clock time. */
export function minutesToStart(card: Card, now: Date): number | null {
  const start = startTime(card);
  if (!start) return null;
  const diff = start.getTime() - now.getTime();
  const mins = diff > 0 ? Math.ceil(diff / 60_000) : -Math.floor(-diff / 60_000);
  return mins === 0 ? 0 : mins;
}

/** Open, easy to miss, and from 15 minutes before the start until 10 minutes after it. */
export function isIncoming(card: Card, now: Date): boolean {
  if (card.status !== 'open' || card.deleted || !isEasyToMiss(card)) return false;
  const start = startTime(card);
  if (!start) return false;
  const t = now.getTime() - start.getTime();
  return t >= -INCOMING_BEFORE_MIN * 60_000 && t < INCOMING_AFTER_MIN * 60_000;
}

/** "in 12 min", "starting now" or "started 3 min ago". */
export function countdownText(mins: number): string {
  if (mins > 0) return `in ${mins} min`;
  if (mins === 0) return 'starting now';
  return `started ${-mins} min ago`;
}
