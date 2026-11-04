import { useState } from 'react';
import type { Draft } from './types';

interface Props {
  drafts: Draft[];
  onCopied: (id: string) => void;
  onSent: (id: string) => void;
  onDiscard: (id: string) => void;
  onSend: (draft: Draft) => void;
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

const SEND_VALID_MS = 6 * 3600_000;

function hhmm(iso?: string): string {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
}

function SentLine({ draft }: { draft: Draft }) {
  const to = (draft.to ?? []).join(', ');
  return (
    <li className="draft sent-line">
      <span className="who">SENT · {hhmm(draft.sentAt)}{draft.sentVia === 'elsewhere' ? ' · by you, elsewhere' : ''}</span>
      <span>{draft.subject ?? draft.topic ?? draft.id}{to ? ` to ${to}` : ''}</span>
    </li>
  );
}

function DraftCard({ draft, onCopied, onSent, onDiscard, onSend }: { draft: Draft } & Omit<Props, 'drafts'>) {
  const [flash, setFlash] = useState(false);
  const [armed, setArmed] = useState(false);
  const requested = draft.sendRequestedAt && Date.now() - Date.parse(draft.sendRequestedAt) < SEND_VALID_MS;
  const arm = () => {
    if (!armed) {
      setArmed(true);
      window.setTimeout(() => setArmed(false), 6000);
      return;
    }
    setArmed(false);
    onSend(draft);
  };
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
          {requested ? (
            <p className="send-wait">Send requested {hhmm(draft.sendRequestedAt)}. Nexo sends it on its next run; press Call Nexo to hurry it.</p>
          ) : (
            <button className={`send-main ${armed ? 'armed' : ''}`} onClick={arm}>
              {armed ? 'Tap again to send' : 'Send'}
            </button>
          )}
          {armed ? <p className="send-confirm">{to ? `To ${to}` : 'No address on this draft'}{draft.subject ? ` · ${draft.subject}` : ''}</p> : null}
          <div className="draft-actions">
            <button className="copy-main alt" onClick={copy}>{flash || draft.copiedAt ? 'Copy again' : 'Copy'}</button>
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

export function Drafts({ drafts, onCopied, onSent, onDiscard, onSend }: Props) {
  const waiting = drafts.filter((d) => d.status !== 'sent');
  const dayAgo = Date.now() - 24 * 3600_000;
  const sent = drafts.filter((d) => d.status === 'sent' && Date.parse(d.sentAt ?? '') > dayAgo);
  return (
    <main className="screen">
      <header className="top">
        <div>
          <span className="kicker">READY TO SEND</span>
          <h1>Drafts</h1>
        </div>
      </header>
      {waiting.length === 0 ? <p className="empty">No drafts waiting.</p> : null}
      <ul className="drafts">
        {waiting.map((d) => <DraftCard key={d.id} draft={d} onCopied={onCopied} onSent={onSent} onDiscard={onDiscard} onSend={onSend} />)}
        {sent.map((d) => <SentLine key={d.id} draft={d} />)}
      </ul>
    </main>
  );
}
