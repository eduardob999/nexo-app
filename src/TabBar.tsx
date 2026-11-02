const TABS = [
  { id: 'today', label: 'Today', href: '#/', d: 'M4 4h16v16H4zM9 12l2 2 4-4' },
  { id: 'upcoming', label: 'Upcoming', href: '#/upcoming', d: 'M4 6h16v14H4zM4 11h16M9 3v5M15 3v5' },
  { id: 'drafts', label: 'Drafts', href: '#/drafts', d: 'M3 6h18v12H3zM4 8l8 6 8-6' },
  { id: 'browse', label: 'Browse', href: '#/browse', d: 'M4 6h16M4 12h16M4 18h10' },
] as const;

export function TabBar({ current, draftCount = 0 }: { current: string; draftCount?: number }) {
  return (
    <nav className="tabs" aria-label="Sections">
      {TABS.map((t) => {
        const icon = (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={t.d} /></svg>
        );
        const badge = t.id === 'drafts' && draftCount > 0 ? <i className="badge">{draftCount}</i> : null;
        return (
          <a key={t.id} href={t.href} aria-current={t.id === current ? 'page' : undefined}>{icon}{t.label}{badge}</a>
        );
      })}
    </nav>
  );
}
