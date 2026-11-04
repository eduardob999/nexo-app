import { useInstall } from './install';
import { sleepOptions, untilLabel } from './sleep';
import type { Settings } from './settings';

interface Props { nexoCount: number; draftCount: number; settings: Settings; onSettings: (s: Settings) => void; onSleep?: (until: Date) => void }

const ITEMS = [
  { id: 'search', label: 'Search', hint: 'Find an open card', href: '#/search' },
  { id: 'nexo', label: 'Nexo', hint: 'What the assistant is working on', href: '#/nexo' },
  { id: 'notes', label: 'Notes', hint: 'Things worth keeping', href: '#/notes' },
  { id: 'money', label: 'Money', hint: 'Coming later', href: null },
  { id: 'trips', label: 'Trips', hint: 'Tickets for the trips ahead', href: '#/trips' },
  { id: 'shelf', label: 'Shelf', hint: 'Resources, done cards and closed threads', href: '#/shelf' },
] as const;

/** Todoist's Browse: everything that is not an hourly decision, one tap away. */
export function Browse({ nexoCount, draftCount, settings, onSettings, onSleep }: Props) {
  const { state: installState, install } = useInstall();
  return (
    <main className="screen">
      <header className="top"><div><span className="kicker">EVERYTHING ELSE</span><h1>Browse</h1></div></header>
      <ul className="browse panel">
        {ITEMS.map((i) => (
          <li key={i.id}>
            {i.href ? (
              <a className="browse-row" href={i.href}><span><b>{i.label}</b><small>{i.hint}</small></span>{i.id === 'nexo' && nexoCount > 0 ? <i className="badge flat">{nexoCount}</i> : null}</a>
            ) : (
              <div className="browse-row off"><span><b>{i.label}</b><small>{i.hint}</small></span></div>
            )}
          </li>
        ))}
      </ul>
      {installState !== 'installed' ? (
        <>
          <h2 className="group-title">Install</h2>
          <div className="panel settings">
            <div className="setting install">
              {installState === 'ready' ? (
                <>
                  <span>Put Nexo on your home screen</span>
                  <button className="copy-main" onClick={() => { void install(); }}>Install app</button>
                </>
              ) : installState === 'ios' ? (
                <span>Tap the Share button in Safari, then <b>Add to Home Screen</b>.</span>
              ) : (
                <span>Open your browser's menu and choose <b>Install app</b> or <b>Add to Home screen</b>.</span>
              )}
            </div>
          </div>
        </>
      ) : null}
      {onSleep ? (
        <>
          <h2 className="group-title">Pause Nexo</h2>
          <div className="panel settings">
            <div className="sleep-opts">
              {sleepOptions(new Date()).map((o) => (
                <button key={o.label} className="chip-btn" onClick={() => onSleep(o.until)}>
                  {o.label}<small>until {untilLabel(o.until, new Date())}</small>
                </button>
              ))}
            </div>
            <p className="notice">While paused it makes no calls at all, so it costs nothing. Mail checks and the nightly check-in are skipped, not queued.</p>
          </div>
        </>
      ) : null}
      <h2 className="group-title">Display</h2>
      <div className="panel settings">
        <div className="setting"><span>Theme</span>
          <div className="seg" role="group" aria-label="Theme">
            {(['auto', 'light', 'dark'] as const).map((t) => (
              <button key={t} aria-pressed={settings.theme === t} onClick={() => onSettings({ ...settings, theme: t })}>{t}</button>
            ))}
          </div>
        </div>
        <div className="setting"><span>Compact rows</span>
          <button className={`switch ${settings.compact ? 'on' : ''}`} role="switch" aria-checked={settings.compact} aria-label="Compact rows"
            onClick={() => onSettings({ ...settings, compact: !settings.compact })} />
        </div>
        <div className="setting"><span>Open on</span>
          <div className="seg" role="group" aria-label="Start screen">
            {(['today', 'upcoming'] as const).map((t) => (
              <button key={t} aria-pressed={settings.start === t} onClick={() => onSettings({ ...settings, start: t })}>{t}</button>
            ))}
          </div>
        </div>
      </div>
      <p className="notice">{draftCount} draft{draftCount === 1 ? '' : 's'} waiting in Drafts.</p>
    </main>
  );
}
