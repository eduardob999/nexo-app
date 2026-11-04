import { collection, doc, documentId, increment, onSnapshot, orderBy, query, serverTimestamp, setDoc, where, writeBatch } from 'firebase/firestore';
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

/**
 * Every change he makes is two writes in one batch: the visible change on the card, so the screen
 * answers at once and offline, and an *intent* in `outbox`, which is what the sync service on the
 * loop's machine applies to state.json. The card change is only a preview; state.json decides.
 */
function intent(batch: ReturnType<typeof writeBatch>, uid: string, fields: Record<string, unknown>): void {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  batch.set(doc(db, ...root(uid), 'outbox', id), { ...fields, at: new Date().toISOString(), applied: false });
}

export function markDone(uid: string, id: string): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, ...root(uid), 'cards', id), { status: 'done', doneAt: new Date().toISOString() });
  intent(batch, uid, { type: 'done', cardId: id });
  return batch.commit();
}

/** The "call Nexo" button: the listener on the loop's machine turns this write into a tick. */
export function callNexo(uid: string): Promise<void> {
  return setDoc(doc(db, ...root(uid), 'meta', 'wake'), { at: serverTimestamp() });
}

/** One day on. */
export function markLater(uid: string, card: Card): Promise<void> {
  const due = postpone(card.due, new Date());
  const batch = writeBatch(db);
  batch.update(doc(db, ...root(uid), 'cards', card.id), { due });
  intent(batch, uid, { type: 'later', cardId: card.id, due });
  return batch.commit();
}

/**
 * A new card, with its first entry, in one batch. Every card gets a date, so
 * one made without a date lands on today; the entry count and last entry are
 * written with it so a list never needs the entries subcollection.
 */
export function addCard(uid: string, text: string, forWho: 'you' | 'nexo', due?: string | null): Promise<void> {
  const now = new Date();
  const ts = now.toISOString();
  const id = `n${now.getTime().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const entryId = String(now.getTime());
  const entry = { by: 'eduardo', text, ts };
  const when = due ?? todayYmd(now);
  const batch = writeBatch(db);
  batch.set(doc(db, ...root(uid), 'cards', id), {
    status: 'open', for: forWho, type: 'TASK', title: text, due: when, ts,
    entryCount: 1, last: entry, hasEntries: true,
  });
  batch.set(doc(db, ...root(uid), 'cards', id, 'entries', entryId), entry);
  intent(batch, uid, { type: 'add', cardId: id, text, for: forWho, due: when, ts, entryId });
  return batch.commit();
}

/** A card's thread, oldest first. Entry ids sort chronologically (zero padded index, then epoch milliseconds). */
export function watchEntries(uid: string, cardId: string, onEntries: (e: Entry[]) => void, onError: (e: Error) => void): () => void {
  const q = query(collection(db, ...root(uid), 'cards', cardId, 'entries'), orderBy(documentId()));
  const when = (e: Entry) => { const t = Date.parse(e.ts); return Number.isNaN(t) ? 0 : t; };
  return onSnapshot(q, (snap) => {
    // Ids sort by position for old entries and by time for new ones, so order by the entry's own time.
    const all = snap.docs.map((d) => ({ ...(d.data() as Omit<Entry, 'id'>), id: d.id }));
    onEntries(all.sort((a, b) => when(a) - when(b) || a.id.localeCompare(b.id)));
  }, onError);
}

/**
 * His reply. The entry, the card's preview fields and the intent go in one batch. The count uses
 * increment so two appends cannot write the same number. A reply on a card that was his hands it
 * to Nexo, as the old board does, so it leaves his queue straight away.
 */
export function addEntry(uid: string, card: Card, text: string): Promise<void> {
  const now = new Date();
  const ts = now.toISOString();
  const entryId = String(now.getTime());
  const entry = { by: 'eduardo', text, ts };
  const batch = writeBatch(db);
  batch.set(doc(db, ...root(uid), 'cards', card.id, 'entries', entryId), entry);
  batch.update(doc(db, ...root(uid), 'cards', card.id), {
    entryCount: increment(1), last: entry, ...(card.for === 'you' && card.status !== 'done' ? { for: 'nexo' } : {}),
  });
  intent(batch, uid, { type: 'reply', cardId: card.id, text, ts, entryId });
  return batch.commit();
}

/** Drafts that still need him. Sent and discarded ones stay in Firestore but leave this list. */
export function watchDrafts(uid: string, onDrafts: (d: Draft[]) => void, onError: (e: Error) => void): () => void {
  const q = query(collection(db, ...root(uid), 'drafts'), where('status', 'in', ['drafted', 'needs-info']));
  return onSnapshot(q, (snap) => onDrafts(snap.docs.map((d) => ({ ...(d.data() as Omit<Draft, 'id'>), id: d.id }))), onError);
}

const draftRef = (uid: string, id: string) => doc(db, ...root(uid), 'drafts', id);

function draftAction(uid: string, id: string, action: 'copied' | 'sent' | 'discarded', fields: Record<string, unknown>): Promise<void> {
  const batch = writeBatch(db);
  batch.update(draftRef(uid, id), fields);
  intent(batch, uid, { type: 'draft', draftId: id, action });
  return batch.commit();
}

/** Marks a draft copied. The draft stays until he says it was sent or drops it. */
export function markCopied(uid: string, id: string): Promise<void> {
  return draftAction(uid, id, 'copied', { copiedAt: new Date().toISOString() });
}

/** He sent it himself, elsewhere. The app never sends mail. */
export function markSent(uid: string, id: string): Promise<void> {
  return draftAction(uid, id, 'sent', { status: 'sent', sentAt: new Date().toISOString(), sentBy: 'eduardo', sentVia: 'elsewhere' });
}

export function discardDraft(uid: string, id: string): Promise<void> {
  return draftAction(uid, id, 'discarded', { status: 'discarded', discardedAt: new Date().toISOString() });
}

/** When the sync service last completed a cycle, or null if it never has. */
export function watchSync(uid: string, onTime: (ms: number | null) => void): () => void {
  return onSnapshot(doc(db, ...root(uid), 'meta', 'sync'), (snap) => {
    const t = snap.exists() ? Date.parse(String((snap.data() as { lastCycleAt?: string }).lastCycleAt ?? '')) : NaN;
    onTime(Number.isNaN(t) ? null : t);
  }, () => onTime(null));
}
