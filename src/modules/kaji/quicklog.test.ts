import { describe, expect, it } from 'vitest';
import { balance } from './burden';
import { DEFAULT_SETTINGS } from './model';
import type { Member } from './model';
import { CUSTOM_ID, OPEN_TASK, customTask, eventFromTimer, isOpenTimer, newTaskFrom, startOpenTimer } from './quicklog';

const MEMBERS: Member[] = [{ uid: 'a', name: 'A', lang: 'en', role: 'owner' }, { uid: 'b', name: 'B', lang: 'en', role: 'member' }];

describe('quick log timer', () => {
  it('starts unassigned', () => {
    const r = startOpenTimer(1000);
    expect(r).toEqual({ taskId: OPEN_TASK, start: 1000 });
    expect(isOpenTimer(r)).toBe(true);
    expect(isOpenTimer({ taskId: 'cena', start: 1 })).toBe(false);
    expect(isOpenTimer(null)).toBe(false);
  });
  it('turns a finished timer on an existing chore into a done event with the measured minutes', () => {
    const e = eventFromTimer(startOpenTimer(0), 12 * 60_000 + 20_000, 'a', { kind: 'existing', taskId: 'platos' });
    expect(e).toEqual({ uid: 'a', kind: 'done', at: 12 * 60_000 + 20_000, start: 0, minutes: 12, planned: false, taskId: 'platos' });
  });
  it('a new chore is adhoc, named, and logged under its own id', () => {
    const task = newTaskFrom('  Water plants ', '🌱', 'rooms', 7, 123456);
    expect(task.names.en).toBe('Water plants');
    expect(task.freq.adhoc).toBe(true);
    expect(task.priorMinutes).toBe(7);
    expect(task.id.startsWith('water-plants-')).toBe(true);
    const e = eventFromTimer(startOpenTimer(0), 7 * 60_000, 'b', { kind: 'new', task });
    expect(e.taskId).toBe(task.id);
    expect(e.minutes).toBe(7);
  });
  it('a one-off is logged as custom with its name, at least one minute', () => {
    const e = eventFromTimer(startOpenTimer(0), 5_000, 'a', { kind: 'custom', name: ' Fix shelf ' });
    expect(e).toMatchObject({ taskId: CUSTOM_ID, custom: 'Fix shelf', minutes: 1, kind: 'done' });
  });
  it('a one-off counts in the balance at its measured minutes', () => {
    const now = 10 * 86_400_000;
    const ev = { id: 'x', ...eventFromTimer(startOpenTimer(now - 3_600_000 - 30 * 60_000), now - 3_600_000, 'a', { kind: 'custom', name: 'Fix shelf' }) };
    const b = balance([ev], [], {}, MEMBERS, now, DEFAULT_SETTINGS);
    expect(b.perUid.a?.minutes).toBe(30);
    expect(b.perUid.a?.weight).toBeCloseTo(3);
    expect(b.perUid.b?.minutes).toBe(0);
    expect(customTask('x').id).toBe(CUSTOM_ID);
  });
});
