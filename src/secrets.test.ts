import { describe, expect, it } from 'vitest';
import { PRESETS, clean, problem } from './secrets';

describe('secrets', () => {
  const dojo = PRESETS[0]!;
  it('accepts the dojo login and keeps password spaces', () => {
    const f = clean(dojo, { DOJO_URL: ' https://x.test/ ', DOJO_USER: ' staff_1 ', DOJO_PASS: ' p w ' });
    expect(f).toEqual({ DOJO_URL: 'https://x.test/', DOJO_USER: 'staff_1', DOJO_PASS: ' p w ' });
    expect(problem('dojo', f)).toBeNull();
  });
  it('refuses empty values, line breaks and bad names, without echoing the value', () => {
    expect(problem('dojo', { DOJO_USER: '', DOJO_PASS: 'x' })).toMatch(/DOJO_USER is empty/);
    const msg = problem('dojo', { DOJO_PASS: 'hunter2\nB=1' }) ?? '';
    expect(msg).toMatch(/line break/);
    expect(msg).not.toContain('hunter2');
    expect(problem('../x', { A: '1' })).toBe('Bad secret name.');
    expect(problem('dojo', { 'a b': '1' })).toMatch(/Bad field name/);
  });
});
