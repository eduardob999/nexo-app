import { describe, expect, it } from 'vitest';
import { bandOf, sortQueue } from './urgency';
import type { Card } from './types';

const now = new Date('2026-11-02T12:00:00+09:00');
const c = (id: string, extra: Partial<Card> = {}): Card => ({ id, status: 'open', for: 'you', ...extra });

describe('bandOf', () => {
  it('puts an assignment on top however far off', () => {
    expect(bandOf(c('a', { type: 'ASSIGNMENT', due: '2027-01-01' }), now)).toBe('assignment');
  });
  it('treats a past due date as now', () => {
    expect(bandOf(c('a', { due: '2026-11-01' }), now)).toBe('now');
  });
  it('treats later today as today', () => {
    expect(bandOf(c('a', { due: '2026-11-02T18:00:00+09:00' }), now)).toBe('today');
  });
  it('treats tomorrow and undated as later', () => {
    expect(bandOf(c('a', { due: '2026-11-03' }), now)).toBe('later');
    expect(bandOf(c('b'), now)).toBe('later');
  });
});

describe('sortQueue', () => {
  it('orders by band, then due, undated last', () => {
    const out = sortQueue(
      [c('undated'), c('tomorrow', { due: '2026-11-03' }), c('overdue', { due: '2026-11-01' }), c('hw', { type: 'ASSIGNMENT', due: '2026-12-01' })],
      now,
    ).map((x) => x.id);
    expect(out).toEqual(['hw', 'overdue', 'tomorrow', 'undated']);
  });
});
