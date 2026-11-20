import { describe, expect, it } from 'vitest';
import { UJI, classify, contrast, eventsFromCards, groundAlpha, hex, moonPhase, palette, season, skyState, sunTimes } from './sky';

const at = (s: string) => Date.parse(s);
const clock = (ms: number) => { const d = new Date(ms + 9 * 3600_000); return d.getUTCHours() * 60 + d.getUTCMinutes(); };

describe('sun and moon', () => {
  it('puts sunrise and sunset in Uji within ten minutes of the almanac, winter and summer', () => {
    const dec = sunTimes(at('2026-12-21T12:00:00+09:00'));
    expect(Math.abs(clock(dec.rise) - (6 * 60 + 59))).toBeLessThanOrEqual(10);   // about 06:59
    expect(Math.abs(clock(dec.set) - (16 * 60 + 52))).toBeLessThanOrEqual(10);   // about 16:52
    const jun = sunTimes(at('2026-06-21T12:00:00+09:00'));
    expect(Math.abs(clock(jun.rise) - (4 * 60 + 46))).toBeLessThanOrEqual(10);   // about 04:46
    expect(Math.abs(clock(jun.set) - (19 * 60 + 11))).toBeLessThanOrEqual(10);   // about 19:11
    expect(UJI.tz).toBe(540);
  });
  it('gives a moon phase between 0 and 1 and a full moon near the known date', () => {
    expect(moonPhase(at('2026-11-20T12:00:00+09:00'))).toBeGreaterThanOrEqual(0);
    const full = moonPhase(at('2026-11-24T23:00:00+09:00'));         // full moon 24 Nov 2026
    expect(Math.abs(full - 0.5)).toBeLessThan(0.05);
  });
  it('knows the season', () => {
    expect([season(at('2026-04-05T12:00:00+09:00')), season(at('2026-07-05T12:00:00+09:00')), season(at('2026-11-05T12:00:00+09:00')), season(at('2026-01-05T12:00:00+09:00'))]).toEqual(['spring', 'summer', 'autumn', 'winter']);
  });
});

describe('palette', () => {
  it('is dark at 02:00, blue at noon and warm near sunset, and always three valid colours', () => {
    const lum = (h: string) => { const c = hex(h); return (c[0] + c[1] + c[2]) / 3; };
    const night = palette(at('2026-11-20T02:00:00+09:00'));
    const noon = palette(at('2026-11-20T12:00:00+09:00'));
    const golden = palette(at('2026-11-20T15:50:00+09:00'));
    expect(lum(night[0])).toBeLessThan(40);
    expect(lum(noon[1])).toBeGreaterThan(150);
    expect(hex(golden[1])[0]).toBeGreaterThan(hex(golden[1])[2]);
    for (let m = 0; m < 24 * 60; m += 7) for (const c of palette(at('2026-11-20T00:00:00+09:00') + m * 60_000)) expect(c).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('weather and sky state', () => {
  it('classifies weather codes', () => {
    expect(classify(0, 5, 12).kind).toBe('clear');
    expect(classify(3, 90, 12).kind).toBe('cloud');
    expect(classify(61, 100, 8).kind).toBe('rain');
    expect(classify(61, 100, -2).kind).toBe('snow');
    expect(classify(73, 100, -2).kind).toBe('snow');
    expect(classify(95, 100, 20).kind).toBe('storm');
    expect(classify(45, 100, 10).kind).toBe('fog');
  });
  it('rains in the rain, snows in the snow, drifts leaves on a clear November day and shows stars on a clear night', () => {
    const noon = at('2026-11-20T12:00:00+09:00'), night = at('2026-11-20T22:00:00+09:00');
    expect(skyState({ now: noon, weather: classify(61, 100, 9), events: [] }).particle).toBe('rain');
    expect(skyState({ now: noon, weather: classify(73, 100, -1), events: [] }).particle).toBe('snow');
    expect(skyState({ now: noon, weather: classify(0, 0, 12), events: [] }).particle).toBe('leaves');
    const n = skyState({ now: night, weather: classify(0, 0, 8), events: [] });
    expect(n.particle).toBe('stars');
    expect(n.moon).not.toBeNull();
    expect(n.sun).toBeNull();
  });
  it('places the sun on its arc by day only', () => {
    const s = skyState({ now: at('2026-11-20T12:00:00+09:00'), weather: null, events: [] });
    expect(s.sun!.x).toBeGreaterThan(0.4);
    expect(s.sun!.x).toBeLessThan(0.6);
    expect(s.sun!.y).toBeGreaterThan(0.9);
  });
  it('tints a dojo day, grows an edge as an assignment nears, marks the Kyoto horizon, and dims for bed', () => {
    const now = at('2026-11-20T18:00:00+09:00');
    expect(skyState({ now, weather: null, events: [{ kind: 'dojo' }] }).tint?.color).toBe('#2a3f8f');
    const far = skyState({ now, weather: null, events: [{ kind: 'assignment', due: now + 20 * 3600_000 }] }).edge!.strength;
    const near = skyState({ now, weather: null, events: [{ kind: 'assignment', due: now + 2 * 3600_000 }] }).edge!.strength;
    expect(near).toBeGreaterThan(far);
    expect(skyState({ now, weather: null, events: [{ kind: 'kyoto' }] }).horizon).toBe(true);
    expect(skyState({ now, weather: null, events: [], bedMs: now + 10 * 60_000 }).dim).toBeGreaterThan(0.3);
    expect(skyState({ now, weather: null, events: [], bedMs: now + 6 * 3600_000 }).dim).toBe(0);
  });
  it('builds events from cards', () => {
    const now = at('2026-11-21T08:00:00+09:00');
    const ev = eventsFromCards([
      { id: 'n-dojo-1121', title: 'Dojo shift', due: '2026-11-21T11:00:00+09:00', status: 'open', place: '園山大弓場, Gion' },
      { id: 'a', type: 'ASSIGNMENT', due: '2026-11-21T17:00:00+09:00', status: 'open' },
      { id: 'old', title: 'Dojo', due: '2026-11-20T11:00:00+09:00', status: 'open' },
      { id: 'done', title: 'Dojo', due: '2026-11-21T11:00:00+09:00', status: 'done' },
    ], now).map((e) => e.kind).sort();
    expect(ev).toEqual(['assignment', 'dojo', 'kyoto']);
  });
});

describe('readability guard', () => {
  it('keeps at least 4.5 contrast for the title ink over any sky, light or dark', () => {
    const grounds = [{ g: '#f3f4f1', ink: '#15171b' }, { g: '#0f1114', ink: '#f5f4ef' }];
    for (let m = 0; m < 24 * 60; m += 20) {
      const top = palette(at('2026-11-20T00:00:00+09:00') + m * 60_000)[0];
      for (const { g, ink } of grounds) {
        const a = groundAlpha(top, g, ink, 1);
        const blended = hex(g).map((v, i) => v + (hex(top)[i]! - v) * a) as [number, number, number];
        expect(contrast(blended, hex(ink))).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
  it('hides a sky that cannot be made readable', () => {
    expect(groundAlpha('#808080', '#808080', '#808080', 1)).toBe(0);
  });
});
