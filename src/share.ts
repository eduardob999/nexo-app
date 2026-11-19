import type { Card } from './types';
import { searchCards } from './search';

/** What another app handed over: the service worker keeps it in the `nexo-share` cache until the page has dealt with it. */
export interface SharedMeta {
  title: string;
  text: string;
  url: string;
  files: { name: string; type: string; lastModified: number }[];
  at: number;
}
export interface Shared { text: string; files: File[] }

/** The words shared with the files, as one block of text. Android often repeats the link in both text and url. */
export function sharedText(m: { title?: string; text?: string; url?: string }): string {
  const title = (m.title ?? '').trim();
  const text = (m.text ?? '').trim();
  const url = (m.url ?? '').trim();
  const parts: string[] = [];
  if (title && title !== text && !text.includes(title)) parts.push(title);
  if (text) parts.push(text);
  if (url && !text.includes(url)) parts.push(url);
  return parts.join('\n');
}

/** Is this page load the landing of a share? */
export function isShareLoad(search: string): boolean {
  return new URLSearchParams(search).get('share') === '1';
}

/** Cards offered in the picker: all when the box is empty, otherwise the ones matching every word. */
export function shareTargets(cards: Card[], query: string): Card[] {
  return query.trim() ? searchCards(cards, query) : cards;
}

/** A line saying what is being shared, for the top of the picker. */
export function shareSummary(s: Shared): string {
  const n = s.files.length;
  const bits: string[] = [];
  if (n > 0) bits.push(`${n} file${n > 1 ? 's' : ''}`);
  if (s.text) bits.push(s.files.length > 0 ? 'text' : s.text.length > 80 ? `${s.text.slice(0, 80)}…` : s.text);
  return bits.join(' and ') || 'Nothing readable was shared';
}

/** Read what the service worker stashed, then empty the stash so a reload does not offer it twice. */
export async function takeShared(): Promise<Shared | null> {
  if (typeof caches === 'undefined') return null;
  const cache = await caches.open('nexo-share');
  const keys = await cache.keys();
  const metaKey = keys.find((k) => k.url.endsWith('/share-meta'));
  if (!metaKey) return null;
  const meta = (await (await cache.match(metaKey))!.json()) as SharedMeta;
  const files: File[] = [];
  for (let i = 0; i < meta.files.length; i++) {
    const key = keys.find((k) => k.url.endsWith(`/share-file/${i}`));
    const res = key ? await cache.match(key) : undefined;
    if (!res) continue;
    const f = meta.files[i]!;
    files.push(new File([await res.blob()], f.name, { type: f.type, lastModified: f.lastModified }));
  }
  for (const k of keys) await cache.delete(k);
  return { text: sharedText(meta), files };
}
