import { arrayUnion, collection, doc, documentId, increment, onSnapshot, orderBy, query, serverTimestamp, setDoc, where, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import type { Alloc, Market, Receipt, Card, CardFile, Draft, Entry, NexoStatus, Memo, Relay, Resource, TodayInfo } from './types';
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
/**
 * Join open cards into one. Nothing is removed: the sources are marked done and point at the new card, which
 * shows at once with the first card's title and the earliest date; the sync fills in the merged thread.
 */
export function joinCards(uid: string, cards: Card[]): Promise<string> {
  const ids = cards.map((c) => c.id);
  const newId = `nj${Date.now().toString(36)}`;
  const at = new Date().toISOString();
  const dues = cards.map((c) => c.due).filter((d): d is string => !!d).sort();
  const first = cards[0];
  const batch = writeBatch(db);
  const merged: Record<string, unknown> = { id: newId, status: 'open', for: cards.some((c) => c.for === 'you') ? 'you' : 'nexo', title: first?.title ?? newId, prio: first?.prio ?? 'normal', mergedFrom: ids, ts: at };
  if (dues[0]) merged.due = dues[0];
  if (first?.type) merged.type = first.type;
  if (first?.place) merged.place = first.place;
  batch.set(doc(db, ...root(uid), 'cards', newId), merged);
  for (const id of ids) batch.update(doc(db, ...root(uid), 'cards', id), { status: 'done', doneAt: at, mergedInto: newId });
  intent(batch, uid, { type: 'join', ids, newId, at });
  return batch.commit().then(() => newId);
}

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
export function addCard(uid: string, text: string, forWho: 'you' | 'nexo', due?: string | null, prio: 'high' | 'normal' | 'low' = 'normal'): Promise<void> {
  const now = new Date();
  const ts = now.toISOString();
  const id = `n${now.getTime().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const entryId = String(now.getTime());
  const entry = { by: 'eduardo', text, ts };
  const when = due ?? todayYmd(now);
  const batch = writeBatch(db);
  batch.set(doc(db, ...root(uid), 'cards', id), {
    status: 'open', for: forWho, type: 'TASK', title: text, due: when, ts, prio,
    entryCount: 1, last: entry, hasEntries: true,
  });
  batch.set(doc(db, ...root(uid), 'cards', id, 'entries', entryId), entry);
  intent(batch, uid, { type: 'add', cardId: id, text, for: forWho, due: when, ts, entryId, prio });
  return batch.commit();
}

/** The pictures attached to a card, read from its files subcollection (the card document holds only their names). */
export function watchFiles(uid: string, cardId: string, onFiles: (f: CardFile[]) => void, onError: (e: Error) => void): () => void {
  return onSnapshot(collection(db, ...root(uid), 'cards', cardId, 'files'), (snap) => {
    onFiles(snap.docs.map((d) => ({ ...(d.data() as Omit<CardFile, 'id'>), id: d.id })));
  }, onError);
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

/** Drafts that still need him, plus sent ones so the tab can confirm a send. Discarded ones leave. */
export function watchDrafts(uid: string, onDrafts: (d: Draft[]) => void, onError: (e: Error) => void): () => void {
  const q = query(collection(db, ...root(uid), 'drafts'), where('status', 'in', ['drafted', 'needs-info', 'sent']));
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

/** He rewrote the draft himself. The text Copy and Send use is now his. */
export function editDraft(uid: string, draft: Draft, text: string): Promise<void> {
  const batch = writeBatch(db);
  batch.update(draftRef(uid, draft.id), { text, editedAt: new Date().toISOString(), editedBy: 'eduardo', ...(draft.status === 'needs-info' ? { status: 'drafted' } : {}) });
  intent(batch, uid, { type: 'draft', action: 'edit', draftId: draft.id, text });
  return batch.commit();
}

/** He tells Nexo what to change; Nexo rewrites it. Edit and Send stay hidden until the new text lands. */
export function reviseDraft(uid: string, draft: Draft, instruction: string): Promise<void> {
  const at = new Date().toISOString();
  const batch = writeBatch(db);
  batch.update(draftRef(uid, draft.id), { revise: { text: instruction, at, by: 'eduardo' } });
  intent(batch, uid, { type: 'draft', action: 'revise', draftId: draft.id, text: instruction, entryId: String(Date.now()) });
  return batch.commit();
}

/** He supplies the missing detail on a needs-info draft; Nexo redrafts with it. */
export function answerDraft(uid: string, draft: Draft, detail: string): Promise<void> {
  const batch = writeBatch(db);
  batch.update(draftRef(uid, draft.id), { answer: detail, answeredAt: new Date().toISOString() });
  intent(batch, uid, { type: 'draft', action: 'answer', draftId: draft.id, text: detail, entryId: String(Date.now()) });
  return batch.commit();
}

/**
 * He pressed Send. This is the explicit act the sending policy asks for, for exactly this text. The
 * app sends nothing itself: the loop does, from state.json, and only if the draft is still the one he saw.
 */
export function requestSend(uid: string, draft: Draft): Promise<void> {
  const batch = writeBatch(db);
  batch.update(draftRef(uid, draft.id), { sendRequestedAt: new Date().toISOString() });
  intent(batch, uid, { type: 'draft', draftId: draft.id, action: 'send', text: draft.text ?? '' });
  return batch.commit();
}

/** When the sync service last completed a cycle, or null if it never has. */
export function watchSync(uid: string, onTime: (ms: number | null) => void): () => void {
  return onSnapshot(doc(db, ...root(uid), 'meta', 'sync'), (snap) => {
    const t = snap.exists() ? Date.parse(String((snap.data() as { lastCycleAt?: string }).lastCycleAt ?? '')) : NaN;
    onTime(Number.isNaN(t) ? null : t);
  }, () => onTime(null));
}

/** What Nexo is doing right now: idle, called and waiting, or working through cards. */
export function watchNexo(uid: string, onStatus: (s: NexoStatus | null) => void): () => void {
  return onSnapshot(doc(db, ...root(uid), 'meta', 'nexo'), (snap) => onStatus(snap.exists() ? (snap.data() as NexoStatus) : null), () => onStatus(null));
}

/** Prompts waiting for him to take to another model and bring back. */
export function watchRelays(uid: string, onRelays: (r: Relay[]) => void, onError: (e: Error) => void): () => void {
  const q = query(collection(db, ...root(uid), 'relays'), where('status', '==', 'open'));
  return onSnapshot(q, (snap) => onRelays(snap.docs.map((d) => ({ ...(d.data() as Omit<Relay, 'id'>), id: d.id }))), onError);
}

export function answerRelay(uid: string, relay: Relay, text: string): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, ...root(uid), 'relays', relay.id), { response: text, status: 'answered', answeredAt: new Date().toISOString() });
  intent(batch, uid, { type: 'relay', action: 'answer', relayId: relay.id, text });
  return batch.commit();
}

export function closeRelay(uid: string, relay: Relay): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, ...root(uid), 'relays', relay.id), { status: 'closed' });
  intent(batch, uid, { type: 'relay', action: 'close', relayId: relay.id });
  return batch.commit();
}

/** The info strip's data, which board/today_strip.py writes and the sync copies to `meta/today`. */
export function watchTodayInfo(uid: string, onInfo: (t: TodayInfo | null) => void): () => void {
  return onSnapshot(doc(db, ...root(uid), 'meta', 'today'), (snap) => {
    const v = snap.exists() ? (snap.data() as { value?: TodayInfo }).value : null;
    onInfo(v ?? null);
  }, () => onInfo(null));
}

/** Pause Nexo until a time, or wake it (null). While it sleeps it makes no model calls, so it costs nothing. */
export function setSleep(uid: string, until: Date | null): Promise<void> {
  const batch = writeBatch(db);
  intent(batch, uid, { type: 'sleep', until: until ? until.toISOString() : null });
  return batch.commit();
}

/** "Check my mail now": the next tick runs the normal mail check, drafting only, instead of waiting for its slot. */
export function requestMailCheck(uid: string): Promise<void> {
  const batch = writeBatch(db);
  intent(batch, uid, { type: 'mailcheck' });
  return batch.commit();
}

/** Cards he has finished. Read only while the Shelf is open: a few hundred documents, cached after the first time. */
export function watchDoneCards(uid: string, onCards: (c: Card[]) => void, onError: (e: Error) => void): () => void {
  const q = query(collection(db, ...root(uid), 'cards'), where('status', '==', 'done'));
  return onSnapshot(q, (snap) => onCards(snap.docs.map((d) => ({ ...(d.data() as Omit<Card, 'id'>), id: d.id }))), onError);
}

export function watchClosedRelays(uid: string, onRelays: (r: Relay[]) => void, onError: (e: Error) => void): () => void {
  const q = query(collection(db, ...root(uid), 'relays'), where('status', 'in', ['filed', 'closed']));
  return onSnapshot(q, (snap) => onRelays(snap.docs.map((d) => ({ ...(d.data() as Omit<Relay, 'id'>), id: d.id }))), onError);
}

export function watchResources(uid: string, onItems: (r: Resource[]) => void, onError: (e: Error) => void): () => void {
  return onSnapshot(collection(db, ...root(uid), 'resources'), (snap) => onItems(snap.docs.map((d) => ({ ...(d.data() as Omit<Resource, 'id'>), id: d.id }))), onError);
}

export function addResource(uid: string, r: { title: string; url: string; note: string; kind: string }): Promise<void> {
  const id = `res-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const batch = writeBatch(db);
  batch.set(doc(db, ...root(uid), 'resources', id), { id, ...r, ts: new Date().toISOString() });
  intent(batch, uid, { type: 'resource', action: 'add', resourceId: id, ...r });
  return batch.commit();
}

/** Resources are archived and restored, never deleted. */
export function archiveResource(uid: string, r: Resource, archived: boolean): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, ...root(uid), 'resources', r.id), { archived });
  intent(batch, uid, { type: 'resource', action: archived ? 'archive' : 'restore', resourceId: r.id });
  return batch.commit();
}

