/**
 * The shared-house search (Eduardo and Carla, move-in March 2027), as pure data and arithmetic. No Firestore here.
 *
 * Every piece is one document in households/{hid}/settings with `kind: 'kaji-housing'`, the same place and the same `kind` filter the
 * household money share already uses (moneystore.ts), so the existing rules cover it and two people editing different rows never
 * overwrite each other. The seed comes from PM/projects/shared-house.md (2026-11-24).
 */
export const HOUSING_KIND = 'kaji-housing';

export type StepStatus = 'todo' | 'doing' | 'done' | 'blocked';
export type Owner = 'eduardo' | 'carla' | 'nexo' | 'agent';
export type ListingStatus = 'idea' | 'contact' | 'viewing' | 'applied' | 'won' | 'dropped';
export type Cohab = 'yes' | 'no' | 'ask';
export type DocPerson = 'eduardo' | 'carla' | 'both';

/** A must-have. `firm` true: cannot give; false: can give; null: not decided yet. */
export interface Chip { id: string; text: string; firm: boolean | null }
export interface HBrief { part: 'brief'; id: string; chips: Chip[]; rentCap: number; moveIn: string; visaExpiry: string; leaseYears: number }
export interface HStep { part: 'step'; id: string; n: number; title: string; detail: string; status: StepStatus; owner: Owner; due: string; note: string }
export const COST_KEYS = ['deposit', 'keyMoney', 'agentFee', 'firstMonth', 'guarantor', 'insurance', 'keyExchange'] as const;
export type CostKey = (typeof COST_KEYS)[number];
export interface HListing {
  part: 'listing'; id: string; name: string; url: string; area: string; stations: string;
  /** Typed as the person wrote it: "58000", "¥58,000", "5.8万". Empty means not known yet. */
  rent: string; mgmt: string;
  /** Each also accepts months of rent: "1m", "1ヶ月", "0.5 month". Empty means to fill. First month left empty is taken as rent plus fee. */
  deposit: string; keyMoney: string; agentFee: string; firstMonth: string; guarantor: string; insurance: string; keyExchange: string;
  cohab: Cohab; status: ListingStatus; viewing: string; note: string; at: number; by: string;
}
export interface HDoc { part: 'doc'; id: string; person: DocPerson; text: string; done: boolean; at: number }
export interface HSource { part: 'source'; id: string; url: string; text: string; note: string; at: number; by: string }
export type HAny = HBrief | HStep | HListing | HDoc | HSource;

export interface HousingState { brief: HBrief | null; steps: HStep[]; listings: HListing[]; docs: HDoc[]; sources: HSource[] }

export function split(all: HAny[]): HousingState {
  const out: HousingState = { brief: null, steps: [], listings: [], docs: [], sources: [] };
  for (const d of all) {
    if (d.part === 'brief') out.brief = d;
    else if (d.part === 'step') out.steps.push(d);
    else if (d.part === 'listing') out.listings.push(d);
    else if (d.part === 'doc') out.docs.push(d);
    else if (d.part === 'source') out.sources.push(d);
  }
  out.steps.sort((a, b) => a.n - b.n);
  out.listings.sort((a, b) => a.at - b.at);
  out.docs.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  out.sources.sort((a, b) => b.at - a.at);
  return out;
}

// ---- money

/** Yen from what a person typed: digits with ¥, commas, 円 or spaces, or 万 (ten thousand). Null when empty or unreadable. */
export function parseYenText(raw: string): number | null {
  const s = raw.trim().replace(/[¥￥,，\s]/g, '').replace(/円$/, '');
  if (!s) return null;
  const man = /^(\d+(?:\.\d+)?)万$/.exec(s);
  if (man) return Math.round(Number(man[1]) * 10_000);
  if (!/^\d+(?:\.\d+)?$/.test(s)) return null;
  return Math.round(Number(s));
}

const MONTHS = /^(\d+(?:\.\d+)?)\s*(?:m|mo|month|months|ヶ月|か月|ヵ月|カ月|ケ月)$/i;

/** A cost that may be written in months of rent. Null when empty, unreadable, or in months while the rent is unknown. */
export function parseCost(raw: string, rent: number | null): number | null {
  const m = MONTHS.exec(raw.trim());
  if (m) return rent === null ? null : Math.round(Number(m[1]) * rent);
  return parseYenText(raw);
}

/** Rent plus management fee. `missing` names what is still to fill. */
export function monthly(l: Pick<HListing, 'rent' | 'mgmt'>): { value: number | null; missing: ('rent' | 'mgmt')[] } {
  const rent = parseYenText(l.rent);
  const mgmt = parseYenText(l.mgmt);
  const missing: ('rent' | 'mgmt')[] = [];
  if (rent === null) missing.push('rent');
  if (mgmt === null) missing.push('mgmt');
  return { value: rent === null ? null : rent + (mgmt ?? 0), missing };
}

