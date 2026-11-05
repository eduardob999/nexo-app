import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFS } from './alarm';
import { addDays, axisPos, bars, bedDate, durationHours, factorEffects, fallAsleepMinutes, fmtHours, isoLocal, isWeekendNight, learnedUsualWake, neededHours, nightKey, paybackMinutes, phaseOf, planSleep, sleepDebt, sleepStats, isMorning, type SleepRec } from './sleepmodel';
import type { Card } from './types';

const L = (y: number, mo: number, d: number, h: number, mi = 0) => new Date(y, mo - 1, d, h, mi);
/** A night: bed at `bedH`:`bedM` on `night`, up after `hours`. */
function rec(night: string, hours: number | null, rating: number | null = null, extra: Partial<SleepRec> = {}, bedH = 23, bedM = 0): SleepRec {
  const bed = bedDate(night, bedH, bedM);
  return { night, bed: isoLocal(bed), wake: hours === null ? null : isoLocal(new Date(bed.getTime() + hours * 3_600_000)), rating, ...extra };
}
const now = L(2026, 11, 5, 21, 0);
const nightsBack = (n: number) => addDays('2026-11-05', -n);

describe('dates', () => {
  it('assigns a night by the bedtime hour', () => {
    expect(nightKey(L(2026, 11, 5, 23, 44))).toBe('2026-11-05');
    expect(nightKey(L(2026, 11, 6, 0, 30))).toBe('2026-11-05');
    expect(nightKey(L(2026, 11, 6, 11, 59))).toBe('2026-11-05');
    expect(nightKey(L(2026, 11, 6, 12, 0))).toBe('2026-11-06');
  });
  it('writes an offset ISO string that reads back to the same moment', () => {
    const d = L(2026, 11, 5, 23, 44);
    expect(new Date(isoLocal(d)).getTime()).toBe(d.getTime());
    expect(isoLocal(d)).toMatch(/^2026-11-05T23:44:00[+-]\d\d:\d\d$/);
  });
  it('puts a bedtime after midnight on the next date, and the wake on the morning after', () => {
    expect(bedDate('2026-11-05', 0, 40).getDate()).toBe(6);
    expect(bedDate('2026-11-05', 23, 40).getDate()).toBe(5);
  });
  it('calls a night a weekend night when the morning is Saturday or Sunday', () => {
    expect(isWeekendNight('2026-11-06')).toBe(true); // Friday night, up on Saturday
    expect(isWeekendNight('2026-11-07')).toBe(true);
    expect(isWeekendNight('2026-11-05')).toBe(false);
  });
  it('rejects a duration that is not a night', () => {
    expect(durationHours(rec('2026-11-04', 7.5))).toBeCloseTo(7.5);
    expect(durationHours(rec('2026-11-04', null))).toBeNull();
    expect(durationHours(rec('2026-11-04', 20))).toBeNull();
    expect(durationHours(rec('2026-11-04', 1))).toBeNull();
  });
  it('formats hours', () => {
    expect(fmtHours(7.6667)).toBe('7 h 40');
    expect(fmtHours(8)).toBe('8 h');
  });
});

