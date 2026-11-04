import type React from 'react';
import { useState } from 'react';
import { usePersisted } from './persist';
import { parseQuickAdd } from './parse';
import { dueText } from './urgency';

interface Props {
  onAdd: (title: string, forWho: 'you' | 'nexo', due: string | null, prio: 'high' | 'normal' | 'low') => void;
  onClose: () => void;
}

/** The typed text with recognised dates and times marked, drawn behind a transparent textarea. */
function Mirror({ text, tokens }: { text: string; tokens: { start: number; end: number }[] }) {
  const out: (string | React.JSX.Element)[] = [];
  let at = 0;
  tokens.forEach((k, i) => {
    out.push(text.slice(at, k.start));
    out.push(<mark key={i}>{text.slice(k.start, k.end)}</mark>);
    at = k.end;
  });
  out.push(text.slice(at) + '​');
  return <div className="mirror" aria-hidden="true">{out}</div>;
}

export function AddSheet({ onAdd, onClose }: Props) {
  const [text, setText] = usePersisted('add');
  const [forWho, setForWho] = useState<'you' | 'nexo'>('you');
  const [prio, setPrio] = useState<'high' | 'normal' | 'low'>('normal');
  const now = new Date();
  const parsed = parseQuickAdd(text, now);
  const submit = () => {
    if (!parsed.title) return;
    onAdd(parsed.title, forWho, parsed.due, prio);
    onClose();
  };
  return (
    <div className="scrim" onClick={onClose}>
      <form className="sheet" role="dialog" aria-label="Add a task" onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <div className="grab" />
        <div className="field">
          <Mirror text={text} tokens={parsed.tokens} />
          <label className="sr" htmlFor="add-text">New task</label>
          <textarea id="add-text" className="add-input" autoFocus rows={1} placeholder="What needs doing? Try “call the office tomorrow 3pm”"
            value={text} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }} />
        </div>
        <div className="chips">
          <span className={`chip ${parsed.due ? 'on' : ''}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M4 10h16M9 3v4M15 3v4" /></svg>
            {parsed.due ? dueText({ id: 'x', status: 'open', for: 'you', due: parsed.due }, now) : 'Today'}
          </span>
        </div>
        <div className="seg" role="group" aria-label="Priority">
          {([['high', 'Now'], ['normal', 'Soon'], ['low', 'Whenever']] as const).map(([v, label]) => (
            <button type="button" key={v} aria-pressed={prio === v} onClick={() => setPrio(v)}>{label}</button>
          ))}
        </div>
        <div className="sheet-foot">
          <button type="button" className="chip-btn" onClick={() => setForWho(forWho === 'you' ? 'nexo' : 'you')}>
            For {forWho === 'you' ? 'me' : 'Nexo'}
          </button>
          <button type="submit" className="send" aria-label="Add task" disabled={!parsed.title}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
          </button>
        </div>
      </form>
    </div>
  );
}
