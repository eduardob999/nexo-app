import { collection, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import type { Card } from './types';
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
