import { useEffect, useRef, useState } from 'react';
import { Autosaver, type SaveState } from './autosave';
import { Camera } from './Camera';
import { applyFix, sortDocs, type FudeDoc, type Note } from './documents';
import { lintText, PROFILES, profileById } from './profiles';
import { connectDrive, driveReady } from '../../drive';
import { cleanProposal, orderedItems, progress, sortSets, type ChatMsg, type HomeworkItem, type HomeworkSet, type ItemKind, type Question } from './model';

interface Props {
  sets: HomeworkSet[];
  /** The set that is open, from the URL, or none for the list. */
  openId?: string | undefined;
  onCreate: (title: string, due?: string) => void;
  onAddItem: (set: HomeworkSet, n: string, prompt: string) => void;
  /** Called with his text for one question, after a quiet time or on blur, never while a kana conversion is open. */
  onAnswer: (set: HomeworkSet, item: HomeworkItem, text: string) => void;
  /** Small pictures of the open set's photos, by file id. */
  thumbs?: Record<string, string>;
  /** Upload the chosen or taken photos to Drive and attach them to the set. Rejects with a readable message. */
  onPhotos?: (set: HomeworkSet, files: File[]) => Promise<void>;
  /** Ask the reader to propose the questions from the photos. */
  onRead?: (set: HomeworkSet) => void;
  /** He confirmed the proposal (possibly edited). */
  onConfirm?: (set: HomeworkSet, questions: Question[]) => void;
  onDiscard?: (set: HomeworkSet) => void;
  /** Ask for a hint or an explanation of one answer. */
  onCheck?: (set: HomeworkSet, item: HomeworkItem, mode: 'hint' | 'explain') => void;
  /** The set's chat (every message, with `n` set when it is about one question) and how to send one. */
  chat?: ChatMsg[];
  onChat?: (set: HomeworkSet, text: string, n: string | undefined, deep: boolean) => void;
  onContext?: (set: HomeworkSet, text: string) => void;
  /** Whole-text documents (reports, emails). */
  docs?: FudeDoc[];
  onCreateDoc?: (title: string, profile: string, due?: string) => void;
  onSaveDoc?: (doc: FudeDoc, text: string) => void;
  notes?: Note[];
  /** The host's way to put a document's text back into the draft it came from. */
  onSendBackDraft?: (draftId: string, text: string) => void;
  onReviewDoc?: (doc: FudeDoc, profile: unknown) => void;
  onNoteStatus?: (doc: FudeDoc, note: Note, status: Note['status']) => void;
}

const dueLabel = (due?: string) => (due ? new Date(due).toLocaleString('en-GB', { timeZone: 'Asia/Tokyo', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'No deadline');

function Back() {
  return (
    <a className="icon-btn" aria-label="Back" href="#/homework">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 5-7 7 7 7" /></svg>
    </a>
  );
}

/** A small conversation with the tutor: bubbles, a box, and a switch for the slower, stronger model. */
function ChatThread({ set, msgs, n, onChat, compact }: { set: HomeworkSet; msgs: ChatMsg[]; n?: string; onChat: NonNullable<Props['onChat']>; compact?: boolean }) {
  const [text, setText] = useState('');
  const [deep, setDeep] = useState(false);
  const mine = msgs.filter((m) => (n ? m.n === n : !m.n));
  const req = set.chatRequest;
  const waiting = req?.status === 'requested' || req?.status === 'working';
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView?.({ block: 'nearest' }); }, [mine.length, waiting]);
  const send = () => { const t = text.trim(); if (!t || waiting) return; onChat(set, t, n, deep); setText(''); };
  return (
    <div className={`hw-chat${compact ? ' compact' : ''}`}>
      {mine.length ? (
        <div className="hw-msgs" role="log" aria-live="polite">
          {(compact ? mine.slice(-6) : mine).map((m) => <p key={m.id} className={`hw-msg ${m.by}`}>{m.text}</p>)}
          {waiting ? <p className="hw-msg tutor mut" role="status">Thinking…</p> : null}
          <div ref={endRef} />
        </div>
      ) : waiting ? <p className="hw-msg tutor mut" role="status">Thinking…</p> : <p className="mut hw-chat-hint">{n ? `Ask anything about question ${n}.` : 'Ask anything about this set or the lesson.'} I explain and guide; you write the answers.</p>}
      {req?.status === 'error' ? <p className="hw-note" role="alert">{req.message ?? 'The tutor could not answer.'}</p> : null}
      <form className="reply-form" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <label className="sr" htmlFor={`chat-${n ?? 'set'}`}>Message the tutor</label>
        <input id={`chat-${n ?? 'set'}`} className="reply-input" lang="ja" placeholder={n ? `About question ${n}` : 'Message'} value={text} onChange={(e) => setText(e.target.value)} />
        <button type="submit" className="send small" aria-label="Send" disabled={!text.trim() || waiting}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </button>
      </form>
      <label className="hw-deep"><input type="checkbox" checked={deep} onChange={(e) => setDeep(e.target.checked)} /> Think harder (slower)</label>
    </div>
  );
}

