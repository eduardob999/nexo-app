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

export const SUGGESTED: { en: string; es: string; ja: string }[] = [
  { en: 'Shopping', es: 'Compras', ja: '買い物' }, { en: 'Trips', es: 'Viajes', ja: '旅行' }, { en: 'Home', es: 'Casa', ja: '家' },
];
