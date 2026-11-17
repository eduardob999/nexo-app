/**
 * Length rules for a report that is written in English and submitted in Japanese (or the reverse). Pure.
 * The course states its limit in Japanese characters (1000〜2000字程度); the English draft is sized so the translation lands inside it.
 */
export interface CharBudget { min?: number; max?: number }

/** Japanese characters the way the course counts them: everything except white space. Headings count, the header does not. */
export const jaChars = (s: string): number => Array.from((s ?? '').replace(/\s+/g, '')).length;

/** Words, the way an editor counts English. */
export const enWords = (s: string): number => (s ?? '').match(/[A-Za-z0-9’'-]+/g)?.length ?? 0;

/**
 * A character range in the assignment's own words: 1000〜2000字, 1000~2000 characters, 1,000 to 2,000 characters.
 * Undefined when the request names none.
 */
export function parseJaBudget(request: string | undefined): CharBudget | undefined {
  const s = (request ?? '').replace(/,/g, '');
  const m = s.match(/(\d{3,5})\s*(?:〜|～|~|-|–|to)\s*(\d{3,5})\s*(?:字|文字|characters|chars)/i);
  if (m) return { min: Number(m[1]), max: Number(m[2]) };
  const up = s.match(/(\d{3,5})\s*(?:字|文字)\s*以内/);
  return up ? { max: Number(up[1]) } : undefined;
}

/** Japanese characters per English word measured on this course's reports (734 words became 1951 characters, 792 became 2105). */
export const JA_PER_EN_WORD = 2.66;

/** The English length that translates into the Japanese budget. Rounded to the nearest 10, with a little room under the ceiling. */
export function englishWordTarget(b: CharBudget | undefined): { min?: number; max?: number } | undefined {
  if (!b || (b.min === undefined && b.max === undefined)) return undefined;
  const r = (n: number) => Math.round(n / 10) * 10;
  return { ...(b.min !== undefined ? { min: r(b.min / JA_PER_EN_WORD) } : {}), ...(b.max !== undefined ? { max: r((b.max * 0.97) / JA_PER_EN_WORD) } : {}) };
}

export interface Verdict { status: 'under' | 'ok' | 'over' | 'none'; chars: number; message: string }

/** Where a Japanese text stands against the budget, in one sentence he can act on. */
export function lengthVerdict(ja: string, b: CharBudget | undefined): Verdict {
  const chars = jaChars(ja);
  const n = (x: number) => x.toLocaleString('en-GB');
  if (!b || (b.min === undefined && b.max === undefined)) return { status: 'none', chars, message: `${n(chars)} characters.` };
  if (b.max !== undefined && chars > b.max) return { status: 'over', chars, message: `${n(chars)} characters: ${n(chars - b.max)} over the limit of ${n(b.max)}. Cut the least important detail in the English and translate again.` };
  if (b.min !== undefined && chars < b.min) return { status: 'under', chars, message: `${n(chars)} characters: ${n(b.min - chars)} under the minimum of ${n(b.min)}.` };
  return { status: 'ok', chars, message: `${n(chars)} characters, inside ${n(b.min ?? 0)}–${n(b.max ?? chars)}.` };
}

/** The submission page's own counter includes the HTML it wraps around each paragraph, so it reads a little higher. */
export const editorCounterNote = 'KULMS\'s editor shows a higher number because it counts its HTML tags (about 100 for ten paragraphs). The course counts your text.';
