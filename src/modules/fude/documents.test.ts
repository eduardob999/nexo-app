import { describe, expect, it } from 'vitest';
import { newDoc, sortDocs } from './documents';

const T = new Date('2026-11-09T10:00:00Z');
describe('documents', () => {
  it('creates an empty document with a title fallback and a profile', () => {
    const d = newDoc('  ', 'report-en', T, '2026-11-10T17:00:00+09:00');
    expect(d).toMatchObject({ title: 'Untitled', profile: 'report-en', text: '', due: '2026-11-10T17:00:00+09:00' });
    expect(d.id.startsWith('fd')).toBe(true);
  });
  it('sorts by deadline and hides deleted ones', () => {
    const a = newDoc('late', 'free', T, '2026-11-12');
    const b = newDoc('soon', 'free', T, '2026-11-10');
    const c = { ...newDoc('gone', 'free', T), deleted: true };
    expect(sortDocs([a, c, b]).map((d) => d.title)).toEqual(['soon', 'late']);
  });
});