describe('neededHours', () => {
  it('is the 7.5 h prior with no rated nights', () => {
    expect(neededHours([], now)).toEqual({ hours: 7.5, n: 0 });
    expect(neededHours([rec(nightsBack(1), 6, null)], now).n).toBe(0);
  });
  it('moves toward well rated nights but only part of the way when there are few', () => {
    const one = neededHours([rec(nightsBack(1), 8.5, 5)], now);
    expect(one.hours).toBeGreaterThan(7.5);
    expect(one.hours).toBeLessThan(8.2);
    const many = neededHours(Array.from({ length: 10 }, (_, i) => rec(nightsBack(i + 1), 8.5, 5)), now);
    expect(many.hours).toBeGreaterThan(8.2);
    expect(many.hours).toBeLessThanOrEqual(8.5);
  });
  it('is pulled up by short nights that felt bad', () => {
    const bad = neededHours(Array.from({ length: 4 }, (_, i) => rec(nightsBack(i + 1), 6, 1)), now);
    expect(bad.hours).toBeGreaterThan(7.5);
    expect(bad.hours).toBeLessThanOrEqual(9.5);
  });
  it('ignores a long night that felt bad and a middling rating', () => {
    expect(neededHours([rec(nightsBack(1), 10, 1), rec(nightsBack(2), 6, 3)], now).n).toBe(0);
  });
  it('weights recent nights more than old ones', () => {
    const recent = neededHours([rec(nightsBack(1), 9, 5), rec(nightsBack(60), 6.5, 5)], now).hours;
    const flipped = neededHours([rec(nightsBack(1), 6.5, 5), rec(nightsBack(60), 9, 5)], now).hours;
    expect(recent).toBeGreaterThan(flipped);
  });
  it('clamps to 6 and 9.5 hours', () => {
    const hi = Array.from({ length: 30 }, (_, i) => rec(nightsBack(i + 1), 12, 5));
    expect(neededHours(hi, now).hours).toBe(9.5);
    const lo = Array.from({ length: 30 }, (_, i) => rec(nightsBack(i + 1), 4.5, 5));
    expect(neededHours(lo, now).hours).toBe(6);
  });
  it('applies a weekend offset only with 3 rated nights of each kind', () => {
    // Nights 2026-10-03.. : weekend nights (Fri and Sat) sleep 9, weekdays 7.
    const mk = (start: string, count: number) => Array.from({ length: count }, (_, i) => {
      const n = addDays(start, -i);
      return rec(n, isWeekendNight(n) ? 9 : 7, 5);
    });
    const recs = mk('2026-11-04', 28);
    const we = neededHours(recs, now, true).hours;
    const wd = neededHours(recs, now, false).hours;
    expect(we).toBeGreaterThan(wd);
    const sparse = recs.filter((r) => !isWeekendNight(r.night)).concat(recs.filter((r) => isWeekendNight(r.night)).slice(0, 2));
    expect(neededHours(sparse, now, true).hours).toBe(neededHours(sparse, now).hours);
  });
});

describe('sleepDebt and payback', () => {
  it('sums the shortfall over the last 7 nights only', () => {
    const recs = [rec(nightsBack(1), 6), rec(nightsBack(2), 6.5), rec(nightsBack(20), 4)];
    expect(sleepDebt(recs, now, 7.5)).toBeCloseTo(2.5);
  });
  it('lets a long night repay at most an hour, caps the total, and never goes negative', () => {
    expect(sleepDebt([rec(nightsBack(1), 10)], now, 7.5)).toBe(0);
    expect(sleepDebt([rec(nightsBack(1), 6), rec(nightsBack(2), 8.5)], now, 7.5)).toBeCloseTo(0.5);
    const awful = Array.from({ length: 7 }, (_, i) => rec(nightsBack(i + 1), 3));
    expect(sleepDebt(awful, now, 7.5)).toBe(5);
  });
  it('ignores a night with no wake yet', () => {
    expect(sleepDebt([rec(nightsBack(1), null)], now, 7.5)).toBe(0);
  });
  it('pays back a quarter of the debt, in 5 minute steps, up to 45 minutes', () => {
    expect(paybackMinutes(0)).toBe(0);
    expect(paybackMinutes(2)).toBe(30);
    expect(paybackMinutes(5)).toBe(45);
  });
});

describe('fallAsleepMinutes', () => {
  it('is 15 with fewer than 3 rated nights', () => {
    expect(fallAsleepMinutes([rec(nightsBack(1), 7, 4, { factors: { slowToSleep: true } })])).toBe(15);
  });
  it('rises with the share of nights he says it took long, to at most 45', () => {
    const half = Array.from({ length: 6 }, (_, i) => rec(nightsBack(i + 1), 7, 4, { factors: { slowToSleep: i < 3 } }));
    expect(fallAsleepMinutes(half)).toBe(30);
    const all = Array.from({ length: 6 }, (_, i) => rec(nightsBack(i + 1), 7, 4, { factors: { slowToSleep: true } }));
    expect(fallAsleepMinutes(all)).toBe(45);
  });
});

describe('learnedUsualWake', () => {
  it('needs 3 mornings, then takes the median, preferring the same kind of day', () => {
    expect(learnedUsualWake([rec(nightsBack(1), 8), rec(nightsBack(2), 8)], false)).toBeNull();
    const recs = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04'].map((n) => rec(n, 8)); // bed 23:00, up 07:00
    expect(learnedUsualWake(recs, false)).toBe(7 * 60);
  });
});