export function watchMemos(uid: string, onItems: (m: Memo[]) => void, onError: (e: Error) => void): () => void {
  return onSnapshot(collection(db, ...root(uid), 'memos'), (snap) => onItems(snap.docs.map((d) => ({ ...(d.data() as Omit<Memo, 'id'>), id: d.id }))), onError);
}

/** Keep a thought. Tags are set by hand now: the old board asked a model on the page to tag it, which the page can no longer do. */
export function addMemo(uid: string, text: string, tags: string[]): Promise<void> {
  const id = `m-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const batch = writeBatch(db);
  batch.set(doc(db, ...root(uid), 'memos', id), { id, text, tags, ts: new Date().toISOString() });
  intent(batch, uid, { type: 'memo', action: 'add', memoId: id, text, tags });
  return batch.commit();
}

export function watchAllocations(uid: string, onItems: (a: Alloc[]) => void, onError: (e: Error) => void): () => void {
  return onSnapshot(collection(db, ...root(uid), 'allocations'), (snap) => onItems(snap.docs.map((d) => ({ ...(d.data() as Omit<Alloc, 'id'>), id: d.id }))), onError);
}

const allocRef = (uid: string, id: string) => doc(db, ...root(uid), 'allocations', id);

export function addAlloc(uid: string, a: { label: string; amount: number; tag: string; month: string }): Promise<void> {
  const id = `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const batch = writeBatch(db);
  batch.set(allocRef(uid, id), { id, label: a.label, amount: a.amount, done: false, recurring: true, month: a.month, ts: new Date().toISOString(), ...(a.tag ? { tag: a.tag } : {}) });
  intent(batch, uid, { type: 'alloc', action: 'add', allocId: id, ...a });
  return batch.commit();
}

