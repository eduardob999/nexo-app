import type { TaskType } from './model';

const t = (id: string, es: string, en: string, ja: string, icon: string, category: TaskType['category'], times: number, perDays: number,
  mode: TaskType['mode'], priorMinutes: number, extra: Partial<TaskType> = {}): TaskType => ({
  id, names: { es, en, ja }, icon, category, freq: { times, perDays }, mode, priorMinutes, active: true, ...extra,
});

/** Dishes are washed three times a day: after breakfast, after lunch (the lunch hour itself is blocked) and after dinner. */
export const DISH_WINDOWS = [{ from: '08:00', to: '11:30' }, { from: '13:00', to: '16:00' }, { from: '19:30', to: '22:00' }];

/** First assumptions, 2026-11-20. Every number is a prior to be corrected in the app or by the data. */
export const SEED: TaskType[] = [
  t('platos', 'Lavar platos', 'Wash the dishes', '皿洗い', '🍽️', 'kitchen', 3, 1, 'measured', 10, { windows: DISH_WINDOWS }),
  t('recoger', 'Recoger los platos', 'Clear the dishes', '食器を下げる', '🥣', 'kitchen', 2, 1, 'measured', 5),
  t('desayuno', 'Preparar el desayuno', 'Make breakfast', '朝食づくり', '🍳', 'kitchen', 1, 1, 'fixed', 25, { window: { from: '07:00', to: '08:30' } }),
  t('bento', 'Preparar los bento boxes', 'Pack the bento boxes', 'お弁当づくり', '🍱', 'kitchen', 1, 1, 'fixed', 30, { window: { from: '21:00', to: '22:30' }, freq: { times: 1, perDays: 1, weekdaysOnly: true } }),
  t('cena', 'Preparar la cena', 'Make dinner', '夕食づくり', '🍲', 'kitchen', 1, 1, 'fixed', 45, { window: { from: '18:00', to: '20:00' } }),
  t('congelar', 'Preparar la comida que se congela', 'Freezer meal prep', '冷凍用の作り置き', '🧊', 'kitchen', 1, 7, 'measured', 90, { freq: { times: 1, perDays: 7, days: [6, 0] } }),
  t('aspirar', 'Aspirar el piso', 'Vacuum the floor', '掃除機がけ', '🌀', 'floors', 2, 7, 'measured', 20),
  t('polvo', 'Limpiar el polvo de los muebles y la cama', 'Dust the furniture and the bed', '家具とベッドのほこり取り', '🪶', 'rooms', 1, 7, 'measured', 25),
  t('piso-sala', 'Limpiar el piso de la sala a profundidad', 'Deep-clean the living-room floor', 'リビングの床の念入り掃除', '🧽', 'floors', 1, 14, 'measured', 40),
  t('bano-profundo', 'Limpiar la ducha, el piso del baño, el lavamanos y el tanque de la poceta', 'Deep-clean the shower, bathroom floor, sink and cistern', '浴室・洗面・トイレタンクの念入り掃除', '🛁', 'bathroom', 1, 7, 'measured', 45),
  t('poceta', 'Limpiar la poceta', 'Clean the toilet', 'トイレ掃除', '🚽', 'bathroom', 2, 7, 'measured', 10),
  t('ropa', 'Lavar la ropa (separar la que se guinda y la que seca en lavadora)', 'Do the laundry (sort hang-dry from machine-dry)', '洗濯（干す物と乾燥機の物を分ける）', '🧺', 'laundry', 2, 7, 'measured', 15),
  t('guindar', 'Guindar la ropa que se guinda', 'Hang the air-dry clothes', '洗濯物を干す', '👕', 'laundry', 2, 7, 'measured', 10, { after: { taskId: 'ropa', delayMin: 60 } }),
  t('doblar', 'Doblar la ropa', 'Fold the clothes', '洗濯物をたたむ', '🧦', 'laundry', 2, 7, 'measured', 15, { after: { taskId: 'ropa', delayMin: 1440 } }),
  t('sabanas', 'Lavar las sábanas', 'Wash the sheets', 'シーツを洗う', '🛏️', 'bed', 1, 14, 'measured', 10),
  t('poner-sabanas', 'Poner las sábanas luego de lavarlas', 'Put the sheets back on', 'シーツを敷く', '🛌', 'bed', 1, 14, 'measured', 10, { after: { taskId: 'sabanas', delayMin: 120 } }),
  t('panos', 'Lavar los paños', 'Wash the cloths and towels', 'ふきん・タオルを洗う', '🧻', 'laundry', 1, 7, 'measured', 10),
  t('basura', 'Botar la basura', 'Take out the rubbish', 'ゴミ出し', '🗑️', 'trash', 1, 1, 'fixed', 5, { window: { from: '20:00', to: '23:00' } }),
  t('mercado', 'Ir al mercado, a Daiso o a Sugi', 'Shopping run (market, Daiso, Sugi)', '買い物（市場・ダイソー・スギ薬局）', '🛒', 'shopping', 1, 7, 'measured', 90),
  t('ordenar', 'Ordenar', 'Tidy up', '片付け', '✨', 'tidy', 1, 1, 'measured', 15, { freq: { times: 0, perDays: 1, adhoc: true } }),
];

export const CATEGORY_COLOR: Record<TaskType['category'], string> = {
  kitchen: '#e8a33d', floors: '#4f8fd6', rooms: '#8e6cc4', bathroom: '#2fa7a0', laundry: '#d9618a', bed: '#7a7fd0', shopping: '#5aa05a', trash: '#8a8f98', tidy: '#c98b5a',
};

/**
 * Stored chores that predate a change in the seed. Only a chore still exactly as the old seed made it is updated, so nothing he edited is
 * overwritten. 2026-11-21: the dishes went from once after dinner to three times a day.
 */
export function migrateTasks(stored: TaskType[]): TaskType[] {
  return stored.map((x) => {
    const old = x.freq.times === 1 && x.freq.perDays === 1 && !x.freq.adhoc && !x.windows && x.window?.from === '19:30' && x.window.to === '22:00';
    if (x.id !== 'platos' || !old) return x;
    const { window: _drop, ...rest } = x;
    void _drop;
    return { ...rest, freq: { times: 3, perDays: 1 }, windows: DISH_WINDOWS, priorMinutes: x.priorMinutes === 15 ? 10 : x.priorMinutes };
  });
}
