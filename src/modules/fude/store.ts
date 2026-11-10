/**
 * Firestore side of the homework sets: `users/{uid}/homework/{setId}`. The rules already cover it (the
 * ownership wildcard under users/{uid}), so no rule change is needed. The app and the checker service both
 * read and write here; the sync and state.json know nothing about it.
 */
import { collection, deleteField, doc, FieldPath, limit, onSnapshot, orderBy, query, setDoc, updateDoc, arrayUnion, where, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import { setAnswer, putItem, type ChatMsg, type ExportRec, type HomeworkItem, type HomeworkSet, type Question } from './model';
import type { DocMode, FudeDoc, Note, SelectionRequest } from './documents';
import type { CardFile } from '../../types';

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

/**
 * A photo added to the set: the Drive record on the set (arrayUnion keeps both devices' photos when they add at the
 * same time) and the small picture in `files/{id}`, the same split the cards use so the set document stays small.
 */
export function savePhoto(uid: string, setId: string, file: CardFile, thumb: string | undefined, now: Date): Promise<void> {
  const batch = writeBatch(db);
  batch.update(ref(uid, setId), { photos: arrayUnion(file), updatedAt: now.toISOString() });
  if (thumb) batch.set(doc(ref(uid, setId), 'files', file.id), { thumb });
  return batch.commit();
}

/** The small pictures of a set's photos, by file id. */
export function watchThumbs(uid: string, setId: string, on: (thumbs: Record<string, string>) => void): () => void {
  return onSnapshot(collection(ref(uid, setId), 'files'), (snap) => {
    const out: Record<string, string> = {};
    for (const d of snap.docs) { const t = (d.data() as { thumb?: string }).thumb; if (t) out[d.id] = t; }
    on(out);
  }, () => on({}));
}

/** The confirmed questions, written one field path per question so nothing else in the set is touched. */
export function saveItems(uid: string, set: HomeworkSet, questions: Question[], now: Date): Promise<void> {
  let next = set;
  for (const q of questions) next = putItem(next, q.n, q.prompt, now, { type: q.type, options: q.options });
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

/** Ask the reader on the loop's machine to propose the questions from the photos. */
export function requestTranscription(uid: string, setId: string, now: Date): Promise<void> {
  return updateDoc(ref(uid, setId), { transcribe: { status: 'requested', at: now.toISOString() }, proposed: deleteField() });
}

/** He confirmed (possibly edited) the proposal: the questions become items and the proposal goes away. */
export async function confirmProposal(uid: string, set: HomeworkSet, questions: Question[], now: Date): Promise<void> {
  if (questions.length === 0) return;
  await saveItems(uid, set, questions, now);
  await updateDoc(ref(uid, set.id), { proposed: deleteField(), transcribe: deleteField() });
}

export function dismissProposal(uid: string, setId: string): Promise<void> {
  return updateDoc(ref(uid, setId), { proposed: deleteField(), transcribe: deleteField() });
}

// ---- whole-text documents: users/{uid}/documents/{id} --------------------------------------------------------
const dcol = (uid: string) => collection(db, 'users', uid, 'documents');
const dref = (uid: string, id: string) => doc(db, 'users', uid, 'documents', id);

export function watchDocuments(uid: string, on: (docs: FudeDoc[]) => void, onError: (e: Error) => void): () => void {
  return onSnapshot(dcol(uid), (snap) => on(snap.docs.map((d) => ({ ...(d.data() as Omit<FudeDoc, 'id'>), id: d.id }))), onError);
}

export function createDocument(uid: string, d: FudeDoc): Promise<void> {
  return setDoc(dref(uid, d.id), d);
}

/** His text, saved. One field only, so a title edit on another device is not overwritten. */
export function saveDocText(uid: string, id: string, text: string, now: Date): Promise<void> {
  return updateDoc(dref(uid, id), { text, updatedAt: now.toISOString() });
}

/** Switch a document between Plain and Suggestions. Its own field, so the text is not touched. */
export function setDocMode(uid: string, id: string, mode: DocMode, now: Date): Promise<void> {
  return updateDoc(dref(uid, id), { mode, updatedAt: now.toISOString() });
}

/** Ask the reviewer to proofread the document. The profile travels with the request, so the app stays the one place that defines it. */
export function requestReview(uid: string, id: string, profile: unknown, now: Date, auto = false): Promise<void> {
  return updateDoc(dref(uid, id), { review: { status: 'requested', profile, at: now.toISOString(), ...(auto ? { auto: true } : {}) } });
}

/** Ask about one selected passage: a rewrite proposal or an answer to a question. The words travel with the request, so a later edit makes the result stale instead of wrong. */
export function requestSelection(uid: string, id: string, mode: SelectionRequest['mode'], text: string, question: string, profile: unknown): Promise<void> {
  return updateDoc(dref(uid, id), { selectionRequest: { status: 'requested', mode, text, ...(question ? { question } : {}), profile } });
}

export function clearSelection(uid: string, id: string): Promise<void> {
  return updateDoc(dref(uid, id), { selectionRequest: deleteField() });
}

export function watchNotes(uid: string, id: string, on: (notes: Note[]) => void): () => void {
  return onSnapshot(collection(dref(uid, id), 'notes'), (snap) => on(snap.docs.map((d) => ({ ...(d.data() as Omit<Note, 'id'>), id: d.id }))), () => on([]));
}

export function setNoteStatus(uid: string, docId: string, noteId: string, status: Note['status']): Promise<void> {
  return updateDoc(doc(collection(dref(uid, docId), 'notes'), noteId), { status });
}

/** Ask the checker for a hint or an explanation of one answer. The answer travels with the request, so a later edit makes the result stale instead of wrong. */
export function requestCheck(uid: string, setId: string, item: HomeworkItem, mode: 'hint' | 'explain'): Promise<void> {
  return updateDoc(ref(uid, setId), { checkRequest: { status: 'requested', n: item.n, mode, forAnswer: item.answer } });
}

export function saveContext(uid: string, setId: string, text: string): Promise<void> {
  return updateDoc(ref(uid, setId), { context: text });
}

// ---- links to Nexo cards and drafts ------------------------------------------------------------------------
/** The set and document started from this card, live. Both lists are usually empty or one long. */
export function watchLinked(uid: string, cardId: string, on: (found: { sets: HomeworkSet[]; docs: FudeDoc[] }) => void): () => void {
  let sets: HomeworkSet[] = [];
  let docs: FudeDoc[] = [];
  const push = () => on({ sets, docs });
  const a = onSnapshot(query(col(uid), where('cardId', '==', cardId)), (snap) => { sets = snap.docs.map((d) => ({ ...(d.data() as Omit<HomeworkSet, 'id'>), id: d.id })); push(); }, () => {});
  const b = onSnapshot(query(dcol(uid), where('cardId', '==', cardId)), (snap) => { docs = snap.docs.map((d) => ({ ...(d.data() as Omit<FudeDoc, 'id'>), id: d.id })); push(); }, () => {});
  return () => { a(); b(); };
}

// ---- the chat: users/{uid}/homework/{set}/chat/{id} -------------------------------------------------------------
export function watchChat(uid: string, setId: string, on: (msgs: ChatMsg[]) => void): () => void {
  return onSnapshot(collection(ref(uid, setId), 'chat'), (snap) => {
    on(snap.docs.map((d) => ({ ...(d.data() as Omit<ChatMsg, 'id'>), id: d.id })).sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0)));
  }, () => on([]));
}

