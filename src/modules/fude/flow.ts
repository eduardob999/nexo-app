/**
 * The assignment flow: nine ordered steps from the request to the submit button. Pure, so every rule is tested.
 * A document with `flow` set uses the stepper (Flow.tsx); one without it keeps the plain editor screen.
 */
import type { Budget } from './profiles';
import { englishWordTarget, lengthVerdict, parseJaBudget } from './lengths';

export interface StepDef { n: number; key: string; label: string; hint: string }
export const STEPS: StepDef[] = [
  { n: 1, key: 'request', label: 'Request', hint: 'What the assignment asks, word for word, and what it requires.' },
  { n: 2, key: 'context', label: 'Context', hint: 'Bring in what you already have: mail, Drive, earlier work, notes.' },
  { n: 3, key: 'research', label: 'Research prompt', hint: 'Paste this into Perplexity to find the facts.' },
  { n: 4, key: 'answer', label: 'Research answer', hint: 'Paste what Perplexity answered.' },
  { n: 5, key: 'draftprompt', label: 'Draft prompt', hint: 'Paste this into any model for a first draft, or write it yourself.' },
  { n: 6, key: 'write', label: 'Write', hint: 'Your text, with the writing check and the assignment check.' },
  { n: 7, key: 'naturalize', label: 'Naturalize', hint: 'A style pass in a general model: more natural wording, nothing added or dropped. Check what changed before you take it.' },
  { n: 8, key: 'translate', label: 'Translation prompt', hint: 'Paste this into any model to translate. Skip for English-only work.' },
  { n: 9, key: 'tcheck', label: 'Translation check', hint: 'Paste the Japanese, check its length, and compare it with your English or with a second translation.' },
  { n: 10, key: 'submit', label: 'Submit', hint: 'Last look, then mark it submitted.' },
];
export const LAST_STEP = STEPS.length;

export type ContextSource = 'gmail' | 'drive' | 'mailspring' | 'past' | 'paste' | 'file';
export interface ContextItem { id: string; source: ContextSource; title: string; from?: string; date?: string; text: string; on: boolean; why?: string; /** The helper could not read this attachment: it is never ticked and the screen says so. */ unread?: boolean }
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

/** The language the lecture was given in decides the language the report is submitted in. */
export type LectureLanguage = 'ja' | 'en';

export interface Flow {
  /** 2 once the naturalize step exists; documents without it stored the older step numbers. */
  v?: number;
  step?: number;
  lectureLanguage?: LectureLanguage;
  /** His style rules for the draft prompt; the default for the kind of assignment when absent. */
  style?: string;
  /** His own views, for the part of the report that asks for his opinion. */
  opinion?: string;
  /** The header lines of the Japanese submission (date and lecturer, title, name, affiliation). */
  header?: string;
  naturalizeSafe?: boolean;
  /** What came back from the naturalizing model, kept until he accepts or drops it. */
  naturalized?: string;
  /** He passed the naturalizing step (or chose to skip it). */
  naturalizeDone?: boolean;
  /** He read the university's generative-AI rules for this course before submitting. */
  aiRulesChecked?: boolean;
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
  /** The same check, run on the Japanese that will be submitted. */
  assignmentCheckJa?: { status: string; text?: string; items?: { status: string; deferred?: boolean }[] };
  sourcesCheck?: { status: string; text?: string; items?: { status: string }[] };
  review?: { status: string };
}

/** The character range the assignment names for the submitted text, read from its own words. */
export const jaBudgetOf = (d: { requirements?: string }): { min?: number; max?: number } | undefined => parseJaBudget(d.requirements);
/** 'ja' when the lecture was in Japanese, so the report is submitted in Japanese and written first in English; otherwise nothing special. */
export const submitLang = (f: Flow | undefined): 'ja' | undefined => (f?.lectureLanguage === 'ja' ? 'ja' : undefined);

