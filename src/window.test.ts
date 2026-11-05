import { describe, expect, it } from 'vitest';
import { shown } from './cards';
import { dueText, windowEnd } from './urgency';
import type { Card } from './types';

const card = (due: string, dueEnd?: string): Card => ({ id: 'x', status: 'open', for: 'you', due, ...(dueEnd ? { dueEnd } : {}) });

describe('hour windows', () => {
  it('reads the end from HH:MM or an ISO time, and nothing else', () => {
    expect(windowEnd('22:00')).toBe('22:00');
    expect(windowEnd('2026-11-15T14:00')).toBe('14:00');
    expect(windowEnd('2026-11-17')).toBe('');
    expect(windowEnd(undefined)).toBe('');
  });
  it('shows the window after the start time only when the card has a time', () => {
    const now = new Date('2026-10-29T08:00:00');
    expect(dueText(card('2026-10-29T17:00', '18:00'), now)).toBe('Today 17:00–18:00');
    expect(dueText(card('2026-10-29', '14:30'), now)).toBe('Today');
  });
});

describe('deleted records', () => {
  it('are left out of every list', () => {
    expect([{ deleted: true }, {}, { deleted: false }].filter(shown)).toHaveLength(2);
  });
});
