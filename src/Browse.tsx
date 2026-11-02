import type { Settings } from './settings';

interface Props { nexoCount: number; draftCount: number; settings: Settings; onSettings: (s: Settings) => void }

const ITEMS = [
  { id: 'search', label: 'Search', hint: 'Find an open card', href: '#/search' },
  { id: 'nexo', label: 'Nexo', hint: 'What the assistant is working on', href: '#/nexo' },
  { id: 'notes', label: 'Notes', hint: 'Coming later', href: null },
  { id: 'money', label: 'Money', hint: 'Coming later', href: null },
  { id: 'trips', label: 'Trips', hint: 'Coming later', href: null },
  { id: 'shelf', label: 'Shelf', hint: 'Done cards and filed answers, coming later', href: null },
] as const;

/** Todoist's Browse: everything that is not an hourly decision, one tap away. */
export function Browse({ nexoCount, draftCount, settings, onSettings }: Props) {
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
