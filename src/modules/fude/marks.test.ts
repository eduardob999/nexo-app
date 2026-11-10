import { describe, expect, it } from 'vitest';
import type { Note } from './documents';
import { markAt, markRanges, segments } from './marks';

const note = (id: string, find: string, status: Note['status'] = 'open'): Note => ({ id, find, kind: 'grammar', msg: 'm', fix: '', status });
const hit = (index: number, match: string) => ({ rule: 'r', sev: 'error' as const, msg: 'x', match, index });

describe('marks', () => {
  const text = 'A step do not remove. The rise was 7.9 percent.';
  it('finds open notes by their words and skips dismissed or missing ones', () => {
    const m = markRanges(text, [note('a', 'do not remove'), note('b', 'gone words'), note('c', 'The rise', 'dismissed')], []);
    expect(m).toHaveLength(1);
    expect(text.slice(m[0]!.start, m[0]!.end)).toBe('do not remove');
  });
  it('adds rule hits, sorted, and lets a note win over a rule on the same words', () => {
    const m = markRanges(text, [note('a', '7.9 percent')], [hit(text.indexOf('7.9 percent'), '7.9 percent'), hit(2, 'step')]);
    expect(m.map((x) => [x.kind, text.slice(x.start, x.end)])).toEqual([['rule', 'step'], ['note', '7.9 percent']]);
  });
  it('drops a range that overlaps an earlier one', () => {
    const m = markRanges(text, [note('a', 'step do not'), note('b', 'do not remove')], []);
    expect(m.map((x) => x.id)).toEqual(['a']);
  });
  it('cuts the text into pieces that join back to the original', () => {
    const m = markRanges(text, [note('a', 'do not remove')], [hit(text.indexOf('7.9 percent'), '7.9 percent')]);
    const s = segments(text, m);
    expect(s.map((p) => p.text).join('')).toBe(text);
    expect(s.filter((p) => p.mark)).toHaveLength(2);
    expect(segments('plain', [])).toEqual([{ text: 'plain' }]);
  });
  it('finds the mark under the caret, including its last letter, and nothing outside', () => {
    const m = markRanges(text, [note('a', 'do not remove')], []);
    const a = m[0]!;
    expect(markAt(m, a.start + 3)?.id).toBe('a');
    expect(markAt(m, a.end)?.id).toBe('a');
    expect(markAt(m, a.start)).toBeUndefined();
    expect(markAt(m, 0)).toBeUndefined();
  });
});
