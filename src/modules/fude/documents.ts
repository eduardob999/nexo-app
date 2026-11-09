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
