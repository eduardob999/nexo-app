/**
 * Profiles: what differs between one kind of writing and another. A document points at a profile; the editor,
 * the counters and the reviewer read the profile and nothing else about the purpose.
 * The rules of `report-en` are ported from report-system/tools/suggest-ui/suggest.py (DEFAULT_RULES r1, r2, r4).
 */
export type Sev = 'info' | 'warn' | 'error';
export interface Rule { id: string; pattern: string; flags?: string; sev: Sev; msg: string }
export interface Budget { unit: 'words' | 'chars'; min?: number; max?: number }
export interface Profile { id: string; name: string; hint: string; lang: 'en' | 'ja' | 'any'; budget?: Budget; rules: Rule[] }

const NO_EM_DASH: Rule = { id: 'em-dash', pattern: '—', sev: 'warn', msg: 'Em dash (house style: no em dashes in prose).' };

export const PROFILES: Profile[] = [
  {
    id: 'report-en', name: 'Lecture report (English)', hint: 'Word budget, no decimals in percentages, no claims about what you did', lang: 'en',
    budget: { unit: 'words', min: 240, max: 290 },
    rules: [
      { id: 'r1', pattern: '\\d+\\.\\d+\\s?(%|percent)', flags: 'i', sev: 'error', msg: 'Decimal in a percentage (rule: no decimals in percentages).' },
      NO_EM_DASH,
      { id: 'r4', pattern: '\\bI (did|performed|ran|used|built|made)\\b', sev: 'warn', msg: 'A claim about what you did: only allowed if you confirmed it.' },
    ],
  },
  { id: 'email', name: 'Email', hint: 'No em dashes; the register is set when the reviewer reads it', lang: 'any', rules: [NO_EM_DASH] },
  { id: 'free', name: 'Free writing', hint: 'No rules, just the counters', lang: 'any', rules: [] },
];

export const profileById = (id: string): Profile => PROFILES.find((p) => p.id === id) ?? (PROFILES[PROFILES.length - 1] as Profile);

export interface Hit { rule: string; sev: Sev; msg: string; match: string; index: number }
export interface Lint { words: number; chars: number; budget?: Budget; over: boolean; under: boolean; hits: Hit[] }

export function countWords(text: string): number {
  return (text.match(/[A-Za-z0-9][A-Za-z0-9'’-]*/g) ?? []).length;
}
export const countChars = (text: string): number => Array.from(text.replace(/\s+/g, '')).length;

export function lintText(text: string, profile: Profile, budget: Budget | undefined = profile.budget): Lint {
  const words = countWords(text);
  const chars = countChars(text);
  const hits: Hit[] = [];
  for (const r of profile.rules) {
    const re = new RegExp(r.pattern, `${r.flags ?? ''}g`);
    for (const m of text.matchAll(re)) hits.push({ rule: r.id, sev: r.sev, msg: r.msg, match: m[0], index: m.index ?? 0 });
  }
  hits.sort((a, b) => a.index - b.index);
  const n = budget?.unit === 'chars' ? chars : words;
  return {
    words, chars, ...(budget ? { budget } : {}), hits,
    over: !!budget?.max && n > budget.max,
    under: !!budget?.min && text.trim() !== '' && n < budget.min,
  };
}
