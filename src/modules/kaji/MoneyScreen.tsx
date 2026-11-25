import { useEffect, useState, type ReactNode } from 'react';
import { GuestMoney } from '../../GuestMoney';
import { OwnerMoney } from '../../OwnerMoney';
import { t } from './i18n';
import { balances, monthTotals, parseYen, settleUp, yen, type LedgerEntry } from './ledger';
import type { Lang } from './model';
import { addLedger, removeLedger, watchLedger } from './store';
import type { KajiData } from './ui';
import { memberColor } from './view';

/** Splitting costs between the two of them: who paid, who it was for, who owes whom, settling up. */
export function MoneyTab({ data, lang, preview, mine }: { data: KajiData; lang: Lang; preview?: LedgerEntry[]; mine?: ReactNode }) {
  // The preview has no Firebase, so it only has "mine" when given one.
  const [part, setPart] = useState<'mine' | 'shared'>(preview && !mine ? 'shared' : 'mine');
  const owner = data.house.members[data.me] === 'owner';
  const ownerName = data.members.find((m) => data.house.members[m.uid] === 'owner')?.name;
  const own = mine ?? (preview ? null : owner ? <OwnerMoney uid={data.me} /> : <GuestMoney uid={data.me} embedded {...(ownerName ? { ownerName } : {})} />);
  return (
    <>
      <div className="seg kaji-tabs" role="tablist" aria-label="Money">
        <button role="tab" aria-pressed={part === 'mine'} onClick={() => setPart('mine')} style={{ textTransform: 'none' }}>Mine</button>
        <button role="tab" aria-pressed={part === 'shared'} onClick={() => setPart('shared')} style={{ textTransform: 'none' }}>Shared</button>
      </div>
      {part === 'mine' ? own : <MoneyScreen data={data} lang={lang} {...(preview ? { preview } : {})} />}
    </>
  );
}

export function MoneyScreen({ data, lang, preview }: { data: KajiData; lang: Lang; preview?: LedgerEntry[] }) {
  const [entries, setEntries] = useState<LedgerEntry[]>(preview ?? []);
  const [adding, setAdding] = useState(false);
  useEffect(() => (preview ? undefined : watchLedger(data.hid, setEntries)), [data.hid, preview]);
  const net = balances(entries, data.members);
  const settle = settleUp(net);
  const name = (uid: string) => data.members.find((m) => m.uid === uid)?.name ?? '?';
  const idx = (uid: string) => Math.max(0, data.members.findIndex((m) => m.uid === uid));
  const month = new Date(data.now + 9 * 3_600_000).toISOString().slice(0, 7);
  const mt = monthTotals(entries, month);
  const line = settle ? (settle.to === data.me ? `${name(settle.from)} ${t(lang, 'owesYou')}` : settle.from === data.me ? `${t(lang, 'youOwe')} ${name(settle.to)}` : `${name(settle.from)} → ${name(settle.to)}`) : t(lang, 'allEven');
  return (
    <>
      <p className="notice">{t(lang, 'moneyAbout')}</p>
      <div className="panel kaji-bal">
        <div className="kaji-bal-head"><span className="kicker">{t(lang, 'thisMonth').toUpperCase()}</span><b className="kaji-pct">{yen(mt.total)}</b></div>
        <p className="mut kaji-line">{data.members.map((m) => `${m.name} ${yen(mt.byPayer[m.uid] ?? 0)}`).join(' · ')} {t(lang, 'spent')}</p>
        <div className="kaji-bal-head" style={{ marginTop: 6 }}><b>{line}</b>{settle ? <b className="kaji-pct" style={{ fontSize: 22 }}>{yen(settle.amount)}</b> : null}</div>
        <div className="kaji-chips">
          <button className="copy-main" onClick={() => setAdding(true)}>+ {t(lang, 'addExpense')}</button>
          {settle ? <button className="chip-btn" onClick={() => void addLedger(data.hid, { at: Date.now(), by: data.me, paidBy: settle.from, amount: settle.amount, text: t(lang, 'settled'), kind: 'settle', split: { [settle.to]: 1 } })}>{t(lang, 'settleUp')}</button> : null}
        </div>
      </div>
      <ul className="kaji-list panel">
        {entries.slice(0, 60).map((e) => (
          <li key={e.id} className="kaji-item">
            <i className="kaji-dot" style={{ background: memberColor(idx(e.paidBy)) }} />
            <span className="kaji-main"><b>{e.text}</b><small className="mut">{new Date(e.at + 9 * 3_600_000).toISOString().slice(5, 10)} · {name(e.paidBy)}{e.split && Object.keys(e.split).length === 1 ? ` → ${name(Object.keys(e.split)[0] as string)}` : ''}</small></span>
            <b>{yen(e.amount)}</b>
            <button className="chip-btn" aria-label={t(lang, 'deleteEntry')} onClick={() => void removeLedger(data.hid, e.id)}>×</button>
          </li>
        ))}
        {entries.length === 0 ? <li className="kaji-item mut">·</li> : null}
      </ul>
      {adding ? <AddSheet data={data} lang={lang} onClose={() => setAdding(false)} onSave={(e) => { void addLedger(data.hid, e); setAdding(false); }} /> : null}
    </>
  );
}

function AddSheet({ data, lang, onSave, onClose }: { data: KajiData; lang: Lang; onSave: (e: Omit<LedgerEntry, 'id'>) => void; onClose: () => void }) {
  const [amount, setAmount] = useState('');
  const [what, setWhat] = useState('');
  const [payer, setPayer] = useState(data.me);
  const [forWho, setForWho] = useState<'both' | string>('both');
  const n = parseYen(amount);
  return (
    <div className="scrim" onClick={onClose}>
      <form className="sheet kaji-sheet" role="dialog" aria-label={t(lang, 'addExpense')} onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); if (n > 0) onSave({ at: Date.now(), by: data.me, paidBy: payer, amount: n, text: what.trim() || t(lang, 'addExpense'), kind: 'expense', ...(forWho === 'both' ? {} : { split: { [forWho]: 1 } }) }); }}>
        <span className="grab" />
        <b className="sheet-title">{t(lang, 'addExpense')}</b>
        <label className="kaji-field"><span>{t(lang, 'amount')}</span><input inputMode="numeric" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1200" /></label>
        <label className="kaji-field"><span>{t(lang, 'what')}</span><input value={what} onChange={(e) => setWhat(e.target.value)} /></label>
        <div className="kaji-field"><span>{t(lang, 'paidBy')}</span><div className="kaji-chips">{data.members.map((m) => <button type="button" key={m.uid} className="chip-btn" aria-pressed={payer === m.uid} onClick={() => setPayer(m.uid)}>{m.name}</button>)}</div></div>
        <div className="kaji-field"><span>{t(lang, 'forWho')}</span><div className="kaji-chips">
          <button type="button" className="chip-btn" aria-pressed={forWho === 'both'} onClick={() => setForWho('both')}>{t(lang, 'forBoth')}</button>
          {data.members.map((m) => <button type="button" key={m.uid} className="chip-btn" aria-pressed={forWho === m.uid} onClick={() => setForWho(m.uid)}>{t(lang, 'forOnly')} {m.name}</button>)}
        </div></div>
        <div className="sheet-foot"><button type="button" className="chip-btn" onClick={onClose}>{t(lang, 'skip')}</button><button type="submit" className="copy-main" disabled={!(n > 0)}>{t(lang, 'save')}</button></div>
      </form>
    </div>
  );
}
