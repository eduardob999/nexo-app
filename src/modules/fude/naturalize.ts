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

/**
 * The four-message sequence he uses in one chat (2026-11-24), which replaced the single prompt: show an example of the style,
 * ask where the text feels unnatural, have the suggestions checked against the safeguards, then apply what complies.
 * Each message is sent in the same conversation, in this order.
 */
export const EXAMPLE_HEAD = "I don't want the repetitive paragraph starters, you can learn how to naturalize the writing from this example, you can see, no repetitive patterns at the beginning of each paragraph:";

export const naturalizeExamplePrompt = (example: string): string => `${EXAMPLE_HEAD}\n\n${example.trim()}\n`;
export const naturalizeDiagnosePrompt = (text: string): string => `Where does it feel unnatural?\n\n${text.trim()}\n`;
export const naturalizeCheckPrompt = (): string => `Before applying those changes, do they comply with this:\n\nConstraints:\n${NATURALIZE_SAFEGUARDS.map((r) => `- ${r}`).join('\n')}\n`;
export const naturalizeApplyPrompt = (): string => 'Apply your suggestions as much as they comply with the constraints.\n';

export interface NaturalizeStepDef { key: 'example' | 'diagnose' | 'check' | 'apply'; label: string; note: string }
export const NATURALIZE_SEQUENCE: NaturalizeStepDef[] = [
  { key: 'example', label: '1. The style example', note: 'Send this first. Wait for the model to answer.' },
  { key: 'diagnose', label: '2. Where does it feel unnatural?', note: 'Same chat. This carries your text.' },
  { key: 'check', label: '3. Check against the safeguards', note: 'Same chat, after its suggestions. Read what it says before going on.' },
  { key: 'apply', label: '4. Apply what complies', note: 'Same chat. Paste the revised text below.' },
];
