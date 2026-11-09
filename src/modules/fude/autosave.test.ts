import { describe, expect, it, vi } from 'vitest';
import { Autosaver, type SaveState } from './autosave';

function setup(initial = '') {
  vi.useFakeTimers();
  const saves: string[] = [];
  const states: SaveState[] = [];
  const a = new Autosaver(initial, (t) => saves.push(t), (s) => states.push(s), 700, { set: (fn, ms) => setTimeout(fn, ms), clear: (id) => clearTimeout(id as ReturnType<typeof setTimeout>) });
  return { a, saves, states };
}

describe('Autosaver', () => {
  it('saves plain typing after the quiet time, once', () => {
    const { a, saves } = setup();
    a.change('わ'); a.change('わた'); a.change('わたし');
    vi.advanceTimersByTime(699); expect(saves).toEqual([]);
    vi.advanceTimersByTime(2); expect(saves).toEqual(['わたし']);
  });
  it('never saves while a composition is open, however long it takes', () => {
    const { a, saves } = setup();
    a.compositionStart(); a.change('かんじ', true);
    vi.advanceTimersByTime(60_000); expect(saves).toEqual([]);
    a.blur(); expect(saves).toEqual([]);          // blur during composition waits for its end
    a.compositionEnd('漢字');
    vi.advanceTimersByTime(701); expect(saves).toEqual(['漢字']);
  });
  it('treats the input event flag as composing even when compositionstart never fired', () => {
    const { a, saves } = setup();
    a.change('にほ', true);
    vi.advanceTimersByTime(5_000); expect(saves).toEqual([]);
    a.compositionEnd('日本'); vi.advanceTimersByTime(701); expect(saves).toEqual(['日本']);
  });
  it('blur saves at once when nothing is being composed, and not twice', () => {
    const { a, saves } = setup();
    a.change('音楽'); a.blur(); expect(saves).toEqual(['音楽']);
    vi.advanceTimersByTime(2_000); expect(saves).toEqual(['音楽']);
  });
  it('does not save unchanged text and reports its state', () => {
    const { a, saves, states } = setup('学校');
    a.change('学校'); a.blur(); vi.advanceTimersByTime(2_000);
    expect(saves).toEqual([]);
    a.change('学校へ'); expect(states).toContain('dirty');
    vi.advanceTimersByTime(701); expect(states[states.length - 1]).toBe('saved');
  });
  it('adopts text from another device without saving it back', () => {
    const { a, saves } = setup('a');
    a.change('ab'); a.adopt('remote'); vi.advanceTimersByTime(2_000);
    expect(saves).toEqual([]);
    a.blur(); expect(saves).toEqual([]);
  });
});
