import { describe, expect, it } from 'vitest';
import { kindForCard } from './link';

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
});
