import { describe, expect, it } from 'vitest';
import { sleepOptions, untilLabel } from './sleep';

describe('sleepOptions', () => {
  it('offers 1 hour, 3 hours, rest of the day and until tomorrow in the morning', () => {
    const now = new Date(2026, 10, 4, 9, 0, 0);
    const o = sleepOptions(now);
    expect(o.map((x) => x.label)).toEqual(['1 hour', '3 hours', 'Rest of the day', 'Until tomorrow']);
    expect(o[0]?.until.getTime()).toBe(now.getTime() + 3_600_000);
    expect(o[3]?.until).toEqual(new Date(2026, 10, 5, 8, 0, 0));
  });
  it('drops "rest of the day" late in the evening', () => {
    expect(sleepOptions(new Date(2026, 10, 4, 22, 0, 0)).map((x) => x.label)).toEqual(['1 hour', '3 hours', 'Until tomorrow']);
  });
});

describe('untilLabel', () => {
  it('shows the weekday only when it is not today', () => {
    const now = new Date(2026, 10, 4, 9, 0, 0);
    expect(untilLabel(new Date(2026, 10, 4, 10, 30), now)).toBe('10:30');
    expect(untilLabel(new Date(2026, 10, 5, 8, 0), now)).toBe('Thu 08:00');
  });
});
