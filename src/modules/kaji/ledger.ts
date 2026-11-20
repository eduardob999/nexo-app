import type { Member } from './model';

/**
 * The household ledger, in whole yen. One entry is either an expense (someone paid, and it is split between people by weights) or a
 * settlement (someone paid the other back). Balances follow from the entries alone, so editing or deleting one corrects everything.
 */
export interface LedgerEntry {
  id: string;
  at: number;
  by: string;
  paidBy: string;
  amount: number;
  text: string;
  kind: 'expense' | 'settle';
  /** Weights by uid: who the cost is for. Equal when absent. */
  split?: Record<string, number>;
}

function sharesOf(e: LedgerEntry, uids: string[]): Record<string, number> {
  const w = e.split && Object.values(e.split).some((x) => x > 0) ? e.split : Object.fromEntries(uids.map((u) => [u, 1]));
  const sum = Object.values(w).reduce((a, b) => a + Math.max(0, b), 0) || 1;
  return Object.fromEntries(Object.entries(w).map(([u, x]) => [u, (e.amount * Math.max(0, x)) / sum]));
}

/** Net position by uid: positive means the others owe that person, negative means that person owes. Sums to zero. */
export function balances(entries: LedgerEntry[], members: Pick<Member, 'uid'>[]): Record<string, number> {
  const uids = members.map((m) => m.uid);
  const net: Record<string, number> = Object.fromEntries(uids.map((u) => [u, 0]));
  for (const e of entries) {
    if (!(e.amount > 0) || !(e.paidBy in net)) continue;
    net[e.paidBy] = (net[e.paidBy] ?? 0) + e.amount;
    for (const [u, share] of Object.entries(sharesOf(e, uids))) if (u in net) net[u] = (net[u] ?? 0) - share;
  }
  return net;
}

/** For two people: who should pay whom how much to be even. Null when already even to the yen. */
export function settleUp(net: Record<string, number>): { from: string; to: string; amount: number } | null {
  const rows = Object.entries(net).sort((a, b) => a[1] - b[1]);
  const debtor = rows[0], creditor = rows[rows.length - 1];
  if (!debtor || !creditor || debtor[0] === creditor[0]) return null;
  const amount = Math.round(Math.min(-debtor[1], creditor[1]));
  return amount >= 1 ? { from: debtor[0], to: creditor[0], amount } : null;
}

/** Spending paid out and total per month (YYYY-MM, local time of the zone), settlements excluded. */
export function monthTotals(entries: LedgerEntry[], month: string, tz = 540): { total: number; byPayer: Record<string, number> } {
  const byPayer: Record<string, number> = {};
  let total = 0;
  for (const e of entries) {
    if (e.kind !== 'expense' || new Date(e.at + tz * 60_000).toISOString().slice(0, 7) !== month) continue;
    total += e.amount;
    byPayer[e.paidBy] = (byPayer[e.paidBy] ?? 0) + e.amount;
  }
  return { total, byPayer };
}

export const yen = (n: number): string => '¥' + Math.round(n).toLocaleString('en-US');

/** "1,200", "¥1200", "1200円" and "1 200" all mean 1200. Returns 0 when it is not a positive whole amount. */
export function parseYen(raw: string): number {
  const digits = raw.replace(/[,，\s¥￥円]/g, '').replace(/[０-９]/g, (c) => String(c.charCodeAt(0) - 0xff10));
  return /^\d{1,9}$/.test(digits) ? Number(digits) : 0;
}
