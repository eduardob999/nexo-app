/**
 * The assignment flow: nine ordered steps from the request to the submit button. Pure, so every rule is tested.
 * A document with `flow` set uses the stepper (Flow.tsx); one without it keeps the plain editor screen.
 */
import type { Budget } from './profiles';

export interface StepDef { n: number; key: string; label: string; hint: string }
export const STEPS: StepDef[] = [
  { n: 1, key: 'request', label: 'Request', hint: 'What the assignment asks, word for word, and what it requires.' },
  { n: 2, key: 'context', label: 'Context', hint: 'Bring in what you already have: mail, Drive, earlier work, notes.' },
  { n: 3, key: 'research', label: 'Research prompt', hint: 'Paste this into Perplexity to find the facts.' },
  { n: 4, key: 'answer', label: 'Research answer', hint: 'Paste what Perplexity answered.' },
  { n: 5, key: 'draftprompt', label: 'Draft prompt', hint: 'Paste this into any model for a first draft, or write it yourself.' },
  { n: 6, key: 'write', label: 'Write', hint: 'Your text, with the writing check and the assignment check.' },
  { n: 7, key: 'translate', label: 'Translation prompt', hint: 'Paste this into any model to translate. Skip for English-only work.' },
  { n: 8, key: 'tcheck', label: 'Translation check', hint: 'Paste the Japanese and compare it with your English.' },
  { n: 9, key: 'submit', label: 'Submit', hint: 'Last look, then mark it submitted.' },
];
export const LAST_STEP = STEPS.length;

export type ContextSource = 'gmail' | 'drive' | 'mailspring' | 'past' | 'paste' | 'file';
export interface ContextItem { id: string; source: ContextSource; title: string; from?: string; date?: string; text: string; on: boolean; why?: string }
export interface ContextSources { gmail: boolean; drive: boolean; mailspring: boolean; past: boolean }
export const DEFAULT_SOURCES: ContextSources = { gmail: true, drive: true, mailspring: false, past: true };
export const SOURCE_LABEL: Record<ContextSource, string> = { gmail: 'Gmail', drive: 'Drive', mailspring: 'Mailspring', past: 'Earlier work', paste: 'Pasted', file: 'File' };

/** Asked by the app, answered by the helper. The sources and the hint travel with the request. */
export interface ContextRequest {
  status: 'requested' | 'working' | 'ready' | 'error';
  sources: ContextSources;
  hint?: string;
  items?: ContextItem[];
  message?: string;
  at?: string;
}

export interface Flow {
  step?: number;
  sources?: ContextSources;
  hint?: string;
  contextItems?: ContextItem[];
  contextSkipped?: boolean;
  research?: string;
  skipTranslation?: boolean;
  /** The step-by-step ticks he makes in the submit step: requirement text mapped to what he saw. */
  submittedAt?: string;
  final?: { english: string; japanese?: string; at: string };
}

/** The slice of a document the flow reads. FudeDoc satisfies it. */
export interface FlowDoc {
  title: string;
  text: string;
  requirements?: string;
  facts?: string;
  flow?: Flow;
  translationRequest?: { status: string };
  translationDraft?: string;
  translationCheck?: { status: string; english?: string; japanese?: string };
  assignmentCheck?: { status: string; text?: string; items?: { status: string }[] };
  review?: { status: string };
}

export const isFlow = (d: { flow?: unknown }): boolean => !!d.flow && typeof d.flow === 'object';
export const clampStep = (n: unknown): number => (typeof n === 'number' && n >= 1 && n <= LAST_STEP ? Math.floor(n) : 1);
export const currentStep = (d: FlowDoc): number => (d.flow?.submittedAt ? LAST_STEP : clampStep(d.flow?.step));

export const chosenContext = (f: Flow | undefined): ContextItem[] => (f?.contextItems ?? []).filter((i) => i.on && i.text.trim());

/** The context he ticked, as one block with a header per item, so a model can tell where each piece came from. */
export function compileContext(f: Flow | undefined): string {
  return chosenContext(f).map((i) => `[${SOURCE_LABEL[i.source]}: ${i.title}${i.from ? `, ${i.from}` : ''}${i.date ? `, ${i.date}` : ''}]\n${i.text.trim()}`).join('\n\n');
}

/** The fact sheet the reviewer checks claims against: the context he chose, then the research answer. */
export function factSheet(f: Flow | undefined): string {
  const ctx = compileContext(f);
  const res = (f?.research ?? '').trim();
  return [ctx ? `CONTEXT\n${ctx}` : '', res ? `RESEARCH\n${res}` : ''].filter(Boolean).join('\n\n');
}

const hasText = (s: string | undefined): boolean => !!s && s.trim().length > 0;

/** Whether a step has what it needs. Used for the dots on the step bar and for the "next" nudge; never to block him. */
export function stepDone(d: FlowDoc, n: number): boolean {
  const f = d.flow;
  switch (n) {
    case 1: return hasText(d.requirements);
    case 2: return chosenContext(f).length > 0 || !!f?.contextSkipped;
    case 3: return hasText(f?.research);
    case 4: return hasText(f?.research);
    case 5: return hasText(d.text);
    case 6: return hasText(d.text) && d.assignmentCheck?.status === 'ready' && d.assignmentCheck.text === d.text;
    case 7: return !!f?.skipTranslation || d.translationRequest?.status === 'ready';
    case 8: return !!f?.skipTranslation || d.translationCheck?.status === 'ready';
    case 9: return !!f?.submittedAt;
    default: return false;
  }
}

