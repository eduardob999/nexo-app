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
  /** A question or decision Nexo has put to him. Present only while it is open. */
  ask?: string;
  /** Calendar coverage marker: `yes`, `queued` or `ics`. */
  cal?: string | null;
  calEvent?: unknown;
  trip?: boolean;
  /** Personalised reply options Nexo wrote for this card. */
  qreplies?: string[];
  /** Days ahead this card should start showing under Preparation, overriding the default for its kind. */
  lead?: number;
  /** Things to bring and a plan: either marks a card as needing preparation. */
  bring?: unknown[];
  plan?: unknown;
  /** Denormalised by the writer so a list never has to read the entries subcollection. */
  files?: CardFile[];
  entryCount?: number;
  last?: LastEntry;
}

/** An image attached to a card by the loop (a QR code, a screenshot). The picture itself is in `files/{id}.thumb`. */
export interface CardFile {
  id: string;
  name?: string;
  type?: string;
  viewUrl?: string;
  thumb?: string;
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
  /** He asked Nexo to rewrite it; set until the new text lands. */
  revise?: { text: string; at: string; by?: string };
  answer?: string;
  answeredAt?: string;
  editedAt?: string;
  editedBy?: string;
  sentAt?: string;
  sentBy?: string;
  sentVia?: string;
  ts?: string;
}

export type { TodayInfo } from './strip';

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
  /** While set and in the future, the loop makes no calls at all. */
  sleepUntil?: string | null;
  /** A mail-check request still waiting in the loop's inbox, since when. */
  mailCheckSince?: string | null;
}

/** A prompt for another model that he carries by hand. `open` is the only state that waits on him. */
export interface Relay {
  id: string;
  target?: string;
  mode?: string;
  status: 'open' | 'answered' | 'filed' | 'closed';
  topic: string;
  prompt?: string;
  response?: string;
  ts?: string;
}

export interface Resource {
  id: string;
  kind: string;
  title: string;
  url?: string;
  note?: string;
  ts?: string;
  archived?: boolean;
}
