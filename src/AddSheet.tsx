import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { connectDrive, driveReady, warmDrive } from './drive';
import { addPicked, removePicked } from './addfiles';
import { usePersisted } from './persist';
import { parseQuickAdd } from './parse';
import { dueText } from './urgency';
import { checklistLines } from './checklistlines';
import { readClipboard } from './clipboard';

interface Props {
  onAdd: (title: string, forWho: 'you' | 'nexo', due: string | null, prio: 'high' | 'normal' | 'low', files: File[], lines: string[], callNow: boolean) => void;
  /** Preview only: files already chosen. */
  initialFiles?: File[];
  /** Text shared in from another app, put in the box when nothing is half-typed. */
  initialText?: string;
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

export function AddSheet({ onAdd, onClose, initialFiles = [], initialText = '' }: Props) {
  const [text, setText] = usePersisted('add');
  useEffect(() => { if (initialText) setText(initialText); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [forWho, setForWho] = useState<'you' | 'nexo'>('nexo');
  // Soon, not Now: a card he types or shares in is usually something to know or do later, and 'high' put
  // every shared file in the Urgent band (his words, 2026-11-19, nmwmutysss6t). Now is kept for when he picks it.
  const [prio, setPrio] = useState<'high' | 'normal' | 'low'>('normal');
  const [files, setFiles] = useState<File[]>(initialFiles);
  const [drive, setDrive] = useState(driveReady());
  const [msg, setMsg] = useState('');
  const [listOn, setListOn] = useState(false);
  const [list, setList] = useState('');
  const urls = useMemo(() => files.map((f) => (f.type.startsWith('image/') ? URL.createObjectURL(f) : '')), [files]);
  useEffect(() => () => urls.forEach((u) => { if (u) URL.revokeObjectURL(u); }), [urls]);
  const pick = (list: FileList | File[] | null) => {
    const more = Array.from(list ?? []);
    if (more.length > 0) setFiles((cur) => addPicked(cur, more));
  };
  const onPaste = (e: React.ClipboardEvent) => {
    const pasted = Array.from(e.clipboardData.files);
    if (pasted.length === 0) return;
    e.preventDefault();
    pick(pasted);
    if (!drive) setMsg('Connect Google Drive to upload these');
  };
  const now = new Date();
  const parsed = parseQuickAdd(text, now);
  const submit = (callNow = false) => {
    if (!parsed.title) return;
    // A stale Drive token is renewed here, inside the tap, because a popup opened later would be blocked.
    if (files.length > 0) warmDrive();
    // The text is spent once the card exists, so it must not come back the next time the sheet opens.
    setText('');
    onAdd(parsed.title, forWho, parsed.due, prio, files, listOn ? checklistLines(list) : [], callNow && forWho === 'nexo');
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
            value={text} onChange={(e) => setText(e.target.value)} onPaste={onPaste} enterKeyHint="enter" />
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
        {listOn ? (
          <div className="add-list">
            <label className="sr" htmlFor="add-list">Checklist, one item per line</label>
            <textarea id="add-list" className="relay-answer" rows={3} placeholder="Checklist, one item per line" value={list} onChange={(e) => setList(e.target.value)} />
          </div>
        ) : null}
        {files.length > 0 ? (
          <ul className="add-files" aria-label="Chosen files">
            {files.map((f, i) => (
              <li key={`${f.name}-${f.size}-${i}`}>
                {urls[i] ? <img src={urls[i]} alt={f.name} /> : <span className="rc-file">{f.name}</span>}
                <button type="button" className="rm" aria-label={`Remove ${f.name}`} onClick={() => setFiles((cur) => removePicked(cur, i))}>×</button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="draft-more">
          <button type="button" className="chip-btn small" onClick={() => { void readClipboard().then(({ files: fs, text: t }) => { if (fs.length) { pick(fs); if (!drive) setMsg('Connect Google Drive to upload these'); } else if (t) setText(text ? `${text} ${t}` : t); else setMsg('The clipboard is empty or not readable'); }); }}>Paste</button>
          <button type="button" className="chip-btn small" aria-pressed={listOn} onClick={() => setListOn(!listOn)}>Checklist</button>
          {drive ? (
            <>
              <label className="chip-btn small">Take a photo<input type="file" accept="image/*" capture="environment" hidden onChange={(e) => { pick(e.target.files); e.target.value = ''; }} /></label>
              <label className="chip-btn small">Choose photos or files<input type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => { pick(e.target.files); e.target.value = ''; }} /></label>
            </>
          ) : (
            <button type="button" className="chip-btn small" onClick={() => { setMsg('Opening Google'); connectDrive().then(() => { setDrive(true); setMsg(''); }, (err: unknown) => setMsg(err instanceof Error ? err.message : 'Could not connect')); }}>Connect Google Drive</button>
          )}
        </div>
        {msg ? <p className="mut" role="status">{msg}</p> : null}
        <div className="sheet-foot">
          <button type="button" className="chip-btn" onClick={() => setForWho(forWho === 'you' ? 'nexo' : 'you')}>
            For {forWho === 'you' ? 'me' : 'Nexo'}
          </button>
          {forWho === 'nexo' ? <button type="button" className="chip-btn call-now" disabled={!parsed.title} onClick={() => submit(true)}>Add and call Nexo</button> : null}
          <button type="submit" className="send" aria-label="Add task" disabled={!parsed.title}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
          </button>
        </div>
      </form>
    </div>
  );
}
