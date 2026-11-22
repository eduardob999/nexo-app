import type { LogEvent, PlannedItem, SwapRecord, TaskType } from './model';
import { swapItem } from './planner';
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

/** My latest swap request for one planned chore (matched by id, or by chore and time when a re-plan changed the id), so the button reflects what became of it. */
export function latestSwap(swaps: SwapRecord[], me: string, item: PlannedItem): SwapRecord | undefined {
  return swaps.filter((s) => s.fromUid === me && swapItem([item], s) === item).sort((a, b) => b.at - a.at)[0];
}

/** What the Swap button shows: nothing sent yet, a request waiting, or an answer. An accepted swap has moved the chore, so it no longer sits with the one who asked. */
export function swapButtonState(swap: SwapRecord | undefined, sending: boolean): 'idle' | 'sending' | 'open' | 'declined' {
  if (sending) return 'sending';
  return swap?.state === 'open' ? 'open' : swap?.state === 'declined' ? 'declined' : 'idle';
}

export function taskName(t: TaskType | undefined, lang: 'en' | 'es' | 'ja', id = ''): string {
  return t ? t.names[lang] || t.names.en : id;
}

/** " with Clean kitchen sink": the chores a planned item carries in the same go (TaskType.bundle), empty when none. */
export function withNames(item: PlannedItem, byId: Map<string, TaskType>, lang: 'en' | 'es' | 'ja', word: string): string {
  return item.with?.length ? ` ${word} ${item.with.map((w) => taskName(byId.get(w.taskId), lang, w.taskId)).join(', ')}` : '';
}

/** Two colours, one per person, readable on light and dark. */
export const MEMBER_COLORS = ['#3b6fe0', '#d0508a', '#2f9e8f', '#c98a2c'];
export const memberColor = (index: number): string => MEMBER_COLORS[index % MEMBER_COLORS.length] as string;

/** What this person finished in the last two days, newest first, with whether it has any rating yet: the list that lets her rate later. */
export function recentDone(log: LogEvent[], uid: string, now: number, limit = 6): { event: LogEvent; rated: boolean }[] {
  return log.filter((e) => e.uid === uid && e.kind === 'done' && e.at <= now + 60_000 && e.at >= now - 2 * 86_400_000)
    .sort((a, b) => b.at - a.at).slice(0, limit)
    .map((event) => ({ event, rated: typeof event.effort === 'number' || typeof event.dislike === 'number' || typeof event.enjoyment === 'number' || Boolean(event.note) }));
}
