import { describe, expect, it } from 'vitest';
import { addPicked, removePicked, uploadFailText } from './addfiles';
import { storeDraft } from './persist';
import { qtyText, receiptTotals } from './money';

const f = (name: string, size = 1) => new File(['x'.repeat(size)], name, { lastModified: 1 });

describe('add sheet files', () => {
  it('adds without duplicating the same file', () => {
    const a = addPicked([], [f('a.jpg'), f('b.jpg')]);
    expect(addPicked(a, [f('a.jpg'), f('c.jpg')]).map((x) => x.name)).toEqual(['a.jpg', 'b.jpg', 'c.jpg']);
  });
  it('removes by position', () => {
    expect(removePicked([f('a'), f('b'), f('c')], 1).map((x) => x.name)).toEqual(['a', 'c']);
  });
  it('words the failure', () => {
    expect(uploadFailText(new Error('Not signed in'))).toBe('Card added, photo could not upload: Not signed in');
    expect(uploadFailText(undefined)).toBe('Card added, photo could not upload: upload failed');
  });
});

describe('draft storage', () => {
  it('forgets an emptied draft', () => {
    const store = new Map<string, string>();
    const ls = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
    (globalThis as unknown as { window: unknown }).window = { localStorage: ls };
    storeDraft('add', 'call the office');
    expect(store.get('nexo-draft-add')).toBe('call the office');
    storeDraft('add', '');
    expect(store.has('nexo-draft-add')).toBe(false);
  });
});

describe('receipt breakdown', () => {
  it('shows quantity times unit', () => {
    expect(qtyText({ qty: 3, unit: 139 })).toBe('3 × ¥139');
    expect(qtyText({})).toBe('');
  });
  it('lists only the totals the receipt has', () => {
    expect(receiptTotals({ amount: 1459 }).map((r) => r.label)).toEqual(['Total']);
    expect(receiptTotals({ amount: 1459, subtotal: 1351, taxTotal: 108, paid: 10000, change: 8541 }).map((r) => r.label)).toEqual(['Subtotal', 'Tax', 'Total', 'Paid', 'Change']);
  });
});
