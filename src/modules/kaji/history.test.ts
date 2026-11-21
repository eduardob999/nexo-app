import { describe, expect, it } from 'vitest';
import { SEED } from './catalog';
import { historyLine, learnedLine } from './history';

const M = [{ uid: 'a', name: 'Eduardo' }, { uid: 'b', name: 'Carla' }];

describe('history lines', () => {
  it('reads an edit, an add and a settings change in English', () => {
    expect(historyLine({ by: 'b', what: 'edit platos', at: 1 }, SEED, M, 'en')).toBe('Carla edited 🍽️ Wash the dishes');
    expect(historyLine({ by: 'a', what: 'add platos', at: 1 }, SEED, M, 'en')).toBe('Eduardo added 🍽️ Wash the dishes');
    expect(historyLine({ by: 'a', what: 'settings', at: 1 }, SEED, M, 'en')).toBe('Eduardo changed the settings');
  });
  it('never drops an entry it does not know, nor a chore that was deleted', () => {
    expect(historyLine({ by: 'a', what: 'weird thing', at: 1 }, SEED, M, 'en')).toBe('Eduardo: weird thing');
    expect(historyLine({ by: 'zz', what: 'edit gone-id', at: 1 }, SEED, M, 'en')).toBe('? edited gone-id');
  });
  it('reads a learned shift in English', () => {
    expect(learnedLine({ taskId: 'basura', kind: 'window', value: 30, n: 3 }, SEED, 'en')).toBe('🗑️ Take out the rubbish: window 30 min later, from 3 moves');
    expect(learnedLine({ taskId: 'basura', kind: 'window', value: -45, n: 3 }, SEED, 'en')).toBe('🗑️ Take out the rubbish: window 45 min earlier, from 3 moves');
    expect(learnedLine({ taskId: 'basura', kind: 'freq', value: 1.3, n: 4 }, SEED, 'en')).toBe('🗑️ Take out the rubbish: interval 1.3x longer, from 4 dismissals');
  });
});
