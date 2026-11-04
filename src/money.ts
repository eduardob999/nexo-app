import type { Alloc } from './types';

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