export interface Upfront { total: number; parts: Record<CostKey, number | null>; missing: CostKey[]; assumed: CostKey[]; complete: boolean }

/** The up-front total: the sum of every cost known so far, with what is still missing named, so a partial total is never shown as final. */
export function upfront(l: HListing): Upfront {
  const rent = parseYenText(l.rent);
  const parts = {} as Record<CostKey, number | null>;
  const missing: CostKey[] = [];
  const assumed: CostKey[] = [];
  for (const k of COST_KEYS) {
    let v = parseCost(l[k], rent);
    if (v === null && k === 'firstMonth' && l.firstMonth.trim() === '') {
      const mo = monthly(l);
      if (mo.value !== null) { v = mo.value; assumed.push(k); }
    }
    parts[k] = v;
    if (v === null) missing.push(k);
  }
  const total = COST_KEYS.reduce((s, k) => s + (parts[k] ?? 0), 0);
  return { total, parts, missing, assumed, complete: missing.length === 0 };
}

/** Up-front cost in months of rent, the way listings and agents talk about it ("about 4 to 6 months"). */
export function upfrontMonths(l: HListing): number | null {
  const rent = parseYenText(l.rent);
  if (!rent) return null;
  return Math.round((upfront(l).total / rent) * 10) / 10;
}

export function overCap(l: HListing, cap: number): boolean {
  const m = monthly(l).value;
  return m !== null && cap > 0 && m > cap;
}

// ---- the visa and the lease

/** Whole months from the first of `moveIn` (YYYY-MM) to `expiry` (YYYY-MM-DD), rounded down. */
export function monthsBetween(moveIn: string, expiry: string): number | null {
  const a = /^(\d{4})-(\d{2})$/.exec(moveIn);
  const b = /^(\d{4})-(\d{2})-(\d{2})$/.exec(expiry);
  if (!a || !b) return null;
  return (Number(b[1]) - Number(a[1])) * 12 + (Number(b[2]) - Number(a[2]));
}

export function visaRisk(b: Pick<HBrief, 'moveIn' | 'visaExpiry' | 'leaseYears'>): { months: number; leaseMonths: number; short: boolean } | null {
  const months = monthsBetween(b.moveIn, b.visaExpiry);
  if (months === null) return null;
  const leaseMonths = Math.round(b.leaseYears * 12);
  return { months, leaseMonths, short: months < leaseMonths };
}

// ---- progress

export function stepProgress(steps: HStep[]): { done: number; total: number; next: HStep | null } {
  const done = steps.filter((s) => s.status === 'done').length;
  return { done, total: steps.length, next: steps.find((s) => s.status !== 'done') ?? null };
}

export function docProgress(docs: HDoc[], person: DocPerson): { done: number; total: number } {
  const mine = docs.filter((d) => d.person === person);
  return { done: mine.filter((d) => d.done).length, total: mine.length };
}

/** Overdue: a due date before today that is not done. `today` is YYYY-MM-DD in Tokyo. */
export function overdue(s: HStep, today: string): boolean {
  return s.status !== 'done' && /^\d{4}-\d{2}-\d{2}$/.test(s.due) && s.due < today;
}

// ---- the Nexo helper: one request into the existing asks, which becomes one card on his board

const HELP: Record<number, string> = {
  1: 'Help fix the brief: budget with all up-front costs, route (ourselves or an agent), areas, move-in month, notice periods.',
  2: 'Work out the monthly and up-front budget for a ¥60,000 rent in Kyoto, with each cost named.',
  3: 'Find current listings on SUUMO, HOME\'S, at home and UR that fit the must-haves.',
  4: 'Make the station map: stations on both lines, travel to Uji campus and Yoshida, and Carla\'s commute.',
  5: 'Shortlist the listings: cohabitation allowed, foreigners accepted, under the cap all in, guarantor company accepted.',
  6: 'Draft the contact mail for a viewing and the list of questions and checks for the visit.',
  7: 'List what the application needs from each of us and draft anything that has to be written.',
  8: 'Prepare for screening: emergency contact in Japan, guarantor company, and how to explain the visa dates.',
  9: 'Check the contract: term, renewal fee, early-cancellation clause, who signs, and an end before July 2028.',
  10: 'List the payments, the insurance and the key handover with dates and amounts.',
  11: 'Make the move-in checklist: utilities, 転入届 within 14 days, residence card, bank, phone, post forwarding, garbage rules.',
  12: 'Find the notice period and leaving rules for both current homes and put the dates on the calendar.',
};

export function helpRequest(s: Pick<HStep, 'n' | 'title'>, who: string): string {
  const base = `Housing step ${s.n}, ${s.title}. ${HELP[s.n] ?? 'Help with this step.'}`;
  const out = who ? `${base} (asked by ${who})` : base;
  return out.length > 400 ? out.slice(0, 397) + '...' : out;
}

// ---- the seed, from the brief of 2026-11-24

