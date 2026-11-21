import { describe, expect, it } from 'vitest';
import { SEED } from './catalog';
import { historyLine, learnedLine } from './history';

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
  it('reads a learned shift in each language', () => {
    expect(learnedLine({ taskId: 'basura', kind: 'window', value: 30, n: 3 }, SEED, 'en')).toBe('🗑️ Take out the rubbish: window 30 min later, from 3 moves');
    expect(learnedLine({ taskId: 'basura', kind: 'window', value: -45, n: 3 }, SEED, 'es')).toBe('🗑️ Botar la basura: ventana 45 min antes, por 3 cambios');
    expect(learnedLine({ taskId: 'basura', kind: 'freq', value: 1.3, n: 4 }, SEED, 'ja')).toBe('🗑️ ゴミ出し: 間隔を1.3倍に（4回の見送りから）');
  });
});
