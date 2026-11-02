import type { Card } from './types';

/** Open cards matching every word the query has, in title, place, type or the latest entry. */
export function searchCards(cards: Card[], query: string): Card[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  return cards.filter((c) => {
    const hay = `${c.title ?? ''} ${c.place ?? ''} ${c.type ?? ''} ${c.last?.text ?? ''}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}
