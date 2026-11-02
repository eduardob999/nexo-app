import { describe, expect, it } from 'vitest';
import { parseQuickAdd } from './parse';

// Mon 2 Nov 2026, noon
const now = new Date(2026, 10, 2, 12, 0, 0);

describe('parseQuickAdd', () => {
  it('leaves plain text alone', () => {
    const p = parseQuickAdd('Buy milk', now);
    expect(p).toEqual({ title: 'Buy milk', due: null, tokens: [] });
  });
  it('reads tomorrow as a date-only due', () => {
    const p = parseQuickAdd('Call the office tomorrow', now);
    expect(p.due).toBe('2026-11-03');
    expect(p.title).toBe('Call the office');
  });
  it('reads a weekday and a clock time', () => {
    const p = parseQuickAdd('Submit report by fri 4 pm', now);
    expect(p.due?.startsWith('2026-11-06T16:00:00')).toBe(true);
    expect(p.title).toBe('Submit report');
    expect(p.tokens.map((t) => t.kind)).toEqual(['date', 'time']);
  });
  it('picks the next week for the same weekday', () => {
    expect(parseQuickAdd('Gym monday', now).due).toBe('2026-11-09');
  });
  it('reads in N days and 24 hour times', () => {
    expect(parseQuickAdd('Check in 3 days', now).due).toBe('2026-11-05');
    expect(parseQuickAdd('Seminar today 15:00', now).due?.startsWith('2026-11-02T15:00')).toBe(true);
  });
  it('does not treat a bare number as a time', () => {
    const p = parseQuickAdd('Pay 5 euros', now);
    expect(p.due).toBeNull();
    expect(p.title).toBe('Pay 5 euros');
  });
});
