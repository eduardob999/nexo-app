import { useEffect, useState } from 'react';
import { orderedItems, progress, sortSets, type HomeworkItem, type HomeworkSet } from './homework';

interface Props {
  sets: HomeworkSet[];
  /** The set that is open, from the URL, or none for the list. */
  openId?: string | undefined;
  onCreate: (title: string, due?: string) => void;
  onAddItem: (set: HomeworkSet, n: string, prompt: string) => void;
  /** Called with his finished text for one question. The screen only calls it on blur, never mid-composition. */
  onAnswer: (set: HomeworkSet, item: HomeworkItem, text: string) => void;
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

export function Homework({ sets, openId, onCreate, onAddItem, onAnswer }: Props) {
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
        <section className="panel hw-photos" aria-label="Book pages">
          <b>Book pages</b>
          {open.photos.length === 0 ? <span className="mut">No photos yet.</span> : (
            <ul>{open.photos.map((f) => <li key={f.id}>{(f as { viewUrl?: string }).viewUrl ? <a href={(f as { viewUrl?: string }).viewUrl} target="_blank" rel="noopener noreferrer">{f.name ?? f.id}</a> : (f.name ?? f.id)}</li>)}</ul>
          )}
        </section>
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
