import { useState } from 'react';
import { t } from './i18n';
import type { Lang } from './model';

/** First run: make the household, or join the one a person was invited to. */
export function Setup({ lang, defaultName, joinHid, onCreate, onJoin }: {
  lang: Lang; defaultName: string; joinHid: string | null;
  onCreate: (houseName: string, myName: string) => Promise<void>; onJoin: (hid: string, myName: string) => Promise<void>;
}) {
  const [house, setHouse] = useState('');
  const [me, setMe] = useState(defaultName);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const go = async (fn: () => Promise<void>) => {
    setBusy(true); setErr('');
    try { await fn(); } catch { setErr('That did not work. Were you invited with this Google address?'); }
    setBusy(false);
  };
  return (
    <form className="panel settings secret-form kaji-setup" onSubmit={(e) => { e.preventDefault(); void go(() => (joinHid ? onJoin(joinHid, me.trim()) : onCreate(house.trim() || 'Home', me.trim()))); }}>
      <div className="setting"><span><b>{joinHid ? t(lang, 'joinTitle') : t(lang, 'create')}</b><small>{joinHid ? t(lang, 'joinAbout') : t(lang, 'setupAbout')}</small></span></div>
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
