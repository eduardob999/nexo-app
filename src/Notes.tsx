import { useState } from 'react';
import { usePersisted } from './persist';
import { groupMemos, parseTags } from './notes';
import { ConfirmButton } from './ConfirmButton';
import { readClipboard } from './clipboard';
import type { Memo } from './types';

export function Notes({ memos, onKeep, onDelete }: { memos: Memo[]; onKeep: (text: string, tags: string[]) => void; onDelete?: (m: Memo) => void }) {
  const [text, setText] = usePersisted('memo');
  const [tags, setTags] = useState('');
  const [q, setQ] = useState('');
  const groups = groupMemos(memos, q);
  const allTags = [...new Set(memos.flatMap((m) => m.tags))].sort();
  return (
    <main className="screen">
      <header className="top"><div><span className="kicker">WORTH KEEPING</span><h1>Notes</h1></div></header>
      <form className="res-add memo-form" onSubmit={(e) => { e.preventDefault(); if (!text.trim()) return; onKeep(text.trim(), parseTags(tags)); setText(''); setTags(''); }}>
        <label className="sr" htmlFor="memo-text">Something worth keeping</label>
        <textarea id="memo-text" className="relay-answer" rows={3} placeholder="Something worth keeping" value={text} onChange={(e) => setText(e.target.value)} />
        <label className="sr" htmlFor="memo-tags">Tags</label>
        <input id="memo-tags" className="search-input" placeholder="Tags, up to three (research japan)" value={tags} onChange={(e) => setTags(e.target.value)} />
        <div className="draft-more">
          <button type="submit" className="copy-main" disabled={!text.trim()}>Keep it</button>
          <button type="button" className="chip-btn" onClick={() => { void readClipboard().then(({ text: t }) => { if (t) setText(text ? `${text}\n${t}` : t); }); }}>Paste</button>
        </div>
      </form>
      <label className="sr" htmlFor="memo-q">Search text or tag</label>
      <input id="memo-q" className="search-input" type="search" placeholder="Search text or tag" value={q} onChange={(e) => setQ(e.target.value)} />
      {allTags.length ? (
        <div className="qchips" role="group" aria-label="Tags">
          {allTags.map((t) => <button key={t} type="button" className="qchip" onClick={() => setQ(q === t ? '' : t)}>#{t}</button>)}
        </div>
      ) : null}
      {memos.length === 0 ? <p className="empty">Nothing kept yet.</p> : groups.length === 0 ? <p className="empty">Nothing matches.</p> : null}
      {groups.map((g) => (
        <section key={g.tag || 'untagged'} className="day-group">
          <h2 className="day-title">{g.tag ? `#${g.tag}` : 'Untagged'} <span className="mut">{g.items.length}</span></h2>
          <ul className="res-list panel-flat memo-list">
            {g.items.map((m) => (
              <li key={m.id} className="res"><span className="memo-text">{m.text}</span><span className="mut">{new Date(m.ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}{m.tags.length ? ` · ${m.tags.map((t) => `#${t}`).join(' ')}` : ''}</span>{onDelete ? <ConfirmButton label="Delete" ariaLabel="Delete this note" onConfirm={() => onDelete(m)} /> : null}</li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
