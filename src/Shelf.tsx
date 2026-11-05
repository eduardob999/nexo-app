import { useState } from 'react';
import { ConfirmButton } from './ConfirmButton';
import { groupResources, isWebLink, recentDone } from './shelf';
import type { Card, Relay, Resource } from './types';

interface Props {
  done: Card[];
  closed: Relay[];
  resources: Resource[];
  onAdd: (r: { title: string; url: string; note: string; kind: string }) => void;
  onArchive: (r: Resource, archived: boolean) => void;
  /** Delete the finished cards with these ids (kept in the records, hidden everywhere). */
  onClearDone?: (ids: string[]) => void;
}

const KINDS = ['link', 'file', 'deck', 'paper', 'repo', 'doc'];

function Copy({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return <button className="chip-btn small" onClick={() => { void navigator.clipboard.writeText(text).then(() => setOk(true), () => setOk(false)); }}>{ok ? 'Copied' : 'Copy'}</button>;
}

function ResourceRow({ r, onArchive }: { r: Resource; onArchive: Props['onArchive'] }) {
  const target = (r.url ?? '').trim();
  return (
    <li className="res">
      <b>{isWebLink(target) ? <a href={target} target="_blank" rel="noopener noreferrer">{r.title}</a> : r.title}</b>
      {r.note ? <span className="res-note">{r.note}</span> : null}
      {target && !isWebLink(target) ? <code className="res-path">{target}</code> : null}
      <span className="draft-more">
        {target && !isWebLink(target) ? <Copy text={target} /> : null}
        <button className="chip-btn small" onClick={() => onArchive(r, !r.archived)}>{r.archived ? 'Restore' : 'Archive'}</button>
      </span>
    </li>
  );
}

export function Shelf({ done, closed, resources, onAdd, onArchive, onClearDone }: Props) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [note, setNote] = useState('');
  const [kind, setKind] = useState('link');
  const groups = groupResources(resources);
  const archived = resources.filter((r) => r.archived);
  const finished = recentDone(done);
  const [more, setMore] = useState(false);
  return (
    <main className="screen">
      <header className="top"><div><span className="kicker">NOTHING OWED</span><h1>Shelf</h1></div></header>

      <details className="shelf-fold" open>
        <summary>Resources <span className="mut">{resources.length - archived.length}</span></summary>
        {groups.length === 0 ? <p className="mut">Nothing filed here yet.</p> : null}
        {groups.map((g) => (
          <div key={g.kind}>
            <h3 className="group-title">{g.label} <span className="mut">{g.items.length}</span></h3>
            <ul className="res-list">{g.items.map((r) => <ResourceRow key={r.id} r={r} onArchive={onArchive} />)}</ul>
          </div>
        ))}
        <details className="shelf-sub">
          <summary>Add one</summary>
          <form className="res-add" onSubmit={(e) => { e.preventDefault(); if (!title.trim()) return; onAdd({ title: title.trim(), url: url.trim(), note: note.trim(), kind }); setTitle(''); setUrl(''); setNote(''); }}>
            <input className="search-input" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <input className="search-input" placeholder="Link or path" value={url} onChange={(e) => setUrl(e.target.value)} />
            <input className="search-input" placeholder="Note" value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="seg" role="group" aria-label="Kind">
              {KINDS.map((k) => <button type="button" key={k} aria-pressed={kind === k} onClick={() => setKind(k)}>{k}</button>)}
            </div>
            <button type="submit" className="copy-main" disabled={!title.trim()}>Add</button>
          </form>
        </details>
        {archived.length > 0 ? (
          <details className="shelf-sub"><summary>Archived <span className="mut">{archived.length}</span></summary>
            <ul className="res-list">{archived.map((r) => <ResourceRow key={r.id} r={r} onArchive={onArchive} />)}</ul>
          </details>
        ) : null}
      </details>

      <details className="shelf-fold">
        <summary>Done <span className="mut">{finished.length}</span></summary>
        <ul className="res-list">
          {(more ? finished : finished.slice(0, 40)).map((c) => (
            <li key={c.id} className="res done"><a href={`#/card/${c.id}`}>{c.title ?? c.id}</a></li>
          ))}
        </ul>
        {finished.length > 40 && !more ? <button className="chip-btn" onClick={() => setMore(true)}>Show all {finished.length}</button> : null}
        {onClearDone && finished.length > 0 ? (
          <div className="selrow"><ConfirmButton label="Clear done" armedLabel={`Tap again to clear ${finished.length}`} className="chip-btn" onConfirm={() => onClearDone(finished.map((c) => c.id))} /></div>
        ) : null}
      </details>

      <details className="shelf-fold">
        <summary>Threads, closed <span className="mut">{closed.length}</span></summary>
        <ul className="res-list">
          {closed.map((r) => <li key={r.id} className="res done"><span className="relay-id">{r.id}</span> {r.topic}</li>)}
        </ul>
      </details>
    </main>
  );
}
