/** The prompt he pastes into a general-purpose model to translate his English text into Japanese. Pure, so it can be tested.
 *  The reviewer proposes the glossary (what a translator could get wrong); the app assembles the prompt around it. */
export type GlossaryKind = 'term' | 'name' | 'nuance';
export interface GlossaryItem { kind: GlossaryKind; en: string; ja: string; note: string }
export interface TranslationRequest {
  status: 'requested' | 'working' | 'ready' | 'stale' | 'error';
  /** The text the list is about, exactly as it was when asked. */
  text: string;
  items?: GlossaryItem[];
  message?: string;
  at?: string;
}

const line = (i: GlossaryItem): string => {
  const head = i.ja ? (i.ja === i.en ? `${i.en} (keep as written)` : `${i.en} → ${i.ja}`) : i.en;
  return `- ${head}${i.note ? `: ${i.note}` : ''}`;
};

export function translationPrompt(text: string, items: GlossaryItem[], opts: { budget?: { unit: 'words' | 'chars'; max?: number } | undefined; request?: string | undefined; jaRule?: string | undefined; context?: string | undefined; header?: string | undefined; jaBudget?: { min?: number; max?: number } | undefined } = {}): string {
  const headings = Array.from(new Set(text.match(/【[^】\n]+】/g) ?? []));
  const of = (k: GlossaryKind) => items.filter((i) => i.kind === k);
  const section = (title: string, k: GlossaryKind) => (of(k).length ? `${title}\n${of(k).map(line).join('\n')}\n\n` : '');
  const jb = opts.jaBudget;
  const cap = jb && (jb.min !== undefined || jb.max !== undefined)
    ? `- Length: the Japanese body (from the first heading to the end, without the header, white space not counted) must be ${jb.min ?? 0} to ${jb.max ?? 'any number of'} characters. Do not shorten or cut anything on your own to meet this: deliver the complete translation, and if it is over ${jb.max ?? 'the limit'} say so and list which sentences could be dropped, without dropping them.\n`
    : opts.budget?.unit === 'chars' && opts.budget.max ? `- Length: at most ${opts.budget.max} Japanese characters in total; if the translation would be longer, deliver it complete, say so, and list which sentences could be dropped without dropping them.\n` : '';
  const header = opts.header?.trim() ? `HEADER (start the Japanese with exactly these lines, then a blank line, then the body; plain form here too, no です／ます)\n${opts.header.trim()}\n\n` : '';
  return (
    'Translate the English text below into Japanese for a university report (レポート). It is a student\'s own text: translate what it says and do not add, remove or strengthen any claim.\n\n' +
    (opts.request?.trim() ? `WHAT THE REPORT IS FOR (the assignment, so every choice serves it)\n${opts.request.trim()}\n\n` : '') +
    (opts.context?.trim() ? `BACKGROUND (to resolve ambiguous words; do not translate this part)\n${opts.context.trim().slice(0, 6000)}\n\n` : '') +
    'STYLE\n' +
    (opts.jaRule?.trim() ? `- ${opts.jaRule.trim()}\n` : '') +
    '- Academic report register, である調 throughout (change this line if your course wants です・ます).\n' +
    (headings.length ? `- Keep the headings ${headings.join(' and ')} and the paragraph breaks as they are.\n` : '- Keep the paragraph breaks as they are.\n') +
    '- Keep gene, protein, residue and method names in Latin letters exactly as written (PINK1, Parkin, DJ-1, Ser65, Phos-tag SDS-PAGE, GAPDH, Km, kcat).\n' +
    '- Where the English hedges (suggest, fit, may, appears), the Japanese hedges equally; where it is definite, the Japanese is definite.\n' +
    '- Translate as literally as possible: the same sentences in the same order and the same paragraphs, nothing added, removed, merged, split, summarised or improved; where a literal rendering sounds unnatural change only the grammar and word order needed, never the content. A long English sentence may stay long in Japanese.\n' +
    '- No facts, details, examples or citations that are not in the English. No decimals in percentages. Plain text only: no markdown, bold, bullets or tables.\n' + cap + '\n' + header +
    section('TERMS (use exactly this rendering every time)', 'term') +
    section('NAMES (do not guess kanji; keep the spelling given)', 'name') +
    section('NUANCES (these phrases are easy to bend; keep the meaning stated)', 'nuance') +
    'After the Japanese, add one line with the character count of the body (white space not counted), then a short list headed 翻訳メモ of any place where you had to choose between two readings, and what you chose.\n\n' +
    '--- ENGLISH TEXT ---\n' + text.trim() + '\n--- END ---\n'
  );
}

export type CheckKind = 'meaning' | 'omission' | 'addition' | 'term' | 'hedge' | 'name' | 'style';
export interface CheckNote { find: string; en: string; kind: CheckKind; msg: string; fix: string }
/** His pasted Japanese compared with his English. Asked by the app, answered by the helper; a fix is only a proposal. */
export interface TranslationCheck {
  status: 'requested' | 'working' | 'ready' | 'error';
  english: string;
  japanese: string;
  items?: CheckNote[];
  message?: string;
  at?: string;
}
