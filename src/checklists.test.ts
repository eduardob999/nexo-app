import { describe, expect, it } from 'vitest';
import { bringLabel } from './Checklists';
import type { Card } from './types';

const c = (extra: Partial<Card>): Card => ({ id: 'x', status: 'open', for: 'you', ...extra });

describe('bringLabel', () => {
  it('says Bring on a dated card, Steps otherwise, and obeys bringAs', () => {
    expect(bringLabel(c({ due: '2026-11-05' }))).toBe('Bring');
    expect(bringLabel(c({}))).toBe('Steps');
    expect(bringLabel(c({ due: '2026-11-05', bringAs: 'Documents' }))).toBe('Documents');
  });
});
