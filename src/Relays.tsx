import { useState } from 'react';
import type { Relay } from './types';

interface Props {
  relays: Relay[];
  /** `answered`: threads whose answer is pasted back and waiting for Nexo to file. */
  mode?: 'open' | 'answered';
  onAnswer: (relay: Relay, text: string) => void;
  onClose: (relay: Relay) => void;
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function RelayCard({ relay, onAnswer, onClose, mode }: { relay: Relay } & Omit<Props, 'relays'>) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [answer, setAnswer] = useState('');
  return (
    <li className="relay">
      <button className="relay-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="relay-id">{relay.id}</span>
        <span className="relay-topic">{relay.topic}</span>
        {relay.target ? <span className="relay-target">{relay.target}{relay.mode ? ` · ${relay.mode}` : ''}</span> : null}
      </button>
      {open ? (
        <div className="relay-body">
          <pre className="relay-prompt">{relay.prompt ?? '(no prompt on this thread)'}</pre>
          <button className="copy-main" onClick={() => { void copy(relay.prompt ?? '').then(setCopied); }}>{copied ? 'Copied' : 'Copy prompt'}</button>
          {mode === 'answered' ? (
            <>
              <p className="group-title">His answer</p>
              <pre className="relay-prompt">{relay.response ?? '(no answer text)'}</pre>
              <div className="draft-actions"><button className="chip-btn" onClick={() => onClose(relay)}>Close thread</button></div>
            </>
          ) : (
            <>
              <label className="sr" htmlFor={`ans-${relay.id}`}>Paste the answer</label>
              <textarea id={`ans-${relay.id}`} className="relay-answer" rows={4} placeholder="Paste the answer here, then Save"
                value={answer} onChange={(e) => setAnswer(e.target.value)} />
              <div className="draft-actions">
                <button className="copy-main alt" disabled={!answer.trim()} onClick={() => { onAnswer(relay, answer.trim()); setAnswer(''); }}>Save answer</button>
                <button className="chip-btn" onClick={() => onClose(relay)}>Close thread</button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </li>
  );
}

/** "To paste elsewhere": the one kind of card whose next move is carrying text to another model. */
export function Relays({ relays, onAnswer, onClose, mode = 'open' }: Props) {
  if (relays.length === 0) return null;
  const title = mode === 'answered' ? 'Answers waiting to be filed' : 'To paste elsewhere';
  return (
    <section className="relays" aria-label={title}>
      <h2 className="band-title">{title} <span>{relays.length}</span></h2>
      <ul className="relay-list">
        {relays.map((r) => <RelayCard key={r.id} relay={r} onAnswer={onAnswer} onClose={onClose} mode={mode} />)}
      </ul>
    </section>
  );
}
