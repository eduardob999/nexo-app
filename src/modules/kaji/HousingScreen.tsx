import { useEffect, useMemo, useRef, useState } from 'react';
import { ConfirmButton } from '../../ConfirmButton';
import {
  blankListing, COST_KEYS, docProgress, helpRequest, monthly, overCap, overdue, parseYenText, seedAll, sourceProblem, split, stepProgress, upfront, upfrontMonths, visaRisk,
  type Chip, type Cohab, type CostKey, type DocPerson, type HAny, type HBrief, type HDoc, type HListing, type HSource, type HStep, type ListingStatus, type Owner, type StepStatus,
} from './housing';
import { yen } from './ledger';
import type { Lang } from './model';
import { housingId, patchHousing, removeHousing, saveHousing, seedHousing, watchHousing } from './store';
import { dayKey } from './time';
import type { KajiActions, KajiData } from './ui';

type Section = 'steps' | 'listings' | 'costs' | 'docs' | 'sources';
const SECTIONS: { id: Section; label: string }[] = [
  { id: 'steps', label: 'Steps' }, { id: 'listings', label: 'Listings' }, { id: 'costs', label: 'Costs' }, { id: 'docs', label: 'Papers' }, { id: 'sources', label: 'Sources' },
];
const STATUS: { id: StepStatus; label: string }[] = [{ id: 'todo', label: 'To do' }, { id: 'doing', label: 'Doing' }, { id: 'done', label: 'Done' }, { id: 'blocked', label: 'Blocked' }];
const OWNERS: Owner[] = ['eduardo', 'carla', 'nexo', 'agent'];
const LSTATUS: { id: ListingStatus; label: string }[] = [
  { id: 'idea', label: 'Idea' }, { id: 'contact', label: 'Contacted' }, { id: 'viewing', label: 'Viewing' }, { id: 'applied', label: 'Applied' }, { id: 'won', label: 'Got it' }, { id: 'dropped', label: 'Dropped' },
];
const COHAB: { id: Cohab; label: string }[] = [{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }, { id: 'ask', label: 'To ask' }];
const COST_LABEL: Record<CostKey, string> = {
  deposit: 'Deposit (敷金)', keyMoney: 'Key money (礼金)', agentFee: 'Agent fee (仲介手数料)', firstMonth: 'First month', guarantor: 'Guarantor company', insurance: 'Fire insurance', keyExchange: 'Key exchange',
};
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDate = (d: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d); return m ? `${Number(m[3])} ${MON[Number(m[2]) - 1]} ${m[1]}` : d; };
const fmtMonth = (d: string) => { const m = /^(\d{4})-(\d{2})$/.exec(d); return m ? `${MON[Number(m[2]) - 1]} ${m[1]}` : d; };

interface Api { save: (d: HAny) => void; patch: (id: string, p: Record<string, unknown>) => void; remove: (id: string) => void }

