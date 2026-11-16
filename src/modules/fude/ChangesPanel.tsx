import { useMemo } from 'react';
import { changedWords, diffWords, revertHunk, revertHunks } from './diff';

interface Props {
  /** The saved version to compare against; undefined when nothing is being tracked. */
  base: string | undefined;
  text: string;
  /** Save a new base (the current text) or stop tracking (null). */
  onBase: (base: string | null) => void;
  /** Replace the text, after a change was reverted. */
  onText: (text: string) => void;
}

/** What differs from the saved version, change by change. Reverting is his; nothing here touches the text unless he taps it. */
export function ChangesPanel({ base, text, onBase, onText }: Props) {
  const hunks = useMemo(() => (base === undefined ? [] : diffWords(base, text)), [base, text]);
  if (base === undefined) {
    return (
      <details className="panel fude-changes">
        <summary>Changes: not tracking</summary>
        <p className="mut">Save this version as the starting point. The panel then lists every change you and the reviewer make after it, and you can revert any one.</p>
        <button type="button" className="tool-chip" disabled={!text.trim()} onClick={() => onBase(text)}>Track changes from now</button>
      </details>
    );
  }
  return (
    <details className="panel fude-changes" open={hunks.length > 0}>
      <summary>{hunks.length ? `Changes: ${hunks.length} (${changedWords(hunks)} words)` : 'Changes: none since the saved version'}</summary>
      <div className="fude-bar">
        <button type="button" className="tool-chip" disabled={!hunks.length} onClick={() => onBase(text)}>Keep all (new starting point)</button>
        <button type="button" className="tool-chip" disabled={!hunks.length} onClick={() => onText(revertHunks(text, hunks))}>Revert all</button>
        <button type="button" className="tool-chip" onClick={() => onBase(null)}>Stop tracking</button>
      </div>
      <ul className="fude-hunks">
        {hunks.map((h) => (
          <li key={`${h.curStart}-${h.id}`}>
            {h.removed ? <del className="fude-del">{h.removed.trim()}</del> : null}
            {h.added ? <ins className="fude-ins">{h.added.trim()}</ins> : null}
            <button type="button" className="tool-chip" onClick={() => onText(revertHunk(text, h))}>Revert</button>
          </li>
        ))}
      </ul>
    </details>
  );
}
