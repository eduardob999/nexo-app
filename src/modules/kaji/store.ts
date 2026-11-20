import { collection, deleteDoc, doc, getDoc, onSnapshot, orderBy, query, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import { SEED } from './catalog';
import type { Interval, LogEvent, Member, PlannedItem, Settings, TaskType } from './model';
import { DEFAULT_SETTINGS } from './model';
import { DAY } from './time';

/** Everything Kaji keeps lives in `households/{hid}`, a space the people who live together share. Rules: members only. */
const house = (hid: string) => doc(db, 'households', hid);
const sub = (hid: string, name: string) => collection(db, 'households', hid, name);

/** Firestore refuses undefined anywhere in a document. */
export function clean<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

export interface HouseholdDoc { name: string; members: Record<string, 'owner' | 'member'>; createdAt: number; names?: Record<string, string>; langs?: Record<string, 'en' | 'es' | 'ja'> }
export interface Swap { id: string; itemId: string; taskId: string; fromUid: string; toUid: string; state: 'open' | 'accepted' | 'declined'; at: number; start: number }
export interface PlanDoc { items: PlannedItem[]; at: number; by: string }
export interface BusyDoc { events: Record<string, Interval[]>; at: number }
export interface SurveyDoc { answers: Record<string, number>; at: number }
export interface AwayDoc { until: number }

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// ---- which household is this person in
export function watchMyHousehold(uid: string, on: (hid: string | null) => void): () => void {
  return onSnapshot(doc(db, 'users', uid, 'meta', 'household'), (s) => on((s.data() as { id?: string } | undefined)?.id ?? null), () => on(null));
}

export async function createHousehold(uid: string, name: string, myName: string, lang: 'en' | 'es' | 'ja'): Promise<string> {
  const hid = newId();
  const now = Date.now();
  await setDoc(house(hid), clean({ name, members: { [uid]: 'owner' }, names: { [uid]: myName }, langs: { [uid]: lang }, createdAt: now } satisfies HouseholdDoc));
  const batch = writeBatch(db);
  for (const t of SEED) batch.set(doc(sub(hid, 'tasks'), t.id), clean(t));
  batch.set(doc(sub(hid, 'settings'), 'main'), clean(DEFAULT_SETTINGS));
  await batch.commit();
  await setDoc(doc(db, 'users', uid, 'meta', 'household'), { id: hid });
  return hid;
}

/** The owner invites a person by the Google address they sign in with. */
export function invite(hid: string, email: string, by: string): Promise<void> {
  return setDoc(doc(sub(hid, 'invites'), email.trim().toLowerCase()), { role: 'member', at: Date.now(), by });
}

/** The invited person adds only their own uid. The rules check the invite and the role. */
export async function join(uid: string, hid: string, myName: string, lang: 'en' | 'es' | 'ja'): Promise<void> {
  await updateDoc(house(hid), { [`members.${uid}`]: 'member', [`names.${uid}`]: myName, [`langs.${uid}`]: lang });
  await setDoc(doc(db, 'users', uid, 'meta', 'household'), { id: hid });
}

export function members(h: HouseholdDoc | null): Member[] {
  if (!h) return [];
  return Object.entries(h.members).map(([uid, role]) => ({ uid, role, name: h.names?.[uid] ?? uid.slice(0, 5), lang: h.langs?.[uid] ?? 'en' }));
}

// ---- watching
function watchDoc<T>(ref: ReturnType<typeof doc>, on: (x: T | null) => void): () => void {
  return onSnapshot(ref, (s) => on(s.exists() ? (s.data() as T) : null), () => on(null));
}
export const watchHousehold = (hid: string, on: (h: HouseholdDoc | null) => void) => watchDoc<HouseholdDoc>(house(hid), on);
export const watchSettings = (hid: string, on: (s: Settings) => void) => watchDoc<Settings>(doc(sub(hid, 'settings'), 'main'), (s) => on({ ...DEFAULT_SETTINGS, ...(s ?? {}) }));
export const watchPlan = (hid: string, on: (p: PlanDoc | null) => void) => watchDoc<PlanDoc>(doc(sub(hid, 'plan'), 'current'), on);
export const watchBusy = (hid: string, on: (b: BusyDoc | null) => void) => watchDoc<BusyDoc>(doc(sub(hid, 'busy'), 'main'), on);

export function watchTasks(hid: string, on: (t: TaskType[]) => void): () => void {
  return onSnapshot(sub(hid, 'tasks'), (s) => on(s.docs.map((d) => d.data() as TaskType)), () => on([]));
}
export function watchLog(hid: string, on: (l: LogEvent[]) => void, days = 120): () => void {
  const q = query(sub(hid, 'log'), where('at', '>=', Date.now() - days * DAY), orderBy('at'));
  return onSnapshot(q, (s) => on(s.docs.map((d) => d.data() as LogEvent)), () => on([]));
}
export function watchSurvey(hid: string, on: (s: Record<string, Record<string, number>>) => void): () => void {
  return onSnapshot(sub(hid, 'survey'), (s) => on(Object.fromEntries(s.docs.map((d) => [d.id, (d.data() as SurveyDoc).answers ?? {}]))), () => on({}));
}
export function watchAway(hid: string, on: (a: Record<string, number>) => void): () => void {
  return onSnapshot(sub(hid, 'away'), (s) => on(Object.fromEntries(s.docs.map((d) => [d.id, (d.data() as AwayDoc).until]))), () => on({}));
}
export function watchSwaps(hid: string, on: (s: Swap[]) => void): () => void {
  return onSnapshot(sub(hid, 'swaps'), (s) => on(s.docs.map((d) => d.data() as Swap)), () => on([]));
}

// ---- writing: every edit leaves a line in the history
export function addHistory(hid: string, by: string, what: string, before?: unknown, after?: unknown): Promise<void> {
  return setDoc(doc(sub(hid, 'history'), newId()), clean({ by, what, before: before ?? null, after: after ?? null, at: Date.now() }));
}

export async function saveTask(hid: string, by: string, task: TaskType, before?: TaskType): Promise<void> {
  await setDoc(doc(sub(hid, 'tasks'), task.id), clean(task));
  await addHistory(hid, by, before ? `edit ${task.id}` : `add ${task.id}`, before, task);
}
export async function saveSettings(hid: string, by: string, s: Settings, before: Settings): Promise<void> {
  await setDoc(doc(sub(hid, 'settings'), 'main'), clean(s));
  await addHistory(hid, by, 'settings', before, s);
}
export function saveSurvey(hid: string, uid: string, answers: Record<string, number>): Promise<void> {
  return setDoc(doc(sub(hid, 'survey'), uid), { answers, at: Date.now() });
}
export function logEvent(hid: string, ev: Omit<LogEvent, 'id'>): Promise<string> {
  const id = newId();
  return setDoc(doc(sub(hid, 'log'), id), clean({ ...ev, id })).then(() => id);
}
export const undoLog = (hid: string, id: string) => deleteDoc(doc(sub(hid, 'log'), id));
export function savePlan(hid: string, by: string, items: PlannedItem[]): Promise<void> {
  return setDoc(doc(sub(hid, 'plan'), 'current'), clean({ items, at: Date.now(), by } satisfies PlanDoc));
}
export interface NotToday { uid: string; taskId: string; day: string }
export function watchNotToday(hid: string, on: (n: NotToday[]) => void): () => void {
  return onSnapshot(query(sub(hid, 'requests'), where('kind', '==', 'notToday')), (s) => on(s.docs.map((d) => d.data() as NotToday)), () => on([]));
}
export const addNotToday = (hid: string, uid: string, taskId: string, day: string) =>
  setDoc(doc(sub(hid, 'requests'), `nt-${uid}-${taskId}-${day}`), { kind: 'notToday', uid, taskId, day, at: Date.now() });
export const setAway = (hid: string, uid: string, until: number) => setDoc(doc(sub(hid, 'away'), uid), { until });
export const clearAway = (hid: string, uid: string) => deleteDoc(doc(sub(hid, 'away'), uid));

export async function proposeSwap(hid: string, item: PlannedItem, toUid: string): Promise<void> {
  const id = newId();
  await setDoc(doc(sub(hid, 'swaps'), id), clean({ id, itemId: item.id, taskId: item.taskId, fromUid: item.uid, toUid, state: 'open', at: Date.now(), start: item.start } satisfies Swap));
}
export const answerSwap = (hid: string, id: string, state: 'accepted' | 'declined') => updateDoc(doc(sub(hid, 'swaps'), id), { state });

export async function householdExists(hid: string): Promise<boolean> {
  try { return (await getDoc(house(hid))).exists(); } catch { return false; }
}