/** His message, and the request the helper answers. One batch, so the helper never sees a request without the message. */
export function sendChat(uid: string, setId: string, text: string, n: string | undefined, deep: boolean, now: Date): Promise<void> {
  const batch = writeBatch(db);
  const msg: Omit<ChatMsg, 'id'> = { by: 'you', text: text.trim(), ts: now.toISOString(), ...(n ? { n } : {}), ...(deep ? { deep: true } : {}) };
  batch.set(doc(collection(ref(uid, setId), 'chat'), String(now.getTime())), msg);
  batch.update(ref(uid, setId), { chatRequest: { status: 'requested' } });
  return batch.commit();
}

// ---- exports: users/{uid}/homework/{set}/exports/{id} ------------------------------------------------------------
export function watchExports(uid: string, setId: string, on: (x: ExportRec[]) => void): () => void {
  return onSnapshot(query(collection(ref(uid, setId), 'exports'), orderBy('at', 'desc'), limit(3)),
    (snap) => on(snap.docs.map((d) => ({ ...(d.data() as Omit<ExportRec, 'id'>), id: d.id }))), () => on([]));
}

/** Ask the helper to lay the answers out as a document. `exportId` makes it a revision of that export. */
export function requestExport(uid: string, setId: string, format: 'pdf' | 'docx' | 'md', instructions: string, exportId?: string): Promise<void> {
  return updateDoc(ref(uid, setId), { exportRequest: { status: 'requested', mode: exportId ? 'revise' : 'create', format, instructions: instructions.trim(), ...(exportId ? { exportId } : {}) } });
}
