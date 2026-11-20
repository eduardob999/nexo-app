import { useEffect, useState } from 'react';
import { t } from './i18n';
import { counts, ordered, splitLines, SUGGESTED } from './lists';
import type { Lang } from './model';
import { addItem, addList, removeItem, tickItem, watchItems, watchLists, type KItem, type KList } from './store';
import { memberColor } from './view';
import type { KajiData } from './ui';

/** Shared lists: shopping, trips, anything the two keep together. Live for both, one document per item. */
export function ListsScreen({ data, lang, preview }: { data: KajiData; lang: Lang; preview?: { lists: KList[]; items: KItem[] } }) {
  const [lists, setLists] = useState<KList[]>(preview?.lists ?? []);
  const [items, setItems] = useState<KItem[]>(preview?.items ?? []);
  const [pick, setPick] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  useEffect(() => { if (preview) return undefined; const a = watchLists(data.hid, setLists), b = watchItems(data.hid, setItems); return () => { a(); b(); }; }, [data.hid]);
  const current = lists.find((l) => l.id === pick) ?? lists[0];
  const mine = current ? ordered(items.filter((i) => i.listId === current.id)) : [];
  const c = counts(mine);
  const colorOf = (uid: string) => memberColor(Math.max(0, data.members.findIndex((m) => m.uid === uid)));
  const add = async () => {
    if (!current) return;
    const lines = splitLines(text);
    setText('');
    for (const l of lines) await addItem(data.hid, data.me, current.id, l);
  };
  return (
    <>
      <p className="notice">{t(lang, 'listsAbout')}</p>
      {lists.length === 0 ? (
        <div className="panel kaji-empty">
          <b>{t(lang, 'noLists')}</b>
          <div className="kaji-chips" style={{ marginTop: 10 }}>{SUGGESTED.map((s) => <button key={s.en} className="chip-btn" onClick={() => void addList(data.hid, data.me, s[lang]).then(setPick)}>{s[lang]}</button>)}</div>
        </div>
      ) : (
        <div className="kaji-chips kaji-listtabs" role="tablist">
          {lists.map((l) => <button key={l.id} role="tab" className="chip-btn" aria-pressed={current?.id === l.id} onClick={() => setPick(l.id)}>{l.title}</button>)}
        </div>
      )}
      {current ? (
        <>
          <form className="panel kaji-addrow" onSubmit={(e) => { e.preventDefault(); void add(); }}>
            <textarea rows={text.includes('\n') ? 4 : 1} value={text} onChange={(e) => setText(e.target.value)} placeholder={t(lang, 'addItem')} aria-label={t(lang, 'addItem')} />
            <button className="copy-main" type="submit" disabled={!splitLines(text).length}>+</button>
          </form>
          <ul className="kaji-list panel">
            {mine.map((i) => (
              <li key={i.id} className={`kaji-item kaji-listitem ${i.done ? 'kaji-dim' : ''}`}>
                <button className={`kaji-check-ring ${i.done ? 'on' : ''}`} role="checkbox" aria-checked={i.done} aria-label={i.text} onClick={() => void tickItem(data.hid, data.me, i.id, !i.done)}>{i.done ? '✓' : ''}</button>
                <span className="kaji-main"><b style={i.done ? { textDecoration: 'line-through', fontWeight: 400 } : undefined}>{i.text}</b></span>
                <i className="kaji-dot" style={{ background: colorOf(i.by) }} />
              </li>
            ))}
            {mine.length === 0 ? <li className="kaji-item mut">·</li> : null}
          </ul>
          {c.done > 0 ? <button className="chip-btn" onClick={() => mine.filter((i) => i.done).forEach((i) => void removeItem(data.hid, i.id))}>{t(lang, 'clearDone')} ({c.done})</button> : null}
        </>
      ) : null}
      <form className="panel kaji-addrow" style={{ marginTop: 14 }} onSubmit={(e) => { e.preventDefault(); if (title.trim()) { void addList(data.hid, data.me, title).then(setPick); setTitle(''); } }}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t(lang, 'newList')} aria-label={t(lang, 'newList')} />
        <button className="chip-btn" type="submit" disabled={!title.trim()}>{t(lang, 'add')}</button>
      </form>
    </>
  );
}
