import type { Lang, Member, TaskType } from './model';

export interface Entry { by: string; what: string; at: number }

/** One readable line for a history entry: "Carla edited Wash the dishes". Unknown entries fall back to the raw text, never to nothing. */
export function historyLine(e: Entry, tasks: TaskType[], members: Pick<Member, 'uid' | 'name'>[], lang: Lang): string {
  const who = members.find((m) => m.uid === e.by)?.name ?? '?';
  const [verb, id] = e.what.split(' ');
  const task = tasks.find((t) => t.id === id);
  const name = task ? `${task.icon} ${task.names[lang] || task.names.en}` : id ?? '';
  const V: Record<Lang, Record<string, string>> = {
    en: { edit: 'edited', add: 'added', settings: 'changed the settings' },
    es: { edit: 'editó', add: 'añadió', settings: 'cambió los ajustes' },
    ja: { edit: 'が編集', add: 'が追加', settings: 'が設定を変更' },
  };
  const word = V[lang][verb ?? ''];
  if (!word) return `${who}: ${e.what}`;
  if (verb === 'settings') return lang === 'ja' ? `${who}${word}` : `${who} ${word}`;
  return lang === 'ja' ? `${who}${word}: ${name}` : `${who} ${word} ${name}`;
}
