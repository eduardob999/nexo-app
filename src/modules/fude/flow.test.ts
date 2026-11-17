import { describe, expect, it } from 'vitest';
import { DEFAULT_HEADER, headerFor, jaBudgetOf, LECTURE_STYLE, GENERAL_STYLE, styleFor, submitLang, decodeText, chosenContext, compileContext, currentStep, draftPrompt, factSheet, firstOpenStep, meBlock, meJaRule, researchPrompt, stepDone, type FlowDoc, type ContextItem } from './flow';

const item = (o: Partial<ContextItem>): ContextItem => ({ id: 'a', source: 'gmail', title: 'Nov 11 notes', text: 'x', on: true, ...o });
const base: FlowDoc = { title: '高橋 report', text: '' };
const ME = 'ME. Eduardo, master student.';

describe('context', () => {
  it('keeps only ticked, non-empty items', () => {
    const f = { contextItems: [item({ id: '1' }), item({ id: '2', on: false }), item({ id: '3', text: '  ' })] };
    expect(chosenContext(f).map((i) => i.id)).toEqual(['1']);
  });
  it('labels each piece with its source', () => {
    expect(compileContext({ contextItems: [item({ text: 'hello', from: 'me', date: '11 Nov' })] })).toBe('[Gmail: Nov 11 notes, me, 11 Nov]\nhello');
  });
  it('builds the fact sheet from context then research', () => {
    const s = factSheet({ contextItems: [item({ text: 'notes' })], research: 'found' });
    expect(s.indexOf('CONTEXT')).toBeLessThan(s.indexOf('RESEARCH'));
    expect(factSheet(undefined)).toBe('');
  });
});

describe('steps', () => {
  it('step 1 needs the request, step 2 needs context or a skip', () => {
    expect(stepDone(base, 1)).toBe(false);
    expect(stepDone({ ...base, requirements: 'r' }, 1)).toBe(true);
    expect(stepDone({ ...base, flow: {} }, 2)).toBe(false);
    expect(stepDone({ ...base, flow: { contextSkipped: true } }, 2)).toBe(true);
    expect(stepDone({ ...base, flow: { contextItems: [item({})] } }, 2)).toBe(true);
  });
  it('the writing step is done only when the assignment check judged this exact text', () => {
    const d: FlowDoc = { ...base, text: 'abc', assignmentCheck: { status: 'ready', text: 'abc' } };
    expect(stepDone(d, 6)).toBe(true);
    expect(stepDone({ ...d, text: 'abcd' }, 6)).toBe(false);
  });
  it('translation steps are done by skipping', () => {
    expect(stepDone({ ...base, flow: { skipTranslation: true } }, 8)).toBe(true);
    expect(stepDone({ ...base, flow: { skipTranslation: true } }, 9)).toBe(true);
    expect(stepDone(base, 9)).toBe(false);
  });
  it('the naturalize step is done when he passes it', () => {
    expect(stepDone({ ...base, flow: {} }, 7)).toBe(false);
    expect(stepDone({ ...base, flow: { naturalizeDone: true } }, 7)).toBe(true);
    expect(stepDone({ ...base, flow: {} }, 3)).toBe(false);
  });
  it('lands on the first step that is not done', () => {
    expect(firstOpenStep({ ...base, flow: {} })).toBe(1);
    expect(firstOpenStep({ ...base, requirements: 'r', flow: {} })).toBe(2);
    expect(firstOpenStep({ ...base, requirements: 'r', flow: { contextSkipped: true } })).toBe(3);
  });
  it('a submitted document sits on the last step, and a bad stored step is clamped', () => {
    expect(currentStep({ ...base, flow: { submittedAt: 'now', step: 2 } })).toBe(10);
    expect(currentStep({ ...base, flow: { step: 99 } })).toBe(1);
    expect(currentStep({ ...base, flow: { step: 4 } })).toBe(4);
  });
  it('a step stored before the naturalize step existed means the same step one place later', () => {
    expect(currentStep({ ...base, flow: { step: 7 } })).toBe(8);
    expect(currentStep({ ...base, flow: { step: 9 } })).toBe(10);
    expect(currentStep({ ...base, flow: { step: 6 } })).toBe(6);
    expect(currentStep({ ...base, flow: { step: 7, v: 2 } })).toBe(7);
  });
});

