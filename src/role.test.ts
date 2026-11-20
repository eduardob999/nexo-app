import { describe, expect, it } from 'vitest';
import { roleOf } from './role';
import type { HouseholdDoc } from './modules/kaji/store';

const house = (m: Record<string, 'owner' | 'member'>): HouseholdDoc => ({ name: 'Casa', members: m, createdAt: 1 });

describe('which app a person gets', () => {
  it('gives a plain member the guest app and the owner the full app', () => {
    const h = house({ a: 'owner', b: 'member' });
    expect(roleOf('b', 'casa', h, false)).toBe('guest');
    expect(roleOf('a', 'casa', h, false)).toBe('owner');
  });
  it('gives the full app to someone with no household, unless they are joining one', () => {
    expect(roleOf('x', null, null, false)).toBe('owner');
    expect(roleOf('x', null, null, true)).toBe('guest');
  });
  it('waits while the household is still loading and never guesses', () => {
    expect(roleOf('b', 'casa', undefined, false)).toBe('unknown');
    expect(roleOf('b', undefined, undefined, false)).toBe('unknown');
  });
  it('falls back to the full app if the household document is gone', () => {
    expect(roleOf('b', 'casa', null, false)).toBe('owner');
  });
  it('treats a person not listed in the household as the full app', () => {
    expect(roleOf('z', 'casa', house({ a: 'owner', b: 'member' }), false)).toBe('owner');
  });
});
