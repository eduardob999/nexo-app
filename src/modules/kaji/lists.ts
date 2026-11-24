import type { LedgerEntry } from './ledger';
import type { KItem } from './store';

/** Open items first, oldest first; done ones after, newest done first. */
export function ordered(items: KItem[]): KItem[] {
  return [...items].sort((a, b) => Number(a.done) - Number(b.done) || (a.done ? (b.doneAt ?? 0) - (a.doneAt ?? 0) : a.at - b.at));
}

export function counts(items: KItem[]): { open: number; done: number } {
  const done = items.filter((i) => i.done).length;
  return { open: items.length - done, done };
}

/** Several lines pasted at once become several items; bullets, numbers and blank lines are dropped. */
export function splitLines(raw: string): string[] {
  return raw.split(/\r?\n/).map((l) => l.replace(/^\s*(?:[-*•・]|\d+[.)])\s*/, '').trim()).filter(Boolean).slice(0, 60);
}

/** "coagulante ¥110", "leche 198円" or "pan 250": a trailing amount becomes the item's price. */
export function parseItem(line: string): { text: string; price?: number } {
  const t = line.trim();
  const m = t.match(/^(.+?)\s*(?:[¥￥]\s*(\d[\d,]*)|(\d[\d,]*)\s*(?:円|yen)|\s(\d[\d,]*))$/i);
  if (!m) return { text: t };
  const raw = m[2] ?? m[3] ?? m[4] ?? '';
  const price = Number(raw.replace(/,/g, ''));
  if (m[4] && price < 50) return { text: t };  // "pack of 3" is a count, not a price
  return price > 0 && price < 10_000_000 ? { text: m[1]!.trim(), price } : { text: t };
}

/** Sum of the prices of the items still to buy, and how many of them have no price yet. */
export function openTotal(items: KItem[]): { total: number; unpriced: number } {
  const open = items.filter((i) => !i.done);
  return { total: open.reduce((a, i) => a + (i.price ?? 0), 0), unpriced: open.filter((i) => !i.price).length };
}

/** The Money entry a bought item becomes: paid by whoever bought it, split equally between both. */
export function itemExpense(item: KItem, listTitle: string, me: string, amount: number, now = Date.now()): Omit<LedgerEntry, 'id'> {
  return { at: now, by: me, paidBy: me, amount: Math.round(amount), text: `${item.text} (${listTitle})`, kind: 'expense' };
}

export const SUGGESTED: { en: string; es: string; ja: string; items?: string[] }[] = [
  { en: 'Daiso', es: 'Daiso', ja: 'ダイソー', items: ['El coagulante para el aceite'] },
  { en: 'Shopping', es: 'Compras', ja: '買い物' }, { en: 'Trips', es: 'Viajes', ja: '旅行' }, { en: 'Home', es: 'Casa', ja: '家' },
];
