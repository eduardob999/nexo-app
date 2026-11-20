import { describe, expect, it } from 'vitest';
import { SEED } from './catalog';
import { READINGS, readingFor } from './readings';

describe('readings', () => {
  it('has a hiragana reading for every built-in chore and nothing else', () => {
    expect(Object.keys(READINGS).sort()).toEqual(SEED.map((s) => s.id).sort());
    for (const r of Object.values(READINGS)) expect(r).toMatch(/^[ぁ-ゟー・（）]+$/);
  });
  it('shows only for Japanese, only when on', () => {
    const t = SEED[0]!;
    expect(readingFor(t, 'ja', true)).toBe('さらあらい');
    expect(readingFor(t, 'ja', false)).toBeNull();
    expect(readingFor(t, 'es', true)).toBeNull();
    expect(readingFor({ id: 'custom-1', names: t.names }, 'ja', true)).toBeNull();
  });
});
