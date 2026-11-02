interface Props { nexoCount: number; draftCount: number }

const ITEMS = [
  { id: 'nexo', label: 'Nexo', hint: 'What the assistant is working on', href: '#/nexo' },
  { id: 'notes', label: 'Notes', hint: 'Coming later', href: null },
  { id: 'money', label: 'Money', hint: 'Coming later', href: null },
  { id: 'trips', label: 'Trips', hint: 'Coming later', href: null },
  { id: 'shelf', label: 'Shelf', hint: 'Done cards and filed answers, coming later', href: null },
] as const;

/** Todoist's Browse: everything that is not an hourly decision, one tap away. */
export function Browse({ nexoCount, draftCount }: Props) {
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
      <p className="notice">{draftCount} draft{draftCount === 1 ? '' : 's'} waiting in Drafts.</p>
    </main>
  );
}