describe('prompts', () => {
  const i = { title: '高橋 report', request: '1) Summary\n2) Relate to your research', context: '[Gmail: notes]\nlecture facts', me: ME, due: 'Tue 17 Nov 17:00', budget: { unit: 'words' as const, min: 240, max: 290 } };
  it('the research prompt carries the request verbatim, the context and ME, and does not ask for the report', () => {
    const p = researchPrompt(i);
    expect(p).toContain('1) Summary\n2) Relate to your research');
    expect(p).toContain('lecture facts');
    expect(p).toContain(ME);
    expect(p).toContain('do not write the report');
    expect(p).not.toContain('—');
  });
  it('the draft prompt uses only the sheet, names every requirement and the length', () => {
    const p = draftPrompt({ ...i, research: 'verified fact' });
    expect(p).toContain('verified fact');
    expect(p).toContain('NEED:');
    expect(p).toContain('240 to 290 words');
    expect(p).toContain('CHECK:');
  });
  it('an empty sheet tells the model to ask for facts', () => {
    expect(draftPrompt({ ...i, context: '' })).toContain('(none yet');
  });
});

describe('ME.md', () => {
  const file = '# ME\n\nintro\n\n## The block\n\nME. Eduardo.\nSecond line.\n\n## Facts about the research\n\nz\n\n## Language rule for Japanese output\n\n**His instruction, 2026-11-16:** "keep it." Keep DFT.\n';
  it('extracts the block and the Japanese rule', () => {
    expect(meBlock(file)).toBe('ME. Eduardo.\nSecond line.');
    expect(meJaRule(file)).toBe('"keep it." Keep DFT.');
    expect(meJaRule('nothing')).toBe('');
  });
});

describe('decodeText', () => {
  const buf = (bytes: number[]) => new Uint8Array(bytes).buffer;
  it('reads UTF-16 with a BOM, UTF-8 with and without, and falls back to Shift-JIS', () => {
    expect(decodeText(buf([0xff, 0xfe, 0x42, 0x30, 0x41, 0x00]))).toBe('あA');
    expect(decodeText(buf([0xfe, 0xff, 0x30, 0x42]))).toBe('あ');
    expect(decodeText(buf([0xef, 0xbb, 0xbf, 0x41]))).toBe('A');
    expect(decodeText(new TextEncoder().encode('こんにちは').buffer as ArrayBuffer)).toBe('こんにちは');
    expect(decodeText(buf([0x82, 0xa0]))).toBe('あ');
  });
});

describe('the lecture-report workflow', () => {
  const i = { title: '高橋 report', request: 'Lecture report. 各テーマを1000〜2000字程度にまとめること。 【講義内容】【考察】', context: '[Gmail: transcript]\nfacts', me: ME };
  it('reads the Japanese character range from the assignment text', () => {
    expect(jaBudgetOf({ requirements: i.request })).toEqual({ min: 1000, max: 2000 });
    expect(jaBudgetOf({ requirements: 'Write about it.' })).toBeUndefined();
  });
  it('a lecture in Japanese means the draft is in English for translation, sized to the character range', () => {
    const p = draftPrompt({ ...i, submitLang: submitLang({ lectureLanguage: 'ja' }), jaBudget: { min: 1000, max: 2000 } });
    expect(p).toContain('submitted in Japanese');
    expect(p).toContain('translates cleanly');
    expect(p).toMatch(/Length: about \d+ to \d+ words/);
    expect(p).toContain('1000 to 2000 characters');
    expect(submitLang({ lectureLanguage: 'en' })).toBeUndefined();
  });
  it('the lecture style carries the rules he gave: chronology, the lecturer, explained terms, long sentences', () => {
    const p = draftPrompt(i);
    for (const k of ['chronological order', 'Then the lecturer talked about', 'the lecturer', 'Explain every abbreviation', 'long, flowing sentences', 'No em dashes']) expect(p).toContain(k);
    expect(styleFor(undefined, i.request)).toBe(LECTURE_STYLE);
    expect(styleFor(undefined, 'Write a summary of the paper')).toBe(GENERAL_STYLE);
    expect(styleFor('Only this.', i.request)).toBe('Only this.');
  });
  it('his opinion notes go in the prompt, and an assignment that asks for an opinion without notes asks for them', () => {
    expect(draftPrompt({ ...i, opinion: 'It struck me that methods decide what we see.' })).toContain('methods decide what we see');
    expect(draftPrompt({ ...i, request: 'Write your own opinion (考察).' })).toContain('write NEED:');
    expect(draftPrompt({ ...i, request: 'Summarise.' })).not.toContain('MY OPINION NOTES');
  });
  it('the header defaults to the Japanese report header and can be emptied', () => {
    expect(headerFor(undefined)).toBe(DEFAULT_HEADER);
    expect(headerFor({ header: '' })).toBe('');
    expect(DEFAULT_HEADER).toContain('氏名：Eduardo Bogado');
  });
});
