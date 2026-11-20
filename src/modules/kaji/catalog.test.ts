import { describe, expect, it } from 'vitest';
import { SEED } from './catalog';

describe('seed catalog', () => {
  it('holds all twenty chores with unique ids and three languages', () => {
    expect(SEED).toHaveLength(20);
    expect(new Set(SEED.map((s) => s.id)).size).toBe(20);
    for (const s of SEED) for (const l of ['en', 'es', 'ja'] as const) expect(s.names[l].length).toBeGreaterThan(1);
  });
  it('depends only on chores that exist, and fixed chores have a window', () => {
    const ids = new Set(SEED.map((s) => s.id));
    for (const s of SEED) {
      if (s.after) expect(ids.has(s.after.taskId)).toBe(true);
      if (s.mode === 'fixed') expect(s.window).toBeDefined();
    }
  });
  it('has no em dashes in any name', () => {
    for (const s of SEED) for (const n of Object.values(s.names)) expect(n.includes('—')).toBe(false);
  });
});
