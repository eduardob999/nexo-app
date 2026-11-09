/**
 * How loudly an assignment should call for him, from the time left and how long the work needs.
 * A long report starts shouting days ahead and a short exercise only on the last day, so the warning
 * arrives when there is still time to do the work, not at a fixed distance from the deadline.
 * relaunch/push_core.py keeps the same estimate and ladder for the phone reminders.
 */
import type { Card } from './types';

export type Heat = 'calm' | 'watch' | 'soon' | 'critical' | 'overdue';
export interface AssignmentHeat { level: Heat; hoursLeft: number; label: string; workHours: number }

/** Hours the work needs: `workHours` on the card when he or Nexo set it, else a guess from the words. */
export function workHours(card: Card & { workHours?: number }): number {
  if (typeof card.workHours === 'number' && card.workHours > 0) return card.workHours;
  const t = `${card.title ?? ''} ${card.last?.text ?? ''}`;
  if (/presentation|slides|発表|プレゼン/i.test(t)) return 8;
  if (/report|essay|レポート|1,?000 char|文字/i.test(t)) return 6;
  if (/quiz|homework|exercise|文型|練習|宿題/i.test(t)) return 2;
  return 3;
}

function dueDate(raw: string): Date {
  return raw.length <= 10 ? new Date(`${raw}T23:59:59`) : new Date(raw);
}

export function leftText(hours: number): string {
  if (hours < 0) {
    const m = Math.round(-hours * 60);
    return m < 60 ? `${m} min late` : m < 2880 ? `${Math.round(m / 60)} h late` : `${Math.round(m / 1440)} days late`;
  }
  if (hours < 1) return `${Math.max(Math.round(hours * 60), 1)} min left`;
  if (hours < 48) {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return hours < 6 && m ? `${h} h ${m} min left` : `${h} h left`;
  }
  const d = Math.floor(hours / 24);
  return `${d} days ${Math.round(hours - d * 24)} h left`;
}

export function assignmentHeat(card: Card & { workHours?: number }, now: Date): AssignmentHeat | null {
  if (card.status === 'done' || !card.due) return null;
  const due = dueDate(card.due);
  if (Number.isNaN(due.getTime())) return null;
  const hoursLeft = (due.getTime() - now.getTime()) / 3_600_000;
  const w = workHours(card);
  let level: Heat;
  if (hoursLeft < 0) level = 'overdue';
  else if (hoursLeft <= Math.max(3, w * 1.5)) level = 'critical';
  else if (hoursLeft <= Math.max(12, w * 4)) level = 'soon';
  else if (hoursLeft <= Math.max(48, w * 10)) level = 'watch';
  else level = 'calm';
  return { level, hoursLeft, label: leftText(hoursLeft), workHours: w };
}

const RANK: Record<Heat, number> = { overdue: 0, critical: 1, soon: 2, watch: 3, calm: 4 };

/** The assignments that need to be on screen right now, tightest first: soon, critical or overdue. */
export function pressing(cards: Card[], now: Date): { card: Card; heat: AssignmentHeat }[] {
  return cards
    .filter((c) => (c.type ?? '').toUpperCase() === 'ASSIGNMENT' && c.status !== 'done')
    .map((card) => ({ card, heat: assignmentHeat(card, now) }))
    .filter((x): x is { card: Card; heat: AssignmentHeat } => !!x.heat && RANK[x.heat.level] <= RANK.soon)
    .sort((a, b) => RANK[a.heat.level] - RANK[b.heat.level] || a.heat.hoursLeft - b.heat.hoursLeft);
}
