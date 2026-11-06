import type { Card } from './types';

export function isTrip(card: Card): boolean {
  return card.trip === true || card.type === 'TRIP';
}

const DAY = 86_400_000;

/** Two lists of cards merged by id, the second winning, so two queries can feed one screen. */
export function mergeById(a: Card[], b: Card[]): Card[] {
  const m = new Map<string, Card>();
  for (const c of a) m.set(c.id, c);
  for (const c of b) m.set(c.id, c);
  return [...m.values()];
}

/** Finished trips, most recent first, for the Past fold. */
export function pastTrips(done: Card[]): Card[] {
  const t = (c: Card) => Date.parse(c.due ? (c.due.length <= 10 ? `${c.due}T12:00:00` : c.due) : '') || 0;
  return done.filter((c) => isTrip(c) && !c.deleted).sort((a, b) => t(b) - t(a));
}

/**
 * Open trips by how close they are. The old board folded a trip until it was imminent so the list stays
 * clean; the same line: soon is up to three days out, everything after that is Later. A trip with no date
 * stays in Soon, since a fold is where a thing goes to be missed.
 */
export function tripGroups(cards: Card[], now: Date): { soon: Card[]; later: Card[] } {
  const t = (c: Card) => (c.due ? new Date(c.due.length <= 10 ? `${c.due}T23:59:59` : c.due).getTime() : Number.NaN);
  const open = cards.filter((c) => isTrip(c) && c.status !== 'done').sort((a, b) => (t(a) || Infinity) - (t(b) || Infinity));
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const later = (c: Card) => !Number.isNaN(t(c)) && t(c) >= start + 4 * DAY;
  return { soon: open.filter((c) => !later(c)), later: open.filter(later) };
}
