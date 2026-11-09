/**
 * Firestore side of the homework sets: `users/{uid}/homework/{setId}`. The rules already cover it (the
 * ownership wildcard under users/{uid}), so no rule change is needed. The app and the checker service both
 * read and write here; the sync and state.json know nothing about it.
 */
import { collection, deleteField, doc, FieldPath, onSnapshot, setDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from './firebase';
import { setAnswer, putItem, type HomeworkItem, type HomeworkSet } from './homework';
import type { CardFile } from './types';

const col = (uid: string) => collection(db, 'users', uid, 'homework');
const ref = (uid: string, id: string) => doc(db, 'users', uid, 'homework', id);

export function watchHomework(uid: string, on: (sets: HomeworkSet[]) => void, onError: (e: Error) => void): () => void {
  return onSnapshot(col(uid), (snap) => on(snap.docs.map((d) => ({ ...(d.data() as Omit<HomeworkSet, 'id'>), id: d.id }))), onError);
}

export function watchSet(uid: string, id: string, on: (s: HomeworkSet | null) => void): () => void {
  return onSnapshot(ref(uid, id), (snap) => on(snap.exists() ? ({ ...(snap.data() as Omit<HomeworkSet, 'id'>), id: snap.id }) : null), () => on(null));
}

export function createSet(uid: string, set: HomeworkSet): Promise<void> {
  return setDoc(ref(uid, set.id), set);
}

/** A photo added to the set. arrayUnion keeps both devices' photos when they add at the same time. */
export function savePhoto(uid: string, setId: string, file: CardFile, now: Date): Promise<void> {
  return updateDoc(ref(uid, setId), { photos: arrayUnion(file), updatedAt: now.toISOString() });
}

/** The confirmed questions, written one field path per question so nothing else in the set is touched. */
export function saveItems(uid: string, set: HomeworkSet, questions: { n: string; prompt: string }[], now: Date): Promise<void> {
  let next = set;
  for (const q of questions) next = putItem(next, q.n, q.prompt, now);
  const args: unknown[] = [];
  for (const q of questions) {
    const it = next.items[q.n.trim()];
    if (it) args.push(new FieldPath('items', it.n), it);
  }
  args.push('confirmed', true, 'updatedAt', now.toISOString());
  const [f, v, ...rest] = args as [FieldPath, unknown, ...unknown[]];
  return updateDoc(ref(uid, set.id), f, v, ...rest);
}

/**
 * His typing, saved. Only this question's fields are written, so the other device's edit to another question
 * survives. A hint or explanation written for an earlier answer is removed in the same write.
 */
export function saveAnswer(uid: string, setId: string, item: HomeworkItem, text: string, now: Date): Promise<void> {
  const probe = { id: setId, title: '', photos: [], items: { [item.n]: item }, createdAt: '', updatedAt: '' } as HomeworkSet;
  const next = setAnswer(probe, item.n, text, now).items[item.n];
  if (!next || next === item) return Promise.resolve();
  const p = (field: string) => new FieldPath('items', item.n, field);
  const pairs: unknown[] = [p('answer'), next.answer, p('status'), next.status, p('updatedAt'), next.updatedAt, new FieldPath('updatedAt'), next.updatedAt];
  for (const f of ['hint', 'explain', 'checkedAnswer'] as const) if (item[f] !== undefined && next[f] === undefined) pairs.push(p(f), deleteField());
  const [a, b, ...rest] = pairs as [FieldPath, unknown, ...unknown[]];
  return updateDoc(ref(uid, setId), a, b, ...rest);
}
