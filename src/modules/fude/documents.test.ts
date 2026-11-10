import { describe, expect, it } from 'vitest';
import { applyFix, docMode, newDoc, sortDocs } from './documents';

const T = new Date('2026-11-09T10:00:00Z');
describe('documents', () => {
  it('creates an empty document with a title fallback and a profile', () => {
    const d = newDoc('  ', 'report-en', T, '2026-11-10T17:00:00+09:00');
    expect(d).toMatchObject({ title: 'Untitled', profile: 'report-en', text: '', due: '2026-11-10T17:00:00+09:00' });
    expect(d.id.startsWith('fd')).toBe(true);
  });
  it('is plain unless it was made in suggest mode, and old or odd values read as plain', () => {
    expect(newDoc('a', 'free', T).mode).toBe('plain');
    expect(newDoc('a', 'free', T, undefined, 'suggest').mode).toBe('suggest');
    expect(docMode({})).toBe('plain');
    expect(docMode({ mode: 'suggest' })).toBe('suggest');
    expect(docMode({ mode: 'live' })).toBe('plain');
  });
  it('sorts by deadline and hides deleted ones', () => {
    const a = newDoc('late', 'free', T, '2026-11-12');
    const b = newDoc('soon', 'free', T, '2026-11-10');
    const c = { ...newDoc('gone', 'free', T), deleted: true };
    expect(sortDocs([a, c, b]).map((d) => d.title)).toEqual(['soon', 'late']);
  });
  it('applies a fix to the first occurrence only, and refuses when it cannot', () => {
    expect(applyFix('A step do not remove. A step do not remove.', 'do not remove', 'does not remove')).toBe('A step does not remove. A step do not remove.');
    expect(applyFix('abc', 'x', 'y')).toBeNull();
    expect(applyFix('abc', 'b', '')).toBeNull();
  });
});
