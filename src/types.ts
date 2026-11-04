/** The fields of a card the app reads. The document holds more; unknown fields are left alone on write. */
export interface LastEntry {
  by: string;
  text: string;
  ts: string;
}

export interface Card {
  id: string;
  status: 'open' | 'done';
  /** Who has to act: `you` is the decision queue, `nexo` is the assistant's lane. */
  for: string;
  title?: string;
  type?: string;
  /** ISO date or date-time. */
  due?: string | null;
  place?: string;
  /** `high` is the old board's Urgent flag; `normal`, `med` and `low` carry no queue meaning. */
  prio?: string;
  /** Days ahead this card should start showing under Preparation, overriding the default for its kind. */
  lead?: number;
  /** Things to bring and a plan: either marks a card as needing preparation. */
  bring?: unknown[];
  plan?: unknown;
  /** Denormalised by the writer so a list never has to read the entries subcollection. */
  entryCount?: number;
  last?: LastEntry;
}

export interface Entry {
  id: string;
  by: string;
  text: string;
  ts: string;
}

/** A reply the loop has drafted. Sending is always his act, never the app's. */
export interface Draft {
  id: string;
  linkedNote?: string;
  status: 'drafted' | 'needs-info' | 'sent' | 'discarded';
  topic?: string;
  subject?: string;
  to?: string[];
  text?: string;
  need?: string;
  copiedAt?: string;
  /** He pressed Send; the loop sends on its next run and then sets status `sent`. */
  sendRequestedAt?: string;
  sentAt?: string;
  sentBy?: string;
  sentVia?: string;
  ts?: string;
}

/** What the sync service publishes at meta/nexo. */
export interface NexoStatus {
  phase: 'idle' | 'queued' | 'working';
  startedAt: string | null;
  queuedAt: string | null;
  cards: { id: string; title: string; answered: boolean }[];
  total: number;
  answered: number;
  lastOutcome: 'ok' | 'failed' | null;
  lastEndedAt: string | null;
}