export const isFlow = (d: { flow?: unknown }): boolean => !!d.flow && typeof d.flow === 'object';
export const clampStep = (n: unknown): number => (typeof n === 'number' && n >= 1 && n <= LAST_STEP ? Math.floor(n) : 1);
/** A step number stored before the naturalize step existed (no `v`) means the same step one place later from 7 on. */
export const storedStep = (f: Flow | undefined): number | undefined => (typeof f?.step === 'number' && f.v !== 2 && f.step >= 7 ? f.step + 1 : f?.step);
export const currentStep = (d: FlowDoc): number => (d.flow?.submittedAt ? LAST_STEP : clampStep(storedStep(d.flow)));

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

/**
 * The lines of the requirements that need something only he has: his own view, impressions, research. Without them the
 * draft either leaves the part out or invents it, so step 2 asks for them before any prompt is written.
 */
const OWN_INPUT = /your own|my own|impression|opinion|thought|感想|考え|意見|research|自分/i;
export function ownInputNeeds(requirements: string | undefined): string[] {
  const lines = (requirements ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
  const numbered = lines.filter((l) => /^\d+[.)]\s/.test(l));
  const pool = (numbered.length ? numbered : lines).map((l) => l.replace(/^\d+[.)]\s*/, '').replace(/\*\*/g, '').trim());
  const out: string[] = [];
  for (const l of pool) if (OWN_INPUT.test(l) && !out.includes(l.slice(0, 90))) out.push(l.slice(0, 90));
  return out;
}
/** The title of the context item that answers one of those needs. */
export const ownInputTitle = (need: string): string => `My own input: ${need}`;
/** The needs that have no context item with text yet. */
export const missingOwnInput = (d: { requirements?: string; flow?: Flow | undefined }): string[] =>
  ownInputNeeds(d.requirements).filter((n) => !(d.flow?.contextItems ?? []).some((i) => i.title === ownInputTitle(n) && i.text.trim()));

/** True when the assignment names a character limit and the pasted Japanese is inside it, or when it names none. */
export function japaneseLengthOk(d: { requirements?: string; translationDraft?: string }): boolean {
  const b = jaBudgetOf(d);
  return !b || lengthVerdict(d.translationDraft ?? '', b).status === 'ok';
}