export const SEED_BRIEF: HBrief = {
  part: 'brief', id: 'housing-brief', rentCap: 60_000, moveIn: '2027-03', visaExpiry: '2028-07-07', leaseYears: 2,
  chips: [
    { id: 'stay', text: 'Stay at least 2 years', firm: null },
    { id: 'keihan', text: 'Near the Keihan main line', firm: null },
    { id: 'second', text: 'And near the Keihan Uji line or the JR Nara line', firm: null },
    { id: 'rent', text: 'Rent at most ¥60,000 a month', firm: null },
    { id: 'pets', text: 'No pets', firm: true },
    { id: 'cohab', text: 'Two unmarried people (二人入居可 or 同棲可)', firm: true },
    { id: 'movein', text: 'Move in March 2027', firm: true },
  ],
};

const S = (n: number, title: string, detail: string, owner: Owner, due: string): HStep =>
  ({ part: 'step', id: `housing-step-${String(n).padStart(2, '0')}`, n, title, detail, status: 'todo', owner, due, note: '' });

/** Due dates follow the brief's timeline for a March move-in, and are first guesses to correct. */
export const SEED_STEPS: HStep[] = [
  S(1, 'Fix the brief', 'Budget with all up-front costs, route, areas, move-in month, notice period at both current homes.', 'eduardo', '2026-12-05'),
  S(2, 'Budget', 'Rent plus management fee (管理費/共益費) plus parking or bike. Up-front is usually 4 to 6 months of rent.', 'nexo', '2026-12-10'),
  S(3, 'Search sources', 'SUUMO, HOME\'S, at home, UR (no key money, guarantor or agent fee), Kyoto Univ. housing, local agents.', 'nexo', '2026-12-15'),
  S(4, 'Station map', 'Stations on both lines that fit, with travel to Uji campus and Yoshida, and Carla\'s commute.', 'nexo', '2026-12-20'),
  S(5, 'Shortlist and filters', 'Cohabitation allowed, foreigners accepted, under the cap all in, guarantor company accepted.', 'nexo', '2027-01-20'),
  S(6, 'Contact and viewing (内見)', 'Questions list, what to photograph, what to check: water pressure, mobile signal, noise, bike parking, trash rules.', 'eduardo', '2027-02-10'),
  S(7, 'Application (入居申込)', 'ID, residence cards, enrollment proof, income or scholarship proof. Screening takes days.', 'eduardo', '2027-02-15'),
  S(8, 'Screening (入居審査)', 'By the landlord and the guarantor company. Emergency contact in Japan.', 'agent', '2027-02-25'),
  S(9, 'Contract (重要事項説明, 賃貸借契約)', 'Check term, renewal fee, early-cancellation clause, who signs. Both names on the lease if possible.', 'eduardo', '2027-03-05'),
  S(10, 'Payment, insurance, keys', 'Pay the up-front costs, take the fire insurance, get the keys.', 'eduardo', '2027-03-10'),
  S(11, 'Move in', 'Electricity, gas (with a visit), water, internet. 転入届 at the ward office within 14 days, residence card, bank, phone, post forwarding, garbage rules.', 'carla', '2027-03-25'),
  S(12, 'Leave the old homes', 'Notice dates (often 1 month ahead, check each contract), cleaning, deposit return. おうばく分館 is university housing: check its rules.', 'eduardo', '2027-02-20'),
];

const PERSONAL = [
  'Passport', 'Residence card (在留カード)', 'Student ID or enrollment certificate', 'Scholarship or income proof (stipend letter, bank balance)',
  'Visa expiry date and renewal plan',
];
const SHARED = [
  'Guarantor company application', 'Emergency contact living in Japan', 'Japanese-language contact person (may be an office)', 'Proof of relationship, if cohabiting is queried',
];

export const SEED_DOCS: HDoc[] = [
  ...(['eduardo', 'carla'] as const).flatMap((p) => PERSONAL.map((text, i): HDoc => ({ part: 'doc', id: `housing-doc-${p}-${i + 1}`, person: p, text, done: false, at: i + 1 }))),
  ...SHARED.map((text, i): HDoc => ({ part: 'doc', id: `housing-doc-both-${i + 1}`, person: 'both', text, done: false, at: 100 + i })),
];

export function seedAll(): HAny[] {
  return [SEED_BRIEF, ...SEED_STEPS, ...SEED_DOCS];
}

export function blankListing(id: string, by: string, at: number): HListing {
  return { part: 'listing', id, name: '', url: '', area: '', stations: '', rent: '', mgmt: '', deposit: '', keyMoney: '', agentFee: '', firstMonth: '', guarantor: '', insurance: '', keyExchange: '', cohab: 'ask', status: 'idea', viewing: '', note: '', at, by };
}

/** A pasted source needs a link or some text; a link must look like one. */
export function sourceProblem(url: string, text: string): 'empty' | 'url' | null {
  const u = url.trim();
  if (!u && !text.trim()) return 'empty';
  if (u && !/^https?:\/\/\S+$/i.test(u)) return 'url';
  return null;
}
