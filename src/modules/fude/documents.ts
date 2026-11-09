/** Whole-text documents: a report, an email, free writing. One text, one profile (profiles.ts). */
import type { CardFile } from '../../types';
import type { Budget } from './profiles';

export interface FudeDoc {
  id: string;
  title: string;
  profile: string;
  text: string;
  due?: string;
  /** Overrides the profile's budget for this document (each lecture report has its own). */
  budget?: Budget;
  photos?: CardFile[];
  /** The reviewer's progress: `requested` by the app, then `working`, then `ready` or `error`. */
  review?: { status: 'requested' | 'working' | 'ready' | 'error'; message?: string; count?: number; at?: string };
  createdAt: string;
  updatedAt: string;
  deleted?: boolean;
}

export const newDocId = (now: Date): string => `fd${now.getTime().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export function newDoc(title: string, profile: string, now: Date, due?: string): FudeDoc {
  const t = now.toISOString();
  return { id: newDocId(now), title: title.trim() || 'Untitled', profile, text: '', ...(due ? { due } : {}), createdAt: t, updatedAt: t };
}

/** Documents on screen: not deleted, soonest deadline first, then the most recently touched. */
export function sortDocs(docs: FudeDoc[]): FudeDoc[] {
  return docs.filter((d) => !d.deleted).sort((a, b) => {
    const da = a.due ?? '9999';
    const db = b.due ?? '9999';
    return da === db ? (a.updatedAt < b.updatedAt ? 1 : -1) : da < db ? -1 : 1;
  });
}

/** A proposal from the reviewer. `fix` is empty when it is not sure of an exact replacement. */
export interface Note { id: string; find: string; kind: string; msg: string; fix: string; status: 'open' | 'accepted' | 'dismissed' }

/** Put a note's fix in place of the first occurrence of its words. Null when the words are gone or there is no fix. */
export function applyFix(text: string, find: string, fix: string): string | null {
  if (!fix || !find) return null;
  const i = text.indexOf(find);
  return i < 0 ? null : text.slice(0, i) + fix + text.slice(i + find.length);
}
