import { t } from './i18n';
import type { Lang, Member, TaskType } from './model';
import type { LearnedShift } from './reschedule';

export interface Entry { by: string; what: string; at: number }

/** One readable line for a history entry: "Carla edited Wash the dishes". Unknown entries fall back to the raw text, never to nothing. */
export function historyLine(e: Entry, tasks: TaskType[], members: Pick<Member, 'uid' | 'name'>[], lang: Lang): string {
  const who = members.find((m) => m.uid === e.by)?.name ?? '?';
  const [verb, id] = e.what.split(' ');
  const task = tasks.find((t) => t.id === id);
  const name = task ? `${task.icon} ${task.names[lang] || task.names.en}` : id ?? '';
  const V: Record<string, string> = { edit: 'edited', add: 'added', settings: 'changed the settings' };
  const word = V[verb ?? ''];
  if (!word) return `${who}: ${e.what}`;
  if (verb === 'settings') return `${who} ${word}`;
  return `${who} ${word} ${name}`;
}

/** One line for a shift the planner learned from the household's own moves: "🗑️ Take out the rubbish: window 30 min later, from 3 moves". */
export function learnedLine(l: LearnedShift, tasks: TaskType[], lang: Lang): string {
  const task = tasks.find((x) => x.id === l.taskId);
  const name = task ? `${task.icon} ${task.names[lang] || task.names.en}` : l.taskId;
  const body = l.kind === 'window'
    ? t(lang, l.value < 0 ? 'learnedEarlier' : 'learnedLater').replace('{m}', String(Math.abs(l.value)))
    : t(lang, 'learnedFreq').replace('{x}', String(l.value));
  return `${name}: ${body.replace('{n}', String(l.n))}`;
}
