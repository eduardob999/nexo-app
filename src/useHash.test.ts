import { describe, expect, it } from 'vitest';
import { parseHash } from './useHash';

describe('parseHash', () => {
  it('defaults to today', () => {
    expect(parseHash('')).toEqual({ name: 'today' });
    expect(parseHash('#/')).toEqual({ name: 'today' });
  });
  it('reads tabs and cards', () => {
    expect(parseHash('#/drafts')).toEqual({ name: 'drafts' });
    expect(parseHash('#/nexo')).toEqual({ name: 'nexo' });
    expect(parseHash('#/upcoming')).toEqual({ name: 'upcoming' });
    expect(parseHash('#/browse')).toEqual({ name: 'browse' });
    expect(parseHash('#/search')).toEqual({ name: 'search' });
    expect(parseHash('#/card/n-abc')).toEqual({ name: 'card', id: 'n-abc' });
  });
  it('ignores a card route with no id', () => {
    expect(parseHash('#/card')).toEqual({ name: 'today' });
  });
});