/** The shared-house search: must-haves, the steps, candidate listings with their costs, papers per person and the sources behind them. Both edit. */
export function HousingScreen({ data, actions, preview }: { data: KajiData; actions: KajiActions; lang: Lang; preview?: HAny[] }) {
  const [all, setAll] = useState<HAny[]>(preview ?? []);
  const [loaded, setLoaded] = useState(!!preview);
  const [section, setSection] = useState<Section>('steps');
  const [toast, setToast] = useState('');
  const seeded = useRef(false);
  useEffect(() => {
    if (preview) return undefined;
    return watchHousing(data.hid, (docs, fromServer) => {
      setAll(docs);
      if (fromServer) setLoaded(true);
      // the first time either of them opens it, the brief's steps and papers are written once, with fixed ids
      if (fromServer && !docs.some((d) => d.part === 'brief') && !seeded.current) { seeded.current = true; void seedHousing(data.hid, seedAll()); }
    });
  }, [data.hid, preview]);
  useEffect(() => { if (!toast) return undefined; const i = window.setTimeout(() => setToast(''), 3200); return () => window.clearTimeout(i); }, [toast]);

  const api = useMemo<Api>(() => (preview ? {
    save: (d) => setAll((xs) => [...xs.filter((x) => x.id !== d.id), d]),
    patch: (id, p) => setAll((xs) => xs.map((x) => (x.id === id ? ({ ...x, ...p } as HAny) : x))),
    remove: (id) => setAll((xs) => xs.filter((x) => x.id !== id)),
  } : {
    save: (d) => void saveHousing(data.hid, d),
    patch: (id, p) => void patchHousing(data.hid, id, p),
    remove: (id) => void removeHousing(data.hid, id),
  }), [preview, data.hid]);

  const st = useMemo(() => split(all), [all]);
  const owner = data.members.find((m) => data.house.members[m.uid] === 'owner');
  const member = data.members.find((m) => data.house.members[m.uid] !== 'owner');
  const names: Record<Owner, string> = { eduardo: owner?.name ?? 'Eduardo', carla: member?.name ?? 'Carla', nexo: 'Nexo', agent: 'Agent' };
  const myName = data.members.find((m) => m.uid === data.me)?.name ?? '';
  const today = dayKey(data.now);

  if (!st.brief) return <p className="notice">{loaded ? 'Setting up the housing tracker.' : 'Loading'}</p>;
  const brief = st.brief;
  const askNexo = async (s: HStep) => {
    try { await actions.ask('other', helpRequest(s, myName), null); setToast(`Sent to Nexo. It lands on ${names.eduardo}'s board as a card.`); } catch { setToast('Not sent. Try again.'); }
  };

  return (
    <>
      <p className="notice">The shared-house search. Both of you see and edit everything here, and changes show up for the other person as they happen.</p>
      <RiskBanner brief={brief} />
      <Chips brief={brief} api={api} />
      <div className="seg kaji-tabs kaji-hs-seg" role="tablist" style={{ marginTop: 14 }}>
        {SECTIONS.map((s) => <button key={s.id} role="tab" aria-pressed={section === s.id} onClick={() => setSection(s.id)} style={{ textTransform: 'none' }}>{s.label}</button>)}
      </div>
      {section === 'steps' ? <Steps steps={st.steps} api={api} names={names} today={today} onAsk={askNexo} /> : null}
      {section === 'listings' ? <Listings listings={st.listings} brief={brief} api={api} by={data.me} now={data.now} /> : null}
      {section === 'costs' ? <Costs listings={st.listings} brief={brief} api={api} /> : null}
      {section === 'docs' ? <Docs docs={st.docs} api={api} names={names} /> : null}
      {section === 'sources' ? <Sources sources={st.sources} api={api} by={data.me} nameOf={(u) => data.members.find((m) => m.uid === u)?.name ?? ''} /> : null}
      {toast ? <div className="kaji-toast" role="status">{toast}</div> : null}
    </>
  );
}

/** An input that keeps what is typed and saves it when the field is left, so a remote change never fights the person typing. */
function Field({ value, onSave, label, placeholder, type = 'text', className }: { value: string; onSave: (v: string) => void; label: string; placeholder?: string; type?: string; className?: string }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <input className={className} type={type} value={v} aria-label={label} placeholder={placeholder}
      onChange={(e) => { setV(e.target.value); if (type === 'date' || type === 'month') onSave(e.target.value); }}
      onBlur={() => { if (v !== value && type !== 'date' && type !== 'month') onSave(v); }}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
  );
}

function RiskBanner({ brief }: { brief: HBrief }) {
  const r = visaRisk(brief);
  if (!r || !r.short) return null;
  return (
    <div className="panel kaji-hs-risk" role="note">
      <b>Visa shorter than the lease</b>
      <p>Both visas expire {fmtDate(brief.visaExpiry)}. Moving in {fmtMonth(brief.moveIn)} leaves about {r.months} months, shorter than a {brief.leaseYears}-year lease ({r.leaseMonths} months).
        Ask for a contract that ends, or can be ended, before then, expect the guarantor company to ask about renewal, and plan the renewal before applying.</p>
    </div>
  );
}

