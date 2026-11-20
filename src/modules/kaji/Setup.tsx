import { useState } from 'react';
import { t } from './i18n';
import type { Lang } from './model';

const LANGS: { id: Lang; label: string }[] = [{ id: 'en', label: 'English' }, { id: 'es', label: 'Español' }, { id: 'ja', label: '日本語' }];

export function LangPick({ value, onChange }: { value: Lang; onChange: (l: Lang) => void }) {
  return (
    <div className="seg" role="group" aria-label="Language">
      {LANGS.map((l) => <button key={l.id} aria-pressed={value === l.id} onClick={() => onChange(l.id)} style={{ textTransform: 'none' }}>{l.label}</button>)}
    </div>
  );
}

/** First run: make the household, or join the one a person was invited to. */
export function Setup({ lang, onLang, defaultName, joinHid, onCreate, onJoin }: {
  lang: Lang; onLang: (l: Lang) => void; defaultName: string; joinHid: string | null;
  onCreate: (houseName: string, myName: string) => Promise<void>; onJoin: (hid: string, myName: string) => Promise<void>;
}) {
  const [house, setHouse] = useState('');
  const [me, setMe] = useState(defaultName);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const go = async (fn: () => Promise<void>) => {
    setBusy(true); setErr('');
    try { await fn(); } catch { setErr(lang === 'es' ? 'No se pudo. ¿Ya te invitaron con este correo?' : lang === 'ja' ? 'できませんでした。このアドレスで招待されていますか？' : 'That did not work. Were you invited with this Google address?'); }
    setBusy(false);
  };
  return (
    <form className="panel settings secret-form kaji-setup" onSubmit={(e) => { e.preventDefault(); void go(() => (joinHid ? onJoin(joinHid, me.trim()) : onCreate(house.trim() || 'Home', me.trim()))); }}>
      <div className="setting"><span><b>{joinHid ? t(lang, 'joinTitle') : t(lang, 'create')}</b><small>{joinHid ? t(lang, 'joinAbout') : t(lang, 'setupAbout')}</small></span></div>
      <div className="setting"><span>{t(lang, 'language')}</span><LangPick value={lang} onChange={onLang} /></div>
      {joinHid ? null : <label className="setting"><span>{t(lang, 'householdName')}</span><input value={house} onChange={(e) => setHouse(e.target.value)} placeholder="Casa" /></label>}
      <label className="setting"><span>{t(lang, 'yourName')}</span><input value={me} onChange={(e) => setMe(e.target.value)} /></label>
      <div className="setting"><span className="mut">{err}</span><button className="copy-main" type="submit" disabled={busy || !me.trim()}>{joinHid ? t(lang, 'join') : t(lang, 'create')}</button></div>
    </form>
  );
}

export function InviteCard({ lang, link, onInvite }: { lang: Lang; link: string; onInvite: (email: string) => Promise<void> }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const ok = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  return (
    <form className="panel settings secret-form" onSubmit={(e) => { e.preventDefault(); void onInvite(email).then(() => { setSent(true); setEmail(''); }); }}>
      <div className="setting"><span><b>{t(lang, 'inviteTitle')}</b><small>{t(lang, 'inviteAbout')}</small></span></div>
      <label className="setting"><span>Google</span><input type="email" inputMode="email" autoCapitalize="off" value={email} onChange={(e) => { setEmail(e.target.value); setSent(false); }} placeholder="name@gmail.com" /></label>
      <div className="setting"><span className="mut">{sent ? t(lang, 'invited') : ''}</span><button className="copy-main" type="submit" disabled={!ok}>{t(lang, 'invite')}</button></div>
      {sent ? <div className="setting"><span className="mut kaji-link">{link}</span><button type="button" className="chip-btn" onClick={() => { void navigator.clipboard?.writeText(link); }}>Copy</button></div> : null}
    </form>
  );
}
