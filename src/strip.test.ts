import { describe, expect, it } from 'vitest';
import { buildStrip, freeToday, type TodayInfo } from './strip';

const NOW = new Date('2026-11-04T08:00:00+09:00');
const INFO: TodayInfo = {
  updated: '2026-11-04T07:02:22+09:00',
  weather: { place: 'Uji', now: { temp: 12, text: 'partly cloudy' }, days: [
    { date: '2026-11-04', text: 'heavy drizzle', min: 12, max: 19, rain: 64, sunset: '17:00' },
    { date: '2026-11-05', text: 'rain', min: 14, max: 22, rain: 75 }] },
  transit: [{ line: '京阪宇治線', status: '平常運転', ok: true }, { line: '京阪本線', status: '遅延', ok: false }],
  holidays: [{ date: '2026-11-23', name: '勤労感謝の日' }],
  nextFree: { start: '2026-11-20', end: '2026-11-20', name: 'November Festival', kind: 'university', lab: 'confirm' },
  birthdays: [{ name: 'Carla', date: '2026-11-10' }, { name: 'Far', date: '2026-12-25' }],
  events: [{ title: 'Talk', date: '2026-11-06', url: 'https://example.org/x', place: 'CB-215' }, { title: 'Bad', url: 'javascript:alert(1)' }],
};

describe('buildStrip', () => {
  it('returns null when there is nothing to show', () => {
    expect(buildStrip(null, NOW)).toBeNull();
    expect(buildStrip({}, NOW)).toBeNull();
  });
  it('reads weather for today and tomorrow and the sunset', () => {
    const w = buildStrip(INFO, NOW)?.weather;
    expect(w?.now).toBe('12° partly cloudy');
    expect(w?.today).toContain('12–19°');
    expect(w?.today).toContain('64% rain');
    expect(w?.tomorrow).toContain('75% rain');
    expect(w?.sunset).toBe('17:00');
  });
  it('names only the lines in trouble and puts the count in the head', () => {
    const s = buildStrip(INFO, NOW);
    expect(s?.trains).toEqual({ normal: false, bad: [{ line: '京阪本線', status: '遅延' }] });
    expect(s?.head).toContain('1 line disrupted');
  });
  it('says Trains normal when none is in trouble', () => {
    expect(buildStrip({ transit: [{ line: 'a', ok: true }] }, NOW)?.trains?.normal).toBe(true);
  });
  it('lists the next free day, the next holiday and birthdays within 14 days only', () => {
    const d = buildStrip(INFO, NOW)?.days ?? [];
    expect(d[0]?.text).toBe('Next free day: November Festival');
    expect(d[0]?.when).toContain('in 16 days');
    expect(d[0]?.when).toContain('lab: confirm');
    expect(d.some((x) => x.kind === 'holiday')).toBe(true);
    expect(d.filter((x) => x.kind === 'birthday').map((x) => x.text)).toEqual(['Carla’s birthday']);
  });
  it('makes only https event urls into links', () => {
    const e = buildStrip(INFO, NOW)?.events ?? [];
    expect(e[0]?.url).toBe('https://example.org/x');
    expect(e[1]?.url).toBeNull();
  });
  it('marks a strip stale after six hours', () => {
    expect(buildStrip(INFO, NOW)?.updated?.stale).toBe(false);
    expect(buildStrip(INFO, new Date('2026-11-04T14:00:00+09:00'))?.updated?.stale).toBe(true);
  });
});

describe('freeToday', () => {
  it('finds a free day that includes today, national over university', () => {
    const t: TodayInfo = { freeDay: { start: '2026-11-04', name: 'Break', kind: 'university' }, nextFree: { start: '2026-11-03', end: '2026-11-05', name: 'Culture', kind: 'national' } };
    expect(freeToday(t, '2026-11-04')?.name).toBe('Culture');
    expect(freeToday({ nextFree: { start: '2026-11-20', name: 'x' } }, '2026-11-04')).toBeNull();
  });
});
