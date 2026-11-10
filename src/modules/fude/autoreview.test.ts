import { describe, expect, it } from 'vitest';
import { AutoReview } from './autoreview';
import type { Timers } from './autosave';

function clock() {
  let next = 1; const jobs = new Map<number, () => void>();
  const timers: Timers = { set: (fn) => { jobs.set(next, fn); return next++; }, clear: (id) => { jobs.delete(id as number); } };
  return { timers, run: () => { const all = [...jobs.values()]; jobs.clear(); all.forEach((f) => f()); }, count: () => jobs.size };
}
const TEXT = 'The rise was small. A smaller step does not remove it.';

describe('AutoReview', () => {
  it('asks once after the text is still, with the text it saw', () => {
    const c = clock(); const asked: string[] = [];
    const r = new AutoReview('', (t) => asked.push(t), 2500, c.timers);
    r.change(TEXT); c.run();
    expect(asked).toEqual([TEXT]);
    c.run();
    expect(asked).toHaveLength(1);
  });
  it('does nothing while a composition is open, and asks after it ends', () => {
    const c = clock(); const asked: string[] = [];
    const r = new AutoReview('', (t) => asked.push(t), 2500, c.timers);
    r.compositionStart(); r.change(TEXT, true); c.run();
    expect(asked).toEqual([]);
    r.compositionEnd(TEXT); c.run();
    expect(asked).toEqual([TEXT]);
  });
  it('treats the native isComposing flag as an open composition', () => {
    const c = clock(); const asked: string[] = [];
    const r = new AutoReview('', (t) => asked.push(t), 2500, c.timers);
    r.change(TEXT, true); expect(c.count()).toBe(0); c.run();
    expect(asked).toEqual([]);
  });
  it('restarts the quiet time on every change', () => {
    const c = clock(); const asked: string[] = [];
    const r = new AutoReview('', (t) => asked.push(t), 2500, c.timers);
    r.change(TEXT); r.change(TEXT + ' More.'); expect(c.count()).toBe(1);
    c.run(); expect(asked).toEqual([TEXT + ' More.']);
  });
  it('waits while a review is running, then looks again', () => {
    const c = clock(); const asked: string[] = [];
    const r = new AutoReview('', (t) => asked.push(t), 2500, c.timers);
    r.setBusy(true); r.change(TEXT); c.run();
    expect(asked).toEqual([]);
    r.setBusy(false); c.run();
    expect(asked).toEqual([TEXT]);
  });
  it('ignores text that is too short, has no sentence mark yet, or came from another device', () => {
    const c = clock(); const asked: string[] = [];
    const r = new AutoReview('', (t) => asked.push(t), 2500, c.timers);
    r.change('Short.'); c.run();
    r.change('A long unfinished sentence without a stop'); c.run();
    expect(asked).toEqual([]);
    r.adopt(TEXT); c.run();
    expect(asked).toEqual([]);
  });
  it('sees where a sentence ends, in English and Japanese', () => {
    expect(AutoReview.endsSentence('Done. ')).toBe(true);
    expect(AutoReview.endsSentence('済んだ。')).toBe(true);
    expect(AutoReview.endsSentence('half way')).toBe(false);
  });
});
