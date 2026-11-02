import { collection, doc, documentId, increment, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import type { Card, Draft, Entry } from './types';
import { postpone, todayYmd } from './urgency';

const root = (uid: string) => ['users', uid] as const;

/**
 * The open cards, live. The first delivery comes from the local cache when
 * there is one, so the board renders before the network answers; Firestore
 * then reconciles in the background and only changed documents are billed.
 */
export function watchOpenCards(uid: string, onCards: (cards: Card[], fromCache: boolean) => void, onError: (e: Error) => void): () => void {
  const q = query(collection(db, ...root(uid), 'cards'), where('status', '==', 'open'));
  return onSnapshot(
    q,
    { includeMetadataChanges: true },
    (snap) => onCards(snap.docs.map((d) => ({ ...(d.data() as Omit<Card, 'id'>), id: d.id })), snap.metadata.fromCache),
    onError,
  );
}

/** A field-level write, so a second edit made a moment later cannot undo this one. */
export function markDone(uid: string, id: string): Promise<void> {
  return updateDoc(doc(db, ...root(uid), 'cards', id), { status: 'done', doneAt: new Date().toISOString() });
}

/** The "call Nexo" button: the listener on the loop's machine turns this write into a tick. */
export function callNexo(uid: string): Promise<void> {
  return setDoc(doc(db, ...root(uid), 'meta', 'wake'), { at: serverTimestamp() });
}

/** One day on. A field-level write, like Done. */
export function markLater(uid: string, card: Card): Promise<void> {
  return updateDoc(doc(db, ...root(uid), 'cards', card.id), { due: postpone(card.due, new Date()) });
}

/**
 * A new card, with its first entry, in one batch. Every card gets a date, so
 * one made without a date lands on today; the entry count and last entry are
 * written with it so a list never needs the entries subcollection.
 */
export function addCard(uid: string, text: string, forWho: 'you' | 'nexo'): Promise<void> {
  const now = new Date();
  const ts = now.toISOString();
  const id = `n${now.getTime().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const entry = { by: 'eduardo', text, ts };
  const batch = writeBatch(db);
  batch.set(doc(db, ...root(uid), 'cards', id), {
    status: 'open', for: forWho, type: 'TASK', title: text, due: todayYmd(now), ts,
    entryCount: 1, last: entry, hasEntries: true,
  });
  batch.set(doc(db, ...root(uid), 'cards', id, 'entries', String(now.getTime())), entry);
  return batch.commit();
}

/** A card's thread, oldest first. Entry ids sort chronologically (zero padded index, then epoch milliseconds). */
export function watchEntries(uid: string, cardId: string, onEntries: (e: Entry[]) => void, onError: (e: Error) => void): () => void {
  const q = query(collection(db, ...root(uid), 'cards', cardId, 'entries'), orderBy(documentId()));
  return onSnapshot(q, (snap) => onEntries(snap.docs.map((d) => ({ ...(d.data() as Omit<Entry, 'id'>), id: d.id }))), onError);
}

/**
 * His reply. The entry and the card's denormalised fields go in one batch;
 * the count uses increment so two appends cannot both write the same number.
 * `repliedAt` is what the loop looks for to know he has answered.
 */
export function addEntry(uid: string, cardId: string, text: string): Promise<void> {
  const now = new Date();
  const ts = now.toISOString();
  const entry = { by: 'eduardo', text, ts };
  const batch = writeBatch(db);
  batch.set(doc(db, ...root(uid), 'cards', cardId, 'entries', String(now.getTime())), entry);
  batch.update(doc(db, ...root(uid), 'cards', cardId), { entryCount: increment(1), last: entry, repliedAt: ts });
  return batch.commit();
}

/** Drafts that still need him. Sent and discarded ones stay in Firestore but leave this list. */
export function watchDrafts(uid: string, onDrafts: (d: Draft[]) => void, onError: (e: Error) => void): () => void {
  const q = query(collection(db, ...root(uid), 'drafts'), where('status', 'in', ['drafted', 'needs-info']));
  return onSnapshot(q, (snap) => onDrafts(snap.docs.map((d) => ({ ...(d.data() as Omit<Draft, 'id'>), id: d.id }))), onError);
}

const draftRef = (uid: string, id: string) => doc(db, ...root(uid), 'drafts', id);

/** Marks a draft copied. The draft stays until he says it was sent or drops it. */
export function markCopied(uid: string, id: string): Promise<void> {
  return updateDoc(draftRef(uid, id), { copiedAt: new Date().toISOString() });
}

/** He sent it himself, elsewhere. The app never sends mail. */
export function markSent(uid: string, id: string): Promise<void> {
  return updateDoc(draftRef(uid, id), { status: 'sent', sentAt: new Date().toISOString(), sentBy: 'eduardo', sentVia: 'elsewhere' });
}

export function discardDraft(uid: string, id: string): Promise<void> {
  return updateDoc(draftRef(uid, id), { status: 'discarded', discardedAt: new Date().toISOString() });
}
