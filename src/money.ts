import type { Alloc, Receipt } from './types';

/** The month in Japan, YYYY-MM, whatever the phone's own zone. */
export function jstMonth(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' }).slice(0, 7);
}

/** A line with no month belongs to the month of its timestamp, which covers every line written before months existed. */
export function allocMonth(a: Alloc): string {
  return a.month || (a.ts ? jstMonth(new Date(a.ts)) : '');
}

export interface MonthSummary { lines: Alloc[]; total: number; left: number; doneCount: number }

export function summarise(all: Alloc[], month: string): MonthSummary {
  const lines = all.filter((a) => allocMonth(a) === month);
  const total = lines.reduce((s, a) => s + a.amount, 0);
  const left = lines.filter((a) => !a.done).reduce((s, a) => s + a.amount, 0);
  return { lines, total, left, doneCount: lines.filter((a) => a.done).length };
}

/** True when this month has no lines but an earlier one does, so the month should be seeded. */
export function needsSeed(all: Alloc[], month: string): boolean {
  return all.length > 0 && !all.some((a) => allocMonth(a) === month) && all.some((a) => allocMonth(a) && allocMonth(a) < month);
}

export function earlierMonths(all: Alloc[], month: string): { month: string; summary: MonthSummary }[] {
  return [...new Set(all.map(allocMonth).filter((m) => m && m < month))].sort().reverse().map((m) => ({ month: m, summary: summarise(all, m) }));
}

export const yen = (n: number) => `¥${n.toLocaleString('en-US')}`;

const AGO = (ms: number) => { const m = Math.round(ms / 60000); return m < 60 ? `${m} min` : m < 2880 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`; };

/** How many times each market item was logged, and when last. */
export function marketCounts(log: { itemId?: string | null; name: string; ts: string }[], now: number): Map<string, { n: number; last: string }> {
  const out = new Map<string, { n: number; last: number }>();
  for (const l of log) {
    const k = l.itemId ?? l.name;
    const t = Date.parse(l.ts);
    const e = out.get(k) ?? { n: 0, last: 0 };
    out.set(k, { n: e.n + 1, last: Math.max(e.last, Number.isNaN(t) ? 0 : t) });
  }
  return new Map([...out].map(([k, v]) => [k, { n: v.n, last: v.last ? `${AGO(now - v.last)} ago` : '' }]));
}

/** Receipts with an item name become chart rows; lump-sum shop trips are counted apart. Tax is skipped. */
export function moneyItems(list: Receipt[]): { rows: { name: string; n: number; sum: number }[]; lump: { n: number; sum: number } } {
  const rows = new Map<string, { name: string; n: number; sum: number }>();
  const lump = { n: 0, sum: 0 };
  for (const r of list) {
    const v = r.vendor || '';
    const i = v.indexOf(' (');
    const raw = i > -1 ? v.slice(i + 2).replace(/\)\s*$/, '') : '';
    const name = raw.replace(/\s*\((?:\d+\s*(?:個|点|本|袋|pcs?)|×\s*\d+)\)\s*$/, '').trim();
    if (/^消費税|^tax$/i.test(name)) continue;
    if (!name || r.amount >= 3000 || /supermarket|合計額のみ|判読/.test(raw) || /^fondo/i.test(v)) { lump.n++; lump.sum += r.amount || 0; continue; }
    const e = rows.get(name) ?? { name, n: 0, sum: 0 };
    e.n++; e.sum += r.amount || 0;
    rows.set(name, e);
  }
  return { rows: [...rows.values()], lump };
}

export function topBars(rows: { name: string; n: number; sum: number }[], key: 'n' | 'sum'): { name: string; value: number; pct: number }[] {
  const top = [...rows].sort((a, b) => b[key] - a[key] || a.name.localeCompare(b.name)).slice(0, 8);
  const max = top[0]?.[key] || 1;
  return top.map((r) => ({ name: r.name, value: r[key], pct: Math.max(2, Math.round((100 * r[key]) / max)) }));
}

/** Receipts by month, newest first, each with a total and a per-category breakdown sorted by amount. */
export function receiptMonths(list: Receipt[]): { month: string; total: number; cats: { cat: string; sum: number }[]; items: Receipt[] }[] {
  const by = new Map<string, Receipt[]>();
  for (const r of list) by.set(jstMonth(new Date(r.ts)), [...(by.get(jstMonth(new Date(r.ts))) ?? []), r]);
  return [...by.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([month, items]) => {
    const cats = new Map<string, number>();
    for (const r of items) cats.set(r.cat, (cats.get(r.cat) ?? 0) + r.amount);
    return { month, total: items.reduce((s, r) => s + r.amount, 0), cats: [...cats].map(([cat, sum]) => ({ cat, sum })).sort((a, b) => b.sum - a.sum), items: items.sort((a, b) => b.ts.localeCompare(a.ts)) };
  });
}
