import { describe, expect, it } from 'vitest';
import { countFor, make, step, spawn } from './particles';
import { parseWeather, readCache } from './weather';

describe('weather parsing', () => {
  it('reads the Open-Meteo current block', () => {
    expect(parseWeather({ current: { weather_code: 61, cloud_cover: 100, temperature_2m: 9, wind_speed_10m: 12 } })).toEqual({ kind: 'rain', cloud: 1, temp: 9, wind: 12 });
    expect(parseWeather({ current: { weather_code: 0 } })?.kind).toBe('clear');
  });
  it('refuses anything else', () => {
    for (const bad of [null, {}, { current: {} }, { current: { weather_code: 'x' } }, 'rain']) expect(parseWeather(bad)).toBeNull();
  });
  it('reads a cache up to four hours old and nothing older or broken', () => {
    const w = { kind: 'clear', cloud: 0, temp: 10, wind: 0 };
    expect(readCache(1_000_000, JSON.stringify({ at: 1_000_000 - 3 * 3600_000, w }))).toEqual(w);
    expect(readCache(1_000_000, JSON.stringify({ at: 1_000_000 - 5 * 3600_000, w }))).toBeNull();
    expect(readCache(1_000_000, '{bad')).toBeNull();
    expect(readCache(1_000_000, null)).toBeNull();
  });
});

describe('particles', () => {
  const rand = (() => { let s = 7; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
  it('scales the count with intensity and caps it', () => {
    expect(countFor('none', 1, 390, 700)).toBe(0);
    expect(countFor('rain', 0, 390, 700)).toBe(0);
    expect(countFor('rain', 1, 390, 700)).toBeGreaterThan(countFor('rain', 0.5, 390, 700));
    expect(countFor('rain', 1, 3000, 3000)).toBeLessThanOrEqual(180);
  });
  it('moves particles and retires the ones that leave the screen', () => {
    const p = spawn('snow', 390, 700, rand, true);
    const q = step(p, 'snow', 0.5, 390, 700, 1)!;
    expect(q.y).toBeGreaterThan(p.y);
    expect(step({ ...p, y: 800 }, 'snow', 0.1, 390, 700, 1)).toBeNull();
    expect(make('stars', 10, 390, 700, rand)).toHaveLength(10);
  });
  it('keeps fireflies on screen and twinkling', () => {
    const f = spawn('fireflies', 390, 700, rand, true);
    for (let i = 0; i < 200; i++) { const n = step(f, 'fireflies', 0.1, 390, 700, i * 0.1)!; expect(n.y).toBeLessThanOrEqual(525); expect(n.x).toBeGreaterThanOrEqual(0); expect(n.a).toBeGreaterThan(0); }
  });
});
