import { describe, expect, it } from 'vitest';
import { buildContext, kindForCard } from './link';

describe('kindForCard', () => {
  it('opens an exercise set for textbook homework', () => {
    expect(kindForCard('Submit L21 文型・練習 (pp.121-124) in KULMS')).toEqual({ kind: 'set' });
    expect(kindForCard('Japanese homework')).toEqual({ kind: 'set' });
  });
  it('opens a report document for reports, even when the card mentions a lecture', () => {
    expect(kindForCard('Submit the Yamashita report in KULMS')).toEqual({ kind: 'doc', profile: 'report-en' });
    expect(kindForCard('レポート 11/4 山下 富義先生')).toEqual({ kind: 'doc', profile: 'report-en' });
  });
  it('falls back to free writing', () => {
    expect(kindForCard('Cover letter draft')).toEqual({ kind: 'doc', profile: 'free' });
  });
  it('builds the context from the card facts and its thread, newest kept when trimmed', () => {
    const c = buildContext({ title: 'Yamashita report', due: '2026-11-10T17:00', type: 'ASSIGNMENT', entries: [{ by: 'nexo', text: 'Report on  the lecture' }, { by: 'eduardo', text: 'Angle A please' }] });
    expect(c).toContain('Task: Yamashita report');
    expect(c).toContain('Nexo: Report on the lecture');
    expect(c.endsWith('He: Angle A please')).toBe(true);
    const long = buildContext({ entries: [{ by: 'nexo', text: 'x'.repeat(5000) }, { by: 'eduardo', text: 'LAST' }] }, 100);
    expect(long.length).toBeLessThan(130);
    expect(long.endsWith('LAST')).toBe(true);
  });
});
