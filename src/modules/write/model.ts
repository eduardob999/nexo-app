/**
 * Homework sets: photos of a textbook page and one answer per question, typed by him.
 * Pure data rules, so they can be tested without Firestore or a phone. The store is homeworkStore.ts.
 *
 * Items are a map keyed by question number, not an array, so the phone and the laptop can edit two different
 * questions at the same moment and neither overwrites the other: Firestore updates one field path at a time.
 */
import type { CardFile } from '../../types';

export type ItemStatus = 'open' | 'answered' | 'checking' | 'ok' | 'wrong' | 'hint';

export interface HomeworkItem {
  /** Question number as printed, for example "1" or "3b". Letters, digits, `-` and `_` only. */
  n: string;
  /** Position in the set, so the order survives the map. */
  order: number;
  /** The question as transcribed from the photo and confirmed by him. */
  prompt: string;
  /** His answer, exactly as typed. Never written by the checker. */
  answer: string;
  status: ItemStatus;
  /** A nudge that does not give the answer. */
  hint?: string;
  /** Why the answer is wrong or what it shows, after he asked. */
  explain?: string;
  /** The answer the hint or explanation belongs to. If his answer has moved on, they are stale. */
  checkedAnswer?: string;
  updatedAt?: string;
}

export interface HomeworkSet {
  id: string;
  title: string;
  /** KULMS deadline, ISO, when there is one. */
  due?: string;
  /** The book pages. Same record the cards keep for attachments, so the Drive upload code is shared. */
  photos: CardFile[];
  items: Record<string, HomeworkItem>;
  /** True once he confirmed the transcribed questions. */
  confirmed?: boolean;
  /** Questions the reader proposed from the photos. They become real items only when he confirms them. */
  proposed?: { n: string; prompt: string }[];
  /** The reader's progress on this set: `requested` by the app, then `working`, then `ready` or `error`. */
  transcribe?: { status: 'requested' | 'working' | 'ready' | 'error'; message?: string; notes?: string; at?: string };
  createdAt: string;
  updatedAt: string;
  deleted?: boolean;
}

export const ITEM_KEY = /^[A-Za-z0-9_-]{1,12}$/;

export function newSetId(now: Date): string {
  return `hw${now.getTime().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

export function newSet(title: string, now: Date, due?: string): HomeworkSet {
  const t = now.toISOString();
  return { id: newSetId(now), title: title.trim() || 'Homework', ...(due ? { due } : {}), photos: [], items: {}, createdAt: t, updatedAt: t };
}

/** Add or replace a question. Returns the new set, or the same set when the key is not usable. */
export function putItem(set: HomeworkSet, n: string, prompt: string, now: Date): HomeworkSet {
  const key = n.trim();
  if (!ITEM_KEY.test(key)) return set;
  const old = set.items[key];
  const order = old?.order ?? Object.keys(set.items).length;
  const item: HomeworkItem = { ...(old ?? { answer: '', status: 'open' as ItemStatus }), n: key, order, prompt: prompt.trim(), updatedAt: now.toISOString() };
  return { ...set, items: { ...set.items, [key]: item }, updatedAt: item.updatedAt as string };
}

export const orderedItems = (set: HomeworkSet): HomeworkItem[] => Object.values(set.items).sort((a, b) => a.order - b.order);

/** His typing. Clears a hint or explanation that was written for an earlier answer. */
export function setAnswer(set: HomeworkSet, n: string, text: string, now: Date): HomeworkSet {
  const old = set.items[n];
  if (!old || old.answer === text) return set;
  const stale = old.checkedAnswer !== undefined && old.checkedAnswer !== text;
  const next: HomeworkItem = { ...old, answer: text, status: text.trim() ? 'answered' : 'open', updatedAt: now.toISOString() };
  if (stale) { delete next.hint; delete next.explain; delete next.checkedAnswer; }
  return { ...set, items: { ...set.items, [n]: next }, updatedAt: next.updatedAt as string };
}

export interface CheckResult { n: string; forAnswer: string; verdict: 'ok' | 'wrong' | 'hint'; hint?: string; explain?: string }

/** A checker result is applied only if his answer is still the one that was checked. Returns the same set when it is not. */
export function applyCheck(set: HomeworkSet, r: CheckResult, now: Date): HomeworkSet {
  const old = set.items[r.n];
  if (!old || old.answer !== r.forAnswer) return set;
  const next: HomeworkItem = { ...old, status: r.verdict, checkedAnswer: r.forAnswer, updatedAt: now.toISOString() };
  if (r.hint) next.hint = r.hint; else delete next.hint;
  if (r.explain) next.explain = r.explain; else delete next.explain;
  return { ...set, items: { ...set.items, [r.n]: next }, updatedAt: next.updatedAt as string };
}

export function addPhoto(set: HomeworkSet, file: CardFile, now: Date): HomeworkSet {
  if (set.photos.some((p) => p.id === file.id)) return set;
  return { ...set, photos: [...set.photos, file], updatedAt: now.toISOString() };
}

export interface Progress { total: number; answered: number; ok: number; open: number }
export function progress(set: HomeworkSet): Progress {
  const items = Object.values(set.items);
  return {
    total: items.length,
    answered: items.filter((i) => i.answer.trim() !== '').length,
    ok: items.filter((i) => i.status === 'ok').length,
    open: items.filter((i) => i.answer.trim() === '').length,
  };
}

/** Sets on screen: not deleted, soonest deadline first, then the most recently touched. */
export function sortSets(sets: HomeworkSet[]): HomeworkSet[] {
  return sets.filter((s) => !s.deleted).sort((a, b) => {
    const da = a.due ?? '9999';
    const db = b.due ?? '9999';
    return da === db ? (a.updatedAt < b.updatedAt ? 1 : -1) : da < db ? -1 : 1;
  });
}

/** Two copies of one set (phone and laptop): per question, the later edit wins; the set keeps both devices' photos. */
export function mergeSets(a: HomeworkSet, b: HomeworkSet): HomeworkSet {
  const items: Record<string, HomeworkItem> = {};
  for (const k of new Set([...Object.keys(a.items), ...Object.keys(b.items)])) {
    const x = a.items[k];
    const y = b.items[k];
    items[k] = !x ? (y as HomeworkItem) : !y ? x : (x.updatedAt ?? '') >= (y.updatedAt ?? '') ? x : y;
  }
  const photos = [...a.photos];
  for (const p of b.photos) if (!photos.some((q) => q.id === p.id)) photos.push(p);
  const base = a.updatedAt >= b.updatedAt ? a : b;
  return { ...base, photos, items };
}

/** Tidy a proposal he edited: usable numbers only, no duplicates, no empty text. */
export function cleanProposal(list: { n: string; prompt: string }[]): { n: string; prompt: string }[] {
  const seen = new Set<string>();
  const out: { n: string; prompt: string }[] = [];
  for (const q of list) {
    const n = q.n.trim().replace(/\.$/, '').replace(/\s+/g, '');
    const prompt = q.prompt.trim();
    if (!ITEM_KEY.test(n) || !prompt || seen.has(n)) continue;
    seen.add(n);
    out.push({ n, prompt });
  }
  return out;
}