describe('planSleep', () => {
  const card = (extra: Partial<Card>): Card => ({ id: 'x', status: 'open', for: 'you', title: 'Lecture', ...extra });
  it('with no data: usual wake, prior need, 15 min to fall asleep, wind down 30 min before', () => {
    const p = planSleep({ recs: [], cards: [], now, prefs: DEFAULT_PREFS });
    expect(p.forNight).toBe('2026-11-05');
    expect(p.wakeAt).toEqual(L(2026, 11, 6, 7, 30));
    expect(p.needHours).toBe(7.5);
    expect(p.bedAt).toEqual(L(2026, 11, 5, 23, 45));
    expect(p.windDownAt).toEqual(L(2026, 11, 5, 23, 15));
    expect(p.confidence).toBe('low');
    expect(p.reason).toContain('Starting from 7 h 30');
  });
  it('wakes for the first timed event with the learned lead', () => {
    const p = planSleep({ recs: [], cards: [card({ due: '2026-11-06T09:00', place: 'Uji campus' })], now, prefs: DEFAULT_PREFS });
    expect(p.wakeAt).toEqual(L(2026, 11, 6, 7, 30));
    expect(p.basis).toBe('travel');
    const early = planSleep({ recs: [], cards: [card({ due: '2026-11-06T08:00', place: 'Uji campus' })], now, prefs: DEFAULT_PREFS });
    expect(early.wakeAt).toEqual(L(2026, 11, 6, 6, 30));
    expect(early.bedAt).toEqual(L(2026, 11, 5, 22, 45));
  });
  it('ignores a 00:00 deadline and an assignment', () => {
    const p = planSleep({ recs: [], cards: [card({ due: '2026-11-06T00:00' }), card({ id: 'y', type: 'ASSIGNMENT', due: '2026-11-06T06:00' })], now, prefs: DEFAULT_PREFS });
    expect(p.first).toBeUndefined();
    expect(p.wakeAt).toEqual(L(2026, 11, 6, 7, 30));
  });
  it('adds a payback for debt and says so, and states the evidence count', () => {
    const recs = [...Array.from({ length: 4 }, (_, i) => rec(nightsBack(i + 3), 8, 5)), rec(nightsBack(1), 5.5, 2), rec(nightsBack(2), 6, 3)];
    const p = planSleep({ recs, cards: [], now, prefs: DEFAULT_PREFS });
    expect(p.paybackMin).toBeGreaterThan(0);
    expect(p.reason).toContain('Based on');
    expect(p.reason).toContain('catch up');
    expect(p.bedAt.getTime()).toBe(p.wakeAt.getTime() - (Math.round(p.needHours * 60) + p.paybackMin + p.fallMin) * 60_000);
  });
  it('planned after midnight still belongs to the night that began yesterday', () => {
    const p = planSleep({ recs: [], cards: [], now: L(2026, 11, 6, 0, 20), prefs: DEFAULT_PREFS });
    expect(p.forNight).toBe('2026-11-05');
    expect(p.wakeAt).toEqual(L(2026, 11, 6, 7, 30));
  });
  it('confidence grows with rated nights', () => {
    const mk = (n: number) => planSleep({ recs: Array.from({ length: n }, (_, i) => rec(nightsBack(i + 1), 8, 5)), cards: [], now, prefs: DEFAULT_PREFS }).confidence;
    expect([mk(0), mk(4), mk(9)]).toEqual(['low', 'medium', 'high']);
  });
});