/** One question: the prompt, then his field. Saving waits for any open kana conversion to finish (see autosave.ts). */
function Answer({ set, item, onAnswer, onCheck, chat, onChat }: { set: HomeworkSet; item: HomeworkItem; onAnswer: Props['onAnswer']; onCheck?: Props['onCheck']; chat?: ChatMsg[]; onChat?: Props['onChat'] }) {
  const [asking, setAsking] = useState(false);
  const req = set.checkRequest;
  const waiting = !!req && (req.status === 'requested' || req.status === 'working');
  const mine = waiting && req?.n === item.n;
  const [text, setText] = useState(item.answer);
  const [state, setState] = useState<SaveState>('idle');
  const latest = useRef({ set, item, onAnswer });
  latest.current = { set, item, onAnswer };
  const saver = useRef<Autosaver | null>(null);
  if (saver.current === null) saver.current = new Autosaver(item.answer, (t) => latest.current.onAnswer(latest.current.set, latest.current.item, t), setState);
  useEffect(() => () => saver.current?.dispose(), []);
  // Another device changed this answer: follow it, unless he is typing here right now.
  useEffect(() => {
    if (document.activeElement?.id !== `hw-${item.n}`) { setText(item.answer); saver.current?.adopt(item.answer); }
  }, [item.answer, item.n]);
  return (
    <li className={`hw-item hw-${item.status}`}>
      <label htmlFor={`hw-${item.n}`}><span className="hw-n">{item.n}</span><span className="hw-prompt" lang="ja">{item.prompt || 'No text for this question'}</span></label>
      {item.type === 'choice' && item.options ? (
        <div className="hw-options" role="radiogroup" aria-label={`Question ${item.n}`}>
          {item.options.map((o) => (
            <button key={o} type="button" role="radio" aria-checked={text === o} className={`hw-option${text === o ? ' on' : ''}`}
              onClick={() => { setText(o); saver.current?.adopt(o); setState('saved'); onAnswer(set, item, o); }}>{o}</button>
          ))}
        </div>
      ) : (
        <>
          {item.type === 'reorder' && item.options ? <p className="hw-bank" lang="ja" aria-label="Pieces to put in order">{item.options.map((o) => <span key={o}>{o}</span>)}</p> : null}
          <textarea id={`hw-${item.n}`} className="hw-answer" lang="ja" rows={2} inputMode="text" autoCapitalize="off" autoCorrect="off" spellCheck={false}
        placeholder="Your answer" value={text}
        onChange={(e) => { setText(e.target.value); saver.current?.change(e.target.value, (e.nativeEvent as InputEvent).isComposing === true); }}
        onCompositionStart={() => saver.current?.compositionStart()}
        onCompositionEnd={(e) => saver.current?.compositionEnd(e.currentTarget.value)}
        onBlur={() => saver.current?.blur()} />
        </>
      )}
      <span className={`hw-save ${state}`} aria-live="polite">{state === 'dirty' ? 'Typing…' : state === 'saved' ? 'Saved' : ''}</span>
      {onCheck ? (
        <div className="hw-check">
          {mine ? <span className="mut" role="status">Checking…</span> : (
            <>
              {item.status === 'ok' ? <span className="hw-right">✓ Looks right</span> : null}
              {!item.hint ? <button type="button" className="tool-chip" disabled={waiting || state === 'dirty'} onClick={() => onCheck(set, item, 'hint')}>Hint</button> : null}
              {item.hint && !item.explain ? <button type="button" className="tool-chip" disabled={waiting || state === 'dirty'} onClick={() => onCheck(set, item, 'explain')}>Explain</button> : null}
            </>
          )}
          {req?.status === 'error' && req.n === item.n ? <span className="mut">{req.message}</span> : null}
          {req?.status === 'stale' && req.n === item.n ? <span className="mut">You changed the answer, ask again.</span> : null}
        </div>
      ) : null}
      {item.hint ? <p className="hw-note"><b>Hint</b> {item.hint}</p> : null}
      {item.explain ? <p className="hw-note"><b>Why</b> {item.explain}</p> : null}
      {onChat ? (
        <div className="hw-ask">
          <button type="button" className="tool-chip" aria-expanded={asking} onClick={() => setAsking((a) => !a)}>{asking ? 'Close chat' : (chat ?? []).some((m) => m.n === item.n) ? 'Chat (open)' : 'Ask'}</button>
          {asking ? <ChatThread set={set} msgs={chat ?? []} n={item.n} onChat={onChat} compact /> : null}
        </div>
      ) : null}
    </li>
  );
}

