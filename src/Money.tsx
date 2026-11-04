import { useEffect, useRef, useState } from 'react';
import { earlierMonths, jstMonth, needsSeed, summarise, yen } from './money';
import type { Alloc } from './types';

interface Props {
  allocations: Alloc[];
  onAdd: (a: { label: string; amount: number; tag: string; month: string }) => void;
  onToggle: (a: Alloc) => void;
  onEdit: (a: Alloc, change: { label?: string; amount?: number; tag?: string }) => void;
  onRepeat: (a: Alloc) => void;
  onSeed: (month: string) => void;
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
export function Money({ allocations, onAdd, onToggle, onEdit, onRepeat, onSeed }: Props) {
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
