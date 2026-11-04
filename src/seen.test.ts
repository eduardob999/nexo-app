import { describe, expect, it } from 'vitest';
import { isNew } from './seen';
import type { Card } from './types';

const card = (by: string, ts: string): Card => ({ id: 'x', status: 'open', for: 'you', last: { by, text: 't', ts } });
const store = { baseline: '2026-11-04T10:00:00Z', seen: {} as Record<string, string> };

describe('isNew', () => {
  it('is new when Nexo wrote after the baseline and he has not opened the card', () => {
    expect(isNew(card('nexo', '2026-11-04T11:00:00Z'), store)).toBe(true);
  });
  it('is not new when Nexo wrote before the baseline, or he wrote last', () => {
    expect(isNew(card('nexo', '2026-11-04T09:00:00Z'), store)).toBe(false);
    expect(isNew(card('eduardo', '2026-11-04T11:00:00Z'), store)).toBe(false);
  });
  it('stops being new once he has opened the card, and is new again after a later entry', () => {
    const s = { ...store, seen: { x: '2026-11-04T12:00:00Z' } };
    expect(isNew(card('nexo', '2026-11-04T11:00:00Z'), s)).toBe(false);
    expect(isNew(card('nexo', '2026-11-04T13:00:00Z'), s)).toBe(true);
  });
  it('ignores a card with no usable time', () => {
    expect(isNew(card('nexo', 'garbage'), store)).toBe(false);
  });
});
