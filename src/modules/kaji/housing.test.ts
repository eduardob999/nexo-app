import { describe, expect, it } from 'vitest';
import { blankListing, COST_KEYS, docProgress, helpRequest, monthly, monthsBetween, overCap, overdue, parseCost, parseYenText, SEED_BRIEF, SEED_DOCS, SEED_STEPS, seedAll, sourceProblem, split, stepProgress, upfront, upfrontMonths, visaRisk, type HListing } from './housing';

const L = (p: Partial<HListing>): HListing => ({ ...blankListing('l1', 'a', 1), ...p });

describe('housing: reading amounts', () => {
  it('reads yen as people type it', () => {
    expect(parseYenText('58000')).toBe(58000);
    expect(parseYenText('¥58,000')).toBe(58000);
    expect(parseYenText('58,000円')).toBe(58000);
    expect(parseYenText('5.8万')).toBe(58000);
    expect(parseYenText('0')).toBe(0);
    expect(parseYenText('')).toBeNull();
    expect(parseYenText('ask')).toBeNull();
  });
  it('reads months of rent, and gives nothing while the rent is unknown', () => {
    expect(parseCost('1m', 58000)).toBe(58000);
    expect(parseCost('1ヶ月', 58000)).toBe(58000);
    expect(parseCost('0.5 month', 58000)).toBe(29000);
    expect(parseCost('2か月', 50000)).toBe(100000);
    expect(parseCost('1m', null)).toBeNull();
    expect(parseCost('16500', null)).toBe(16500);
  });
});

describe('housing: monthly and up-front costs', () => {
  it('adds the management fee to the rent and names what is missing', () => {
    expect(monthly({ rent: '55000', mgmt: '3000' })).toEqual({ value: 58000, missing: [] });
    expect(monthly({ rent: '55000', mgmt: '' })).toEqual({ value: 55000, missing: ['mgmt'] });
    expect(monthly({ rent: '', mgmt: '3000' })).toEqual({ value: null, missing: ['rent'] });
  });
  it('totals every cost when all are known', () => {
    const u = upfront(L({ rent: '55000', mgmt: '3000', deposit: '1m', keyMoney: '1m', agentFee: '60500', firstMonth: '58000', guarantor: '29000', insurance: '16000', keyExchange: '16500' }));
    expect(u.complete).toBe(true);
    expect(u.missing).toEqual([]);
    expect(u.total).toBe(55000 + 55000 + 60500 + 58000 + 29000 + 16000 + 16500);
  });
  it('counts zero as known (UR: no key money, no agent fee, no guarantor)', () => {
    const u = upfront(L({ rent: '50000', mgmt: '2000', deposit: '2m', keyMoney: '0', agentFee: '0', firstMonth: '52000', guarantor: '0', insurance: '15000', keyExchange: '0' }));
    expect(u.complete).toBe(true);
    expect(u.total).toBe(100000 + 52000 + 15000);
  });
  it('leaves unknown costs as to fill and never calls a partial total complete', () => {
    const u = upfront(L({ rent: '55000', mgmt: '3000', deposit: '1m' }));
    expect(u.complete).toBe(false);
    expect(u.missing).toEqual(['keyMoney', 'agentFee', 'guarantor', 'insurance', 'keyExchange']);
    expect(u.assumed).toEqual(['firstMonth']);
    expect(u.total).toBe(55000 + 58000);
  });
  it('takes an empty first month as rent plus fee, but not when the rent is unknown', () => {
    expect(upfront(L({ rent: '60000', mgmt: '' })).parts.firstMonth).toBe(60000);
    const u = upfront(L({ deposit: '1m', keyMoney: '20000' }));
    expect(u.parts.deposit).toBeNull();
    expect(u.parts.firstMonth).toBeNull();
    expect(u.total).toBe(20000);
    expect(u.missing).toContain('deposit');
  });
  it('a blank listing has every cost to fill and a total of zero', () => {
    const u = upfront(L({}));
    expect(u.missing).toEqual([...COST_KEYS]);
    expect(u.total).toBe(0);
  });
  it('states the up-front cost in months of rent', () => {
    expect(upfrontMonths(L({ rent: '50000', mgmt: '0', deposit: '1m', keyMoney: '1m', agentFee: '0.5m', firstMonth: '50000', guarantor: '0', insurance: '0', keyExchange: '0' }))).toBe(3.5);
    expect(upfrontMonths(L({}))).toBeNull();
  });
  it('flags a listing over the cap all in', () => {
    expect(overCap(L({ rent: '58000', mgmt: '3000' }), 60000)).toBe(true);
    expect(overCap(L({ rent: '57000', mgmt: '3000' }), 60000)).toBe(false);
    expect(overCap(L({}), 60000)).toBe(false);
  });
});

