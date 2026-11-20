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
  busy: Record<string, Interval[]>;
  plan: PlannedItem[];
  unplaced: Unplaced[];
  swaps: Swap[];
  estimates: Record<string, Estimate>;
  now: number;
}

export interface Ratings { effort?: number; dislike?: number; enjoyment?: number }

/** What the screens can do. The live module wires these to Firestore; the preview wires them to nothing. */
export interface KajiActions {
  logDone: (taskId: string, minutes: number, ratings: Ratings, opts?: { start?: number; planned?: boolean }) => Promise<void>;
  undo: (eventId: string) => Promise<void>;
  notToday: (item: PlannedItem) => Promise<void>;
  move: (item: PlannedItem, uid: string, start: number) => Promise<void>;
  askSwap: (item: PlannedItem, toUid: string) => Promise<void>;
  answerSwap: (swap: Swap, accept: boolean) => Promise<void>;
  saveTask: (task: TaskType, before?: TaskType) => Promise<void>;
  saveSettings: (s: Settings) => Promise<void>;
  saveSurvey: (answers: Record<string, number>) => Promise<void>;
  setAway: (until: number | null) => Promise<void>;
  invite: (email: string) => Promise<void>;
}
