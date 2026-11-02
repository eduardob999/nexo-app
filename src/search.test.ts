import { describe, expect, it } from 'vitest';
import { searchCards } from './search';
import type { Card } from './types';

const c = (id: string, extra: Partial<Card>): Card => ({ id, status: 'open', for: 'you', ...extra });
const cards = [
  c('a', { title: 'Reply to the housing office', last: { by: 'nexo', text: 'Draft ready', ts: '' } }),
  c('b', { title: 'Seminar', place: 'Building 3, room 204', type: 'INFO' }),
];

describe('searchCards', () => {
  it('returns nothing for an empty query', () => {
    expect(searchCards(cards, '  ')).toEqual([]);
  });
  it('matches title, place and the latest entry', () => {
    expect(searchCards(cards, 'housing').map((x) => x.id)).toEqual(['a']);
    expect(searchCards(cards, 'room 204').map((x) => x.id)).toEqual(['b']);
    expect(searchCards(cards, 'draft').map((x) => x.id)).toEqual(['a']);
  });
  it('needs every word to match', () => {
    expect(searchCards(cards, 'housing seminar')).toEqual([]);
  });
});
