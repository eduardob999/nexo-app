import { describe, expect, it } from 'vitest';
import { SEED } from './catalog';
import { historyLine } from './history';

const M = [{ uid: 'a', name: 'Eduardo' }, { uid: 'b', name: 'Carla' }];

describe('history lines', () => {
  it('reads an edit, an add and a settings change in each language', () => {
    expect(historyLine({ by: 'b', what: 'edit platos', at: 1 }, SEED, M, 'en')).toBe('Carla edited 🍽️ Wash the dishes');
    expect(historyLine({ by: 'a', what: 'add platos', at: 1 }, SEED, M, 'es')).toBe('Eduardo añadió 🍽️ Lavar platos');
    expect(historyLine({ by: 'a', what: 'settings', at: 1 }, SEED, M, 'ja')).toBe('Eduardoが設定を変更');
    expect(historyLine({ by: 'b', what: 'edit platos', at: 1 }, SEED, M, 'ja')).toBe('Carlaが編集: 🍽️ 皿洗い');
  });
  it('never drops an entry it does not know, nor a chore that was deleted', () => {
    expect(historyLine({ by: 'a', what: 'weird thing', at: 1 }, SEED, M, 'en')).toBe('Eduardo: weird thing');
    expect(historyLine({ by: 'zz', what: 'edit gone-id', at: 1 }, SEED, M, 'en')).toBe('? edited gone-id');
  });
});
