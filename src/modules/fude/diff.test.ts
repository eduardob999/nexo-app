import { describe, expect, it } from 'vitest';
import { changedWords, diffWords, revertHunk, revertHunks } from './diff';

describe('diffWords', () => {
  it('finds nothing in identical text', () => {
    expect(diffWords('Same text here.', 'Same text here.')).toEqual([]);
  });
  it('reports a replacement as one hunk with both sides', () => {
    const h = diffWords('The model starts early today.', 'The model starts late today.');
    expect(h).toHaveLength(1);
    expect(h[0]).toMatchObject({ removed: 'early ', added: 'late ' });
  });
  it('reports an insertion and a deletion', () => {
    const ins = diffWords('One two three.', 'One two really three.');
    expect(ins[0]).toMatchObject({ removed: '', added: 'really ' });
    const del = diffWords('One two three.', 'One three.');
    expect(del[0]).toMatchObject({ removed: 'two ', added: '' });
  });
  it('keeps separate changes separate, in text order', () => {
    const h = diffWords('a b c d e f g', 'a X c d e Y g');
    expect(h.map((x) => [x.removed, x.added])).toEqual([['b ', 'X '], ['f ', 'Y ']]);
    expect(h[0]!.curStart).toBeLessThan(h[1]!.curStart);
  });
  it('reverting one hunk restores only that change', () => {
    const base = 'a b c d e f g';
    const cur = 'a X c d e Y g';
    const h = diffWords(base, cur);
    expect(revertHunk(cur, h[0]!)).toBe('a b c d e Y g');
  });
  it('reverting every hunk gives the base back, whatever the order', () => {
    const base = 'The first claim holds. The second claim is weak. The third stays.';
    const cur = 'The first claim holds well. The third stays. A new closing line.';
    expect(revertHunks(cur, diffWords(base, cur))).toBe(base);
  });
  it('counts changed words', () => {
    expect(changedWords(diffWords('a b c', 'a X Y c'))).toBe(2);
  });
  it('handles a long text quickly', () => {
    const base = Array.from({ length: 2500 }, (_, i) => `w${i}`).join(' ');
    const cur = base.replace('w1200 ', 'changed ');
    const t0 = Date.now();
    expect(diffWords(base, cur)).toHaveLength(1);
    expect(Date.now() - t0).toBeLessThan(2000);
  });
});
