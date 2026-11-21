import type { Category, LogEvent, TaskType } from './model';
import { elapsedMin, type Running } from './timer';

/** The id of the unassigned timer the add button starts: it is not any chore yet. */
export const OPEN_TASK = '';
/** Log events for a one-off carry this id and the name in `custom`. It is not in the catalog. */
export const CUSTOM_ID = 'custom';

export const isOpenTimer = (r: Running | null): r is Running => r !== null && r.taskId === OPEN_TASK;
export const startOpenTimer = (now: number): Running => ({ taskId: OPEN_TASK, start: now });

export const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'chore';

export const blankTask = (): TaskType => ({ id: '', names: { en: '', es: '', ja: '' }, icon: '🧹', category: 'rooms', freq: { times: 1, perDays: 7 }, mode: 'measured', priorMinutes: 15, active: true });

/** A new chore made from the quick log: never planned on its own (logged when done), first guess is the time just measured. */
export function newTaskFrom(name: string, icon: string, category: Category, minutes: number, now: number): TaskType {
  const en = name.trim();
  return { ...blankTask(), id: `${slug(en)}-${now.toString(36).slice(-3)}`, names: { en, es: '', ja: '' }, icon: icon.trim() || '🧹', category, freq: { times: 0, perDays: 7, adhoc: true }, priorMinutes: Math.max(1, Math.round(minutes)) };
}

/** Stand-in for a one-off, so balance and the lists can weigh it by its minutes without a catalog entry. */
export function customTask(name: string): TaskType {
  return { ...blankTask(), id: CUSTOM_ID, names: { en: name, es: name, ja: name }, icon: '✏️', category: 'tidy', freq: { times: 0, perDays: 7, adhoc: true } };
}

export type Kind =
  | { kind: 'existing'; taskId: string }
  | { kind: 'new'; task: TaskType }
  | { kind: 'custom'; name: string };

/** The log event for a finished unassigned timer. Same shape as a logged chore; a one-off also carries its name. */
export function eventFromTimer(r: Running, now: number, uid: string, pick: Kind): Omit<LogEvent, 'id'> {
  const base = { uid, kind: 'done' as const, at: now, start: r.start, minutes: elapsedMin(r.start, now), planned: false };
  if (pick.kind === 'existing') return { ...base, taskId: pick.taskId };
  if (pick.kind === 'new') return { ...base, taskId: pick.task.id };
  return { ...base, taskId: CUSTOM_ID, custom: pick.name.trim().slice(0, 80) };
}
