import type { Card } from './types';

/**
 * The tag a card wears. An explicit `type` wins; otherwise a card that puts a question to him is a
 * QUESTION (his 4 Nov rule: QUESTION asks him, ANSWER owes him), and a trip card is a TRIP.
 */
export function cardTag(card: Card): string | null {
  if (card.type) return card.type.toUpperCase();
  if (card.ask) return 'QUESTION';
  if (card.trip) return 'TRIP';
  return null;
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