/** The book pages: thumbnails that open the full picture in Drive, and the two ways to add more. */
function Photos({ set, thumbs, onPhotos }: { set: HomeworkSet; thumbs: Record<string, string>; onPhotos: Props['onPhotos'] }) {
  const [drive, setDrive] = useState(driveReady());
  const [busy, setBusy] = useState('');
  const [cam, setCam] = useState(false);
  const pickFiles = (files: File[]) => {
    if (files.length === 0 || !onPhotos) return;
    setBusy(`Uploading ${files.length} photo${files.length > 1 ? 's' : ''}`);
    onPhotos(set, files).then(() => setBusy('Added'), (e: unknown) => { setBusy(e instanceof Error ? e.message : 'Upload failed'); setDrive(driveReady()); });
  };
  const pick = (list: FileList | null) => pickFiles(Array.from(list ?? []));
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
            <button type="button" className="tool-chip" onClick={() => setCam(true)}>Take photos</button>
            <label className="tool-chip">Choose photos<input type="file" accept="image/*" multiple hidden onChange={(e) => { pick(e.target.files); e.target.value = ''; }} /></label>
          </div>
        ) : (
          <button type="button" className="tool-chip" onClick={() => { setBusy('Opening Google'); connectDrive().then(() => { setDrive(true); setBusy(''); }, (e: unknown) => setBusy(e instanceof Error ? e.message : 'Could not connect')); }}>Connect Google Drive</button>
        )
      ) : null}
      {cam ? <Camera onCancel={() => setCam(false)} onDone={(files) => { setCam(false); pickFiles(files); }} /> : null}
      {busy ? <p className="mut" role="status">{busy}</p> : onPhotos && drive ? <p className="mut">Photos go to your Nexo folder in Drive, only you can open them.</p> : null}
    </section>
  );
}