/** The first step that is not done, so opening the document lands where the work is. */
export function firstOpenStep(d: FlowDoc): number {
  for (const s of STEPS) if (!stepDone(d, s.n)) return s.n;
  return LAST_STEP;
}

const hr = '\n\n';

export interface PromptInput {
  title: string;
  request: string;
  context: string;
  research?: string;
  /** The standing description of him (report-system/prompts/ME.md, the block). */
  me: string;
  due?: string | undefined;
  budget?: Budget | undefined;
}

const budgetLine = (b: Budget | undefined): string =>
  b?.max ? `Length: ${b.min ? `${b.min} to ` : 'at most '}${b.max} ${b.unit === 'chars' ? 'characters' : 'words'}, counted and stated at the end.` : '';

/** The prompt for Perplexity: find and verify what the assignment needs. It researches; it does not write the report. */
export function researchPrompt(i: PromptInput): string {
  return (
    'I must write a university report. Help me with the research only: do not write the report.' + hr +
    `${i.me.trim()}` + hr +
    `ASSIGNMENT: ${i.title}${i.due ? ` (due ${i.due})` : ''}\nThe instructions and requirements, verbatim:\n${i.request.trim()}` + hr +
    (i.context.trim() ? `WHAT I ALREADY HAVE (my notes, transcript and mail; treat recognition errors in a transcript as likely)\n${i.context.trim()}` + hr : '') +
    'DO THIS, IN ORDER\n' +
    '1. List each requirement of the assignment as a numbered line and say what evidence or knowledge answering it needs.\n' +
    '2. For every factual claim in my material that a report would rely on (names, dates, numbers, papers, mechanisms), verify it against primary sources and mark it CORRECT, IMPRECISE, WRONG or CANNOT VERIFY, with the source and a corrected wording.\n' +
    '3. Add the background a reader would expect for each requirement, with sources. If a requirement needs something only I have (my own research, my opinion), say so instead of guessing.\n' +
    '4. Finish with a compact fact sheet: one line per fact I may state, each tagged with its requirement number.\n\n' +
    'Rules: never invent; write CANNOT VERIFY when you cannot confirm; primary sources first; give links.\n'
  );
}

/** The prompt for a first draft in any general model. Facts out, prose out, claims in: it may only use the sheet. */
export function draftPrompt(i: PromptInput): string {
  const sheet = [i.context.trim() ? `FROM MY MATERIAL\n${i.context.trim()}` : '', (i.research ?? '').trim() ? `FROM RESEARCH\n${(i.research ?? '').trim()}` : ''].filter(Boolean).join(hr);
  return (
    'Write a first draft of a university report from the facts below. Work only from them: if a requirement needs a fact that is not here, write NEED: and say what is missing instead of inventing it.' + hr +
    `${i.me.trim()}` + hr +
    `ASSIGNMENT: ${i.title}${i.due ? ` (due ${i.due})` : ''}\nInstructions and requirements, verbatim:\n${i.request.trim()}` + hr +
    (sheet ? `FACTS YOU MAY USE\n${sheet}` + hr : 'FACTS YOU MAY USE\n(none yet: reply with NEED: and list what you need)' + hr) +
    'STYLE\n' +
    '- Plain, direct prose in my voice; no em dashes; no filler openers; hedge exactly where the sources hedge.\n' +
    '- Answer every numbered requirement, in the order the instructions give, using the headings the instructions name.\n' +
    '- No numbers from my own results and no claim that anything is published or certain.\n' +
    (budgetLine(i.budget) ? `- ${budgetLine(i.budget)}\n` : '') +
    '\nAfter the draft, add a list headed CHECK: for each requirement, the sentence that answers it.\n'
  );
}

/** Strip the heading line from ME.md's file text down to the block itself, so a mirror of the whole file still works. */
export function meBlock(file: string): string {
  const m = file.match(/## The block\s+([\s\S]*?)(?:\n## |\s*$)/);
  return (m?.[1] ?? file).trim();
}

/** The Japanese-output rule from ME.md, as one paragraph, for the translation prompt. Empty when the file has none. */
export function meJaRule(file: string): string {
  const m = file.match(/## Language rule for Japanese output\s+([\s\S]*?)(?:\n## |\s*$)/);
  return (m?.[1] ?? '').replace(/\*\*[^*]*\*\*\s*/, '').trim();
}

/** Text out of the bytes of a file, whatever it was saved as: voice-recorder transcripts are often UTF-16 with a BOM. */
export function decodeText(buf: ArrayBuffer): string {
  const b = new Uint8Array(buf);
  if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder('utf-16le').decode(b.subarray(2));
  if (b[0] === 0xfe && b[1] === 0xff) return new TextDecoder('utf-16be').decode(b.subarray(2));
  if (b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) return new TextDecoder('utf-8').decode(b.subarray(3));
  const utf8 = new TextDecoder('utf-8', { fatal: true });
  try { return utf8.decode(b); } catch { return new TextDecoder('shift_jis').decode(b); }
}
