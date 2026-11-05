import { describe, expect, it } from 'vitest';
import { calendarLabel, cardTag, cardTags, holidayLine, placeLabel, placeUrl, priorityLabel } from './cardmeta';
import type { Card } from './types';

const c = (extra: Partial<Card>): Card => ({ id: 'x', status: 'open', for: 'you', ...extra });

describe('cardTag', () => {
  it('prefers an explicit type, then a question, then trip, lane and date', () => {
    expect(cardTag(c({ type: 'info', ask: 'q?' }))).toBe('INFO');
    expect(cardTag(c({ ask: 'q?' }))).toBe('QUESTION');
    expect(cardTag(c({ last: { by: 'nexo', text: 'Which day suits you?', ts: 'x' } }))).toBe('QUESTION');
    expect(cardTag(c({ last: { by: 'nexo', text: 'Booked.', ts: 'x' }, due: '2026-11-05' }))).toBe('TASK');
    expect(cardTag(c({ trip: true }))).toBe('TRIP');
    expect(cardTag(c({ for: 'nexo' }))).toBe('NEXO');
    expect(cardTag(c({ due: '2026-11-05' }))).toBe('TASK');
    expect(cardTag(c({}))).toBe('INFO');
  });
  it('wears none when finished or a relay mirror, and two on a trip with a question', () => {
    expect(cardTag(c({ status: 'done', due: '2026-11-05' }))).toBeNull();
    expect(cardTag(c({ relay: 'G-001' }))).toBeNull();
    expect(cardTags(c({ trip: true, ask: 'q?' }))).toEqual(['QUESTION', 'TRIP']);
    expect(cardTags(c({ trip: true, ask: 'q?', type: 'TRIP' }))).toEqual(['TRIP']);
  });
});

describe('holidayLine', () => {
  const day = new Date('2026-11-03T12:00:00+09:00');
  it('says whether to go in, today or ahead', () => {
    expect(holidayLine(c({ type: 'HOLIDAY', due: '2026-11-03' }), day)).toBe('Holiday today. You do not have to come to the lab.');
    expect(holidayLine(c({ type: 'HOLIDAY', due: '2026-11-23' }), day)).toBe('Holiday. No lab that day.');
    expect(holidayLine(c({ type: 'HOLIDAY', due: '2026-11-20', lab: 'confirm' }), day)).toBe('University break: no classes. Lab: confirm.');
    expect(holidayLine(c({ type: 'HOLIDAY', due: '2026-11-01', dueEnd: '2026-11-04', lab: 'confirm' }), day)).toBe('University break today: no classes. Lab: confirm before going in.');
    expect(holidayLine(c({ type: 'TASK', due: '2026-11-03' }), day)).toBeNull();
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

describe('placeUrl', () => {
  it('searches Google Maps for a named place', () => {
    expect(placeUrl('Kyoto University Uji campus')).toBe('https://www.google.com/maps/search/?api=1&query=Kyoto%20University%20Uji%20campus');
  });
  it('keeps a link that is already one', () => {
    expect(placeUrl(' https://maps.app.goo.gl/abc ')).toBe('https://maps.app.goo.gl/abc');
  });
});
