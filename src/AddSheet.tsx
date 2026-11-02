import { useState } from 'react';

interface Props {
  onAdd: (text: string, forWho: 'you' | 'nexo') => void;
  onClose: () => void;
}

export function AddSheet({ onAdd, onClose }: Props) {
  const [text, setText] = useState('');
  const [forWho, setForWho] = useState<'you' | 'nexo'>('you');
  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onAdd(t, forWho);
    onClose();
  };
  return (
    <div className="scrim" onClick={onClose}>
      <form className="sheet" role="dialog" aria-label="Add a task" onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <div className="grab" />
        <label className="sr" htmlFor="add-text">New task</label>
        <input id="add-text" className="add-input" autoFocus placeholder="What needs doing?" value={text}
          onChange={(e) => setText(e.target.value)} />
        <div className="sheet-foot">
          <button type="button" className="chip-btn" onClick={() => setForWho(forWho === 'you' ? 'nexo' : 'you')}>
            For {forWho === 'you' ? 'me' : 'Nexo'}
          </button>
          <button type="submit" className="send" aria-label="Add task" disabled={!text.trim()}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
          </button>
        </div>
      </form>
    </div>
  );
}
