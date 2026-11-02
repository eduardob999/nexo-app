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
  prio?: string;
  /** Denormalised by the writer so a list never has to read the entries subcollection. */
  entryCount?: number;
  last?: LastEntry;
}
