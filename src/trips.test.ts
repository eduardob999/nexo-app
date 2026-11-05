import { describe, expect, it } from 'vitest';
import { isTrip, tripGroups } from './trips';
import type { Card } from './types';

const now = new Date('2026-11-04T12:00:00+09:00');
const c = (id: string, extra: Partial<Card>): Card => ({ id, status: 'open', for: 'you', trip: true, ...extra });

describe('tripGroups', () => {
  it('recognises a trip by flag or type', () => {
    expect(isTrip(c('a', {}))).toBe(true);
    expect(isTrip({ id: 'b', status: 'open', for: 'you', type: 'TRIP' })).toBe(true);
    expect(isTrip({ id: 'c', status: 'open', for: 'you' })).toBe(false);
  });
  it('splits soon from later at four days, sorted by date, leaving done trips out', () => {
    const g = tripGroups([c('far', { due: '2026-11-14' }), c('near', { due: '2026-11-06' }), c('none', {}), c('done', { due: '2026-11-05', status: 'done' }), c('mid', { due: '2026-11-07T10:00:00+09:00' })], now);
    expect(g.soon.map((x) => x.id)).toEqual(['near', 'mid', 'none']);
    expect(g.later.map((x) => x.id)).toEqual(['far']);
  });
});

describe('pastTrips', () => {
  it('lists finished trips newest first and leaves out deleted ones', async () => {
    const { pastTrips } = await import('./trips');
    const done = [
      c('old', { status: 'done', due: '2026-10-01' }),
      c('new', { status: 'done', due: '2026-10-20T09:00' }),
      c('gone', { status: 'done', due: '2026-10-25', deleted: true }),
      { id: 'plain', status: 'done', for: 'you', due: '2026-10-30' } as Card,
    ];
    expect(pastTrips(done).map((x) => x.id)).toEqual(['new', 'old']);
  });
});
