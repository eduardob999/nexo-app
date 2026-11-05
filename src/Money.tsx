import { useEffect, useRef, useState } from 'react';
import { earlierMonths, jstMonth, marketCounts, moneyItems, needsSeed, receiptMonths, summarise, topBars, yen } from './money';
import { ConfirmButton } from './ConfirmButton';
import { ReceiptPhotos } from './ReceiptPhotos';
import type { Alloc, CardFile, Market, Receipt } from './types';

interface Props {
  allocations: Alloc[];
  onAdd: (a: { label: string; amount: number; tag: string; month: string }) => void;
  onToggle: (a: Alloc) => void;
  onEdit: (a: Alloc, change: { label?: string; amount?: number; tag?: string }) => void;
  onRepeat: (a: Alloc) => void;
  onSeed: (month: string) => void;
  market?: Market | null | undefined;
  receipts?: Receipt[];
  onLog?: ((item: { id: string; name: string }) => void) | undefined;
  onAddItem?: ((name: string) => void) | undefined;
  onReceipt?: ((r: { amount: number; cat: string; vendor: string }) => void) | undefined;
  onUndo?: ((logId: string) => void) | undefined;
  onDeleteReceipt?: ((r: Receipt) => void) | undefined;
  onAttachReceipt?: ((r: Receipt, files: File[]) => Promise<void>) | undefined;
  watchPhotos?: ((receiptId: string, on: (f: CardFile[]) => void) => () => void) | undefined;
}

function Line({ a, onToggle, onEdit, onRepeat }: { a: Alloc } & Pick<Props, 'onToggle' | 'onEdit' | 'onRepeat'>) {
  const [editing, setEditing] = useState<'label' | 'amount' | 'tag' | null>(null);
  const [val, setVal] = useState('');
  const begin = (f: 'label' | 'amount' | 'tag') => { setEditing(f); setVal(f === 'amount' ? String(a.amount) : f === 'label' ? a.label : a.tag ?? ''); };
  const save = () => {
    if (editing === 'amount') { const n = Number(val.replace(/[^0-9]/g, '')); if (n > 0) onEdit(a, { amount: n }); }
    else if (editing === 'label') { if (val.trim()) onEdit(a, { label: val.trim() }); }
    else if (editing === 'tag') onEdit(a, { tag: val.trim() });
    setEditing(null);
  };
  const field = (f: 'label' | 'amount' | 'tag', shown: string, cls: string) => editing === f ? (
    <input className={`al-edit ${cls}`} autoFocus value={val} inputMode={f === 'amount' ? 'numeric' : 'text'} aria-label={f}
      onChange={(e) => setVal(e.target.value)} onBlur={save} onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(null); }} />
  ) : <button className={`al-field ${cls}`} onClick={() => begin(f)}>{shown}</button>;
  return (
    <li className={`al ${a.done ? 'done' : ''}`}>
      <button className="ring" style={{ ['--ring' as string]: 'var(--later-ring)', ['--tint' as string]: a.done ? 'var(--later-ring)' : 'var(--later-tint)' }} aria-label={`${a.done ? 'Untick' : 'Tick'} ${a.label}`} onClick={() => onToggle(a)} />
      <div className="al-body">
        {field('label', a.label, 'al-label')}
        <span className="al-meta">
          {field('amount', yen(a.amount), 'al-amt')}
          {field('tag', a.tag ? `#${a.tag}` : '+ tag', 'al-tag')}
          <button className="al-field" aria-pressed={a.recurring !== false} onClick={() => onRepeat(a)}>{a.recurring === false ? 'once' : 'repeats'}</button>
        </span>
      </div>
    </li>
  );
}

