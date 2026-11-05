import type { CardFile, DraftAttachment } from './types';

const MENTION = /attach(ed|ing|ment|ments)?\b|\bPDF\b|添付/i;

/** True when the draft's wording promises a file. */
export function mentionsAttachment(text: string | undefined): boolean {
  return MENTION.test(text ?? '');
}

/** The linked card's files that can still be added to the draft: uploaded to Drive and not already attached. */
export function attachableFiles(cardFiles: CardFile[] | undefined, attached: DraftAttachment[] | undefined): CardFile[] {
  const have = new Set((attached ?? []).map((f) => f.id));
  return (cardFiles ?? []).filter((f) => f.driveId && !have.has(f.id));
}

export function attachmentLabel(n: number): string {
  return `Sends with ${n} attachment${n === 1 ? '' : 's'}`;
}

export function isImage(f: { type?: string }): boolean {
  return (f.type ?? '').startsWith('image/');
}