describe('phaseOf', () => {
  it('is evening from 18:00 with nothing recorded and none before', () => {
    expect(phaseOf([], L(2026, 11, 5, 19, 0)).kind).toBe('evening');
    expect(phaseOf([], L(2026, 11, 5, 10, 0)).kind).toBe('none');
  });
  it('is asleep while a bedtime has no wake, then asks for the rating once he is up', () => {
    const open = rec('2026-11-05', null);
    expect(phaseOf([open], L(2026, 11, 6, 7, 0)).kind).toBe('asleep');
    expect(phaseOf([open], L(2026, 11, 6, 7, 0)).kind).toBe('asleep');
    const up = rec('2026-11-05', 8);
    expect(phaseOf([up], L(2026, 11, 6, 7, 30)).kind).toBe('rate');
    expect(phaseOf([{ ...up, rating: 4 }], L(2026, 11, 6, 7, 30)).kind).toBe('none');
  });
  it('forgets an open record from more than a day ago', () => {
    expect(phaseOf([rec('2026-11-03', null)], L(2026, 11, 5, 19, 0)).kind).toBe('evening');
  });
  it('shows "I\'m up" only from 04:00 and not right after pressing the button', () => {
    const open = rec('2026-11-05', null);
    expect(isMorning(open, L(2026, 11, 6, 2, 0))).toBe(false);
    expect(isMorning(open, L(2026, 11, 6, 6, 50))).toBe(true);
    expect(isMorning(rec('2026-11-05', null, null, {}, 0, 0), L(2026, 11, 6, 4, 30))).toBe(true);
    expect(isMorning(rec('2026-11-05', null, null, {}, 3, 30), L(2026, 11, 6, 4, 30))).toBe(false);
  });
});

describe('insights', () => {
  it('places bars on a 20:00 to 12:00 axis and keeps gaps', () => {
    expect(axisPos(L(2026, 11, 5, 20, 0))).toBe(0);
    expect(axisPos(L(2026, 11, 6, 12, 0))).toBe(1);
    expect(axisPos(L(2026, 11, 6, 4, 0))).toBeCloseTo(0.5);
    expect(axisPos(L(2026, 11, 5, 23, 59))).toBeLessThan(0.25);
    const b = bars([rec('2026-11-05', 8), rec('2026-11-03', 7)], '2026-11-05', 4);
    expect(b.map((x) => x.night)).toEqual(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05']);
    expect(b.map((x) => x.start !== undefined)).toEqual([false, true, false, true]);
  });
  it('averages, consistency and best duration', () => {
    const recs = [rec('2026-11-03', 7, 4), rec('2026-11-04', 8, 5), rec('2026-11-05', 6, 2)];
    const s = sleepStats(recs, '2026-11-05');
    expect(s.avgHours).toBeCloseTo(7);
    expect(s.avgBed).toBe('23:00');
    expect(s.consistency).toBe('steady');
    expect(s.bestHours).toBeCloseTo(7.5);
    expect(s.avgRating).toBeCloseTo(11 / 3);
    expect(sleepStats([], '2026-11-05').avgHours).toBeNull();
    expect(sleepStats([rec('2026-11-05', 7, 4)], '2026-11-05').bestHours).toBeNull();
  });
  it('flags irregular bedtimes', () => {
    const recs = [rec('2026-11-02', 7, 4, {}, 21, 0), rec('2026-11-03', 7, 4, {}, 1, 30), rec('2026-11-04', 7, 4, {}, 23, 0)];
    expect(sleepStats(recs, '2026-11-05').consistency).toBe('irregular');
  });
  it('compares ratings with and without a factor only with 3 nights in each group', () => {
    const withC = [1, 2, 3].map((i) => rec(nightsBack(i), 7, 2, { factors: { caffeine: true } }));
    const without = [4, 5, 6].map((i) => rec(nightsBack(i), 7, 4, { factors: { caffeine: false } }));
    const e = factorEffects([...withC, ...without]);
    const caf = e.find((x) => x.key === 'caffeine');
    expect(caf).toMatchObject({ verdict: 'hurts', diff: -2 });
    expect(e.find((x) => x.key === 'alcohol')?.verdict).toBe('unknown');
    expect(factorEffects([...withC.slice(0, 2), ...without]).find((x) => x.key === 'caffeine')?.verdict).toBe('unknown');
  });
  it('says a factor helps when the rating is higher with it', () => {
    const withE = [1, 2, 3].map((i) => rec(nightsBack(i), 7, 5, { factors: { exercise: true } }));
    const without = [4, 5, 6].map((i) => rec(nightsBack(i), 7, 3, { factors: {} }));
    expect(factorEffects([...withE, ...without]).find((x) => x.key === 'exercise')?.verdict).toBe('helps');
  });
});
