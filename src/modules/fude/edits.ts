/**
 * Applying a pasted list of modifications to a text, and checking any rewrite for drift. Pure.
 * The helper answers `editRequest`; nothing here changes the text: he accepts a result or he does not.
 */
export type EditStatus = 'applied' | 'partial' | 'skipped' | 'needs';
export interface EditItem { n: number; instruction: string; status: EditStatus; note: string }
export interface EditRequest {
  status: 'requested' | 'working' | 'ready' | 'stale' | 'error';
  /** The text the list is about, exactly as it was when asked. */
  text: string;
  instructions: string;
  result?: string;
  items?: EditItem[];
  message?: string;
  at?: string;
}

export const EDIT_LABEL: Record<EditStatus, string> = { applied: 'Done', partial: 'Part done', skipped: 'Not done', needs: 'Needs you' };

/** What the list will be split into, for the preview before he sends it: one modification per numbered or bulleted line. */
export function listItems(list: string): string[] {
  const lines = (list ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
  const bullet = /^(?:\d+[.)、]|[-*・•])\s*/;
  const out: string[] = [];
  for (const l of lines) {
    if (bullet.test(l) || !out.length) out.push(l.replace(bullet, ''));
    else out[out.length - 1] += ` ${l}`;
  }
  return out;
}

const HEADING = /【[^】\n]+】/g;
const NUMBER = /\d+(?:[.,]\d+)*/g;

/**
 * What a rewrite changed that it should not have: a heading lost, a number that was not in the original, an em dash,
 * a different paragraph count, a length that moved a lot. Empty when the rewrite kept the shape of the text.
 */
export function driftWarnings(before: string, after: string): string[] {
  const out: string[] = [];
  const hb = before.match(HEADING) ?? [];
  const ha = after.match(HEADING) ?? [];
  if (hb.join('|') !== ha.join('|')) out.push(`The headings changed: was ${hb.join(' ') || 'none'}, now ${ha.join(' ') || 'none'}.`);
  const numsB: string[] = before.match(NUMBER) ?? [];
  const numsA: string[] = after.match(NUMBER) ?? [];
  const fresh = Array.from(new Set(numsA.filter((x) => !numsB.includes(x))));
  if (fresh.length) out.push(`New numbers that were not in your text: ${fresh.join(', ')}.`);
  const lost = Array.from(new Set(numsB.filter((x) => !numsA.includes(x))));
  if (lost.length) out.push(`Numbers that disappeared: ${lost.join(', ')}.`);
  if (after.includes('—') && !before.includes('—')) out.push('It added an em dash.');
  const pb = before.split(/\n\s*\n/).filter((p) => p.trim()).length;
  const pa = after.split(/\n\s*\n/).filter((p) => p.trim()).length;
  if (pb !== pa) out.push(`The paragraph count changed: ${pb} before, ${pa} now.`);
  const wb = (before.match(/\S+/g) ?? []).length;
  const wa = (after.match(/\S+/g) ?? []).length;
  if (wb > 0 && Math.abs(wa - wb) / wb > 0.1) out.push(`The length moved by ${Math.round(((wa - wb) / wb) * 100)}% (${wb} to ${wa} words).`);
  return out;
}

/** Two Japanese translations compared with the English by the helper. */
export type ComparePick = 'a' | 'b' | 'either' | 'neither';
export interface CompareItem { n: number; english: string; a: string; b: string; pick: ComparePick; kind: string; note: string; fix?: string }
export interface CompareRequest {
  status: 'requested' | 'working' | 'ready' | 'stale' | 'error';
  english: string;
  a: string;
  b: string;
  labelA?: string;
  labelB?: string;
  budget?: { min?: number; max?: number };
  result?: { summary: string; items: CompareItem[]; merged: string; counts?: { a: number; b: number; merged: number } };
  message?: string;
  at?: string;
}