/** The month's set-aside checklist. A new month seeds itself from the last one's repeating lines. */
export function Money({ allocations, onAdd, onToggle, onEdit, onRepeat, onSeed, market, receipts = [], onLog, onAddItem, onReceipt, onUndo, onDeleteReceipt, onAttachReceipt, watchPhotos }: Props) {
  const month = jstMonth(new Date());
  const seeded = useRef(false);
  useEffect(() => {
    if (!seeded.current && needsSeed(allocations, month)) { seeded.current = true; onSeed(month); }
  }, [allocations, month, onSeed]);
  const s = summarise(allocations, month);
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [tag, setTag] = useState('');
  const [msg, setMsg] = useState('');
  const pct = s.total > 0 ? Math.round(((s.total - s.left) / s.total) * 100) : 0;
  const name = new Date(`${month}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const submit = () => {
    const n = Number(amount.replace(/[^0-9]/g, ''));
    if (!label.trim()) return setMsg('What is it for?');
    if (!(n > 0)) return setMsg('An amount, first.');
    onAdd({ label: label.trim(), amount: n, tag: tag.trim().replace(/^#/, ''), month });
    setLabel(''); setAmount(''); setTag(''); setMsg('');
  };
  return (
    <main className="screen">
      <header className="top"><div><span className="kicker">SET ASIDE · {name.toUpperCase()}</span><h1>Money</h1></div></header>
      <section className="shelf-fold">
        <p className="al-total"><b>{yen(s.left)}</b> left <span className="mut">of {yen(s.total)} · {s.doneCount} of {s.lines.length} done</span></p>
        <div className="np-bar" role="progressbar" aria-label="Set aside" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><i style={{ width: `${pct}%` }} /></div>
        {s.lines.length === 0 ? <p className="mut">Nothing set aside yet this month.</p> : null}
        <ul className="al-list">{s.lines.map((a) => <Line key={a.id} a={a} onToggle={onToggle} onEdit={onEdit} onRepeat={onRepeat} />)}</ul>
        <form className="al-add" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <input className="search-input" placeholder="What for" value={label} onChange={(e) => setLabel(e.target.value)} aria-label="What for" />
          <input className="search-input" placeholder="Yen" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Yen" />
          <input className="search-input" placeholder="Tag" value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Tag" />
          <button type="submit" className="copy-main">Add</button>
        </form>
        {msg ? <p className="notice" role="status">{msg}</p> : null}
      </section>
      <MarketBlock market={market} onLog={onLog} onAddItem={onAddItem} onUndo={onUndo} />
      <Charts receipts={receipts} />
      <ReceiptsBlock receipts={receipts} onReceipt={onReceipt} onDeleteReceipt={onDeleteReceipt} onAttachReceipt={onAttachReceipt} watchPhotos={watchPhotos} />
      {earlierMonths(allocations, month).length ? (
        <details className="shelf-fold"><summary>Earlier months</summary>
          {earlierMonths(allocations, month).map((m) => (
            <p key={m.month} className="al-past"><b>{m.month}</b> <span className="mut">{yen(m.summary.total)} · {m.summary.doneCount} of {m.summary.lines.length} done</span></p>
          ))}
        </details>
      ) : null}
    </main>
  );
}


const CATS = ['food', 'transport', 'supplies', 'health', 'fees', 'other'];

function MarketBlock({ market, onLog, onAddItem, onUndo }: Pick<Props, 'market' | 'onLog' | 'onAddItem' | 'onUndo'>) {
  const [q, setQ] = useState('');
  const [name, setName] = useState('');
  if (!market || !onLog) return null;
  const counts = marketCounts(market.log, Date.now());
  const shown = market.items.filter((i) => !q.trim() || i.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <details className="shelf-fold" open>
      <summary>Market <span className="mut">{market.items.length} items, {market.log.length} logged</span></summary>
      <input className="search-input" type="search" placeholder="Find an item" aria-label="Find an item" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="mk-chips">
        {shown.map((i) => (
          <button key={i.id} className="qchip mk" onClick={() => onLog(i)}>
            {i.name}{counts.get(i.id) ? <small>{counts.get(i.id)?.n}× · {counts.get(i.id)?.last}</small> : null}
          </button>
        ))}
      </div>
      {onAddItem ? (
        <form className="al-add" onSubmit={(e) => { e.preventDefault(); if (name.trim()) { onAddItem(name.trim()); setName(''); } }}>
          <input className="search-input" placeholder="New item" aria-label="New item" value={name} onChange={(e) => setName(e.target.value)} />
          <button type="submit" className="copy-main alt" disabled={!name.trim()}>Add item</button>
        </form>
      ) : null}
      <details className="shelf-sub"><summary>Recent log</summary>
        <ul className="res-list">{market.log.slice(0, 20).map((l) => <li key={l.id} className="res done">{l.name} <span className="mut">{new Date(l.ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}{l.price ? ` · ${yen(l.price)}` : ''}</span>{onUndo ? <ConfirmButton label="Undo" ariaLabel={`Undo ${l.name}`} onConfirm={() => onUndo(l.id)} /> : null}</li>)}</ul>
      </details>
    </details>
  );
}

function Bars({ title, bars, fmt }: { title: string; bars: { name: string; value: number; pct: number }[]; fmt: (n: number) => string }) {
  if (!bars.length) return null;
  return (
    <div className="mchart"><h3 className="group-title">{title}</h3>
      {bars.map((b) => <div key={b.name} className="mbar"><span className="ml">{b.name}</span><span className="mt"><i style={{ width: `${b.pct}%` }} /></span><span className="mv">{fmt(b.value)}</span></div>)}
    </div>
  );
}

function Charts({ receipts }: { receipts: Receipt[] }) {
  const d = moneyItems(receipts);
  if (d.rows.length < 3) return null;
  return (
    <details className="shelf-fold"><summary>By item</summary>
      <Bars title="Where the money went" bars={topBars(d.rows, 'sum')} fmt={yen} />
      <Bars title="How often" bars={topBars(d.rows, 'n')} fmt={(n) => `${n}×`} />
      {d.lump.n ? <p className="notice">Not in the charts: {d.lump.n} receipt{d.lump.n === 1 ? '' : 's'} ({yen(d.lump.sum)}) kept as a single total for a whole shop trip.</p> : null}
    </details>
  );
}

/** Photos load only when the fold is opened, so a long month does not open a listener per receipt. */
function PhotoFold(props: React.ComponentProps<typeof ReceiptPhotos>) {
  const [open, setOpen] = useState(false);
  return (
    <details className="shelf-sub" onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary>Photos{props.receipt.files?.length ? ` (${props.receipt.files.length})` : ''}</summary>
      {open ? <ReceiptPhotos {...props} /> : null}
    </details>
  );
}

function ReceiptsBlock({ receipts, onReceipt, onDeleteReceipt, onAttachReceipt, watchPhotos }: Pick<Props, 'onReceipt' | 'onDeleteReceipt' | 'onAttachReceipt' | 'watchPhotos'> & { receipts: Receipt[] }) {
  const [amount, setAmount] = useState('');
  const [cat, setCat] = useState('food');
  const [vendor, setVendor] = useState('');
  const [msg, setMsg] = useState('');
  const months = receiptMonths(receipts);
  return (
    <details className="shelf-fold"><summary>Receipts <span className="mut">{receipts.length}</span></summary>
      {onReceipt ? (
        <form className="al-add" onSubmit={(e) => { e.preventDefault(); const n = Number(amount.replace(/[^0-9]/g, '')); if (!(n > 0)) return setMsg('An amount, first.'); onReceipt({ amount: n, cat, vendor: vendor.trim() }); setAmount(''); setVendor(''); setMsg(''); }}>
          <input className="search-input" placeholder="Yen" inputMode="numeric" aria-label="Yen" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <div className="seg" role="group" aria-label="Category">{CATS.map((c) => <button type="button" key={c} aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>)}</div>
          <input className="search-input" placeholder="Vendor" aria-label="Vendor" value={vendor} onChange={(e) => setVendor(e.target.value)} />
          <button type="submit" className="copy-main">Record it</button>
        </form>
      ) : null}
      {msg ? <p className="notice" role="status">{msg}</p> : null}
      {months.map((m) => (
        <div key={m.month}>
          <h3 className="group-title">{m.month} <span className="mut">{yen(m.total)}</span></h3>
          <p className="mut al-cats">{m.cats.map((c) => `${c.cat} ${yen(c.sum)}`).join(' · ')}</p>
          <ul className="res-list">{m.items.slice(0, 25).map((r) => <li key={r.id} className="res done"><span>{yen(r.amount)} · {r.vendor || r.cat}</span><span className="mut">{r.cat} · {new Date(r.ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}{r.files?.length ? ` · ${r.files.length} photo${r.files.length > 1 ? 's' : ''}` : ''}</span>
            {onAttachReceipt && watchPhotos ? <PhotoFold receipt={r} watch={watchPhotos} onAttach={onAttachReceipt} /> : null}
            {onDeleteReceipt ? <ConfirmButton label="Delete" ariaLabel={`Delete receipt ${r.vendor || r.cat}`} onConfirm={() => onDeleteReceipt(r)} /> : null}</li>)}</ul>
        </div>
      ))}
    </details>
  );
}
