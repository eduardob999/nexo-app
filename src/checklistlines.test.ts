import { describe, expect, it } from 'vitest';
import { checklistLines } from './checklistlines';

describe('checklistLines', () => {
  it('splits on lines, strips bullets and drops blanks', () => {
    expect(checklistLines('milk\n- eggs\n\n  * rice  \n1. tea\n[ ] salt\n- [x] oil')).toEqual(['milk', 'eggs', 'rice', 'tea', 'salt', 'oil']);
  });
  it('accepts an array and caps the length', () => {
    expect(checklistLines(['a', ' ', 'b'])).toEqual(['a', 'b']);
    expect(checklistLines(Array.from({ length: 100 }, (_, i) => `x${i}`))).toHaveLength(60);
  });
});
