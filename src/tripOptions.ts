import type { TrainOption } from './types';

export interface OptionRow extends TrainOption { kind: 'early' | 'pick' | 'later' | 'plain' }

/** The options as rows, each marked earlier or later than the planned one. Without a planned one they are all plain. */
export function optionRows(options: TrainOption[] | undefined): OptionRow[] {
  const list = Array.isArray(options) ? options.filter((o) => o && o.leave && o.arrive) : [];
  const at = list.findIndex((o) => o.pick);
  return list.map((o, i) => ({ ...o, txt: o.txt ?? '', kind: at < 0 ? 'plain' : i === at ? 'pick' : i < at ? 'early' : 'later' }));
}
