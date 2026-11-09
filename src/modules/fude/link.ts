/** Which kind of Fude document an assignment card should open, from its words. Pure, so it can be tested. */
export type Kind = { kind: 'set' } | { kind: 'doc'; profile: string };

const EXERCISE = /文型|練習|宿題|exercise|workbook|homework|\bL\d{1,2}\b|\bpp?\.\s?\d/i;
const REPORT = /report|レポート|essay|lecture report|感想/i;

export function kindForCard(title: string, text = ''): Kind {
  const t = `${title} ${text}`;
  if (EXERCISE.test(t) && !REPORT.test(title)) return { kind: 'set' };
  if (REPORT.test(t)) return { kind: 'doc', profile: 'report-en' };
  return { kind: 'doc', profile: 'free' };
}

export interface ContextCard { title?: string | undefined; due?: string | null | undefined; place?: string | undefined; type?: string | undefined; entries?: { by: string; text: string; ts?: string }[] | undefined }

/**
 * What Nexo already knows about the task, as plain text for the checker and the reviewer: the card's facts and the
 * thread, newest last, trimmed from the old end so the latest words always survive.
 */
export function buildContext(card: ContextCard, max = 3000): string {
  const head = [card.title ? `Task: ${card.title}` : '', card.due ? `Due: ${card.due}` : '', card.place ? `Place: ${card.place}` : '', card.type ? `Kind: ${card.type}` : ''].filter(Boolean).join('\n');
  const lines = (card.entries ?? []).map((e) => `${e.by === 'eduardo' ? 'He' : 'Nexo'}: ${e.text.replace(/\s+/g, ' ').trim()}`);
  let body = lines.join('\n');
  if (body.length > max) body = '…' + body.slice(body.length - max);
  return [head, body].filter(Boolean).join('\n\n');
}
