import { collection, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { db } from './firebase';
import type { Card } from './types';

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