function Chips({ brief, api }: { brief: HBrief; api: Api }) {
  const [edit, setEdit] = useState<Chip | 'new' | 'numbers' | null>(null);
  const firmWord = (f: boolean | null) => (f === true ? 'firm' : f === false ? 'can give' : 'open');
  const saveChips = (chips: Chip[]) => api.patch(brief.id, { chips });
  return (
    <div className="panel kaji-hs-chips">
      <div className="kaji-hs-head"><span className="kicker">MUST-HAVES</span><button className="chip-btn small" onClick={() => setEdit('numbers')}>Dates and cap</button></div>
      <div className="kaji-chips">
        {brief.chips.map((c) => (
          <button key={c.id} className={`chip-btn kaji-hs-chip f-${firmWord(c.firm).replace(' ', '')}`} onClick={() => setEdit(c)}>
            <span>{c.text}</span><small>{firmWord(c.firm)}</small>
          </button>
        ))}
        <button className="chip-btn" aria-label="Add a must-have" onClick={() => setEdit('new')}>+</button>
      </div>
      {edit === 'numbers' ? <NumbersSheet brief={brief} onClose={() => setEdit(null)} onSave={(p) => { api.patch(brief.id, p); setEdit(null); }} /> : null}
      {edit && edit !== 'numbers' ? (
        <ChipSheet chip={edit === 'new' ? { id: `c${Date.now().toString(36)}`, text: '', firm: null } : edit} isNew={edit === 'new'} onClose={() => setEdit(null)}
          onSave={(c) => { saveChips(edit === 'new' ? [...brief.chips, c] : brief.chips.map((x) => (x.id === c.id ? c : x))); setEdit(null); }}
          onRemove={(id) => { saveChips(brief.chips.filter((x) => x.id !== id)); setEdit(null); }} />
      ) : null}
    </div>
  );
}

function ChipSheet({ chip, isNew, onSave, onRemove, onClose }: { chip: Chip; isNew: boolean; onSave: (c: Chip) => void; onRemove: (id: string) => void; onClose: () => void }) {
  const [text, setText] = useState(chip.text);
  const [firm, setFirm] = useState<boolean | null>(chip.firm);
  return (
    <div className="scrim" onClick={onClose}>
      <form className="sheet kaji-sheet" role="dialog" aria-label="Must-have" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (text.trim()) onSave({ ...chip, text: text.trim().slice(0, 120), firm }); }}>
        <span className="grab" />
        <b className="sheet-title">{isNew ? 'Add a must-have' : 'Must-have'}</b>
        <label className="kaji-field"><span>What</span><input className="kaji-text" autoFocus value={text} maxLength={120} onChange={(e) => setText(e.target.value)} /></label>
        <div className="kaji-field"><span>Can it give?</span><div className="kaji-chips">
          {([[true, 'Firm'], [false, 'Can give'], [null, 'Not decided']] as const).map(([v, l]) => <button key={l} type="button" className="chip-btn" aria-pressed={firm === v} onClick={() => setFirm(v)}>{l}</button>)}
        </div></div>
        <div className="sheet-foot">
          {isNew ? <button type="button" className="chip-btn" onClick={onClose}>Cancel</button> : <ConfirmButton label="Remove" className="chip-btn" onConfirm={() => onRemove(chip.id)} />}
          <button type="submit" className="copy-main" disabled={!text.trim()}>Save</button>
        </div>
      </form>
    </div>
  );
}

function NumbersSheet({ brief, onSave, onClose }: { brief: HBrief; onSave: (p: Partial<HBrief>) => void; onClose: () => void }) {
  const [cap, setCap] = useState(String(brief.rentCap));
  const [moveIn, setMoveIn] = useState(brief.moveIn);
  const [visa, setVisa] = useState(brief.visaExpiry);
  const [lease, setLease] = useState(String(brief.leaseYears));
  const capN = parseYenText(cap);
  const leaseN = Number(lease);
  const ok = capN !== null && /^\d{4}-\d{2}$/.test(moveIn) && /^\d{4}-\d{2}-\d{2}$/.test(visa) && leaseN > 0;
  return (
    <div className="scrim" onClick={onClose}>
      <form className="sheet kaji-sheet" role="dialog" aria-label="Dates and cap" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (ok) onSave({ rentCap: capN!, moveIn, visaExpiry: visa, leaseYears: leaseN }); }}>
        <span className="grab" />
        <b className="sheet-title">Dates and cap</b>
        <label className="kaji-field"><span>Rent cap a month, all in (yen)</span><input inputMode="numeric" value={cap} onChange={(e) => setCap(e.target.value)} /></label>
        <label className="kaji-field"><span>Move-in month</span><input type="month" value={moveIn} onChange={(e) => setMoveIn(e.target.value)} /></label>
        <label className="kaji-field"><span>Visa expiry (the earlier of the two)</span><input type="date" value={visa} onChange={(e) => setVisa(e.target.value)} /></label>
        <label className="kaji-field"><span>Lease length (years)</span><input inputMode="decimal" value={lease} onChange={(e) => setLease(e.target.value)} /></label>
        <div className="sheet-foot"><button type="button" className="chip-btn" onClick={onClose}>Cancel</button><button type="submit" className="copy-main" disabled={!ok}>Save</button></div>
      </form>
    </div>
  );
}

