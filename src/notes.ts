import type { Memo } from './types';

/** "research, Japan #reading" into up to three clean tags. */
export function parseTags(raw: string): string[] {
  const out: string[] = [];
  for (const t of raw.split(/[\s,]+/)) {
    const c = t.trim().toLowerCase().replace(/^#/, '');
    if (c && !out.includes(c)) out.push(c);
  }
  return out.slice(0, 3);
}

/**
 * Memos matching the query (in the text or a tag), grouped by first tag, biggest group first, "Untagged"
 * last, newest first inside a group.
 */
export function groupMemos(memos: Memo[], query: string): { tag: string; items: Memo[] }[] {
  const q = query.trim().toLowerCase();
  const hit = memos.filter((m) => !q || m.text.toLowerCase().includes(q) || m.tags.some((t) => t.includes(q.replace(/^#/, ''))));
  const by = new Map<string, Memo[]>();
  for (const m of hit) {
    const k = m.tags[0] ?? '';
    by.set(k, [...(by.get(k) ?? []), m]);
  }
  return [...by.entries()]
    .map(([tag, items]) => ({ tag, items: items.sort((a, b) => b.ts.localeCompare(a.ts)) }))
    .sort((a, b) => (a.tag === '' ? 1 : b.tag === '' ? -1 : b.items.length - a.items.length || a.tag.localeCompare(b.tag)));
}
