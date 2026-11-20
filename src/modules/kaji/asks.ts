import type { Lang } from './model';

/**
 * A request from the other person to the owner. She picks one of a few kinds and writes a line; it becomes a card on his board and
 * NOTHING is done until he answers it. Her text is only ever quoted back to him, never acted on.
 */
export type AskKind = 'remind' | 'plan' | 'question' | 'other';
export interface Ask { id: string; kind: AskKind; text: string; when?: number | null; by: string; byName: string; at: number; state: 'new' | 'sent' | 'done'; cardId?: string }

export const KINDS: { id: AskKind; icon: string; needsWhen: boolean; label: Record<Lang, string>; hint: Record<Lang, string> }[] = [
  { id: 'remind', icon: '🔔', needsWhen: true, label: { en: 'Remind him', es: 'Recordarle algo', ja: 'リマインド' }, hint: { en: 'Remind him of something, on a day', es: 'Que se acuerde de algo, un día', ja: 'ある日に思い出してもらう' } },
  { id: 'plan', icon: '📅', needsWhen: true, label: { en: 'Plan something together', es: 'Planear algo juntos', ja: '一緒に予定を立てる' }, hint: { en: 'A date, a trip, a dinner', es: 'Una fecha, un viaje, una cena', ja: '日程、旅行、食事' } },
  { id: 'question', icon: '❓', needsWhen: false, label: { en: 'Ask a question', es: 'Hacer una pregunta', ja: '質問する' }, hint: { en: 'Something you need to know', es: 'Algo que necesitas saber', ja: '知りたいこと' } },
  { id: 'other', icon: '💬', needsWhen: false, label: { en: 'Something else', es: 'Otra cosa', ja: 'その他' }, hint: { en: 'Anything that needs a yes from him', es: 'Lo que necesite un sí de él', ja: '彼の了承が必要なこと' } },
];

export function problem(kind: AskKind, text: string, when: number | null): string | null {
  const t = text.trim();
  if (t.length < 3) return 'short';
  if (t.length > 400) return 'long';
  if (KINDS.find((k) => k.id === kind)?.needsWhen && (!when || !Number.isFinite(when))) return 'when';
  return null;
}

/** A date from an <input type="date"> and an optional time from <input type="time">, as local epoch ms in the given zone (default Tokyo). */
export function whenFrom(date: string, time: string, tzMin = 540): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const [hh, mm] = /^\d{1,2}:\d{2}$/.test(time) ? (time.split(':').map(Number) as [number, number]) : [9, 0];
  return Date.UTC(y, m - 1, d, hh, mm) - tzMin * 60_000;
}
