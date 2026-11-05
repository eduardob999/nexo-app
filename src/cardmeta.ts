import type { Card } from './types';

/**
 * The tag a card wears. An explicit `type` wins; otherwise a card that puts a question to him is a
 * QUESTION (his 4 Nov rule: QUESTION asks him, ANSWER owes him), and a trip card is a TRIP.
 */
export function cardTag(card: Card): string | null {
  return cardTags(card)[0] ?? null;
}

/**
 * Every tag a card wears, as the old board drew them. A finished card and a relay mirror wear none. An explicit
 * `type` wins; otherwise a question he owes (an `ask`, or Nexo's newest line asking something on his lane) is
 * QUESTION, then TRIP, NEXO for the assistant's lane, TASK for a dated card and INFO for the rest. A trip with a
 * question open, or an ANSWER, also shows TRIP.
 */
export function cardTags(card: Card): string[] {
  if (card.status === 'done' || card.relay) return [];
  const explicit = (card.type ?? '').trim().toUpperCase();
  const lastNexo = card.for === 'you' && card.last?.by === 'nexo' && (card.last.text ?? '').includes('?');
  const t = explicit || (card.ask || lastNexo ? 'QUESTION' : card.trip ? 'TRIP' : card.for === 'nexo' ? 'NEXO' : card.due ? 'TASK' : 'INFO');
  return (t === 'ANSWER' || t === 'QUESTION') && card.trip ? [t, 'TRIP'] : [t];
}

const YMD = /^\d{4}-\d{2}-\d{2}/;
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * The line under a holiday card: whether he has to go in. `lab: confirm` means classes are off but nobody has said
 * the lab closes. A multi-day break carries its last day as a date-only `dueEnd`.
 */
export function holidayLine(card: Card, now: Date): string | null {
  if (card.status === 'done' || card.relay || (card.type ?? '').trim().toUpperCase() !== 'HOLIDAY') return null;
  const conf = card.lab === 'confirm';
  const a = YMD.test(card.due ?? '') ? (card.due as string).slice(0, 10) : '';
  const b = /^\d{4}-\d{2}-\d{2}$/.test(card.dueEnd ?? '') ? (card.dueEnd as string) : a;
  const today = dayKey(now);
  const isToday = a !== '' && a <= today && today <= b;
  if (isToday) return conf ? 'University break today: no classes. Lab: confirm before going in.' : 'Holiday today. You do not have to come to the lab.';
  return conf ? 'University break: no classes. Lab: confirm.' : 'Holiday. No lab that day.';
}

/** A place worth a pin: "Anywhere" and "Online" say nothing about where to be. */
export function placeLabel(card: Card): string | null {
  const p = (card.place ?? '').trim();
  return p && !/^(anywhere|online)$/i.test(p) ? p : null;
}

/** A Google Maps link for a place: the text itself when it already is a link, else a search that opens that place. */
export function placeUrl(place: string): string {
  const p = place.trim();
  if (/^https?:\/\//i.test(p)) return p;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p)}`;
}

const PRIO: Record<string, string> = { high: 'Now', normal: 'Soon', med: 'Soon', low: 'Whenever' };

export function priorityLabel(card: Card): string {
  return PRIO[card.prio ?? 'normal'] ?? 'Soon';
}

/** Whether a dated card has its calendar entry, in words. Null when the card has no date. */
export function calendarLabel(card: Card): string | null {
  if (!card.due) return null;
  if (card.cal === 'yes' || card.calEvent) return 'On calendar';
  if (card.cal === 'queued') return 'Calendar entry queued';
  if (card.cal === 'ics') return 'Calendar invite sent';
  return 'No calendar entry';
}