function Steps({ steps, api, names, today, onAsk }: { steps: HStep[]; api: Api; names: Record<Owner, string>; today: string; onAsk: (s: HStep) => Promise<void> }) {
  const p = stepProgress(steps);
  const [asked, setAsked] = useState<Set<string>>(new Set());
  return (
    <>
      <p className="notice kaji-hs-sum">{p.done} of {p.total} done{p.next ? <>. Next: <b>{p.next.n}. {p.next.title}</b>, {names[p.next.owner]}, {fmtDate(p.next.due)}</> : null}. Dates are first guesses for a March move-in.</p>
      <ul className="kaji-list panel">
        {steps.map((s) => (
          <li key={s.id} className={`kaji-item kaji-hs-step ${s.status === 'done' ? 'kaji-dim' : ''}`}>
            <span className={`kaji-hs-n s-${s.status}`} aria-hidden="true">{s.status === 'done' ? '✓' : s.n}</span>
            <span className="kaji-main"><b style={s.status === 'done' ? { textDecoration: 'line-through' } : undefined}>{s.n}. {s.title}</b><small className="mut">{s.detail}</small></span>
            <div className="kaji-hs-ctl">
              <select value={s.status} aria-label={`Status of step ${s.n}`} onChange={(e) => api.patch(s.id, { status: e.target.value })}>{STATUS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select>
              <select value={s.owner} aria-label={`Who does step ${s.n}`} onChange={(e) => api.patch(s.id, { owner: e.target.value })}>{OWNERS.map((o) => <option key={o} value={o}>{names[o]}</option>)}</select>
              <Field type="date" value={s.due} label={`Due date of step ${s.n}`} onSave={(v) => api.patch(s.id, { due: v })} className={overdue(s, today) ? 'kaji-hs-late' : ''} />
              {s.status !== 'done' ? (
                <button className="chip-btn small" disabled={asked.has(s.id)} onClick={() => { setAsked(new Set(asked).add(s.id)); void onAsk(s); }}>{asked.has(s.id) ? 'Asked' : 'Ask Nexo'}</button>
              ) : null}
            </div>
            <Field className="kaji-hs-note" value={s.note} label={`Note for step ${s.n}`} placeholder="Note" onSave={(v) => api.patch(s.id, { note: v.slice(0, 500) })} />
          </li>
        ))}
      </ul>
    </>
  );
}

function Listings({ listings, brief, api, by, now }: { listings: HListing[]; brief: HBrief; api: Api; by: string; now: number }) {
  const [edit, setEdit] = useState<HListing | null>(null);
  return (
    <>
      <div className="kaji-chips" style={{ margin: '10px 0' }}>
        <button className="copy-main" style={{ padding: '0 18px' }} onClick={() => setEdit(blankListing(housingId('listing'), by, now))}>+ Add a listing</button>
      </div>
      {listings.length === 0 ? <div className="panel kaji-empty"><b>No listings yet.</b><p className="mut">Add one with its link, rent and stations. Costs can be filled in later from Costs.</p></div> : null}
      {listings.map((l) => {
        const mo = monthly(l);
        const up = upfront(l);
        const months = upfrontMonths(l);
        const over = overCap(l, brief.rentCap);
        return (
          <div key={l.id} className={`panel kaji-hs-card ${l.status === 'dropped' ? 'kaji-dim' : ''}`}>
            <div className="kaji-hs-head">
              <b className="kaji-hs-name">{l.url ? <a href={l.url} target="_blank" rel="noreferrer">{l.name || 'Listing'}</a> : (l.name || 'Listing')}</b>
              <select value={l.status} aria-label="Status" onChange={(e) => api.patch(l.id, { status: e.target.value })}>{LSTATUS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select>
            </div>
            {l.area || l.stations ? <p className="mut kaji-hs-line">{[l.area, l.stations].filter(Boolean).join(' · ')}</p> : null}
            <dl className="kaji-hs-stats">
              <div><dt>Monthly, all in</dt><dd className={over ? 'kaji-hs-bad' : ''}>{mo.value === null ? <i>to fill</i> : yen(mo.value)}</dd>
                <small className="mut">{parseYenText(l.rent) === null ? 'rent to fill' : `rent ${yen(parseYenText(l.rent)!)}`} + {parseYenText(l.mgmt) === null ? 'fee to fill' : `fee ${yen(parseYenText(l.mgmt)!)}`}{over ? `, over the ${yen(brief.rentCap)} cap` : ''}</small></div>
              <div><dt>Up-front</dt><dd>{up.total ? yen(up.total) : <i>to fill</i>}</dd>
                <small className="mut">{up.complete ? (months !== null ? `${months} months of rent` : 'complete') : `${up.missing.length} still to fill`}</small></div>
              <div><dt>Two people OK</dt><dd className={l.cohab === 'no' ? 'kaji-hs-bad' : l.cohab === 'yes' ? 'kaji-hs-good' : ''}>{COHAB.find((c) => c.id === l.cohab)?.label}</dd></div>
              <div><dt>Viewing</dt><dd><Field type="date" value={l.viewing} label="Viewing date" onSave={(v) => api.patch(l.id, { viewing: v })} /></dd></div>
            </dl>
            {l.note ? <p className="kaji-hs-line">{l.note}</p> : null}
            <div className="kaji-chips"><button className="chip-btn small" onClick={() => setEdit(l)}>Edit</button><ConfirmButton label="Remove" onConfirm={() => api.remove(l.id)} /></div>
          </div>
        );
      })}
      {edit ? <ListingSheet listing={edit} isNew={!listings.some((x) => x.id === edit.id)} onClose={() => setEdit(null)} onSave={(l) => { api.save(l); setEdit(null); }} /> : null}
    </>
  );
}

function ListingSheet({ listing, isNew, onSave, onClose }: { listing: HListing; isNew: boolean; onSave: (l: HListing) => void; onClose: () => void }) {
  const [l, setL] = useState<HListing>(listing);
  const f = (k: keyof HListing, label: string, placeholder = '', type = 'text') => (
    <label className="kaji-field"><span>{label}</span><input type={type} value={String(l[k] ?? '')} placeholder={placeholder} onChange={(e) => setL({ ...l, [k]: e.target.value })} /></label>
  );
  const urlBad = l.url.trim() !== '' && !/^https?:\/\/\S+$/i.test(l.url.trim());
  return (
    <div className="scrim" onClick={onClose}>
      <form className="sheet kaji-sheet" role="dialog" aria-label="Listing" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (!urlBad) onSave({ ...l, name: l.name.trim() || 'Listing', url: l.url.trim() }); }}>
        <span className="grab" />
        <b className="sheet-title">{isNew ? 'Add a listing' : 'Edit listing'}</b>
        {f('name', 'Name', 'Building or listing title')}
        {f('url', 'Link', 'https://suumo.jp/...')}
        {urlBad ? <small className="mut" role="alert">A link starts with https://</small> : null}
        {f('area', 'Area', 'Obaku, Uji')}
        {f('stations', 'Stations and distance', 'Keihan Obaku 6 min, JR Obaku 8 min')}
        <div className="kaji-hs-grid">
          {f('rent', 'Rent (yen)', 'to fill')}
          {f('mgmt', 'Management fee', 'to fill')}
          {COST_KEYS.map((k) => <span key={k}>{f(k, COST_LABEL[k], k === 'firstMonth' ? 'rent + fee' : 'to fill')}</span>)}
        </div>
        <small className="mut">Type yen, or months of rent like 1m. Leave empty when not known yet.</small>
        <div className="kaji-field"><span>Two people allowed (二人入居可, 同棲可)</span><div className="kaji-chips">
          {COHAB.map((c) => <button key={c.id} type="button" className="chip-btn" aria-pressed={l.cohab === c.id} onClick={() => setL({ ...l, cohab: c.id })}>{c.label}</button>)}
        </div></div>
        {f('viewing', 'Viewing date', '', 'date')}
        <label className="kaji-field"><span>Note</span><textarea rows={2} maxLength={500} value={l.note} onChange={(e) => setL({ ...l, note: e.target.value })} /></label>
        <div className="sheet-foot"><button type="button" className="chip-btn" onClick={onClose}>Cancel</button><button type="submit" className="copy-main" disabled={urlBad}>Save</button></div>
      </form>
    </div>
  );
}

function Costs({ listings, brief, api }: { listings: HListing[]; brief: HBrief; api: Api }) {
  if (listings.length === 0) return <div className="panel kaji-empty"><b>No listings yet.</b><p className="mut">Add a listing under Listings, and its costs show up here.</p></div>;
  const rows = listings.filter((l) => l.status !== 'dropped').map((l) => ({ l, mo: monthly(l), up: upfront(l) }));
  return (
    <>
      <p className="notice">Type yen, or months of rent like 1m. An empty field is still to fill and is left out of the total. Cap: {yen(brief.rentCap)} a month all in.</p>
      <div className="panel kaji-hs-table" role="table" aria-label="Costs by listing">
        <div role="row" className="kaji-hs-tr kaji-hs-th"><span role="columnheader">Listing</span><span role="columnheader">Monthly</span><span role="columnheader">Up-front</span></div>
        {rows.map(({ l, mo, up }) => (
          <div role="row" key={l.id} className="kaji-hs-tr">
            <span role="cell">{l.name || 'Listing'}</span>
            <span role="cell" className={overCap(l, brief.rentCap) ? 'kaji-hs-bad' : ''}>{mo.value === null ? 'to fill' : yen(mo.value)}</span>
            <span role="cell">{up.total ? yen(up.total) : 'to fill'}{up.complete ? '' : <small className="mut">+{up.missing.length} to fill</small>}</span>
          </div>
        ))}
      </div>
      {rows.map(({ l, up }) => (
        <div key={l.id} className="panel kaji-hs-card">
          <div className="kaji-hs-head"><b className="kaji-hs-name">{l.name || 'Listing'}</b><b className="kaji-hs-total">{yen(up.total)}</b></div>
          <div className="kaji-hs-grid">
            <label className="kaji-field"><span>Rent</span><Field value={l.rent} label="Rent" placeholder="to fill" onSave={(v) => api.patch(l.id, { rent: v })} /></label>
            <label className="kaji-field"><span>Management fee</span><Field value={l.mgmt} label="Management fee" placeholder="to fill" onSave={(v) => api.patch(l.id, { mgmt: v })} /></label>
            {COST_KEYS.map((k) => (
              <label key={k} className="kaji-field"><span>{COST_LABEL[k]}</span>
                <Field value={l[k]} label={COST_LABEL[k]} placeholder={k === 'firstMonth' ? 'rent + fee' : 'to fill'} onSave={(v) => api.patch(l.id, { [k]: v })} />
                <small className="mut">{up.parts[k] === null ? 'to fill' : `${yen(up.parts[k]!)}${up.assumed.includes(k) ? ', taken as rent + fee' : ''}`}</small>
              </label>
            ))}
          </div>
          <p className="kaji-hs-line"><b>{up.complete ? 'Up-front total' : 'Known so far'}: {yen(up.total)}</b>{up.complete ? '' : <span className="mut">. Still to fill: {up.missing.map((k) => COST_LABEL[k].split(' (')[0]).join(', ')}.</span>}</p>
        </div>
      ))}
    </>
  );
}

function Docs({ docs, api, names }: { docs: HDoc[]; api: Api; names: Record<Owner, string> }) {
  const [text, setText] = useState('');
  const [who, setWho] = useState<DocPerson>('both');
  const label: Record<DocPerson, string> = { eduardo: names.eduardo, carla: names.carla, both: 'Both of you' };
  return (
    <>
      <p className="notice">What landlords and guarantor companies usually ask international students for. Confirm per listing.</p>
      {(['eduardo', 'carla', 'both'] as const).map((p) => {
        const mine = docs.filter((d) => d.person === p);
        const pr = docProgress(docs, p);
        return (
          <div key={p} className="panel">
            <div className="kaji-hs-head" style={{ padding: '12px 16px 0' }}><span className="kicker">{label[p].toUpperCase()}</span><small className="mut">{pr.done} of {pr.total}</small></div>
            <ul className="kaji-list">
              {mine.map((d) => (
                <li key={d.id} className={`kaji-item kaji-listitem ${d.done ? 'kaji-dim' : ''}`}>
                  <button className={`kaji-check-ring ${d.done ? 'on' : ''}`} role="checkbox" aria-checked={d.done} aria-label={d.text} onClick={() => api.patch(d.id, { done: !d.done })}>{d.done ? '✓' : ''}</button>
                  <span className="kaji-main"><b style={d.done ? { textDecoration: 'line-through', fontWeight: 400 } : undefined}>{d.text}</b></span>
                  <ConfirmButton label="×" ariaLabel={`Remove ${d.text}`} onConfirm={() => api.remove(d.id)} />
                </li>
              ))}
              {mine.length === 0 ? <li className="kaji-item mut">Nothing listed.</li> : null}
            </ul>
          </div>
        );
      })}
      <form className="panel kaji-hs-add" onSubmit={(e) => { e.preventDefault(); if (text.trim()) { api.save({ part: 'doc', id: housingId('doc'), person: who, text: text.trim().slice(0, 160), done: false, at: Date.now() }); setText(''); } }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a paper" aria-label="Add a paper" />
        <select value={who} aria-label="Whose" onChange={(e) => setWho(e.target.value as DocPerson)}>{(['eduardo', 'carla', 'both'] as const).map((p) => <option key={p} value={p}>{label[p]}</option>)}</select>
        <button className="chip-btn" type="submit" disabled={!text.trim()}>Add</button>
      </form>
    </>
  );
}

function Sources({ sources, api, by, nameOf }: { sources: HSource[]; api: Api; by: string; nameOf: (uid: string) => string }) {
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const add = () => {
    const p = sourceProblem(url, text);
    if (p) { setErr(p === 'url' ? 'A link starts with https://' : 'Paste a link or some text.'); return; }
    api.save({ part: 'source', id: housingId('source'), url: url.trim(), text: text.trim().slice(0, 20_000), note: note.trim().slice(0, 300), at: Date.now(), by });
    setUrl(''); setText(''); setNote(''); setErr('');
  };
  return (
    <>
      <p className="notice">Listings, web pages, Perplexity answers and mails worth keeping, each with a note on why.</p>
      <form className="panel kaji-form kaji-hs-src" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <label className="kaji-field"><span>Link</span><input value={url} inputMode="url" placeholder="https://" onChange={(e) => { setUrl(e.target.value); setErr(''); }} /></label>
        <label className="kaji-field"><span>Or paste the text</span><textarea rows={3} value={text} onChange={(e) => { setText(e.target.value); setErr(''); }} /></label>
        <label className="kaji-field"><span>Note</span><input value={note} placeholder="Why it matters" onChange={(e) => setNote(e.target.value)} /></label>
        {err ? <small className="mut" role="alert">{err}</small> : null}
        <button className="copy-main" type="submit">Add source</button>
      </form>
      <ul className="kaji-list panel">
        {sources.map((s) => (
          <li key={s.id} className="kaji-item kaji-hs-source">
            <span className="kaji-main">
              {s.url ? <a href={s.url} target="_blank" rel="noreferrer" className="kaji-hs-url">{s.url.replace(/^https?:\/\//, '')}</a> : null}
              {s.note ? <b>{s.note}</b> : null}
              {s.text ? <details><summary className="mut">{s.text.slice(0, 90)}{s.text.length > 90 ? '…' : ''}</summary><p className="kaji-hs-pre">{s.text}</p></details> : null}
              <small className="mut">{nameOf(s.by)}{s.at ? ` · ${new Date(s.at + 9 * 3_600_000).toISOString().slice(0, 10)}` : ''}</small>
            </span>
            <ConfirmButton label="×" ariaLabel="Remove source" onConfirm={() => api.remove(s.id)} />
          </li>
        ))}
        {sources.length === 0 ? <li className="kaji-item mut">No sources yet.</li> : null}
      </ul>
    </>
  );
}
