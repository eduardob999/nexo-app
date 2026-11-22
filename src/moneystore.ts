import { collection, deleteField, doc, onSnapshot, query, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { fromShare, seedLines } from './money';
import type { Alloc, Market, Receipt } from './types';

const allocRef = (uid: string, id: string) => doc(db, 'users', uid, 'allocations', id);
const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/**
 * His request, 2026-11-22: "dismiss 'cantina' for this month, ideally ... either for a month or permanently." The line changes
 * here at once and an intent goes to the outbox, as every Money write does (cards.ts), so state.json keeps the dismissal
 * (sync_core.py `_alloc` 'dismiss'). 'forever' also stops the line repeating.
 */
export function dismissAlloc(uid: string, a: Alloc, scope: 'month' | 'forever'): Promise<void> {
  const batch = writeBatch(db);
  const repeat = scope === 'forever' && a.recurring !== false;
  batch.update(allocRef(uid, a.id), { dismissed: scope, ...(scope === 'forever' ? { recurring: false } : {}), ...(repeat ? { dismissedRepeat: true } : {}) });
  batch.set(doc(db, 'users', uid, 'outbox', newId()), { type: 'alloc', action: 'dismiss', allocId: a.id, scope, at: new Date().toISOString(), applied: false });
  return batch.commit();
}

export function restoreAlloc(uid: string, a: Alloc): Promise<void> {
  const batch = writeBatch(db);
  batch.update(allocRef(uid, a.id), { dismissed: deleteField(), dismissedRepeat: deleteField(), ...(a.dismissedRepeat ? { recurring: true } : {}) });
  batch.set(doc(db, 'users', uid, 'outbox', newId()), { type: 'alloc', action: 'restore', allocId: a.id, at: new Date().toISOString(), applied: false });
  return batch.commit();
}

/**
 * A household member's own set-aside list, in her own users/{uid}/allocations (the rules already give each person their own area).
 * No sync service reads her outbox, so these write the line directly and nothing else, and a new month is seeded here.
 */
export const guestMoney = {
  add: (uid: string, a: { label: string; amount: number; tag: string; month: string }) => {
    const id = newId();
    return setDoc(allocRef(uid, id), { id, label: a.label, amount: a.amount, done: false, recurring: true, month: a.month, ts: new Date().toISOString(), ...(a.tag ? { tag: a.tag } : {}) });
  },
  toggle: (uid: string, a: Alloc) => updateDoc(allocRef(uid, a.id), { done: !a.done }),
  edit: (uid: string, a: Alloc, change: { label?: string; amount?: number; tag?: string }) => updateDoc(allocRef(uid, a.id), { ...change, editedAt: new Date().toISOString() }),
  repeat: (uid: string, a: Alloc) => updateDoc(allocRef(uid, a.id), { recurring: a.recurring === false }),
  dismiss: (uid: string, a: Alloc, scope: 'month' | 'forever') => {
    const repeat = scope === 'forever' && a.recurring !== false;
    return updateDoc(allocRef(uid, a.id), { dismissed: scope, ...(scope === 'forever' ? { recurring: false } : {}), ...(repeat ? { dismissedRepeat: true } : {}) });
  },
  restore: (uid: string, a: Alloc) => updateDoc(allocRef(uid, a.id), { dismissed: deleteField(), dismissedRepeat: deleteField(), ...(a.dismissedRepeat ? { recurring: true } : {}) }),
  seed: async (uid: string, all: Alloc[], month: string) => {
    const lines = seedLines(all, month, new Date().toISOString());
    if (!lines.length) return;
    const batch = writeBatch(db);
    for (const l of lines) batch.set(allocRef(uid, l.id), l);
    await batch.commit();
  },
};

/** His market and household receipts as the household sees them: the copy the sync service keeps in households/{hid}/settings. */
export function watchShare(hid: string, on: (s: { market: Market | null; receipts: Receipt[] }) => void): () => void {
  const q = query(collection(db, 'households', hid, 'settings'), where('kind', '==', 'nexo-money'));
  return onSnapshot(q, (snap) => on(fromShare(snap.docs.map((d) => d.data()))), () => on({ market: null, receipts: [] }));
}
