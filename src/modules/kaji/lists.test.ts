import { describe, expect, it } from 'vitest';
import { counts, ordered, splitLines } from './lists';
import type { KItem } from './store';

const it_ = (id: string, at: number, done = false, doneAt = 0): KItem => ({ id, listId: 'l', text: id, done, by: 'a', at, doneAt });

describe('shared lists', () => {
  it('puts open items first, oldest first, and done ones after, newest done first', () => {
    expect(ordered([it_('d1', 1, true, 10), it_('o2', 5), it_('d2', 2, true, 20), it_('o1', 3)]).map((i) => i.id)).toEqual(['o1', 'o2', 'd2', 'd1']);
  });
  it('counts open and done', () => {
    expect(counts([it_('a', 1), it_('b', 2, true), it_('c', 3, true)])).toEqual({ open: 1, done: 2 });
    expect(counts([])).toEqual({ open: 0, done: 0 });
  });
  it('splits pasted text into items without bullets or numbers', () => {
    expect(splitLines('- leche\n2. huevos\n\n  • 米\nplain')).toEqual(['leche', 'huevos', '米', 'plain']);
    expect(splitLines('  \n ')).toEqual([]);
  });
});
