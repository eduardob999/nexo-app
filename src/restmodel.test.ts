import { describe, expect, it } from 'vitest';
import { newestFirst, restDue, restStats, type RestRec } from './restmodel';

const rec = (date: string, extra: Partial<RestRec> = {}): RestRec => ({ date, kind: 'full', wellbeing: null, performance: null, ...extra });
const at = (ymdText: string, hour: number) => new Date(`${ymdText}T${String(hour).padStart(2, '0')}:00:00`);

describe('restDue', () => {
  it('asks nothing when there is no rest day', () => {
    expect(restDue([], at('2026-11-08', 20))).toBeNull();
  });

  it('does not ask about wellbeing before the evening of the rest day', () => {
    expect(restDue([rec('2026-11-08')], at('2026-11-08', 14))).toBeNull();
    expect(restDue([rec('2026-11-08')], at('2026-11-08', 18))).toEqual({ date: '2026-11-08', ask: 'wellbeing' });
  });

  it('asks about performance the evening after, once wellbeing is in', () => {
    const r = rec('2026-11-08', { wellbeing: 4 });
    expect(restDue([r], at('2026-11-09', 10))).toBeNull();
    expect(restDue([r], at('2026-11-09', 17))).toEqual({ date: '2026-11-08', ask: 'performance' });
  });

  it('asks wellbeing before performance when both are open', () => {
    expect(restDue([rec('2026-11-08')], at('2026-11-09', 19))).toEqual({ date: '2026-11-08', ask: 'wellbeing' });
  });

  it('stops asking when both are answered', () => {
    expect(restDue([rec('2026-11-08', { wellbeing: 4, performance: 3 })], at('2026-11-09', 20))).toBeNull();
  });

  it('lets a forgotten day go after three days', () => {
    expect(restDue([rec('2026-11-08')], at('2026-11-11', 20))).toEqual({ date: '2026-11-08', ask: 'wellbeing' });
    expect(restDue([rec('2026-11-08')], at('2026-11-12', 20))).toBeNull();
  });

  it('asks about the most recent open day first', () => {
    const recs = [rec('2026-11-07'), rec('2026-11-08')];
    expect(restDue(recs, at('2026-11-09', 9))).toEqual({ date: '2026-11-08', ask: 'wellbeing' });
  });
});

describe('restStats', () => {
  it('averages only what was answered', () => {
    const s = restStats([rec('2026-11-01', { wellbeing: 4, performance: 3 }), rec('2026-11-08', { kind: 'light', wellbeing: 5 }), rec('2026-11-09')]);
    expect(s).toEqual({ days: 3, full: 2, avgWellbeing: 4.5, avgPerformance: 3 });
  });

  it('has no averages without answers', () => {
    expect(restStats([rec('2026-11-08')])).toMatchObject({ avgWellbeing: null, avgPerformance: null });
  });

  it('sorts newest first', () => {
    expect(newestFirst([rec('2026-11-01'), rec('2026-11-08')]).map((r) => r.date)).toEqual(['2026-11-08', '2026-11-01']);
  });
});
