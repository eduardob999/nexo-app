import { describe, expect, it } from 'vitest';
import { alarmLink, clock, suggestWake } from './alarm';
import type { Card } from './types';

const now = new Date('2026-11-04T21:00:00+09:00');
const c = (id: string, extra: Partial<Card> = {}): Card => ({ id, status: 'open', for: 'you', ...extra });

describe('suggestWake', () => {
  it('wakes 90 minutes before the first timed card tomorrow', () => {
    const r = suggestWake([c('a', { title: 'Lab', due: '2026-11-05T09:30' }), c('b', { due: '2026-11-05T13:00' })], now);
    expect(clock(r.minutes)).toBe('07:30');
    expect(r.first?.title).toBe('Lab');
  });
  it('goes earlier for an early start and uses the trip leave time', () => {
    expect(clock(suggestWake([c('a', { due: '2026-11-05T08:00' })], now).minutes)).toBe('06:30');
    const trip = c('t', { due: '2026-11-05T10:00', plan: { out: { leave: '07:10' } } });
    expect(clock(suggestWake([trip], now).minutes)).toBe('05:40');
  });
  it('ignores done cards, other days and date-only cards, and falls back to the usual time', () => {
    const r = suggestWake([c('a', { status: 'done', due: '2026-11-05T06:00' }), c('b', { due: '2026-11-06T06:00' }), c('d', { due: '2026-11-05' })], now);
    expect(clock(r.minutes)).toBe('07:30');
    expect(r.first).toBeUndefined();
  });
  it('never goes earlier than 04:00', () => {
    expect(clock(suggestWake([c('a', { due: '2026-11-05T04:30' })], now).minutes)).toBe('04:00');
  });
});

describe('alarmLink', () => {
  it('builds the Android set-alarm intent', () => {
    const l = alarmLink(6 * 60 + 45);
    expect(l).toContain('action=android.intent.action.SET_ALARM');
    expect(l).toContain('HOUR=6');
    expect(l).toContain('MINUTES=45');
    expect(l).toContain('MESSAGE=Wake%20up');
  });
});
