import { useEffect, useState } from 'react';
import { connectDrive, driveReady } from '../../drive';
import { cleanProposal, orderedItems, progress, sortSets, type HomeworkItem, type HomeworkSet } from './model';

interface Props {
  sets: HomeworkSet[];
  /** The set that is open, from the URL, or none for the list. */
  openId?: string | undefined;
  onCreate: (title: string, due?: string) => void;
  onAddItem: (set: HomeworkSet, n: string, prompt: string) => void;
  /** Called with his finished text for one question. The screen only calls it on blur, never mid-composition. */
  onAnswer: (set: HomeworkSet, item: HomeworkItem, text: string) => void;
  /** Small pictures of the open set's photos, by file id. */
  thumbs?: Record<string, string>;
  /** Upload the chosen or taken photos to Drive and attach them to the set. Rejects with a readable message. */
  onPhotos?: (set: HomeworkSet, files: File[]) => Promise<void>;
  /** Ask the reader to propose the questions from the photos. */
  onRead?: (set: HomeworkSet) => void;
  /** He confirmed the proposal (possibly edited). */
  onConfirm?: (set: HomeworkSet, questions: { n: string; prompt: string }[]) => void;
  onDiscard?: (set: HomeworkSet) => void;
}

const dueLabel = (due?: string) => (due ? new Date(due).toLocaleString('en-GB', { timeZone: 'Asia/Tokyo', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'No deadline');

function Back() {
  return (
    <a className="icon-btn" aria-label="Back" href="#/homework">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 5-7 7 7 7" /></svg>
    </a>
  );
}

/** One question: the prompt, then his field. The field keeps its own text and reports on blur. */
function Answer({ set, item, onAnswer }: { set: HomeworkSet; item: HomeworkItem; onAnswer: Props['onAnswer'] }) {
  const [text, setText] = useState(item.answer);
  // Another device changed this answer: follow it, unless he is typing here right now.
  useEffect(() => { if (document.activeElement?.id !== `hw-${item.n}`) setText(item.answer); }, [item.answer, item.n]);
  return (
    <li className={`hw-item hw-${item.status}`}>
      <label htmlFor={`hw-${item.n}`}><span className="hw-n">{item.n}</span><span className="hw-prompt" lang="ja">{item.prompt || 'No text for this question'}</span></label>
      <textarea id={`hw-${item.n}`} className="hw-answer" lang="ja" rows={2} inputMode="text" autoCapitalize="off" autoCorrect="off" spellCheck={false}
        placeholder="Your answer" value={text} onChange={(e) => setText(e.target.value)} onBlur={() => { if (text !== item.answer) onAnswer(set, item, text); }} />
      {item.hint ? <p className="hw-note"><b>Hint</b> {item.hint}</p> : null}
      {item.explain ? <p className="hw-note"><b>Why</b> {item.explain}</p> : null}
    </li>
  );
}

/** The book pages: thumbnails that open the full picture in Drive, and the two ways to add more. */
function Photos({ set, thumbs, onPhotos }: { set: HomeworkSet; thumbs: Record<string, string>; onPhotos: Props['onPhotos'] }) {
  const [drive, setDrive] = useState(driveReady());
  const [busy, setBusy] = useState('');
  const pick = (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (files.length === 0 || !onPhotos) return;
    setBusy(`Uploading ${files.length} photo${files.length > 1 ? 's' : ''}`);
    onPhotos(set, files).then(() => setBusy('Added'), (e: unknown) => { setBusy(e instanceof Error ? e.message : 'Upload failed'); setDrive(driveReady()); });
  };
  return (
    <section className="panel hw-photos" aria-label="Book pages">
      <b>Book pages</b>
      {set.photos.length === 0 ? <span className="mut">No photos yet.</span> : (
        <ul className="hw-thumbs">
          {set.photos.map((f) => (
            <li key={f.id}>
              <a href={f.viewUrl ?? '#'} target="_blank" rel="noopener noreferrer" aria-label={`Open ${f.name ?? 'photo'}`}>
                {thumbs[f.id] ? <img src={thumbs[f.id]} alt={f.name ?? 'Book page'} /> : <span className="hw-nothumb">{f.name ?? f.id}</span>}
              </a>
            </li>
          ))}
        </ul>
      )}
      {onPhotos ? (
        drive ? (
          <div className="hw-photo-actions">
            <label className="tool-chip">Take a photo<input type="file" accept="image/*" capture="environment" hidden onChange={(e) => { pick(e.target.files); e.target.value = ''; }} /></label>
            <label className="tool-chip">Choose photos<input type="file" accept="image/*" multiple hidden onChange={(e) => { pick(e.target.files); e.target.value = ''; }} /></label>
          </div>
        ) : (
          <button type="button" className="tool-chip" onClick={() => { setBusy('Opening Google'); connectDrive().then(() => { setDrive(true); setBusy(''); }, (e: unknown) => setBusy(e instanceof Error ? e.message : 'Could not connect')); }}>Connect Google Drive</button>
        )
      ) : null}
      {busy ? <p className="mut" role="status">{busy}</p> : onPhotos && drive ? <p className="mut">Photos go to your Nexo folder in Drive, only you can open them.</p> : null}
    </section>
  );
}

/** The reader's proposal: editable rows, and nothing becomes a question until he says so. */
function Proposal({ set, onConfirm, onDiscard }: { set: HomeworkSet; onConfirm: NonNullable<Props['onConfirm']>; onDiscard: NonNullable<Props['onDiscard']> }) {
  const [rows, setRows] = useState(() => (set.proposed ?? []).map((q) => ({ ...q })));
  const edit = (i: number, k: 'n' | 'prompt', v: string) => setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const ok = cleanProposal(rows);
  return (
    <section className="panel hw-proposal" aria-label="Questions read from the photos">
      <b>Check the questions</b>
      <p className="mut">Read from your photos. Fix any mistake, then confirm. Nothing is answered for you.</p>
      {set.transcribe?.notes ? <p className="mut">{set.transcribe.notes}</p> : null}
      <ul>
        {rows.map((q, i) => (
          <li key={i}>
            <input className="reply-input hw-add-n" aria-label={`Number ${i + 1}`} value={q.n} onChange={(e) => edit(i, 'n', e.target.value)} />
            <input className="reply-input" lang="ja" aria-label={`Question ${q.n}`} value={q.prompt} onChange={(e) => edit(i, 'prompt', e.target.value)} />
            <button type="button" className="tool-chip hw-x" aria-label={`Remove ${q.n}`} onClick={() => setRows((r) => r.filter((_, j) => j !== i))}>×</button>
          </li>
        ))}
      </ul>
      <div className="hw-photo-actions">
        <button type="button" className="send-wide hw-confirm" disabled={ok.length === 0} onClick={() => onConfirm(set, ok)}>Use these {ok.length} questions</button>
        <button type="button" className="tool-chip" onClick={() => onDiscard(set)}>Discard</button>
      </div>
    </section>
  );
}

function NewSet({ onCreate }: { onCreate: Props['onCreate'] }) {
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  return (
    <form className="panel hw-new" onSubmit={(e) => { e.preventDefault(); onCreate(title, due ? new Date(due).toISOString() : undefined); setTitle(''); setDue(''); }}>
      <label className="sr" htmlFor="hw-title">Title</label>
      <input id="hw-title" className="reply-input" placeholder="New set, for example L21 文型・練習" value={title} onChange={(e) => setTitle(e.target.value)} />
      <label className="mut" htmlFor="hw-due">Deadline (optional)</label>
      <input id="hw-due" className="reply-input" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
      <button type="submit" className="send-wide" disabled={!title.trim()}>Create set</button>
    </form>
  );
}

function AddQuestion({ onAdd }: { onAdd: (n: string, prompt: string) => void }) {
  const [n, setN] = useState('');
  const [prompt, setPrompt] = useState('');
  return (
    <form className="hw-add" onSubmit={(e) => { e.preventDefault(); onAdd(n, prompt); setN(''); setPrompt(''); }}>
      <input className="reply-input hw-add-n" aria-label="Question number" placeholder="No." value={n} onChange={(e) => setN(e.target.value)} />
      <input className="reply-input" lang="ja" aria-label="Question text" placeholder="Question text" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
      <button type="submit" className="tool-chip" disabled={!n.trim()}>Add</button>
    </form>
  );
}

export function Homework({ sets, openId, onCreate, onAddItem, onAnswer, thumbs = {}, onPhotos, onRead, onConfirm, onDiscard }: Props) {
  const list = sortSets(sets);
  const open = openId ? sets.find((s) => s.id === openId && !s.deleted) : undefined;
  if (openId && !open) {
    return <main className="screen"><header className="thread-top"><Back /><span className="kicker">HOMEWORK</span></header><p className="empty">That set is not here (yet).</p></main>;
  }
  if (open) {
    const p = progress(open);
    return (
      <main className="screen hw">
        <header className="thread-top"><Back /><span className="kicker">{dueLabel(open.due)} · {p.answered} of {p.total} answered</span></header>
        <h1 className="thread-title">{open.title}</h1>
        <Photos set={open} thumbs={thumbs} onPhotos={onPhotos} />
        {onRead && onConfirm && onDiscard && open.photos.length > 0 && orderedItems(open).length === 0 ? (
          open.transcribe?.status === 'ready' && (open.proposed ?? []).length > 0 ? <Proposal key={open.transcribe.at} set={open} onConfirm={onConfirm} onDiscard={onDiscard} /> : (
            <section className="panel hw-read">
              {open.transcribe?.status === 'requested' || open.transcribe?.status === 'working'
                ? <p className="mut" role="status">Reading the pages. This takes about half a minute.</p>
                : <button type="button" className="send-wide" onClick={() => onRead(open)}>Read the questions</button>}
              {open.transcribe?.status === 'error' ? <p className="hw-note" role="alert">{open.transcribe.message ?? 'The reader could not run.'} You can also add the questions by hand below.</p> : null}
            </section>
          )
        ) : null}
        <ul className="panel hw-items">
          {orderedItems(open).map((it) => <Answer key={it.n} set={open} item={it} onAnswer={onAnswer} />)}
          {orderedItems(open).length === 0 ? <li className="hw-empty mut">No questions yet. Add them below.</li> : null}
        </ul>
        <AddQuestion onAdd={(n, prompt) => onAddItem(open, n, prompt)} />
      </main>
    );
  }
  return (
    <main className="screen">
      <header className="top"><div><span className="kicker">STUDY</span><h1>Homework</h1></div></header>
      {list.length === 0 ? <p className="empty">No homework sets yet.</p> : (
        <ul className="browse panel">
          {list.map((s) => {
            const p = progress(s);
            return (
              <li key={s.id}>
                <a className="browse-row" href={`#/homework/${encodeURIComponent(s.id)}`}>
                  <span><b>{s.title}</b><small>{dueLabel(s.due)} · {p.answered} of {p.total} answered</small></span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
      <h2 className="group-title">New set</h2>
      <NewSet onCreate={onCreate} />
    </main>
  );
}
