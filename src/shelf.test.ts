import { describe, expect, it } from 'vitest';
import { doneCutoff, groupResources, isWebLink, onlyDone, recentDone } from './shelf';
import type { Card, Resource } from './types';

const r = (id: string, kind: string, extra: Partial<Resource> = {}): Resource => ({ id, kind, title: id, ...extra });

describe('groupResources', () => {
  it('groups by kind in a fixed order, newest first, leaving archived out', () => {
    const g = groupResources([r('a', 'link', { ts: '2026-01-01' }), r('b', 'deck'), r('c', 'link', { ts: '2026-02-01' }), r('d', 'deck', { archived: true })]);
    expect(g.map((x) => x.label)).toEqual(['Decks', 'Links']);
    expect(g[1]?.items.map((x) => x.id)).toEqual(['c', 'a']);
  });
  it('keeps an unknown kind rather than losing the item', () => {
    expect(groupResources([r('a', 'podcast')]).map((x) => x.label)).toEqual(['podcast']);
  });
});

describe('isWebLink', () => {
  it('links only http and https', () => {
    expect(isWebLink('https://example.org/a')).toBe(true);
    expect(isWebLink('javascript:alert(1)')).toBe(false);
    expect(isWebLink('/home/me/file.pdf')).toBe(false);
  });
});

describe('recentDone', () => {
  it('puts the most recently finished first', () => {
    const c = (id: string, doneAt: string): Card => ({ id, status: 'done', for: 'you', ...({ doneAt } as object) });
    expect(recentDone([c('a', '2026-10-01'), c('b', '2026-11-01')]).map((x) => x.id)).toEqual(['b', 'a']);
  });
});

describe('the Shelf asks for a window, not everything', () => {
  it('doneCutoff is exactly N days before now, as ISO text', () => {
    expect(doneCutoff(new Date('2026-11-06T12:00:00.000Z'), 30)).toBe('2026-10-07T12:00:00.000Z');
    expect(doneCutoff(new Date('2026-11-06T12:00:00.000Z'))).toBe('2026-10-07T12:00:00.000Z');
  });

  it('onlyDone drops a card that was reopened after the window query matched it', () => {
    const cards = [{ id: 'a', status: 'done' }, { id: 'b', status: 'open' }] as never[];
    expect(onlyDone(cards).map((c: { id: string }) => c.id)).toEqual(['a']);
  });
});