/** Whether a step has what it needs. Used for the dots on the step bar and for the "next" nudge; never to block him. */
export function stepDone(d: FlowDoc, n: number): boolean {
  const f = d.flow;
  switch (n) {
    case 1: return hasText(d.requirements);
    case 2: return !!f?.contextSkipped || (chosenContext(f).length > 0 && missingOwnInput(d).length === 0);
    case 3: return hasText(f?.research);
    case 4: return hasText(f?.research);
    case 5: return hasText(d.text);
    case 6: return hasText(d.text) && d.assignmentCheck?.status === 'ready' && d.assignmentCheck.text === d.text;
    case 7: return !!f?.naturalizeDone;
    case 8: return !!f?.skipTranslation || d.translationRequest?.status === 'ready';
    case 9: return !!f?.skipTranslation || (d.translationCheck?.status === 'ready' && japaneseLengthOk(d));
    case 10: return !!f?.submittedAt;
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
  /** His style rules (flow.style); the default for the kind of assignment when empty. */
  style?: string | undefined;
  /** His own views for the opinion part (flow.opinion). */
  opinion?: string | undefined;
  /** The language the report is submitted in, when it is not the one it is written in. */
  submitLang?: 'ja' | 'en' | undefined;
  /** The character range the course sets for the submitted language. */
  jaBudget?: { min?: number; max?: number } | undefined;
  /** Requirement lines that need his own input (ownInputNeeds), so the model asks instead of inventing. */
  ownNeeds?: string[] | undefined;
}

/** The style that a lecture report needs, as he settled it on the 高橋 report (2026-11-17). Each line is a rule he gave. */
export const LECTURE_STYLE = [
  'The summary follows the lecture in chronological order as a story of highlights, in the style "The lecturer began by explaining...", "Then the lecturer talked about...", "After that the lecturer moved on to...", "Finally the lecturer presented...". Pick the 7 to 9 highlights that best show how the lecture developed, in the order of the facts below, and do not try to cover everything.',
  'Call the teacher "the lecturer", never "he" or "she", and never "the professor" unless the facts do.',
  'Plain, natural English that an educated person who is not an expert could follow. Explain every abbreviation and technical term in ordinary words the first time it appears, even though the reader is an expert; after that the short form is fine.',
  'Prefer long, flowing sentences of about 25 to 45 words that join an event, its reason and its consequence with commas and linking words; avoid choppy sentences under 15 words. They must still read easily.',
  'No em dashes, no bullet points, no tables, no bold: plain paragraphs under the headings the instructions name.',
  'Do not call anything proven unless the facts say it was shown; keep each result at the level the lecture stated (for example "in mice"). Do not make a hedge stronger.',
  'Do not name authors, papers or companies, and do not write a number that is not in the facts.',
  'The opinion part is in the first person, uses only my opinion notes, stays modest, and links the lecture to my research only through the facts about me. Close it with the broad question the lecture raised, not with a conclusion about one field.',
  'Do not mention the facts, the transcript or this prompt inside the report.',
].join('\n');

export const GENERAL_STYLE = [
  'Plain, direct prose in my voice; no em dashes; no filler openers; hedge exactly where the sources hedge.',
  'Answer every numbered requirement, in the order the instructions give, using the headings the instructions name.',
  'No numbers from my own results and no claim that anything is published or certain.',
].join('\n');

/** The style text a draft prompt starts from: his own when he has edited it, otherwise the default for this kind of assignment. */
export const styleFor = (flowStyle: string | undefined, request: string): string =>
  flowStyle?.trim() ? flowStyle.trim() : /lecture|講義|講師/i.test(request) ? LECTURE_STYLE : GENERAL_STYLE;

const englishTarget = (j: { min?: number; max?: number }): string => { const t = englishWordTarget(j); return t ? `about ${t.min ?? ''}${t.min !== undefined && t.max !== undefined ? ' to ' : ''}${t.max ?? ''} words` : ''; };

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
    (i.submitLang === 'ja' ? 'LANGUAGE\nThe lecture was in Japanese, so the report is submitted in Japanese. You write the English version, which I will translate afterwards, so write English that translates cleanly: no idioms, no wordplay, and keep each sentence a single clear unit.' + hr : '') +
    'STYLE\n' + styleFor(i.style, i.request).split('\n').map((l) => `- ${l}`).join('\n') + '\n' +
    (i.jaBudget && englishTarget(i.jaBudget) ? `- Length: ${englishTarget(i.jaBudget)} in English, so that the Japanese lands inside the course's limit of ${i.jaBudget.min ?? 0} to ${i.jaBudget.max ?? ''} characters; state the word count of each part at the end.\n` : budgetLine(i.budget) ? `- ${budgetLine(i.budget)}\n` : '') +
    (i.ownNeeds?.length ? hr + 'NEEDS FROM ME (these parts need something only I have)\n' + i.ownNeeds.map((n) => `- ${n}`).join('\n') + '\nUse only what is in the context for these; if it is absent, write NEED: and say what you need instead of inventing it.\n' : '') +
    (i.opinion?.trim() ? hr + `MY OPINION NOTES (my own views, for the part that asks for my opinion: use them, do not contradict them and do not add views of your own)\n${i.opinion.trim()}\n` : (/opinion|考察|own view|your own/i.test(i.request) ? hr + 'MY OPINION NOTES\n(none yet: if the assignment asks for my opinion, write NEED: and ask me for it instead of inventing one)\n' : '')) +
    '\nAfter the draft, add a list headed CHECK: for each requirement, the sentence that answers it; then the word count of each part and anything you left out.\n'
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

/** The header lines of the Japanese submission, with the parts only he knows left as 〇〇 to fill in. */
export const DEFAULT_HEADER = ['YYYY年M月D日 〇〇先生の講義レポート', '講義題目：〇〇', '氏名：Eduardo Bogado', '所属：バイオインフォマティクスセンター 馬見塚研究室'].join('\n');
export const headerFor = (f: Flow | undefined): string => (f?.header !== undefined ? f.header : DEFAULT_HEADER);
