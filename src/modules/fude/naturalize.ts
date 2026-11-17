/**
 * The naturalizing pass: after the first draft is written and before the last fixes and the translation, the text goes
 * through a general model with this instruction, which he found takes the machine feel out of a draft. Pure.
 */
export const NATURALIZE_HEAD = 'De-AI, humanize and naturalize the following text:';

/** What the pass must not do. They are the ways a rewrite of a checked text drifts, each seen or likely in practice. */
export const NATURALIZE_SAFEGUARDS: string[] = [
  'Keep every fact, number, name and claim exactly as it is: add nothing, drop nothing, and do not make a hedge stronger or weaker.',
  'Keep the headings (for example 【Lecture Content】 and 【Discussion】) exactly as written, in the same order, and keep the same paragraphs.',
  'Keep the first person where it is, and keep the writer\'s own opinions as opinions.',
  'Keep the plain-language explanation of every technical term and abbreviation where it first appears.',
  'Keep the long, flowing sentences; do not break them into short ones.',
  'Keep the order of events as it is.',
  'Do not use em dashes. Keep the length within ten percent of the original.',
  'Return only the revised text, with nothing before or after it.',
];

export function naturalizePrompt(text: string, safeguards = true): string {
  const rules = safeguards ? `\n\nConstraints:\n${NATURALIZE_SAFEGUARDS.map((r) => `- ${r}`).join('\n')}` : '';
  return `${NATURALIZE_HEAD}${rules}\n\n${text.trim()}\n`;
}
