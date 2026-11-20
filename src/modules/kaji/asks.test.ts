import { describe, expect, it } from 'vitest';
import { KINDS, problem, whenFrom } from './asks';

describe('requests', () => {
  it('needs a day for a reminder and a plan, and not for a question', () => {
    expect(problem('remind', 'the dentist', null)).toBe('when');
    expect(problem('plan', 'dinner at Karasuma', null)).toBe('when');
    expect(problem('question', 'what time is the class', null)).toBeNull();
    expect(problem('other', 'can we skip the market', null)).toBeNull();
  });
  it('refuses empty and very long text', () => {
    expect(problem('question', ' a ', null)).toBe('short');
    expect(problem('question', 'x'.repeat(401), null)).toBe('long');
  });
  it('turns a date and time into Tokyo time, nine in the morning without a time', () => {
    expect(whenFrom('2026-11-28', '18:30')).toBe(Date.parse('2026-11-28T18:30:00+09:00'));
    expect(whenFrom('2026-11-28', '')).toBe(Date.parse('2026-11-28T09:00:00+09:00'));
    expect(whenFrom('', '10:00')).toBeNull();
  });
  it('has a label and hint in every language for every kind', () => {
    for (const k of KINDS) for (const l of ['en', 'es', 'ja'] as const) { expect(k.label[l].length).toBeGreaterThan(1); expect(k.hint[l].length).toBeGreaterThan(1); }
  });
});
