import { useState } from 'react';
import type { Note } from './documents';

interface Props {
  text: string;
  notes: Note[];
  reviewing: boolean;
  paused: boolean;
  suggest: boolean;
  onPause: (paused: boolean) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
}

/** Counters and bulk actions above the editor: how many suggestions are open, accept or reject all, copy the text, pause the automatic review. */
export function SuggestBar({ text, notes, reviewing, paused, suggest, onPause, onAcceptAll, onRejectAll }: Props) {
  const [copied, setCopied] = useState(false);
  const open = notes.filter((n) => n.status === 'open');
  const fixable = open.filter((n) => n.fix);
  const copy = () => {
    void navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }, () => {});
  };
  const state = paused ? 'Review paused' : reviewing ? 'Reviewing…' : 'Review idle';
  return (
    <div className="fude-bar" role="toolbar" aria-label="Suggestions">
      {suggest ? <span className={`fude-chip${reviewing ? ' busy' : ''}${paused ? ' off' : ''}`} role="status">{state}</span> : null}
      {suggest ? <span className="fude-chip">{open.length} open</span> : null}
      {suggest ? <button type="button" className="tool-chip" disabled={!fixable.length} onClick={onAcceptAll}>Accept all{fixable.length ? ` (${fixable.length})` : ''}</button> : null}
      {suggest ? <button type="button" className="tool-chip" disabled={!open.length} onClick={onRejectAll}>Reject all</button> : null}
      {suggest ? <button type="button" className="tool-chip" aria-pressed={paused} onClick={() => onPause(!paused)}>{paused ? 'Resume reviewing' : 'Pause reviewing'}</button> : null}
      <button type="button" className="tool-chip" disabled={!text.trim()} onClick={copy}>{copied ? 'Copied' : 'Copy text'}</button>
    </div>
  );
}
