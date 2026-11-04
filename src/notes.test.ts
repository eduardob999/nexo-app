import { describe, expect, it } from 'vitest';
import { groupMemos, parseTags } from './notes';
import type { Memo } from './types';

const m = (id: string, text: string, tags: string[], ts: string): Memo => ({ id, text, tags, ts });

describe('parseTags', () => {
  it('lowercases, strips #, dedupes and keeps three', () => {
    expect(parseTags('Research, #japan research  a b')).toEqual(['research', 'japan', 'a']);
    expect(parseTags('  ')).toEqual([]);
  });
});

describe('groupMemos', () => {
  const memos = [m('1', 'dft idea', ['research'], '2026-11-01'), m('2', 'learn kanji', ['japan'], '2026-11-02'), m('3', 'second dft', ['research'], '2026-11-03'), m('4', 'no tag', [], '2026-11-04')];
  it('groups by first tag, biggest first, untagged last, newest first', () => {
    const g = groupMemos(memos, '');
    expect(g.map((x) => x.tag)).toEqual(['research', 'japan', '']);
    expect(g[0]?.items.map((x) => x.id)).toEqual(['3', '1']);
  });
  it('searches the text and the tags', () => {
    expect(groupMemos(memos, 'kanji').flatMap((x) => x.items.map((i) => i.id))).toEqual(['2']);
    expect(groupMemos(memos, '#research').flatMap((x) => x.items.map((i) => i.id)).sort()).toEqual(['1', '3']);
    expect(groupMemos(memos, 'zzz')).toEqual([]);
  });
});
