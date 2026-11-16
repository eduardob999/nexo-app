/** Bulk actions on the reviewer's and Claude's suggestions, and the per-device pause of the automatic review. */
import { applyFix } from './documents';
import type { Note } from './documents';

export interface BulkResult { text: string; applied: Note[]; skipped: Note[] }

/**
 * Apply every open suggestion that has a fix, one after another, each on the text the earlier ones produced.
 * A suggestion whose words are gone (an earlier fix changed them) or that has no fix is skipped, never forced.
 */
export function acceptAll(text: string, notes: Note[]): BulkResult {
  let cur = text;
  const applied: Note[] = [];
  const skipped: Note[] = [];
  for (const n of notes) {
    if (n.status !== 'open') continue;
    const next = applyFix(cur, n.find, n.fix);
    if (next === null) { skipped.push(n); continue; }
    cur = next;
    applied.push(n);
  }
  return { text: cur, applied, skipped };
}

/** Open suggestions, in the order they appear in the text, so "accept all" reads the way the document does. */
export function openInOrder(text: string, notes: Note[]): Note[] {
  return notes.filter((n) => n.status === 'open').sort((a, b) => text.indexOf(a.find) - text.indexOf(b.find));
}

const KEY = (id: string) => `fude-paused-${id}`;

/** Paused reviewing is a per-device choice (the automatic review runs in this browser), kept in localStorage when it works. */
export function readPaused(id: string): boolean {
  try { return window.localStorage.getItem(KEY(id)) === '1'; } catch { return false; }
}
export function writePaused(id: string, paused: boolean): void {
  try { if (paused) window.localStorage.setItem(KEY(id), '1'); else window.localStorage.removeItem(KEY(id)); } catch { /* private mode: the pause lasts for this session only */ }
}
