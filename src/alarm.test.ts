import { describe, expect, it } from 'vitest';
import { applyFeedback, clock, DEFAULT_PREFS, needsTravel, stepFor, suggestWake } from './alarm';
import type { Card } from './types';

const now = new Date('2026-11-04T21:00:00+09:00');
const c = (id: string, extra: Partial<Card> = {}): Card => ({ id, status: 'open', for: 'you', ...extra });

describe('suggestWake', () => {
  it('allows the travel lead before a physical place and the home lead before an online one', () => {
    const lab = suggestWake([c('a', { title: 'Lab', due: '2026-11-05T09:30', place: 'Uji campus' })], now);
    expect([clock(lab.minutes), lab.basis, lab.lead]).toEqual(['07:30', 'travel', 90]);
    const early = suggestWake([c('a', { due: '2026-11-05T08:30', place: 'Uji campus' })], now);
    expect(clock(early.minutes)).toBe('07:00');
    const online = suggestWake([c('a', { due: '2026-11-05T08:30', place: 'Online' })], now);
    expect([clock(online.minutes), online.basis]).toEqual(['07:30', 'home']);
  });
  it('uses a trip leave time and never goes before 04:00', () => {
    const trip = c('t', { due: '2026-11-05T10:00', plan: { out: { leave: '06:10' } } });
    expect(clock(suggestWake([trip], now).minutes)).toBe('04:40');
    expect(clock(suggestWake([c('a', { due: '2026-11-05T04:30', place: 'Gion' })], now).minutes)).toBe('04:00');
  });
  it('ignores done cards, other days and date-only cards and falls back to the usual time', () => {
    const r = suggestWake([c('a', { status: 'done', due: '2026-11-05T06:00' }), c('b', { due: '2026-11-06T06:00' }), c('d', { due: '2026-11-05' })], now);
    expect([clock(r.minutes), r.basis, r.first]).toEqual(['07:30', 'usual', undefined]);
  });
  it('follows the learned numbers', () => {
    const r = suggestWake([c('a', { due: '2026-11-05T08:30', place: 'Uji campus' })], now, { ...DEFAULT_PREFS, leadTravel: 60 });
    expect(clock(r.minutes)).toBe('07:30');
  });
});

describe('needsTravel', () => {
  it('is false for no place, Anywhere and Online, true otherwise', () => {
    expect([needsTravel(c('a')), needsTravel(c('a', { place: 'Anywhere' })), needsTravel(c('a', { place: 'Online (Zoom)' })), needsTravel(c('a', { place: 'Gion' })), needsTravel(c('a', { trip: true }))]).toEqual([false, false, false, true, true]);
  });
});

describe('applyFeedback', () => {
  it('shortens the lead when the morning was too early and lengthens it when too late', () => {
    expect(applyFeedback(DEFAULT_PREFS, 'travel', 'early').leadTravel).toBe(75);
    expect(applyFeedback(DEFAULT_PREFS, 'travel', 'late').leadTravel).toBe(105);
    expect(applyFeedback(DEFAULT_PREFS, 'home', 'late').leadHome).toBe(60);
  });
  it('moves the usual time the opposite way and keeps it between 05:00 and 10:00', () => {
    expect(applyFeedback(DEFAULT_PREFS, 'usual', 'early').usual).toBe(7 * 60 + 45);
    expect(applyFeedback(DEFAULT_PREFS, 'usual', 'late').usual).toBe(7 * 60 + 15);
    expect(applyFeedback({ ...DEFAULT_PREFS, usual: 5 * 60 }, 'usual', 'late').usual).toBe(5 * 60);
  });
  it('counts a right answer without moving anything, and takes smaller steps later', () => {
    const r = applyFeedback(DEFAULT_PREFS, 'travel', 'right');
    expect([r.leadTravel, r.n]).toEqual([90, 1]);
    expect([stepFor(0), stepFor(6), stepFor(20)]).toEqual([15, 10, 5]);
  });
  it('stays inside its limits', () => {
    expect(applyFeedback({ ...DEFAULT_PREFS, leadTravel: 35 }, 'travel', 'early').leadTravel).toBe(30);
    expect(applyFeedback({ ...DEFAULT_PREFS, leadTravel: 175 }, 'travel', 'late').leadTravel).toBe(180);
  });
});

describe('suggestWake ignores deadlines', () => {
  it('a midnight deadline and an assignment do not set the wake-up time', () => {
    const now = new Date('2026-11-05T20:00:00+09:00');
    const cards = [
      { id: 'a', status: 'open', title: 'Report', due: '2026-11-06T00:00:00+09:00' },
      { id: 'b', status: 'open', title: 'Homework', type: 'ASSIGNMENT', due: '2026-11-06T06:00:00+09:00' },
    ] as never[];
    expect(suggestWake(cards, now).basis).toBe('usual');
  });
});
