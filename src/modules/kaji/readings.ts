import type { TaskType } from './model';

/** Hiragana readings for the Japanese chore names, shown under the name when the reading line is on (for someone still learning kanji). */
export const READINGS: Record<string, string> = {
  platos: 'さらあらい', recoger: 'しょっきをさげる', desayuno: 'ちょうしょくづくり', bento: 'おべんとうづくり', cena: 'ゆうしょくづくり',
  congelar: 'れいとうようのつくりおき', aspirar: 'そうじきがけ', polvo: 'かぐとべっどのほこりとり', 'piso-sala': 'りびんぐのゆかのねんいりそうじ',
  'bano-profundo': 'よくしつ・せんめん・といれたんくのねんいりそうじ', poceta: 'といれそうじ', ropa: 'せんたく（ほすものとかんそうきのものをわける）',
  guindar: 'せんたくものをほす', doblar: 'せんたくものをたたむ', sabanas: 'しーつをあらう', 'poner-sabanas': 'しーつをしく', panos: 'ふきん・たおるをあらう',
  basura: 'ごみだし', mercado: 'かいもの（いちば・だいそー・すぎやっきょく）', ordenar: 'かたづけ',
};

const KEY = 'kaji.readings';
export function readingsOn(): boolean {
  try { return window.localStorage.getItem(KEY) === '1'; } catch { return false; }
}
export function setReadings(on: boolean): void {
  try { window.localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* private mode */ }
}

/** The reading line for a chore, only for Japanese and only for the built-in chores whose name is still the original. */
export function readingFor(task: Pick<TaskType, 'id' | 'names'>, lang: string, on: boolean): string | null {
  return on && lang === 'ja' ? READINGS[task.id] ?? null : null;
}
