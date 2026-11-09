/**
 * What the host calls to start Fude work from somewhere else in Nexo. Each returns the id it opened and moves the URL
 * there. They only create; nothing is written to the card or the draft until he chooses to send text back.
 */
import { getDocs, query, where, collection } from 'firebase/firestore';
import { db } from '../../firebase';
import { newDoc, type FudeDoc } from './documents';
import { kindForCard } from './link';
import { newSet } from './model';
import { createDocument, createSet } from './store';

export interface CardLike { id: string; title?: string | undefined; due?: string | null | undefined; last?: { text: string } | undefined }
export interface DraftLike { id: string; text?: string | undefined; subject?: string | undefined }

const go = (id: string) => { window.location.hash = `#/homework/${id}`; return id; };

/** "Work on it": reuse what was already started from this card, else create the right kind. */
export async function openForCard(uid: string, card: CardLike): Promise<string> {
  for (const name of ['homework', 'documents']) {
    const hit = await getDocs(query(collection(db, 'users', uid, name), where('cardId', '==', card.id)));
    if (!hit.empty) return go(hit.docs[0]?.id ?? '');
  }
  const now = new Date();
  const k = kindForCard(card.title ?? '', card.last?.text ?? '');
  if (k.kind === 'set') {
    const s = { ...newSet(card.title ?? 'Homework', now, card.due ?? undefined), cardId: card.id };
    await createSet(uid, s);
    return go(s.id);
  }
  const d: FudeDoc = { ...newDoc(card.title ?? 'Untitled', k.profile, now, card.due ?? undefined), cardId: card.id };
  await createDocument(uid, d);
  return go(d.id);
}

/** "Edit in Fude": an email document holding the draft's text, remembering which draft it came from. */
export async function openForDraft(uid: string, draft: DraftLike): Promise<string> {
  const hit = await getDocs(query(collection(db, 'users', uid, 'documents'), where('draftId', '==', draft.id)));
  if (!hit.empty) return go(hit.docs[0]?.id ?? '');
  const d: FudeDoc = { ...newDoc(draft.subject || 'Email draft', 'email', new Date()), text: draft.text ?? '', draftId: draft.id };
  await createDocument(uid, d);
  return go(d.id);
}
