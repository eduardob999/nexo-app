import { describe, expect, it } from 'vitest';
import { driftWarnings, listItems } from './edits';
import { NATURALIZE_HEAD, NATURALIZE_SAFEGUARDS, naturalizePrompt } from './naturalize';

describe('listItems', () => {
  it('splits a numbered or bulleted list and joins wrapped lines', () => {
    expect(listItems('1. Say lecturer instead of he\n2) Make this clearer:\n   the drying sentence\n- Remove students')).toEqual(['Say lecturer instead of he', 'Make this clearer: the drying sentence', 'Remove students']);
  });
  it('treats plain lines as separate items only when marked, otherwise as one', () => {
    expect(listItems('Change he to the lecturer')).toEqual(['Change he to the lecturer']);
    expect(listItems('')).toEqual([]);
  });
});

describe('driftWarnings', () => {
  const before = '【Lecture Content】\n\nThe lecturer began. 12 studies were reviewed.\n\n【Discussion】\n\nI agree.';
  it('is quiet when the shape is kept', () => {
    expect(driftWarnings(before, before.replace('began', 'started'))).toEqual([]);
  });
  it('flags a lost heading, a new number, a lost number, an em dash, a merged paragraph and a big length change', () => {
    const w = driftWarnings(before, '【Lecture Content】\n\nThe lecturer began — and 14 studies were reviewed in a long and very detailed way across many places.\nI agree.');
    expect(w.join(' ')).toContain('headings changed');
    expect(w.join(' ')).toContain('New numbers');
    expect(w.join(' ')).toContain('14');
    expect(w.join(' ')).toContain('disappeared');
    expect(w.join(' ')).toContain('em dash');
    expect(w.join(' ')).toContain('paragraph count');
    expect(w.join(' ')).toContain('length moved');
  });
});

describe('naturalizePrompt', () => {
  it('starts with his instruction, word for word, and carries the text', () => {
    const p = naturalizePrompt('  Some text.  ', false);
    expect(p.startsWith(`${NATURALIZE_HEAD}\n\nSome text.`)).toBe(true);
    expect(NATURALIZE_HEAD).toBe('De-AI, humanize and naturalize the following text:');
  });
  it('adds the safeguards on request: facts, headings, long sentences, term explanations, no em dashes', () => {
    const p = naturalizePrompt('x', true);
    for (const r of NATURALIZE_SAFEGUARDS) expect(p).toContain(r);
    expect(p).toContain('Keep every fact');
    expect(p).toContain('Do not use em dashes');
  });
});

describe('naturalize sequence', () => {
  it('builds the four messages in his words', async () => {
    const m = await import('./naturalize');
    expect(m.naturalizeExamplePrompt(' Ex. ')).toBe(`${m.EXAMPLE_HEAD}\n\nEx.\n`);
    expect(m.naturalizeDiagnosePrompt('  T  ')).toBe('Where does it feel unnatural?\n\nT\n');
    expect(m.naturalizeApplyPrompt()).toContain('Apply your suggestions as much as they comply with the constraints');
  });
  it('the check message lists every safeguard once', async () => {
    const m = await import('./naturalize');
    const p = m.naturalizeCheckPrompt();
    expect(p.startsWith('Before applying those changes, do they comply with this:')).toBe(true);
    for (const r of m.NATURALIZE_SAFEGUARDS) expect(p.split(r).length - 1).toBe(1);
  });
  it('is four steps in order', async () => {
    const m = await import('./naturalize');
    expect(m.NATURALIZE_SEQUENCE.map((s) => s.key)).toEqual(['example', 'diagnose', 'check', 'apply']);
  });
});