/** The reader's proposal: editable rows, and nothing becomes a question until he says so. */
function Proposal({ set, onConfirm, onDiscard }: { set: HomeworkSet; onConfirm: NonNullable<Props['onConfirm']>; onDiscard: NonNullable<Props['onDiscard']> }) {
  const [rows, setRows] = useState<Question[]>(() => (set.proposed ?? []).filter((q) => !set.items[q.n]).map((q) => ({ ...q })));
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
            <div className="hw-prop-main">
              <input className="reply-input" lang="ja" aria-label={`Question ${q.n}`} value={q.prompt} onChange={(e) => edit(i, 'prompt', e.target.value)} />
              <select className="reply-input hw-type" aria-label={`Kind of question ${q.n}`} value={q.type ?? 'text'} onChange={(e) => setRows((r) => r.map((x, j) => (j === i ? { ...x, type: e.target.value as ItemKind } : x)))}>
                <option value="text">Write</option><option value="choice">Choose</option><option value="reorder">Reorder</option>
              </select>
              {(q.type ?? 'text') !== 'text' ? <input className="reply-input" lang="ja" aria-label={`Options of ${q.n}`} placeholder="Options, separated by |" value={(q.options ?? []).join(' | ')} onChange={(e) => setRows((r) => r.map((x, j) => (j === i ? { ...x, options: e.target.value.split('|') } : x)))} /> : null}
            </div>
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

/** One whole text: a big IME-safe field with live counters and the profile's rules underneath. */
function DocView({ doc, notes, onSave, onReview, onNote, onSendBack }: { doc: FudeDoc; notes: Note[]; onSave: (doc: FudeDoc, text: string) => void; onReview?: ((doc: FudeDoc, profile: unknown) => void) | undefined; onNote?: ((doc: FudeDoc, note: Note, status: Note['status']) => void) | undefined; onSendBack?: ((draftId: string, text: string) => void) | undefined }) {
  const profile = profileById(doc.profile);
  const [text, setText] = useState(doc.text);
  const [state, setState] = useState<SaveState>('idle');
  const latest = useRef({ doc, onSave });
  latest.current = { doc, onSave };
  const saver = useRef<Autosaver | null>(null);
  if (saver.current === null) saver.current = new Autosaver(doc.text, (t) => latest.current.onSave(latest.current.doc, t), setState, 900);
  useEffect(() => () => saver.current?.dispose(), []);
  useEffect(() => { if (document.activeElement?.id !== 'fude-text') { setText(doc.text); saver.current?.adopt(doc.text); } }, [doc.text]);
  const lint = lintText(text, profile, doc.budget ?? profile.budget);
  const unit = (doc.budget ?? profile.budget)?.unit === 'chars' ? lint.chars : lint.words;
  const b = lint.budget;
  return (
    <main className="screen hw">
      <header className="thread-top"><Back /><span className="kicker">{profile.name} · {dueLabel(doc.due)}</span></header>
      <h1 className="thread-title">{doc.title}</h1>
      <textarea id="fude-text" className="hw-answer fude-text" lang={profile.lang === 'ja' ? 'ja' : undefined} rows={12} autoCorrect="off" spellCheck={profile.lang === 'en'}
        placeholder="Write here" value={text}
        onChange={(e) => { setText(e.target.value); saver.current?.change(e.target.value, (e.nativeEvent as InputEvent).isComposing === true); }}
        onCompositionStart={() => saver.current?.compositionStart()}
        onCompositionEnd={(e) => saver.current?.compositionEnd(e.currentTarget.value)}
        onBlur={() => saver.current?.blur()} />
      {doc.cardId || (doc.draftId && onSendBack) ? (
        <div className="fude-review">
          {doc.cardId ? <a className="tool-chip" href={`#/card/${encodeURIComponent(doc.cardId)}`}>Back to the card</a> : null}
          {doc.draftId && onSendBack ? <button type="button" className="tool-chip" disabled={!text.trim()} onClick={() => { saver.current?.change(text); saver.current?.blur(); onSendBack(doc.draftId as string, text.trim()); }}>Send text back to the draft</button> : null}
        </div>
      ) : null}
      <div className="fude-counts">
        <span className={lint.over ? 'bad' : lint.under ? 'warn' : ''}>{unit} {b?.unit ?? 'words'}{b ? ` of ${b.min ?? 0}–${b.max ?? '∞'}` : ''}</span>
        <span className={`hw-save ${state}`} aria-live="polite">{state === 'dirty' ? 'Typing…' : state === 'saved' ? 'Saved' : ''}</span>
      </div>
      {onReview ? (
        <div className="fude-review">
          {doc.review?.status === 'requested' || doc.review?.status === 'working'
            ? <span className="mut" role="status">Checking your writing…</span>
            : <button type="button" className="tool-chip" disabled={!text.trim()} onClick={() => onReview(doc, { name: profile.name, lang: profile.lang, ...(lint.budget ? { budget: lint.budget } : {}), rules: profile.rules.map((r) => ({ msg: r.msg })) })}>Check my writing</button>}
          {doc.review?.status === 'error' ? <span className="hw-note" role="alert">{doc.review.message}</span> : null}
          {doc.review?.status === 'ready' && notes.filter((n) => n.status === 'open').length === 0 ? <span className="mut">{doc.review.message ?? 'No problems found.'}</span> : null}
        </div>
      ) : null}
      {notes.filter((n) => n.status === 'open').length ? (
        <ul className="panel fude-notes" aria-label="Reviewer notes">
          {notes.filter((n) => n.status === 'open').map((n) => (
            <li key={n.id}>
              <p><b>{n.kind}</b> “{n.find}”</p>
              <p>{n.msg}</p>
              {n.fix ? <p className="fude-fix">→ {n.fix}</p> : null}
              <div className="hw-photo-actions">
                {n.fix && onNote ? <button type="button" className="tool-chip" onClick={() => {
                  const next = applyFix(text, n.find, n.fix);
                  if (next !== null) { setText(next); saver.current?.change(next); saver.current?.blur(); onNote(doc, n, 'accepted'); }
                }}>Use this fix</button> : null}
                {onNote ? <button type="button" className="tool-chip" onClick={() => onNote(doc, n, 'dismissed')}>{n.fix ? 'Keep mine' : 'Got it'}</button> : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {lint.hits.length ? (
        <ul className="panel fude-hits" aria-label="Rule notes">
          {lint.hits.map((h) => <li key={`${h.rule}-${h.index}`} className={`sev-${h.sev}`}><b>{h.match}</b> {h.msg}</li>)}
        </ul>
      ) : null}
    </main>
  );
}

function NewDoc({ onCreate }: { onCreate: (title: string, profile: string, due?: string) => void }) {
  const [title, setTitle] = useState('');
  const [profile, setProfile] = useState(PROFILES[0]?.id ?? 'free');
  const [due, setDue] = useState('');
  return (
    <form className="panel hw-new" onSubmit={(e) => { e.preventDefault(); onCreate(title, profile, due ? new Date(due).toISOString() : undefined); setTitle(''); setDue(''); }}>
      <label className="sr" htmlFor="fd-title">Title</label>
      <input id="fd-title" className="reply-input" placeholder="New document, for example the Yamashita report" value={title} onChange={(e) => setTitle(e.target.value)} />
      <label className="mut" htmlFor="fd-profile">Kind of writing</label>
      <select id="fd-profile" className="reply-input" value={profile} onChange={(e) => setProfile(e.target.value)}>
        {PROFILES.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <p className="mut">{profileById(profile).hint}</p>
      <label className="mut" htmlFor="fd-due">Deadline (optional)</label>
      <input id="fd-due" className="reply-input" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
      <button type="submit" className="send-wide" disabled={!title.trim()}>Create document</button>
    </form>
  );
}

export function Homework({ sets, openId, onCreate, onAddItem, onAnswer, thumbs = {}, onPhotos, onRead, onConfirm, onDiscard, onCheck, onContext, chat = [], onChat, docs = [], onCreateDoc, onSaveDoc, notes = [], onReviewDoc, onNoteStatus, onSendBackDraft }: Props) {
  const list = sortSets(sets);
  const docList = sortDocs(docs);
  const openDoc = openId ? docs.find((d) => d.id === openId && !d.deleted) : undefined;
  if (openDoc && onSaveDoc) return <DocView key={openDoc.id} doc={openDoc} notes={notes} onSave={onSaveDoc} onReview={onReviewDoc} onNote={onNoteStatus} onSendBack={onSendBackDraft} />;
  const open = openId ? sets.find((s) => s.id === openId && !s.deleted) : undefined;
  if (openId && !open && !openDoc) {
    return <main className="screen"><header className="thread-top"><Back /><span className="kicker">HOMEWORK</span></header><p className="empty">That set is not here (yet).</p></main>;
  }
  if (open) {
    const p = progress(open);
    return (
      <main className="screen hw">
        <header className="thread-top"><Back /><span className="kicker">{dueLabel(open.due)} · {p.answered} of {p.total} answered</span></header>
        <h1 className="thread-title">{open.title}</h1>
        <Photos set={open} thumbs={thumbs} onPhotos={onPhotos} />
        {onRead && onConfirm && onDiscard && open.photos.length > 0 ? (
          open.transcribe?.status === 'ready' && (open.proposed ?? []).some((q) => !open.items[q.n]) ? <Proposal key={open.transcribe.at} set={open} onConfirm={onConfirm} onDiscard={onDiscard} /> : (
            <section className="panel hw-read">
              {open.transcribe?.status === 'requested' || open.transcribe?.status === 'working'
                ? <p className="mut" role="status">Reading the pages. This takes about half a minute.</p>
                : orderedItems(open).length === 0
                  ? <button type="button" className="send-wide" onClick={() => onRead(open)}>Read the questions</button>
                  : <button type="button" className="tool-chip" onClick={() => onRead(open)}>Read the photos again for missing questions</button>}
              {open.transcribe?.status === 'ready' && (open.proposed ?? []).length > 0 && !(open.proposed ?? []).some((q) => !open.items[q.n]) ? <p className="mut">Nothing new: every question on the photos is already in the set.</p> : null}
              {open.transcribe?.status === 'error' ? <p className="hw-note" role="alert">{open.transcribe.message ?? 'The reader could not run.'} You can also add the questions by hand below.</p> : null}
            </section>
          )
        ) : null}
        <ul className="panel hw-items">
          {orderedItems(open).map((it) => <Answer key={it.n} set={open} item={it} onAnswer={onAnswer} onCheck={onCheck} chat={chat} onChat={onChat} />)}
          {orderedItems(open).length === 0 ? <li className="hw-empty mut">No questions yet. Add them below.</li> : null}
        </ul>
        <AddQuestion onAdd={(n, prompt) => onAddItem(open, n, prompt)} />
        {onChat ? (
          <details className="panel hw-context hw-setchat">
            <summary>Chat about this set</summary>
            <ChatThread set={open} msgs={chat} onChat={onChat} />
          </details>
        ) : null}
        {onContext ? (
          <details className="panel hw-context">
            <summary>Lesson notes for the checker (optional)</summary>
            <textarea className="hw-answer" lang="ja" rows={3} defaultValue={open.context ?? ''} placeholder="For example: が marks the object of 好き; て-form for requests" onBlur={(e) => { if (e.target.value !== (open.context ?? '')) onContext(open, e.target.value); }} />
          </details>
        ) : null}
      </main>
    );
  }
  return (
    <main className="screen">
      <header className="top"><div><span className="kicker">NEXO SUITE</span><h1>Fude</h1></div></header>
      <p className="mut hw-how">Photograph a book page, read the questions from it, type your answers. Ask for a hint, then an explanation if you need one. Reports and emails get a word count, rule notes and a proofread. Nothing is answered or changed for you.</p>
      {docList.length > 0 ? (
        <>
          <h2 className="group-title">Documents</h2>
          <ul className="browse panel">
            {docList.map((d) => (
              <li key={d.id}>
                <a className="browse-row" href={`#/homework/${encodeURIComponent(d.id)}`}>
                  <span><b>{d.title}</b><small>{profileById(d.profile).name} · {dueLabel(d.due)}</small></span>
                </a>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <h2 className="group-title">Exercise sets</h2>
      {list.length === 0 ? <p className="empty">No exercise sets yet.</p> : (
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
      <h2 className="group-title">New exercise set</h2>
      <NewSet onCreate={onCreate} />
      {onCreateDoc ? (<><h2 className="group-title">New document</h2><NewDoc onCreate={onCreateDoc} /></>) : null}
    </main>
  );
}
