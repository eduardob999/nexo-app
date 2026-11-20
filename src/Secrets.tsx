import { useEffect, useState } from 'react';
import { PRESETS, clean, defaults, problem, sendSecret, watchStored, type SecretPreset } from './secrets';

function when(iso: string | undefined): string {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
}

function One({ uid, preset, stored }: { uid: string; preset: SecretPreset; stored: string | undefined }) {
  const [vals, setVals] = useState<Record<string, string>>(() => defaults(preset));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const submit = async () => {
    const fields = clean(preset, vals);
    const bad = problem(preset.name, fields);
    if (bad) { setMsg(bad); return; }
    setBusy(true); setMsg('');
    try {
      await sendSecret(uid, preset.name, fields);
      setVals(defaults(preset));
      setMsg('Sent. It is stored on your computer within a minute and removed from the cloud.');
    } catch { setMsg('Could not send. Check the connection and try again.'); }
    setBusy(false);
  };
  return (
    <form className="panel settings secret-form" onSubmit={(e) => { e.preventDefault(); void submit(); }} autoComplete="off">
      <div className="setting"><span><b>{preset.title}</b><small>{preset.about}</small></span></div>
      {preset.fields.map((f) => (
        <label className="setting" key={f.key}>
          <span>{f.label}</span>
          <input type={f.type === 'password' ? 'password' : f.type === 'url' ? 'url' : 'text'} value={vals[f.key] ?? ''} placeholder={f.hint ?? ''}
            autoComplete={f.type === 'password' ? 'new-password' : 'off'} autoCapitalize="off" autoCorrect="off" spellCheck={false}
            onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })} />
        </label>
      ))}
      <div className="setting">
        <span className="mut">{stored ? `Stored on your computer ${when(stored)}` : 'Not stored yet'}</span>
        <button className="copy-main" type="submit" disabled={busy}>{busy ? 'Sending' : stored ? 'Replace' : 'Send'}</button>
      </div>
      {msg ? <p className="notice" role="status">{msg}</p> : null}
    </form>
  );
}

/** Write-only: the app never shows a secret again, only when the computer stored it. */
export function Secrets({ uid }: { uid: string }) {
  const [stored, setStored] = useState<Record<string, string>>({});
  useEffect(() => watchStored(uid, setStored), [uid]);
  return (
    <>
      <h2 className="group-title">Secrets</h2>
      {PRESETS.map((p) => <One key={p.name} uid={uid} preset={p} stored={stored[p.name]} />)}
      <p className="notice">Passwords go straight to your computer. They are never put on a card or in the repo, and the app cannot show them again.</p>
    </>
  );
}
