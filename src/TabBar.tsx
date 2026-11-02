const TABS = [
  { id: 'today', label: 'Today', href: '#/', d: 'M4 4h16v16H4zM9 12l2 2 4-4' },
  { id: 'nexo', label: 'Nexo', href: '#/nexo', d: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z' },
  { id: 'drafts', label: 'Drafts', href: '#/drafts', d: 'M3 6h18v12H3zM4 8l8 6 8-6' },
  { id: 'more', label: 'More', href: null, d: 'M5 12h.01M12 12h.01M19 12h.01' },
] as const;

export function TabBar({ current, draftCount = 0 }: { current: string; draftCount?: number }) {
  return (
    <nav className="tabs" aria-label="Sections">
      {TABS.map((t) => {
        const icon = (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={t.d} /></svg>
        );
        const badge = t.id === 'drafts' && draftCount > 0 ? <i className="badge">{draftCount}</i> : null;
        if (t.href === null) {
          return <button key={t.id} disabled title="Coming later">{icon}{t.label}</button>;
        }
        return (
          <a key={t.id} href={t.href} aria-current={t.id === current ? 'page' : undefined}>{icon}{t.label}{badge}</a>
        );
      })}
    </nav>
  );
}
