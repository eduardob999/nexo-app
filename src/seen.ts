import type { Card } from './types';

const KEY = 'nexo-seen';

interface Store { baseline: string; seen: Record<string, string> }

function load(): Store {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Store;
  } catch { /* storage blocked: every card then counts as seen from now */ }
  return { baseline: new Date().toISOString(), seen: {} };
}

function save(s: Store): void {
  try { window.localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* nothing to do */ }
}

/**
 * A card is new when Nexo's newest entry on it is later than the moment he last opened it. The first time
 * the app runs on a device, everything already there counts as read (the baseline), so the first screen is not
 * a wall of markers. This lives on the device only: reading something is not an edit, so it is never synced.
 */
export function isNew(card: Card, store: Store): boolean {
  if (card.last?.by !== 'nexo') return false;
  const t = Date.parse(card.last.ts);
  if (Number.isNaN(t)) return false;
  const since = Math.max(Date.parse(store.baseline) || 0, Date.parse(store.seen[card.id] ?? '') || 0);
  return t > since;
}

export function isNewCard(card: Card): boolean {
  return isNew(card, load());
}

export function markSeen(cardId: string): void {
  const s = load();
  s.seen[cardId] = new Date().toISOString();
  save(s);
}

/** Make sure a baseline exists, so a first run does not mark the whole board new. */
export function ensureBaseline(): void {
  try {
    if (!window.localStorage.getItem(KEY)) save({ baseline: new Date().toISOString(), seen: {} });
  } catch { /* storage blocked */ }
}
