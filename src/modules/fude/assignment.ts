/** The assignment check: does the text do everything the instructions ask? Asked by the app, judged by the helper. */
export type ReqStatus = 'met' | 'partial' | 'missing';
/** `deferred`: a language or length requirement on an English draft, judged on the Japanese after translation. It is not a gap. */
export interface ReqItem { req: string; status: ReqStatus; evidence: string; gap: string; deferred?: boolean }
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

/** The claims of a text against his sources: each with the verbatim quote that backs it, or none. */
export type ClaimStatus = 'supported' | 'weak' | 'unsupported';
export interface ClaimItem { claim: string; status: ClaimStatus; quote: string; note: string }
export interface SourcesCheck {
  status: 'requested' | 'working' | 'ready' | 'error';
  text: string;
  items?: ClaimItem[];
  message?: string;
  at?: string;
}
export const CLAIM_LABEL: Record<ClaimStatus, string> = { supported: 'Supported', weak: 'Check', unsupported: 'No source' };
/** Claims still to resolve: anything not fully supported. */
export const unresolvedClaims = (items: ClaimItem[]): number => items.filter((i) => i.status !== 'supported').length;

export const STATUS_LABEL: Record<ReqStatus, string> = { met: 'Done', partial: 'Weak', missing: 'Missing' };
