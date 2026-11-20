import { useEffect, useState } from 'react';
import { KINDS, problem, whenFrom, type Ask, type AskKind } from './asks';
import { t } from './i18n';
import type { Lang } from './model';
import { watchAsks } from './store';
import type { KajiActions, KajiData } from './ui';

/** The request button for the other person: pick a kind, write a line, send. It becomes a card on the owner's board. */
export function AskButton({ data, lang, actions, preview }: { data: KajiData; lang: Lang; actions: KajiActions; preview?: Ask[] }) {
  const owner = data.members.find((m) => data.house.members[m.uid] === 'owner');
  const [open, setOpen] = useState(false);
  const [asks, setAsks] = useState<Ask[]>(preview ?? []);
  useEffect(() => (preview ? undefined : watchAsks(data.hid, data.me, setAsks)), [data.hid, data.me, preview]);
  if (!owner || owner.uid === data.me) return null;
  return (
    <>
      <div className="panel kaji-ask">
        <button className="copy-main" onClick={() => setOpen(true)}>🙋 {t(lang, 'ask').replace('Eduardo', owner.name)}</button>
        {asks.slice(0, 3).map((a) => (
          <span key={a.id} className="kaji-askrow mut"><span>{KINDS.find((k) => k.id === a.kind)?.icon} {a.text.length > 44 ? a.text.slice(0, 44) + '…' : a.text}</span><small>{a.state === 'done' ? t(lang, 'askDone') : t(lang, 'askNew')}</small></span>
        ))}
      </div>
      {open ? <AskSheet lang={lang} owner={owner.name} onClose={() => setOpen(false)} onSend={async (kind, text, when) => { await actions.ask(kind, text, when); }} /> : null}
    </>
  );
}

function AskSheet({ lang, owner, onSend, onClose }: { lang: Lang; owner: string; onSend: (k: AskKind, text: string, when: number | null) => Promise<void>; onClose: () => void }) {
  const [kind, setKind] = useState<AskKind>('question');
  const [text, setText] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  const def = KINDS.find((k) => k.id === kind)!;
  const when = whenFrom(date, time);
  const submit = async () => {
    const p = problem(kind, text, when);
    if (p) { setErr(t(lang, p === 'when' ? 'askNeedWhen' : p === 'long' ? 'askLong' : 'askShort')); return; }
    try { await onSend(kind, text.trim(), def.needsWhen ? when : null); setDone(true); } catch { setErr('?'); }
  };
  return (
    <div className="scrim" onClick={onClose}>
      <form className="sheet kaji-sheet" role="dialog" aria-label={t(lang, 'ask').replace('Eduardo', owner)} onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <span className="grab" />
        <div><b className="sheet-title">{t(lang, 'ask').replace('Eduardo', owner)}</b><p className="mut sheet-sub">{t(lang, 'askAbout')}</p></div>
        {done ? (
          <><p>{t(lang, 'askSent')}</p><div className="sheet-foot"><span /><button type="button" className="copy-main" onClick={onClose}>OK</button></div></>
        ) : (
          <>
            <div className="kaji-field"><span>{t(lang, 'askKind')}</span>
              <div className="kaji-chips">{KINDS.map((k) => <button type="button" key={k.id} className="chip-btn" aria-pressed={kind === k.id} title={k.hint[lang]} onClick={() => setKind(k.id)}>{k.icon} {k.label[lang]}</button>)}</div>
              <small className="mut">{def.hint[lang]}</small></div>
            <label className="kaji-field"><span>{t(lang, 'askText')}</span><textarea rows={3} maxLength={400} value={text} onChange={(e) => { setText(e.target.value); setErr(''); }} /></label>
            {def.needsWhen ? (
              <div className="kaji-row">
                <label className="kaji-field"><span>{t(lang, 'askWhen')}</span><input type="date" value={date} onChange={(e) => { setDate(e.target.value); setErr(''); }} /></label>
                <label className="kaji-field"><span>{t(lang, 'askTime')}</span><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
              </div>
            ) : null}
            {err ? <p className="mut" role="alert">{err}</p> : null}
            <div className="sheet-foot"><button type="button" className="chip-btn" onClick={onClose}>{t(lang, 'skip')}</button><button type="submit" className="copy-main">{t(lang, 'askSend')}</button></div>
          </>
        )}
      </form>
    </div>
  );
}