export function toggleAlloc(uid: string, a: Alloc): Promise<void> {
  const batch = writeBatch(db);
  batch.update(allocRef(uid, a.id), { done: !a.done });
  intent(batch, uid, { type: 'alloc', action: 'toggle', allocId: a.id, done: !a.done });
  return batch.commit();
}

export function editAlloc(uid: string, a: Alloc, change: { label?: string; amount?: number; tag?: string }): Promise<void> {
  const batch = writeBatch(db);
  batch.update(allocRef(uid, a.id), { ...change, editedAt: new Date().toISOString() });
  intent(batch, uid, { type: 'alloc', action: 'edit', allocId: a.id, ...change });
  return batch.commit();
}

export function repeatAlloc(uid: string, a: Alloc): Promise<void> {
  const next = a.recurring === false;
  const batch = writeBatch(db);
  batch.update(allocRef(uid, a.id), { recurring: next });
  intent(batch, uid, { type: 'alloc', action: 'repeat', allocId: a.id, recurring: next });
  return batch.commit();
}

/** The first time the Money tab opens in a month with no lines, ask for the month to be seeded from the last one. */
export function seedAllocMonth(uid: string, month: string): Promise<void> {
  const batch = writeBatch(db);
  intent(batch, uid, { type: 'alloc', action: 'seed', month });
  return batch.commit();
}

