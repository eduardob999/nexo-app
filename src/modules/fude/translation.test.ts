import { describe, expect, it } from 'vitest';
import { translationPrompt, type GlossaryItem } from './translation';

const items: GlossaryItem[] = [
  { kind: 'term', en: 'Phos-tag SDS-PAGE', ja: 'Phos-tag SDS-PAGE', note: 'keep in Latin letters' },
  { kind: 'term', en: 'end-point measurement', ja: '終点測定', note: '' },
  { kind: 'name', en: 'Watanabe et al.', ja: '', note: 'keep the Latin spelling' },
  { kind: 'nuance', en: 'fits the mutant being unable', ja: '', note: 'consistent with, not proof' },
];

describe('translationPrompt', () => {
  const p = translationPrompt('  Hello world.  ', items);
  it('carries the text between markers, trimmed', () => expect(p).toContain('--- ENGLISH TEXT ---\nHello world.\n--- END ---'));
  it('lists terms with their rendering and names without guessing', () => {
    expect(p).toContain('- Phos-tag SDS-PAGE (keep as written): keep in Latin letters');
    expect(p).toContain('- end-point measurement → 終点測定');
    expect(p).toContain('- Watanabe et al.: keep the Latin spelling');
    expect(p).toContain('- fits the mutant being unable: consistent with, not proof');
  });
  it('keeps the headings it finds and none it does not', () => {
    expect(translationPrompt('【考察】\nx', [])).toContain('Keep the headings 【考察】');
    expect(translationPrompt('plain', [])).not.toContain('headings');
  });
  it('leaves out an empty section', () => expect(translationPrompt('x', [])).not.toContain('TERMS'));
  it('mentions a character cap only for a character budget', () => {
    expect(translationPrompt('x', [], { budget: { unit: 'chars', max: 1000 } })).toContain('at most 1000 Japanese characters');
    expect(p).not.toContain('Japanese characters in total');
  });
});

describe('translationPrompt in the assignment flow', () => {
  it('carries the request, the background and the Japanese rule when given, and nothing extra when not', () => {
    const plain = translationPrompt('Hello.', []);
    expect(plain).not.toContain('WHAT THE REPORT IS FOR');
    const p = translationPrompt('Hello.', [], { request: '1) Summary', jaRule: 'Keep DFT in Latin letters.', context: 'lecture notes' });
    expect(p).toContain('WHAT THE REPORT IS FOR');
    expect(p).toContain('1) Summary');
    expect(p).toContain('- Keep DFT in Latin letters.');
    expect(p).toContain('lecture notes');
  });
});

describe('translationPrompt for a Japanese report with a length range and a header', () => {
  const p = translationPrompt('Hello.', [], { jaBudget: { min: 1000, max: 2000 }, header: '2026年11月11日 高橋先生の講義レポート\n氏名：Eduardo Bogado' });
  it('asks for a literal translation and a complete one even when it is over the limit', () => {
    expect(p).toContain('as literally as possible');
    expect(p).toContain('1000 to 2000 characters');
    expect(p).toContain('Do not shorten or cut anything on your own');
    expect(p).toContain('list which sentences could be dropped');
  });
  it('carries the header lines exactly and asks for the character count', () => {
    expect(p).toContain('HEADER');
    expect(p).toContain('2026年11月11日 高橋先生の講義レポート\n氏名：Eduardo Bogado');
    expect(p).toContain('one line with the character count');
  });
});
