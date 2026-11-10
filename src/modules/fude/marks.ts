/**
 * Where to underline in a document in Suggestions mode: the reviewer's open notes (found by their exact words) and
 * the profile's rule hits. Pure, so the layout of the overlay can be tested without a browser.
 */
import type { Note } from './documents';
import type { Hit, Sev } from './profiles';

export interface Mark { start: number; end: number; kind: 'note' | 'rule'; sev: Sev; id: string }
export interface Segment { text: string; mark?: Mark }

/** Ranges sorted by position and never overlapping: when two collide the earlier one wins, and a note beats a rule on the same words. */
export function markRanges(text: string, notes: Note[], hits: Hit[]): Mark[] {
  const all: Mark[] = [];
  for (const n of notes) {
    if (n.status !== 'open' || !n.find) continue;
    const i = text.indexOf(n.find);
    if (i >= 0) all.push({ start: i, end: i + n.find.length, kind: 'note', sev: 'warn', id: n.id });
  }
  for (const h of hits) if (h.match) all.push({ start: h.index, end: h.index + h.match.length, kind: 'rule', sev: h.sev, id: `${h.rule}-${h.index}` });
  all.sort((a, b) => a.start - b.start || (a.kind === b.kind ? 0 : a.kind === 'note' ? -1 : 1) || b.end - a.end);
  const out: Mark[] = [];
  for (const m of all) {
    const last = out[out.length - 1];
    if (!last || m.start >= last.end) out.push(m);
  }
  return out;
}

/** The text cut into plain and marked pieces, covering every character exactly once. */
export function segments(text: string, marks: Mark[]): Segment[] {
  const out: Segment[] = [];
  let at = 0;
  for (const m of marks) {
    if (m.start > at) out.push({ text: text.slice(at, m.start) });
    out.push({ text: text.slice(m.start, m.end), mark: m });
    at = m.end;
  }
  if (at < text.length) out.push({ text: text.slice(at) });
  return out;
}

/** The mark the caret is in or touching, or undefined. A caret at the very end of the words still counts, so a tap on the last letter opens it. */
export function markAt(marks: Mark[], pos: number): Mark | undefined {
  return marks.find((m) => pos > m.start && pos <= m.end);
}
