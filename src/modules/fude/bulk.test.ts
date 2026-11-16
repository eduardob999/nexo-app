import { describe, expect, it } from 'vitest';
import { acceptAll, openInOrder } from './bulk';
import type { Note } from './documents';

const n = (id: string, find: string, fix: string, status: Note['status'] = 'open'): Note => ({ id, find, fix, kind: 'clarity', msg: 'x', status });

describe('acceptAll', () => {
  it('applies every open fix in turn', () => {
    const r = acceptAll('One two three.', [n('a', 'One', '1'), n('b', 'three', '3')]);
    expect(r.text).toBe('1 two 3.');
    expect(r.applied.map((x) => x.id)).toEqual(['a', 'b']);
  });
  it('skips notes with no fix, closed notes and words an earlier fix removed', () => {
    const r = acceptAll('Alpha beta gamma.', [n('a', 'Alpha beta', 'Delta'), n('b', 'beta', 'B'), n('c', 'gamma', ''), n('d', 'Alpha', 'A', 'dismissed')]);
    expect(r.text).toBe('Delta gamma.');
    expect(r.skipped.map((x) => x.id)).toEqual(['b', 'c']);
  });
});

describe('openInOrder', () => {
  it('orders by position and drops closed notes', () => {
    const list = openInOrder('x aa bb', [n('1', 'bb', ''), n('2', 'aa', ''), n('3', 'x', '', 'accepted')]);
    expect(list.map((x) => x.id)).toEqual(['2', '1']);
  });
});
