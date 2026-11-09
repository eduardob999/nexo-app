import { describe, expect, it } from 'vitest';
import { countChars, countWords, lintText, profileById } from './profiles';

describe('profiles and lint', () => {
  const report = profileById('report-en');
  it('counts words and characters', () => {
    expect(countWords("It's a 7-day trial, isn't it?")).toBe(6);
    expect(countChars('私は 音楽 が\n好き')).toBe(7);
  });
  it('flags a decimal percentage as an error and an em dash as a warning', () => {
    const l = lintText('The rise was 7.9 percent — small.', report);
    expect(l.hits.map((h) => [h.rule, h.sev, h.match])).toEqual([['r1', 'error', '7.9 percent'], ['em-dash', 'warn', '—']]);
  });
  it('flags claims about what you did', () => {
    expect(lintText('I performed the assay.', report).hits[0]?.rule).toBe('r4');
    expect(lintText('The team performed the assay.', report).hits).toEqual([]);
  });
  it('reports over and under budget but not for empty text', () => {
    const long = Array.from({ length: 300 }, () => 'word').join(' ');
    expect(lintText(long, report).over).toBe(true);
    expect(lintText('short text', report).under).toBe(true);
    expect(lintText('', report).under).toBe(false);
    expect(lintText(long, report, { unit: 'words', max: 400 }).over).toBe(false);
  });
  it('free writing has no rules and no budget; unknown profile falls back to it', () => {
    expect(lintText('7.9 percent —', profileById('free')).hits).toEqual([]);
    expect(profileById('nope').id).toBe('free');
  });
});
