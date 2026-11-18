import { describe, expect, it } from 'vitest';
import { englishWordTarget, enWords, jaChars, lengthVerdict, parseJaBudget } from './lengths';

describe('lengths', () => {
  it('counts Japanese characters without white space, headings included', () => {
    expect(jaChars('【講義内容】\n\n細胞 外小胞')).toBe(11);
    expect(jaChars('')).toBe(0);
  });
  it('counts English words', () => {
    expect(enWords('The lecturer’s well-known point: 12 studies.')).toBe(6);
  });
  it('reads a range from the course wording', () => {
    expect(parseJaBudget('各テーマを1000〜2000字程度にまとめること')).toEqual({ min: 1000, max: 2000 });
    expect(parseJaBudget('between 1,000 to 2,000 characters')).toEqual({ min: 1000, max: 2000 });
    expect(parseJaBudget('1,000字以内')).toEqual({ max: 1000 });
    expect(parseJaBudget('about 300 words')).toBeUndefined();
  });
  it('turns a Japanese range into an English word target that leaves room under the ceiling', () => {
    const t = englishWordTarget({ min: 1000, max: 2000 });
    expect(t?.min).toBe(330);
    expect(t?.max).toBe(640);
    // the 寺尾 report: a 1,000 limit asks for about 320 English words, not the 360 that overshot by 22 characters
    expect(englishWordTarget({ max: 1000 })?.max).toBe(320);
    expect(englishWordTarget(undefined)).toBeUndefined();
  });
  it('says plainly where a translation stands', () => {
    const b = { min: 1000, max: 2000 };
    expect(lengthVerdict('あ'.repeat(2152), b)).toMatchObject({ status: 'over' });
    expect(lengthVerdict('あ'.repeat(2152), b).message).toContain('152 over');
    expect(lengthVerdict('あ'.repeat(1979), b).status).toBe('ok');
    expect(lengthVerdict('あ'.repeat(500), b).status).toBe('under');
    expect(lengthVerdict('あ', undefined).status).toBe('none');
  });
});
