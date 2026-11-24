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

describe('list prices and Money', () => {
  it('reads a trailing price in yen, and leaves small bare counts alone', async () => {
    const { parseItem } = await import('./lists');
    expect(parseItem('coagulante ¥110')).toEqual({ text: 'coagulante', price: 110 });
    expect(parseItem('leche 198円')).toEqual({ text: 'leche', price: 198 });
    expect(parseItem('pan 1,250')).toEqual({ text: 'pan', price: 1250 });
    expect(parseItem('Huevos x10')).toEqual({ text: 'Huevos x10' });
    expect(parseItem('pilas 4')).toEqual({ text: 'pilas 4' });
    expect(parseItem('El coagulante para el aceite')).toEqual({ text: 'El coagulante para el aceite' });
  });
  it('totals what is still to buy and counts the unpriced', async () => {
    const { openTotal } = await import('./lists');
    expect(openTotal([{ ...it_('a', 1), price: 110 }, it_('b', 2), { ...it_('c', 3, true), price: 500 }])).toEqual({ total: 110, unpriced: 1 });
  });
  it('turns a bought item into an equal-split expense paid by the buyer', async () => {
    const { itemExpense } = await import('./lists');
    expect(itemExpense({ ...it_('x', 1), text: 'Coagulante' }, 'Daiso', 'b', 110.4, 7)).toEqual({ at: 7, by: 'b', paidBy: 'b', amount: 110, text: 'Coagulante (Daiso)', kind: 'expense' });
  });
});
