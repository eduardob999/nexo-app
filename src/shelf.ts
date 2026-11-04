import type { Card, Resource } from './types';

export const KIND_LABEL: Record<string, string> = { deck: 'Decks', paper: 'Papers', repo: 'Repos', doc: 'Docs', link: 'Links', file: 'Files', video: 'Video' };
export const KIND_ORDER = ['deck', 'paper', 'repo', 'doc', 'link', 'file', 'video'];

/** Resources grouped by kind in a fixed order, newest first inside each. Archived ones are left out. */
export function groupResources(items: Resource[]): { kind: string; label: string; items: Resource[] }[] {
  const live = items.filter((r) => !r.archived);
  const kinds = [...KIND_ORDER, ...live.map((r) => r.kind).filter((k) => !KIND_ORDER.includes(k))];
  return [...new Set(kinds)]
    .map((k) => ({ kind: k, label: KIND_LABEL[k] ?? k, items: live.filter((r) => r.kind === k).sort((a, b) => String(b.ts ?? '').localeCompare(String(a.ts ?? ''))) }))
    .filter((g) => g.items.length > 0);
}

/** Only https and http addresses become links; anything else (a path, javascript:) is shown as text to copy. */
export function isWebLink(target: string): boolean {
  return /^https?:\/\/[^\s"'<>]+$/i.test(target.trim());
}

/** Finished cards, most recently finished first. */
export function recentDone(cards: Card[]): Card[] {
  const t = (c: Card) => Date.parse((c as Card & { doneAt?: string }).doneAt ?? c.due ?? '') || 0;
  return [...cards].sort((a, b) => t(b) - t(a));
}
