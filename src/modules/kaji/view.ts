import type { LogEvent, PlannedItem, TaskType } from './model';
import { dayKey, dayStart, DAY } from './time';

/** A planned chore counts as done once the log has that chore after (roughly) its start, so the screen answers before the replan. */
export function isDone(item: PlannedItem, log: LogEvent[], now: number): boolean {
  return log.some((e) => e.taskId === item.taskId && e.kind === 'done' && e.at >= item.start - 6 * 3_600_000 && e.at <= now + 60_000);
}

/** What one person still has to do today, soonest first, plus what is overdue from earlier today. */
export function todayFor(items: PlannedItem[], uid: string, log: LogEvent[], now: number, tz?: number): PlannedItem[] {
  const d0 = dayStart(now, tz), d1 = d0 + DAY;
  return items.filter((i) => i.uid === uid && i.start >= d0 && i.start < d1 && !isDone(i, log, now)).sort((a, b) => a.start - b.start);
}

export function groupByDay(items: PlannedItem[], tz?: number): { day: string; items: PlannedItem[] }[] {
  const m = new Map<string, PlannedItem[]>();
  for (const i of [...items].sort((a, b) => a.start - b.start)) {
    const k = dayKey(i.start, tz);
    m.set(k, [...(m.get(k) ?? []), i]);
  }
  return [...m.entries()].map(([day, list]) => ({ day, items: list }));
}

export function taskName(t: TaskType | undefined, lang: 'en' | 'es' | 'ja', id = ''): string {
  return t ? t.names[lang] || t.names.en : id;
}

/** Two colours, one per person, readable on light and dark. */
export const MEMBER_COLORS = ['#3b6fe0', '#d0508a', '#2f9e8f', '#c98a2c'];
export const memberColor = (index: number): string => MEMBER_COLORS[index % MEMBER_COLORS.length] as string;
