/**
 * The last step of the flow: what he wants changed in the workflow itself. Pure. Entries live on `flow.feedback` of the
 * document, so Nexo reads them with the document (relaunch/fude_feedback.py) and the step they were written at stays attached.
 */
export type FeedbackKind = 'problem' | 'idea';
export const KIND_LABEL: Record<FeedbackKind, string> = { problem: 'Something went wrong', idea: 'A change I want' };

export interface FeedbackEntry { id: string; at: string; step: number; kind: FeedbackKind; text: string }

/** Add one entry, newest last. Empty text adds nothing; the list is returned unchanged. */
export function addFeedback(list: FeedbackEntry[] | undefined, input: { text: string; step: number; kind: FeedbackKind }, now: Date, id: string): FeedbackEntry[] {
  const text = input.text.trim();
  const cur = list ?? [];
  if (!text) return cur;
  return [...cur, { id, at: now.toISOString(), step: input.step, kind: input.kind, text }];
}

export const removeFeedback = (list: FeedbackEntry[] | undefined, id: string): FeedbackEntry[] => (list ?? []).filter((e) => e.id !== id);
