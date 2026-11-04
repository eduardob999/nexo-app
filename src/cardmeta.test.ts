import { describe, expect, it } from 'vitest';
import { calendarLabel, cardTag, placeLabel, priorityLabel } from './cardmeta';
import type { Card } from './types';

const c = (extra: Partial<Card>): Card => ({ id: 'x', status: 'open', for: 'you', ...extra });

describe('cardTag', () => {
  it('prefers an explicit type, then ask, then trip', () => {
    expect(cardTag(c({ type: 'info', ask: 'q?' }))).toBe('INFO');
    expect(cardTag(c({ ask: 'q?' }))).toBe('QUESTION');
    expect(cardTag(c({ trip: true }))).toBe('TRIP');
    expect(cardTag(c({}))).toBeNull();
  });
});

describe('placeLabel', () => {
  it('skips anywhere and online', () => {
    expect(placeLabel(c({ place: 'Online' }))).toBeNull();
    expect(placeLabel(c({ place: ' Building 3 ' }))).toBe('Building 3');
  });
});

describe('priorityLabel and calendarLabel', () => {
  it('maps the old board words', () => {
    expect(priorityLabel(c({ prio: 'high' }))).toBe('Now');
    expect(priorityLabel(c({ prio: 'low' }))).toBe('Whenever');
    expect(priorityLabel(c({}))).toBe('Soon');
  });
  it('says whether a dated card has a calendar entry', () => {
    expect(calendarLabel(c({}))).toBeNull();
    expect(calendarLabel(c({ due: '2026-11-05', cal: 'yes' }))).toBe('On calendar');
    expect(calendarLabel(c({ due: '2026-11-05', calEvent: { eventId: 'e' } }))).toBe('On calendar');
    expect(calendarLabel(c({ due: '2026-11-05' }))).toBe('No calendar entry');
  });
});
