/** Word-level changes between a base version and the current text. Pure: no DOM, no Firestore. */
export interface Hunk {
  id: number;
  /** Character range in the current text that this change occupies (empty for a pure deletion). */
  curStart: number;
  curEnd: number;
  /** What the base had there, and what the text has now. */
  removed: string;
  added: string;
}

const tokens = (s: string): string[] => s.match(/\S+\s*/g) ?? [];

/**
 * Changes from `base` to `cur`, as hunks in text order. Tokens are a word with its trailing space, so a change in
 * spacing alone counts. Adjacent insertions and deletions merge into one replacement.
 */
export function diffWords(base: string, cur: string): Hunk[] {
  if (base === cur) return [];
  const a = tokens(base);
  const b = tokens(cur);
  const n = a.length;
  const m = b.length;
  // longest common subsequence table, from the end so the walk below runs forwards
  const w = m + 1;
  const t = new Uint32Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      t[i * w + j] = a[i] === b[j] ? (t[(i + 1) * w + j + 1] as number) + 1 : Math.max(t[(i + 1) * w + j] as number, t[i * w + j + 1] as number);
    }
  }
  const starts: number[] = [];
  let off = 0;
  for (const x of b) { starts.push(off); off += x.length; }
  starts.push(off);
  const hunks: Hunk[] = [];
  let i = 0;
  let j = 0;
  let open: { ai: number; bj: number } | null = null;
  const close = (ai: number, bj: number) => {
    if (!open) return;
    hunks.push({ id: hunks.length, curStart: starts[open.bj] as number, curEnd: starts[bj] as number, removed: a.slice(open.ai, ai).join(''), added: b.slice(open.bj, bj).join('') });
    open = null;
  };
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) { close(i, j); i++; j++; continue; }
    if (!open) open = { ai: i, bj: j };
    if (j < m && (i >= n || (t[i * w + j + 1] as number) >= (t[(i + 1) * w + j] as number))) j++;
    else i++;
  }
  close(i, j);
  return hunks;
}

/** The text with one change undone: the base's words are put back where the hunk is. */
export function revertHunk(cur: string, h: Hunk): string {
  return cur.slice(0, h.curStart) + h.removed + cur.slice(h.curEnd);
}

/** Undo several changes from the last to the first, so earlier positions stay valid. */
export function revertHunks(cur: string, hunks: Hunk[]): string {
  return [...hunks].sort((x, y) => y.curStart - x.curStart).reduce((t, h) => revertHunk(t, h), cur);
}

/** Words that differ, for the counter next to the tab. */
export const changedWords = (hunks: Hunk[]): number => hunks.reduce((n, h) => n + Math.max(tokens(h.added).length, tokens(h.removed).length), 0);