/** The market list and its log live in one document, `meta/market`, under `value`. */
export function watchMarket(uid: string, onMarket: (m: Market | null) => void): () => void {
  return onSnapshot(doc(db, ...root(uid), 'meta', 'market'), (snap) => onMarket(snap.exists() ? ((snap.data() as { value?: Market }).value ?? null) : null), () => onMarket(null));
}

export function watchReceipts(uid: string, onItems: (r: Receipt[]) => void, onError: (e: Error) => void): () => void {
  return onSnapshot(collection(db, ...root(uid), 'receipts'), (snap) => onItems(snap.docs.map((d) => ({ ...(d.data() as Omit<Receipt, 'id'>), id: d.id }))), onError);
}

const rid = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/** One tap logs a purchase. The preview goes into the document's own log; the sync writes the real one. */
export function logPurchase(uid: string, item: { id: string; name: string }): Promise<void> {
  const id = rid('ml');
  const batch = writeBatch(db);
  batch.update(doc(db, ...root(uid), 'meta', 'market'), { 'value.log': arrayUnion({ id, itemId: item.id, name: item.name, ts: new Date().toISOString(), price: null }) });
  intent(batch, uid, { type: 'market', action: 'log', logId: id, itemId: item.id, name: item.name });
  return batch.commit();
}

export function addMarketItem(uid: string, name: string): Promise<void> {
  const id = rid('mi');
  const batch = writeBatch(db);
  batch.update(doc(db, ...root(uid), 'meta', 'market'), { 'value.items': arrayUnion({ id, name }) });
  intent(batch, uid, { type: 'market', action: 'item', itemId: id, name });
  return batch.commit();
}

export function addReceipt(uid: string, r: { amount: number; cat: string; vendor: string }): Promise<void> {
  const id = rid('r');
  const batch = writeBatch(db);
  batch.set(doc(db, ...root(uid), 'receipts', id), { id, ...r, ts: new Date().toISOString() });
  intent(batch, uid, { type: 'receipt', action: 'add', receiptId: id, ...r });
  return batch.commit();
}

/** Tick one line of a card's "Bring" or "Steps" list. A fully ticked list never closes the card. */
export function tickBring(uid: string, card: Card, index: number, got: boolean): Promise<void> {
  const bring = (card.bring ?? []).map((b, i) => (i === index ? { ...b, got } : b));
  const batch = writeBatch(db);
  batch.update(doc(db, ...root(uid), 'cards', card.id), { bring });
  intent(batch, uid, { type: 'checklist', action: 'bring', cardId: card.id, index, got });
  return batch.commit();
}

export function tickItem(uid: string, card: Card, itemId: string, done: boolean): Promise<void> {
  const items = (card.items ?? []).map((x) => (x.id === itemId ? { ...x, done } : x));
  const batch = writeBatch(db);
  batch.update(doc(db, ...root(uid), 'cards', card.id), { items });
  intent(batch, uid, { type: 'checklist', action: 'item-toggle', cardId: card.id, itemId, done });
  return batch.commit();
}

export function addItem(uid: string, card: Card, text: string): Promise<void> {
  const itemId = `it${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const items = [...(card.items ?? []), { id: itemId, text, done: false }];
  const batch = writeBatch(db);
  batch.update(doc(db, ...root(uid), 'cards', card.id), { items });
  intent(batch, uid, { type: 'checklist', action: 'item-add', cardId: card.id, itemId, text });
  return batch.commit();
}

const NEXT_PRIO: Record<string, 'high' | 'normal' | 'low'> = { high: 'normal', normal: 'low', low: 'high', med: 'low' };

/** Cycle Now, Soon, Whenever. */
export function cyclePriority(uid: string, card: Card): Promise<void> {
  const next = NEXT_PRIO[card.prio ?? 'normal'] ?? 'high';
  const batch = writeBatch(db);
  batch.update(doc(db, ...root(uid), 'cards', card.id), { prio: next });
  intent(batch, uid, { type: 'priority', cardId: card.id, prio: next });
  return batch.commit();
}
