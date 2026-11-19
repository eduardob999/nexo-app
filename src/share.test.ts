import { describe, expect, it } from 'vitest';
import { isShareLoad, shareSummary, shareTargets, sharedText } from './share';
import type { Card } from './types';

const c = (id: string, title: string): Card => ({ id, status: 'open', for: 'you', title });

describe('shared text', () => {
  it('joins title, text and link without repeating the link', () => {
    expect(sharedText({ title: 'Menu', text: 'Look https://x.org/a', url: 'https://x.org/a' })).toBe('Menu\nLook https://x.org/a');
  });
  it('drops a title that only repeats the text', () => {
    expect(sharedText({ title: 'hello', text: 'hello' })).toBe('hello');
  });
  it('is empty when nothing came', () => { expect(sharedText({})).toBe(''); });
  it('adds a link that is only in url', () => { expect(sharedText({ url: 'https://x.org' })).toBe('https://x.org'); });
});

describe('share landing', () => {
  it('recognises ?share=1', () => {
    expect(isShareLoad('?share=1')).toBe(true);
    expect(isShareLoad('?share=0')).toBe(false);
    expect(isShareLoad('')).toBe(false);
  });
  it('lists every card for an empty search and filters otherwise', () => {
    const cards = [c('a', 'Bicycle registration'), c('b', 'Dentist visit')];
    expect(shareTargets(cards, '  ')).toHaveLength(2);
    expect(shareTargets(cards, 'dent').map((x) => x.id)).toEqual(['b']);
  });
  it('lists cards in the Today order: his board band by band, then the rest', () => {
    const now = new Date('2026-11-19T10:00:00+09:00');
    const cards: Card[] = [
      { id: 'later', status: 'open', for: 'you', title: 'Renew card', due: '2026-12-20' },
      { id: 'nexo', status: 'open', for: 'nexo', title: 'Nexo work', due: '2026-12-01' },
      { id: 'today', status: 'open', for: 'you', title: 'Pay rent', due: '2026-11-19T18:00:00+09:00' },
      { id: 'prep', status: 'open', for: 'you', title: 'Dentist', due: '2026-11-22T10:00:00+09:00' },
      { id: 'urgent', status: 'open', for: 'you', title: 'Call office', prio: 'high', due: '2026-11-19T17:00:00+09:00' },
      { id: 'asg', status: 'open', for: 'you', type: 'ASSIGNMENT', title: 'Report', due: '2026-11-30T12:00:00+09:00' },
      { id: 'q', status: 'open', for: 'you', type: 'QUESTION', title: 'Which day?', ask: 'Thu or Fri?' },
    ];
    expect(shareTargets(cards, '', now).map((x) => x.id)).toEqual(['asg', 'q', 'urgent', 'today', 'prep', 'nexo', 'later']);
    expect(shareTargets(cards, 'r', now).map((x) => x.id)).toEqual(['asg', 'today', 'nexo', 'later']);
  });
  it('summarises', () => {
    const f = new File(['x'], 'a.png');
    expect(shareSummary({ text: '', files: [f, f] })).toBe('2 files');
    expect(shareSummary({ text: 'hi', files: [f] })).toBe('1 file and text');
    expect(shareSummary({ text: 'hi', files: [] })).toBe('hi');
    expect(shareSummary({ text: '', files: [] })).toBe('Nothing readable was shared');
  });
});
