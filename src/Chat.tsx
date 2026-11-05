import { useEffect, useRef } from 'react';
import { CHAT_SUGGESTIONS, chatState, outgoing, type ChatMsg } from './chatlogic';
import { Linkified } from './Linkified';
import { usePersisted } from './persist';
import { stamp } from './Thread';

interface Props {
  msgs: ChatMsg[];
  onBack: () => void;
  onSend: (text: string) => void;
}

export function Chat({ msgs, onBack, onSend }: Props) {
  const [text, setText] = usePersisted('chat-draft');
  const barRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const state = chatState(msgs);

  // The reply bar is fixed, so the page keeps clear of its real height and the last message is never hidden.
  useEffect(() => {
    const bar = barRef.current; const page = pageRef.current;
    if (!bar || !page || typeof ResizeObserver === 'undefined') return;
    const set = () => page.style.setProperty('--reply-h', `${bar.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(bar);
    return () => ro.disconnect();
  }, []);

  // Newest at the bottom: scroll there on open, on a new message and when the thinking bubble appears.
  useEffect(() => {
    window.scrollTo({ top: document.documentElement.scrollHeight });
  }, [msgs.length, state]);

  const send = () => {
    const t = outgoing(text);
    if (!t) return;
    onSend(t);
    setText('');
  };

  return (
    <main className="screen chat" ref={pageRef}>
      <header className="thread-top">
        <button className="icon-btn" aria-label="Back" onClick={onBack}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 5-7 7 7 7" /></svg>
        </button>
        <h1 className="chat-title">Chat with Nexo</h1>
      </header>

      {msgs.length === 0 ? (
        <p className="chat-empty">Ask about your day, or tell Nexo to add or change a card.</p>
      ) : (
        <ol className="bubbles chat-list">
          {msgs.map((m) => {
            const you = m.by === 'you';
            return (
              <li key={m.id} className={`bubble-wrap ${you ? 'you' : 'nexo'}`}>
                <span className="who">{you ? 'YOU' : 'NEXO'} · <span className="mono">{stamp(m.ts)}</span></span>
                <div className="bubble"><Linkified text={m.text} /></div>
                {!you && m.did && m.did.length > 0 ? (
                  <ul className="did" aria-label="What Nexo did">
                    {m.did.map((d, i) => <li key={i} className="did-chip">{d}</li>)}
                  </ul>
                ) : null}
              </li>
            );
          })}
          {state === 'thinking' ? (
            <li className="bubble-wrap nexo" role="status" aria-label="Nexo is thinking">
              <div className="bubble typing" aria-hidden="true"><i /><i /><i /></div>
            </li>
          ) : null}
          {state === 'error' ? <li className="chat-error" role="status">Nexo did not answer, try again</li> : null}
        </ol>
      )}

      <div className="reply-bar" ref={barRef}>
        {msgs.length === 0 ? (
          <div className="qchips" role="group" aria-label="Suggestions">
            {CHAT_SUGGESTIONS.map((q) => (
              <button key={q} type="button" className="qchip" onClick={() => { setText(q); inputRef.current?.focus(); }}>{q.trim()}</button>
            ))}
          </div>
        ) : null}
        <form className="reply-form" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <label className="sr" htmlFor="chat-input">Message to Nexo</label>
          <input id="chat-input" ref={inputRef} className="reply-input" placeholder="Message" enterKeyHint="send" autoComplete="off" value={text} onChange={(e) => setText(e.target.value)} />
          <button type="submit" className="send small" aria-label="Send message" disabled={!text.trim()}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </button>
        </form>
      </div>
    </main>
  );
}
