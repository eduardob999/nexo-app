import { describe, expect, it } from 'vitest';
import { gearFor, rainSoon } from './gear';
import type { DayWeather } from './strip';

const flat = (v: number) => Array.from({ length: 24 }, () => v);
const day = (h: Partial<NonNullable<DayWeather['h']>>, o: Partial<DayWeather> = {}): DayWeather => ({
  date: '2026-11-09', min: 10, max: 14, sunset: '16:56',
  h: { feels: flat(14), pop: flat(0), wind: flat(5), uv: flat(1), ...h }, ...o,
});

describe('gearFor', () => {
  it('names an umbrella and the hours of rain', () => {
    const pop = flat(0); pop[15] = 70; pop[16] = 80; pop[17] = 60;
    const g = gearFor(day({ pop }), 9);
    expect(g[0]).toMatchObject({ item: 'Umbrella' });
    expect(g[0]?.why).toContain('15–17h');
  });
  it('swaps the umbrella for a rain jacket in strong wind or on the bike', () => {
    const pop = flat(70);
    expect(gearFor(day({ pop, wind: flat(40) }), 9)[0]?.item).toBe('Rain jacket');
    expect(gearFor(day({ pop }), 9, { bike: true })[0]?.item).toBe('Rain jacket');
  });
  it('dresses for the coldest hour still ahead, not for the morning that has passed', () => {
    const feels = flat(14); feels[6] = 2; // 6h is cold but it is already 9h
    expect(gearFor(day({ feels }), 9).map((x) => x.item)).toContain('Light jacket');
    expect(gearFor(day({ feels }), 5).map((x) => x.item)).toContain('Warm coat, gloves, scarf');
  });
  it('adds lights on the bike when the sun sets inside the window, and sun cover for high UV', () => {
    expect(gearFor(day({ uv: flat(7) }), 9, { bike: true }).map((x) => x.item)).toEqual(expect.arrayContaining(['Bike lights', 'Sunscreen, cap']));
  });
  it('says nothing for a mild dry day and falls back without hourly data', () => {
    expect(gearFor(day({ feels: flat(20) }), 9)).toEqual([]);
    expect(gearFor({ date: 'x', min: 3, max: 8, rain: 80 }, 9).map((x) => x.item)).toEqual(['Umbrella', 'Warm coat, gloves, scarf']);
    expect(gearFor(undefined, 9)).toEqual([]);
  });
});

describe('rainSoon', () => {
  it('returns the hour rain starts when it is dry now and wet within three hours', () => {
    const pop = flat(0); pop[14] = 65;
    expect(rainSoon(day({ pop }), 12)).toBe(14);
    expect(rainSoon(day({ pop }), 9)).toBeNull();
    pop[12] = 80;
    expect(rainSoon(day({ pop }), 12)).toBeNull(); // already raining
  });
});
