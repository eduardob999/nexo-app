/**
 * Kaji (家事): the household chores of two people, split by felt burden rather than by minutes. Pure types, no Firebase.
 * Unit of work: the tama (玉, an abacus bead), about ten minutes of ordinary effort.
 */
export type Lang = 'en' | 'es' | 'ja';
export type Category = 'kitchen' | 'floors' | 'rooms' | 'bathroom' | 'laundry' | 'bed' | 'shopping' | 'trash' | 'tidy';
export type Names = Record<Lang, string>;

/** `times` occurrences every `perDays` days. `adhoc`: never planned, only logged. */
export interface Freq {
  times: number;
  perDays: number;
  weekdaysOnly?: boolean;
  adhoc?: boolean;
  /** Preferred weekdays, 0 = Sunday. A preference, not a rule. */
  days?: number[];
}

export interface TaskType {
  id: string;
  names: Names;
  icon: string;
  category: Category;
  freq: Freq;
  /** fixed: a window of the day, never timed. measured: timed until the estimate is stable. */
  mode: 'fixed' | 'measured';
  /** Minutes the first week assumes (a prior), or the planned length of a fixed chore. */
  priorMinutes: number;
  /** HH:MM to HH:MM. A fixed chore sits inside it; a measured one may have a preferred one. */
  window?: { from: string; to: string };
  /** One window per occurrence of a day, when `freq.times` > 1 (dishes: after breakfast, lunch and dinner). Replaces `window` when its length equals `times`. */
  windows?: { from: string; to: string }[];
  /** Done after another chore: starts `delayMin` minutes after that one ends. */
  after?: { taskId: string; delayMin: number };
  /** Uids allowed to do it. Empty or absent means anyone. */
  who?: string[];
  /** Replaces the learned difficulty when set. */
  weightOverride?: number;
  active: boolean;
}

export interface Member { uid: string; name: string; lang: Lang; role: 'owner' | 'member'; awayUntil?: string; share?: number }

/** A request to hand one planned chore to the other person. `accepted` is binding on every re-plan; `declined` is remembered by the planner. */
export interface SwapRecord { id: string; itemId: string; taskId: string; fromUid: string; toUid: string; state: 'open' | 'accepted' | 'declined'; at: number; start: number }

export interface Interval { start: number; end: number; label?: string; place?: string }   // epoch milliseconds

/** What happened, appended and never rewritten. */
export interface LogEvent {
  id: string;
  taskId: string;
  uid: string;
  kind: 'done' | 'skipped' | 'rescheduled' | 'dismissed';
  /** Epoch milliseconds when it ended. */
  at: number;
  start?: number;
  minutes: number;
  planned: boolean;
  effort?: number;      // 1 to 5, how hard
  dislike?: number;     // 1 to 5, how much the doer minded
  enjoyment?: number;   // 1 to 5
  /** If part was done by someone else: [uid, minutes] pairs, this event's own minutes included. */
  split?: { uid: string; minutes: number }[];
  note?: string;
  /** A one-off chore that is not in the catalog (taskId is "custom"): its name. */
  custom?: string;
  /** rescheduled / dismissed: when the chore was planned to start, where it went, and why. A dismissal always has a reason. */
  plannedStart?: number;
  newStart?: number;
  reason?: Reason;
  context?: { weather?: string; busyMinutes?: number };
}

/** Why a chore was dismissed or moved. `other` carries free text in `note`. */
export type Reason = 'not_needed' | 'no_time' | 'not_enough' | 'other';
export const REASONS: Reason[] = ['not_needed', 'no_time', 'not_enough', 'other'];

export interface Settings {
  /** Share of total burden each member should carry, by uid. Equal when absent. */
  targets?: Record<string, number>;
  windowDays: number;
  /** burden = weight * (a + b * dislike) */
  burdenA: number;
  burdenB: number;
  bufferMin: number;
  freezeMin: number;
  /** The one daily slot per person for chores that are not fixed. */
  slot: { from: string; to: string };
  lunch: { from: string; to: string };
  sleep: { from: string; to: string };
  quiet: { from: string; to: string };
  /** Data questions: a person's spot-check rate floor. */
  askFloor: number;
}

export const DEFAULT_SETTINGS: Settings = {
  windowDays: 28, burdenA: 0.6, burdenB: 0.2, bufferMin: 15, freezeMin: 120,
  slot: { from: '17:30', to: '21:30' }, lunch: { from: '12:15', to: '13:00' },
  sleep: { from: '23:30', to: '07:00' }, quiet: { from: '22:30', to: '07:30' }, askFloor: 0.1,
};

/** Learned numbers for one task type. */
export interface Estimate {
  n: number;
  meanMin: number;
  /** Sample variance of minutes, 0 until two samples. */
  varMin: number;
  difficulty: number;
  /** Mean dislike by uid, from the survey and the ratings. */
  dislike: Record<string, number>;
  /** Event count since the last time the system had to ask again. */
  stableSince: number;
}

export interface PlannedItem {
  id: string;
  taskId: string;
  uid: string;
  start: number;
  end: number;
  frozen?: boolean;
  /** Fixed by a person (an accepted swap or a drag): kept exactly until it is past. */
  pinned?: boolean;
  reason?: string;
}
