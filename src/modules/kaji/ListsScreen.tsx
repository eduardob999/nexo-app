import { useEffect, useState } from 'react';
import { t } from './i18n';
import { counts, itemExpense, openTotal, ordered, parseItem, splitLines, SUGGESTED } from './lists';
import { parseYen, yen } from './ledger';
import type { Lang } from './model';
import { addItem, addLedger, addList, removeItem, setItemMoney, tickItem, watchItems, watchLists, type KItem, type KList } from './store';
import { memberColor } from './view';
import type { KajiData } from './ui';

/** Shared lists: shopping, trips, anything the two keep together. Live for both, one document per item. */
export function ListsScreen({ data, lang, preview }: { data: KajiData; lang: Lang; preview?: { lists: KList[]; items: KItem[] } }) {
  const [lists, setLists] = useState<KList[]>(preview?.lists ?? []);
  const [items, setItems] = useState<KItem[]>(preview?.items ?? []);
  const [pick, setPick] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [bought, setBought] = useState<{ id: string; amount: string } | null>(null);
  useEffect(() => { if (preview) return undefined; const a = watchLists(data.hid, setLists), b = watchItems(data.hid, setItems); return () => { a(); b(); }; }, [data.hid]);
  const current = lists.find((l) => l.id === pick) ?? lists[0];
  const mine = current ? ordered(items.filter((i) => i.listId === current.id)) : [];
  const c = counts(mine);
  const colorOf = (uid: string) => memberColor(Math.max(0, data.members.findIndex((m) => m.uid === uid)));
  const tot = openTotal(mine);
  const add = async () => {
    if (!current) return;
    const lines = splitLines(text);
    setText('');
    for (const l of lines) { const p = parseItem(l); await addItem(data.hid, data.me, current.id, p.text, p.price); }
  };
  const startList = async (s: (typeof SUGGESTED)[number]) => {
    const id = await addList(data.hid, data.me, s[lang]);
    for (const it of s.items ?? []) await addItem(data.hid, data.me, id, it);
    setPick(id);
  };
  const tick = (i: KItem) => {
    if (preview) setItems((xs) => xs.map((x) => (x.id === i.id ? { ...x, done: !x.done, doneAt: Date.now() } : x)));
    else void tickItem(data.hid, data.me, i.id, !i.done);
    setBought(!i.done && !i.ledgerId ? { id: i.id, amount: i.price ? String(i.price) : '' } : null);
  };
  const toMoney = async () => {
    const i = items.find((x) => x.id === bought?.id);
    const amount = parseYen(bought?.amount ?? '');
    if (!i || !current || !amount) return;
    setBought(null);
    const ledgerId = await addLedger(data.hid, itemExpense(i, current.title, data.me, amount));
    await setItemMoney(data.hid, i.id, amount, ledgerId);
  };
  const pending = bought ? items.find((x) => x.id === bought.id) : undefined;
  const unused = SUGGESTED.filter((s) => !lists.some((l) => l.title.toLowerCase() === s[lang].toLowerCase()));
  return (
    <>
      <p className="notice">{t(lang, 'listsAbout')}</p>
      {lists.length === 0 ? (
        <div className="panel kaji-empty">
          <b>{t(lang, 'noLists')}</b>
          <div className="kaji-chips" style={{ marginTop: 10 }}>{SUGGESTED.map((s) => <button key={s.en} className="chip-btn" onClick={() => void startList(s)}>{s[lang]}</button>)}</div>
        </div>
      ) : (
        <div className="kaji-chips kaji-listtabs" role="tablist">
          {lists.map((l) => <button key={l.id} role="tab" className="chip-btn" aria-pressed={current?.id === l.id} onClick={() => setPick(l.id)}>{l.title}</button>)}
          {unused.filter((s) => s.items).map((s) => <button key={s.en} className="chip-btn mut" aria-label={`${t(lang, 'suggestedLists')}: ${s[lang]}`} onClick={() => void startList(s)}>+ {s[lang]}</button>)}
        </div>
      )}
      {current ? (
        <>
          <form className="panel kaji-addrow" onSubmit={(e) => { e.preventDefault(); void add(); }}>
            <textarea rows={text.includes('\n') ? 4 : 1} value={text} onChange={(e) => setText(e.target.value)} placeholder={t(lang, 'addItem')} aria-label={t(lang, 'addItem')} />
            <button className="copy-main" type="submit" disabled={!splitLines(text).length}>+</button>
          </form>
          {pending ? (
            <form className="panel" style={{ padding: 14 }} onSubmit={(e) => { e.preventDefault(); void toMoney(); }}>
              <b>{t(lang, 'boughtTitle')}</b>
              <p className="mut" style={{ margin: '4px 0 8px' }}>{pending.text} · {t(lang, 'boughtAbout')}</p>
              <div className="kaji-addrow">
                <input inputMode="numeric" value={bought?.amount ?? ''} onChange={(e) => setBought((b) => (b ? { ...b, amount: e.target.value } : b))} placeholder={t(lang, 'amount')} aria-label={t(lang, 'amount')} />
                <button className="copy-main" type="submit" disabled={!parseYen(bought?.amount ?? '')}>{t(lang, 'addToMoney')}</button>
                <button className="chip-btn" type="button" onClick={() => setBought(null)}>{t(lang, 'notNow')}</button>
              </div>
            </form>
          ) : null}
          {c.open > 0 ? <p className="mut kaji-line">{t(lang, 'toBuy')}: {c.open}{tot.total ? ` · ${yen(tot.total)}` : ''}{tot.unpriced && tot.total ? ` (${tot.unpriced} ${t(lang, 'unpriced')})` : ''}</p> : null}
          <ul className="kaji-list panel">
            {mine.map((i) => (
              <li key={i.id} className={`kaji-item kaji-listitem ${i.done ? 'kaji-dim' : ''}`}>
                <button className={`kaji-check-ring ${i.done ? 'on' : ''}`} role="checkbox" aria-checked={i.done} aria-label={i.text} onClick={() => tick(i)}>{i.done ? '✓' : ''}</button>
                <span className="kaji-main"><b style={i.done ? { textDecoration: 'line-through', fontWeight: 400 } : undefined}>{i.text}</b>{i.ledgerId ? <small className="mut">{t(lang, 'inMoney')}</small> : null}</span>
                {i.price ? <small className="mut">{yen(i.price)}</small> : null}
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
