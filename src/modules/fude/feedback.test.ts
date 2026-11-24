import { describe, expect, it } from 'vitest';
import { addFeedback, removeFeedback } from './feedback';

const now = new Date('2026-11-24T05:00:00Z');
describe('feedback', () => {
  it('adds a trimmed entry at the end with the step and kind', () => {
    const a = addFeedback(undefined, { text: ' first ', step: 7, kind: 'idea' }, now, 'a');
    const b = addFeedback(a, { text: 'second', step: 3, kind: 'problem' }, now, 'b');
    expect(b.map((e) => e.id)).toEqual(['a', 'b']);
    expect(b[0]).toMatchObject({ text: 'first', step: 7, kind: 'idea', at: now.toISOString() });
  });
  it('ignores empty text and returns the same list', () => {
    const a = addFeedback(undefined, { text: 'x', step: 1, kind: 'idea' }, now, 'a');
    expect(addFeedback(a, { text: '  ', step: 1, kind: 'idea' }, now, 'b')).toBe(a);
  });
  it('removes by id', () => {
    const a = addFeedback(undefined, { text: 'x', step: 1, kind: 'idea' }, now, 'a');
    expect(removeFeedback(a, 'a')).toEqual([]);
    expect(removeFeedback(undefined, 'a')).toEqual([]);
  });
});
