import type { PlanSide, TrainOption, TripStep } from './types';

/** The id an itinerary is chosen by. Options from before ids existed are told apart by their times. */
export const optionId = (o: TrainOption): string => o.id ?? `${o.leave}-${o.arrive}`;
const startOf = (o: TrainOption): string => o.start ?? o.leave;

export interface OptionRow extends TrainOption { kind: 'early' | 'pick' | 'later' | 'plain'; oid: string; startAt: string; selected: boolean }

function valid(options: TrainOption[] | undefined): TrainOption[] {
  return Array.isArray(options) ? options.filter((o) => o && o.leave && o.arrive) : [];
}

/** The itinerary the ticket is drawn from: the one he chose, else the planned one, else the first. */
export function chosen(side: PlanSide | null | undefined, selected?: string | undefined): TrainOption | undefined {
  const list = valid(side?.options);
  const want = selected ?? side?.selected;
  return list.find((o) => want !== undefined && optionId(o) === want) ?? list.find((o) => o.pick) ?? list[0];
}

/** The options as rows, each marked earlier or later than the planned one, with the chosen one flagged. Without a planned one they are all plain. */
export function optionRows(options: TrainOption[] | undefined, selected?: string): OptionRow[] {
  const list = valid(options);
  const at = list.findIndex((o) => o.pick);
  const sel = list.find((o) => selected !== undefined && optionId(o) === selected) ?? (at >= 0 ? list[at] : list[0]);
  return list.map((o, i) => ({
    ...o, txt: o.txt ?? '', oid: optionId(o), startAt: startOf(o), selected: o === sel,
    kind: at < 0 ? 'plain' : i === at ? 'pick' : i < at ? 'early' : 'later',
  }));
}

/** What to call the first move: "Leave the lab", "Leave the dojo", "Leave home", else plain "Start". */
export function startLabel(first: TripStep | undefined): string {
  const from = `${first?.from ?? ''}`;
  if (/lab/i.test(from)) return 'Leave the lab';
  if (/dojo|園山/i.test(from)) return 'Leave the dojo';
  if (/home|自宅/i.test(from)) return 'Leave home';
  return 'Start';
}

export interface Headline { option: TrainOption; startLabel: string; start: string; board?: string; arrive: string; steps: TripStep[] }

/** The three times that matter, each named: when to start moving, when to board the first train, when he arrives. Undefined when there are no options. */
export function effective(side: PlanSide | null | undefined, selected?: string): Headline | undefined {
  const option = chosen(side, selected);
  if (!option) return undefined;
  const steps = option.steps ?? [];
  const board = steps.find((s) => s.kind === 'train')?.board;
  return { option, startLabel: startLabel(steps[0]), start: startOf(option), ...(board ? { board } : {}), arrive: option.arrive, steps };
}

/** A bare number becomes "platform 1"; anything else the lookup gave ("1番線") is shown as it came. */
const pf = (p: string | null | undefined): string => (p ? (/^\d+$/.test(p) ? `platform ${p}` : p) : '');

/** One line on the timeline. Platform appears only when the lookup supplied one. */
export interface StepLine { label: string; time: string; text: string; sub: string; kind: TripStep['kind'] | 'arrive' }

export function stepLines(h: Headline): StepLine[] {
  const out: StepLine[] = [];
  const lastTrain = h.steps.map((s) => s.kind).lastIndexOf('train');
  h.steps.forEach((s, i) => {
    const first = i === 0;
    if (s.kind === 'bike' || s.kind === 'walk') {
      const verb = s.kind === 'bike' ? 'Bike' : 'Walk';
      const route = [s.from ? `from ${s.from}` : '', s.to ? `to ${s.to}` : ''].filter(Boolean).join(' ');
      out.push({ kind: s.kind, label: first ? 'Start' : verb, time: s.start ?? (first ? h.start : ''), text: s.txt ?? `${verb} ${route}`.trim(), sub: s.min && !(s.txt ?? '').includes(String(s.min)) ? `${s.min} min` : '' });
    } else if (s.kind === 'train') {
      const platform = pf(s.platform);
      const toward = s.toward ? `for ${s.toward}` : '';
      out.push({ kind: 'train', label: 'Board', time: s.board ?? '', text: [s.line, toward].filter(Boolean).join(' '), sub: [s.from ? `at ${s.from}` : '', platform, s.alight ? `arrives ${s.alight}${s.to ? ` at ${s.to}` : ''}` : ''].filter(Boolean).join(' · ') });
    } else {
      const plat = s.from_platform || s.to_platform ? `${pf(s.from_platform) || '?'} to ${pf(s.to_platform) || '?'}` : '';
      out.push({ kind: 'change', label: 'Change', time: '', text: `Change at ${s.at ?? s.from ?? ''}`.trim(), sub: [s.wait_min !== undefined ? `${s.wait_min} min` : '', plat].filter(Boolean).join(' · ') });
    }
    if (i === lastTrain) out.push({ kind: 'arrive', label: 'Arrive', time: h.arrive, text: s.to ?? '', sub: '' });
  });
  return out;
}
