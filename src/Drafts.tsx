import { useState } from 'react';
import type { Draft } from './types';

interface Props {
  drafts: Draft[];
  onCopied: (id: string) => void;
  onSent: (id: string) => void;
  onDiscard: (id: string) => void;
}

/** Clipboard first; the textarea fallback covers browsers that refuse the async API on a plain page. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
}

function CopyChip({ label, text }: { label: string; text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button className="chip-btn small" onClick={() => { void copyText(text).then((ok) => setDone(ok)); }}>
      {done ? 'Copied' : label}
    </button>
  );
}

function DraftCard({ draft, onCopied, onSent, onDiscard }: { draft: Draft } & Omit<Props, 'drafts'>) {
  const [flash, setFlash] = useState(false);
  const body = draft.text ?? '';
  const to = (draft.to ?? []).join(', ');
  const copy = () => {
    void copyText(body).then((ok) => {
      if (!ok) return;
      setFlash(true);
      onCopied(draft.id);
    });
  };
  return (
    <li className="draft">
      <div className="draft-head">
        <div>
          {to ? <span className="who">TO · {to}</span> : null}
          <h2 className="draft-title">{draft.subject ?? draft.topic ?? draft.id}</h2>
        </div>
        {flash || draft.copiedAt ? <span className="pill-ok">COPIED</span> : null}
      </div>
      {draft.status === 'needs-info' ? (
        <p className="need">Needs from you: {draft.need ?? 'more information'}</p>
      ) : (
        <div className="draft-body">{body}</div>
      )}
      {draft.status === 'drafted' ? (
        <>
          <div className="draft-actions">
            <button className="copy-main" onClick={copy}>{flash || draft.copiedAt ? 'Copy again' : 'Copy'}</button>
            <button className="chip-btn" onClick={() => onSent(draft.id)}>I sent it</button>
          </div>
          <div className="draft-more">
            {draft.subject ? <CopyChip label="Copy subject" text={draft.subject} /> : null}
            {to ? <CopyChip label="Copy address" text={to} /> : null}
            <button className="chip-btn small" onClick={() => onDiscard(draft.id)}>Discard</button>
          </div>
        </>
      ) : (
        <div className="draft-more"><button className="chip-btn small" onClick={() => onDiscard(draft.id)}>Discard</button></div>
      )}
    </li>
  );
}

export function Drafts({ drafts, onCopied, onSent, onDiscard }: Props) {
  return (
    <main className="screen">
      <header className="top">
        <div>
          <span className="kicker">READY TO SEND</span>
          <h1>Drafts</h1>
        </div>
      </header>
      {drafts.length === 0 ? <p className="empty">No drafts waiting.</p> : null}
      <ul className="drafts">
        {drafts.map((d) => <DraftCard key={d.id} draft={d} onCopied={onCopied} onSent={onSent} onDiscard={onDiscard} />)}
      </ul>
    </main>
  );
}
