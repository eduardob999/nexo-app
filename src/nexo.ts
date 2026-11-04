import type { Card } from './types';

export type Section = 'you' | 'nexo' | 'close' | 'else';

export const SECTION_LABEL: Record<Section, string> = {
  you: 'Waiting on you',
  nexo: 'Nexo’s move',
  close: 'Should be closed',
  else: 'Waiting on something else',
};

export const SECTION_ORDER: Section[] = ['you', 'nexo', 'close', 'else'];

function dueMs(card: Card): number {
  if (!card.due) return Number.NaN;
  return new Date(card.due.length <= 10 ? `${card.due}T23:59:59` : card.due).getTime();
}

/**
 * A card in Nexo's lane, by whose move it is. Ported from the old board's `nexoSection`. Conservative on
 * purpose: a question mark in Nexo's newest entry puts the card under "you", never under "close", because
 * closing a card he still owes an answer on hides the question from him.
 */
export function nexoSection(card: Card, now: Date): Section {
  const last = card.last;
  if (last?.by === 'eduardo') return 'nexo';
  if (card.ask) return 'you';
  const text = (last?.text ?? '').replace(/\s+/g, ' ').trim();
  if (text.includes('?') || text.includes('？')) return 'you';
  if (/\bnothing (else |more |further )?(is )?(needed|owed|required|left to do|to do)\b|\bno action (is )?needed\b/i.test(text)) return 'close';
  const dm = dueMs(card);
  if (!Number.isNaN(dm) && dm < now.getTime()) return 'close';
  if (!Number.isNaN(dm)) return 'else';
  if (/\b(unconfirmed|once (they|the \w+) (confirm|reply|answer|assign)|waiting (on|for)|until (they|the \w+) (confirm|reply|answer))/i.test(text)) return 'else';
  return 'nexo';
}

/**
 * Is this card on HIS board? His words, 2026-10-08: "the ones that are waiting on me should appear in my
 * board". A card in Nexo's lane with a question open to him, Nexo's entry the newest, is his.
 */
export function isHis(card: Card): boolean {
  if (card.status === 'done') return false;
  if (card.for !== 'nexo') return true;
  return Boolean(card.ask) && card.last?.by !== 'eduardo';
}