describe('housing: the visa and the lease', () => {
  it('counts 16 months from a March 2027 move-in to the 2028-07-07 expiry, shorter than 2 years', () => {
    expect(monthsBetween('2027-03', '2028-07-07')).toBe(16);
    expect(visaRisk(SEED_BRIEF)).toEqual({ months: 16, leaseMonths: 24, short: true });
    expect(visaRisk({ ...SEED_BRIEF, visaExpiry: '2029-09-30' })?.short).toBe(false);
    expect(visaRisk({ ...SEED_BRIEF, moveIn: 'March' })).toBeNull();
  });
});

describe('housing: seed and progress', () => {
  it('seeds the 12 steps in order, with dates, and the must-haves from the brief', () => {
    expect(SEED_STEPS.map((s) => s.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(SEED_STEPS.every((s) => /^\d{4}-\d{2}-\d{2}$/.test(s.due))).toBe(true);
    expect(new Set(seedAll().map((d) => d.id)).size).toBe(seedAll().length);
    expect(SEED_BRIEF.chips.map((c) => c.id)).toEqual(['stay', 'keihan', 'second', 'rent', 'pets', 'cohab', 'movein']);
    expect(SEED_BRIEF.rentCap).toBe(60000);
  });
  it('seeds documents for each person and for both', () => {
    expect(docProgress(SEED_DOCS, 'eduardo')).toEqual({ done: 0, total: 5 });
    expect(docProgress(SEED_DOCS, 'carla')).toEqual({ done: 0, total: 5 });
    expect(docProgress(SEED_DOCS, 'both').total).toBe(4);
  });
  it('splits the documents by part and orders the steps', () => {
    const st = split([...seedAll()].reverse());
    expect(st.brief?.id).toBe('housing-brief');
    expect(st.steps[0]?.n).toBe(1);
    expect(st.docs).toHaveLength(SEED_DOCS.length);
    const p = stepProgress([{ ...st.steps[0]!, status: 'done' }, ...st.steps.slice(1)]);
    expect(p).toMatchObject({ done: 1, total: 12 });
    expect(p.next?.n).toBe(2);
  });
  it('marks an open step past its date as overdue', () => {
    const s = SEED_STEPS[0]!;
    expect(overdue(s, '2026-12-06')).toBe(true);
    expect(overdue({ ...s, status: 'done' }, '2026-12-06')).toBe(false);
    expect(overdue(s, '2026-12-05')).toBe(false);
  });
  it('writes a Nexo request under the asks limit, naming the step', () => {
    for (const s of SEED_STEPS) {
      const r = helpRequest(s, 'Carla');
      expect(r.length).toBeLessThanOrEqual(400);
      expect(r).toContain(`step ${s.n}`);
    }
  });
  it('needs a link or text for a source, and a real link', () => {
    expect(sourceProblem('', '')).toBe('empty');
    expect(sourceProblem('suumo.jp', '')).toBe('url');
    expect(sourceProblem('https://suumo.jp/x', '')).toBeNull();
    expect(sourceProblem('', 'pasted answer')).toBeNull();
  });
  it('has no em dash in any seeded text', () => {
    const all = JSON.stringify(seedAll());
    expect(all.includes('—')).toBe(false);
  });
});
