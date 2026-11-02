import { describe, expect, it } from 'vitest';
import { bandOf, postpone, sortQueue } from './urgency';
import type { Card } from './types';

const now = new Date('2026-11-02T12:00:00+09:00');
const c = (id: string, extra: Partial<Card> = {}): Card => ({ id, status: 'open', for: 'you', ...extra });

describe('bandOf', () => {
  it('puts an assignment on top however far off', () => {
    expect(bandOf(c('a', { type: 'ASSIGNMENT', due: '2027-01-01' }), now)).toBe('assignment');
  });
  it('treats a high card undated or due by tonight as urgent', () => {
    expect(bandOf(c('a', { prio: 'high' }), now)).toBe('urgent');
    expect(bandOf(c('b', { prio: 'high', due: '2026-11-02' }), now)).toBe('urgent');
    expect(bandOf(c('c', { prio: 'high', due: '2026-10-30' }), now)).toBe('urgent');
  });
  it('lets a high card dated later fall back to its date', () => {
    expect(bandOf(c('a', { prio: 'high', due: '2026-11-05', type: 'TASK' }), now)).toBe('prep');
  });
  it('separates overdue from today', () => {
    expect(bandOf(c('a', { due: '2026-11-01' }), now)).toBe('overdue');
    expect(bandOf(c('b', { due: '2026-11-02T18:00:00+09:00' }), now)).toBe('today');
    expect(bandOf(c('c', { due: '2026-11-02T08:00:00+09:00' }), now)).toBe('today');
  });
  it('puts things to anticipate in the next seven days under preparation', () => {
    expect(bandOf(c('a', { due: '2026-11-04', type: 'TASK' }), now)).toBe('prep');
    expect(bandOf(c('b', { due: '2026-11-07', type: 'TRIP' }), now)).toBe('prep');
    expect(bandOf(c('c', { due: '2026-11-06', type: 'INFO', bring: ['ID card'] }), now)).toBe('prep');
    expect(bandOf(c('d', { due: '2026-11-09', type: 'TASK' }), now)).toBe('prep');
  });
  it('keeps classes, notices, holidays and far dates out of Today', () => {
    expect(bandOf(c('a', { due: '2026-11-04', type: 'INFO' }), now)).toBe('other');
    expect(bandOf(c('b', { due: '2026-11-03', type: 'HOLIDAY' }), now)).toBe('other');
    expect(bandOf(c('c', { due: '2026-11-20', type: 'TASK' }), now)).toBe('other');
    expect(bandOf(c('d'), now)).toBe('other');
  });
});

describe('sortQueue', () => {
  it('orders by band, then due, undated last', () => {
    const out = sortQueue(
      [c('undated'), c('prep', { due: '2026-11-04', type: 'TASK' }), c('today', { due: '2026-11-02T20:00:00+09:00' }),
       c('overdue', { due: '2026-11-01' }), c('urgent', { prio: 'high' }), c('hw', { type: 'ASSIGNMENT', due: '2026-12-01' })],
      now,
    ).map((x) => x.id);
    expect(out).toEqual(['hw', 'urgent', 'overdue', 'today', 'prep', 'undated']);
  });
});

describe('postpone', () => {
  it('moves a future date-only due one day on', () => {
    expect(postpone('2026-11-05', now)).toBe('2026-11-06');
  });
  it('keeps the time of day', () => {
    expect(postpone('2026-11-05T15:00:00+09:00', now)).toBe('2026-11-06T15:00:00+09:00');
  });
  it('sends a past or undated card to tomorrow', () => {
    expect(postpone('2026-10-30', now)).toBe('2026-11-03');
    expect(postpone(null, now)).toBe('2026-11-03');
  });
});
