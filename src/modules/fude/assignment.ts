/** The assignment check: does the text do everything the instructions ask? Asked by the app, judged by the helper. */
export type ReqStatus = 'met' | 'partial' | 'missing';
export interface ReqItem { req: string; status: ReqStatus; evidence: string; gap: string }
export interface AssignmentCheck {
  status: 'requested' | 'working' | 'ready' | 'error';
  /** The text that was judged, exactly as it was when asked. */
  text: string;
  items?: ReqItem[];
  message?: string;
  at?: string;
}

/** One line for the top of the results: how many items are fully met. Empty list is not "all met". */
export function tally(items: ReqItem[]): { met: number; total: number; done: boolean } {
  const met = items.filter((i) => i.status === 'met').length;
  return { met, total: items.length, done: items.length > 0 && met === items.length };
}

export const STATUS_LABEL: Record<ReqStatus, string> = { met: 'Done', partial: 'Weak', missing: 'Missing' };
