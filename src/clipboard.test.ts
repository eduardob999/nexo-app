import { describe, expect, it } from 'vitest';
import { insertAt } from './clipboard';

describe('insertAt', () => {
  it('puts text at the caret, over a selection, or at the end', () => {
    expect(insertAt('hello world', 'big ', 6, 6)).toBe('hello big world');
    expect(insertAt('hello world', 'there', 6, 11)).toBe('hello there');
    expect(insertAt('abc', 'd', null, null)).toBe('abcd');
  });
});
