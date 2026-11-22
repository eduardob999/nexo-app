import type { Estimate, Interval, LogEvent, Member, PlannedItem, Settings, TaskType } from './model';
import type { HouseholdDoc, Swap } from './store';
import type { Unplaced } from './planner';

export interface KajiData {
  hid: string;
  me: string;
  house: HouseholdDoc;
  members: Member[];
  tasks: TaskType[];
  log: LogEvent[];
  survey: Record<string, Record<string, number>>;
  settings: Settings;
  away: Record<string, number>;
  /** The last Go out / Back home press per person (home.ts). */
  presence: Record<string, import('./home').Presence>;
  busy: Record<string, Interval[]>;
  plan: PlannedItem[];
  unplaced: Unplaced[];
  swaps: Swap[];
  estimates: Record<string, Estimate>;
  now: number;
}

export interface Ratings { effort?: number; dislike?: number; enjoyment?: number; note?: string }

/** What the screens can do. The live module wires these to Firestore; the preview wires them to nothing. */
export interface KajiActions {
  logDone: (taskId: string, minutes: number, ratings: Ratings, opts?: { start?: number; planned?: boolean; custom?: string }) => Promise<void>;
  /** Fill in or change the ratings and the comment of something already logged (the person's own entry only). */
  rate: (eventId: string, ratings: Ratings) => Promise<void>;
  undo: (eventId: string) => Promise<void>;
  notToday: (item: PlannedItem) => Promise<void>;
  /** Move one planned chore to a new time (pinned there) and log it with the optional reason. */
  reschedule: (item: PlannedItem, start: number, reason: import('./model').Reason | null, note: string, toUid?: string) => Promise<void>;
  /** Take a planned chore off the plan for good, with a required reason, and log it. */
  dismiss: (item: PlannedItem, reason: import('./model').Reason, note: string) => Promise<void>;
  move: (item: PlannedItem, uid: string, start: number) => Promise<void>;
  askSwap: (item: PlannedItem, toUid: string) => Promise<void>;
  answerSwap: (swap: Swap, accept: boolean) => Promise<void>;
  saveTask: (task: TaskType, before?: TaskType) => Promise<void>;
  saveSettings: (s: Settings) => Promise<void>;
  saveSurvey: (answers: Record<string, number>) => Promise<void>;
  setAway: (until: number | null) => Promise<void>;
  /** Go out (true) or Back home (false), for this person. */
  setPresence: (uid: string, out: boolean) => Promise<void>;
  invite: (email: string) => Promise<void>;
  ask: (kind: import('./asks').AskKind, text: string, when: number | null) => Promise<void>;
}
