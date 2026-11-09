import { describe, expect, it } from 'vitest';
import { addPhoto, applyCheck, cleanProposal, ITEM_KEY, mergeSets, newSet, orderedItems, progress, putItem, setAnswer, sortSets } from './homework';

const T0 = new Date('2026-11-09T10:00:00Z');
const T1 = new Date('2026-11-09T10:05:00Z');
const T2 = new Date('2026-11-09T10:10:00Z');

function base() {
  let s = newSet('L21 文型・練習', T0, '2026-11-09T23:59:00+09:00');
  s = putItem(s, '1', '＿＿＿が好きです。', T0);
  s = putItem(s, '2', '＿＿＿に行きます。', T0);
  return s;
}

describe('homework model', () => {
  it('keeps questions in order and refuses unusable numbers', () => {
    const s = putItem(base(), 'a.b', 'x', T0);
    expect(orderedItems(s).map((i) => i.n)).toEqual(['1', '2']);
    expect(ITEM_KEY.test('3b')).toBe(true);
    expect(ITEM_KEY.test('a/b')).toBe(false);
  });
  it('stores his answer exactly as typed, kanji included, and marks it answered', () => {
    const s = setAnswer(base(), '1', '私は音楽が好きです。', T1);
    expect(s.items['1']?.answer).toBe('私は音楽が好きです。');
    expect(s.items['1']?.status).toBe('answered');
    expect(setAnswer(s, '1', '', T2).items['1']?.status).toBe('open');
  });
  it('applies a check only while his answer is the one that was checked', () => {
    let s = setAnswer(base(), '1', 'わたしはおんがくがすきです', T1);
    const r = { n: '1', forAnswer: 'わたしはおんがくがすきです', verdict: 'hint' as const, hint: 'Check the particle after 音楽.' };
    s = applyCheck(s, r, T2);
    expect(s.items['1']?.hint).toContain('particle');
    const edited = setAnswer(s, '1', 'わたしはおんがくがすきです。', T2);
    expect(edited.items['1']?.hint).toBeUndefined();
    expect(applyCheck(edited, r, T2)).toBe(edited);
  });
  it('never writes the answer from the checker', () => {
    const s = setAnswer(base(), '2', '学校', T1);
    const out = applyCheck(s, { n: '2', forAnswer: '学校', verdict: 'wrong', explain: 'Needs a particle.' }, T2);
    expect(out.items['2']?.answer).toBe('学校');
  });
  it('counts progress', () => {
    const s = setAnswer(base(), '1', 'x', T1);
    expect(progress(s)).toEqual({ total: 2, answered: 1, ok: 0, open: 1 });
  });
  it('lists sets by deadline and hides deleted ones', () => {
    const a = newSet('late', T0, '2026-11-12');
    const b = newSet('soon', T0, '2026-11-09');
    const c = { ...newSet('gone', T0), deleted: true };
    expect(sortSets([a, c, b]).map((s) => s.title)).toEqual(['soon', 'late']);
  });
  it('merges two devices per question, later edit wins, photos from both stay', () => {
    const s = base();
    const phone = addPhoto(setAnswer(s, '1', 'phone one', T1), { id: 'p1' }, T1);
    const laptop = addPhoto(setAnswer(s, '2', 'laptop two', T2), { id: 'p2' }, T2);
    const m = mergeSets(phone, laptop);
    expect(m.items['1']?.answer).toBe('phone one');
    expect(m.items['2']?.answer).toBe('laptop two');
    expect(m.photos.map((p) => p.id)).toEqual(['p1', 'p2']);
    const clash = mergeSets(setAnswer(s, '1', 'early', T1), setAnswer(s, '1', 'later', T2));
    expect(clash.items['1']?.answer).toBe('later');
  });
  it('cleans an edited proposal', () => {
    expect(cleanProposal([{ n: '1.', prompt: ' a ' }, { n: '1', prompt: 'dup' }, { n: '2 b', prompt: 'b' }, { n: 'x/y', prompt: 'c' }, { n: '3', prompt: '  ' }]))
      .toEqual([{ n: '1', prompt: 'a' }, { n: '2b', prompt: 'b' }]);
  });
});
